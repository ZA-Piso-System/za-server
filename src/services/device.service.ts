import { DeviceSessionStatus } from "@/common/types/device-session.type";
import { DeviceStatus } from "@/common/types/device.type";
import { SessionEvent } from "@/common/types/session-event.type";
import { Session } from "@/common/types/session.type";
import db from "@/db";
import { devices, deviceSessions } from "@/db/schemas";
import { clients } from "@/lib/clients";
import CustomError from "@/lib/error";
import { logger } from "@/lib/pino.lib";
import { and, eq, inArray } from "drizzle-orm";
import wakeonlan from "wakeonlan";

export const addTime = async (
  deviceId: string,
  seconds: number,
  source: "add-time" | "insert-coin",
) => {
  logger.debug({ deviceId, seconds, source }, "Adding time to device");

  if (seconds <= 0) {
    logger.debug({ deviceId }, "Invalid time provided");
    throw new CustomError("Invalid time provided", 400);
  }

  const device = await db.query.devices.findFirst({
    where: eq(devices.id, deviceId),
  });

  if (!device) {
    logger.debug({ deviceId }, "Device not found");
    throw new CustomError("Device not found", 400);
  }

  if (!device.macAddress || device.status === DeviceStatus.Pending) {
    logger.debug({ deviceId }, "Unregistered device");
    throw new CustomError("Unregistered device", 400);
  }

  let pendingOrActiveSession = await db.query.deviceSessions.findFirst({
    where: and(
      eq(deviceSessions.deviceId, deviceId),
      inArray(deviceSessions.status, [
        DeviceSessionStatus.Pending,
        DeviceSessionStatus.Active,
      ]),
    ),
  });

  if (pendingOrActiveSession) {
    logger.debug(
      {
        deviceId,
        deviceNumber: device.deviceNumber,
        type: device.type,
      },
      "Session found. Checking remaining time.",
    );

    const startAt = pendingOrActiveSession.startAt;
    const endAt = pendingOrActiveSession.endAt;

    if (startAt && endAt) {
      const remainingMs = Math.max(0, endAt.getTime() - Date.now());

      if (remainingMs <= 0) {
        logger.debug(
          {
            deviceId,
            deviceNumber: device.deviceNumber,
            type: device.type,
          },
          "Session already expired. Updating device session status to expired.",
        );

        await db
          .update(deviceSessions)
          .set({
            status: DeviceSessionStatus.Expired,
          })
          .where(eq(deviceSessions.id, pendingOrActiveSession.id));

        pendingOrActiveSession = undefined;
      }
    }
  }

  if (!pendingOrActiveSession) {
    logger.debug(
      {
        deviceId,
        deviceNumber: device.deviceNumber,
        type: device.type,
      },
      "No pending or active session found. Creating a new session.",
    );

    [pendingOrActiveSession] = await db
      .insert(deviceSessions)
      .values({
        deviceId,
        status: DeviceSessionStatus.Pending,
        allocatedSeconds: 0,
      })
      .returning();
  }

  let status = pendingOrActiveSession.status;
  let startAt: Date | null = null;
  let endAt: Date | null = null;

  const allocatedSeconds = pendingOrActiveSession.allocatedSeconds + seconds;

  if (device.status === DeviceStatus.Offline) {
    endAt = pendingOrActiveSession.endAt
      ? new Date(pendingOrActiveSession.endAt.getTime() + seconds * 1_000)
      : null;

    await db
      .update(devices)
      .set({
        status: DeviceStatus.Starting,
      })
      .where(eq(devices.id, deviceId));

    logger.debug(
      {
        deviceId,
        deviceNumber: device.deviceNumber,
        type: device.type,
      },
      "Turning on device",
    );

    wakeonlan(device.macAddress);
  }

  if (device.status === DeviceStatus.Starting) {
    endAt = pendingOrActiveSession.endAt
      ? new Date(pendingOrActiveSession.endAt.getTime() + seconds * 1_000)
      : null;
  }

  if (device.status === DeviceStatus.Online) {
    status = DeviceSessionStatus.Active;

    startAt = pendingOrActiveSession.startAt
      ? pendingOrActiveSession.startAt
      : new Date();

    endAt = pendingOrActiveSession.endAt
      ? new Date(pendingOrActiveSession.endAt.getTime() + seconds * 1_000)
      : new Date(startAt.getTime() + seconds * 1_000);
  }

  await db
    .update(deviceSessions)
    .set({
      status,
      allocatedSeconds,
      startAt,
      endAt,
    })
    .where(eq(deviceSessions.id, pendingOrActiveSession.id));

  const serverClient = clients.get(deviceId);

  if (serverClient) {
    logger.debug(
      {
        deviceId,
        deviceNumber: device.deviceNumber,
        type: device.type,
        session: { startAt, endAt },
      },
      "Sending session",
    );

    serverClient.ws.send(
      JSON.stringify({
        type: SessionEvent.AddTime,
        payload: {
          startAt: startAt?.getTime() ?? null,
          endAt: endAt?.getTime() ?? null,
        } satisfies Session,
      }),
    );
  }

  logger.debug({ deviceId, seconds, source }, "Device time updated");

  return pendingOrActiveSession;
};
