import env from "@/common/env.type";
import { RegisterDeviceSchema } from "@/common/schemas/device.schema";
import { DeviceSessionStatus } from "@/common/types/device-session.type";
import { DeviceStatus } from "@/common/types/device.type";
import { SessionEvent } from "@/common/types/session-event.type";
import { Session } from "@/common/types/session.type";
import db from "@/db";
import { devices, deviceSessions } from "@/db/schemas";
import { clients } from "@/lib/clients";
import { logger } from "@/lib/pino.lib";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";
import wakeonlan from "wakeonlan";

const route = new Hono();

route.get("/devices", async (c) => {
  const devices = await db.query.devices.findMany({
    with: {
      deviceSessions: {
        where: inArray(deviceSessions.status, [
          DeviceSessionStatus.Pending,
          DeviceSessionStatus.Active,
        ]),
      },
    },
  });

  return c.json({
    items: devices,
  });
});

route.post("/devices/register", async (c) => {
  const parsedData = RegisterDeviceSchema.parse(await c.req.json());

  const existingDevice = await db.query.devices.findFirst({
    where: and(
      isNull(devices.macAddress),
      eq(devices.registrationToken, parsedData.registrationToken),
    ),
  });

  if (!existingDevice) {
    return c.json({ message: "Device not found." }, 404);
  }

  const [updatedDevice] = await db
    .update(devices)
    .set({
      macAddress: parsedData.macAddress,
      status: DeviceStatus.Offline,
    })
    .where(eq(devices.id, existingDevice.id))
    .returning();

  return c.json({
    message: "Device registered successfully.",
    data: {
      id: updatedDevice.id,
      deviceNumber: updatedDevice.deviceNumber,
      macAddress: updatedDevice.macAddress,
      type: updatedDevice.type,
    },
  });
});

route.post("/devices/:id/insert-coin", async (c) => {
  // TODO: improve
  const apiKey = c.req.raw.headers.get("x-api-key");
  if (apiKey !== env.COIN_SLOT_SECRET) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");
  const { coins } = await c.req.json();
  const seconds = coins * 4 * 60;

  logger.info({ id }, "Insert Coin API");

  if (seconds <= 0) {
    logger.info({ id }, "Invalid time");
    return c.json({ message: "Invalid time" }, 400);
  }

  const device = await db.query.devices.findFirst({
    where: eq(devices.id, id),
  });

  if (!device) {
    logger.info({ id }, "Device not found");
    return c.json({ message: "Device not found." }, 404);
  }

  if (!device.macAddress || device.status === DeviceStatus.Pending) {
    logger.info(
      {
        deviceNumber: device.deviceNumber,
        type: device.type,
      },
      "Device is not registered",
    );
    return c.json({ message: "Device is not registered." }, 404);
  }

  let pendingOrActiveSession = await db.query.deviceSessions.findFirst({
    where: and(
      eq(deviceSessions.deviceId, device.id),
      inArray(deviceSessions.status, [
        DeviceSessionStatus.Pending,
        DeviceSessionStatus.Active,
      ]),
    ),
  });

  if (
    pendingOrActiveSession &&
    pendingOrActiveSession.status === DeviceSessionStatus.Active
  ) {
    logger.info(
      {
        deviceNumber: device.deviceNumber,
        type: device.type,
      },
      "Device session is Active",
    );

    const startAt = pendingOrActiveSession.startAt;
    const endAt = pendingOrActiveSession.endAt;

    if (startAt && endAt) {
      logger.info(
        {
          deviceNumber: device.deviceNumber,
          type: device.type,
        },
        "Checking remaining time",
      );
      const remainingMs = Math.max(0, endAt.getTime() - Date.now());

      if (remainingMs <= 0) {
        logger.info(
          {
            deviceNumber: device.deviceNumber,
            type: device.type,
          },
          "Already expired. Updating device session to Expired",
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

  if (device.status === DeviceStatus.Offline) {
    logger.info(
      {
        deviceNumber: device.deviceNumber,
        type: device.type,
      },
      "Device is offline",
    );

    // No pending/active session
    if (!pendingOrActiveSession) {
      logger.info(
        {
          deviceNumber: device.deviceNumber,
          type: device.type,
          seconds,
        },
        "No pending/active session. Creating new Pending session.",
      );

      await db.insert(deviceSessions).values({
        deviceId: device.id,
        status: DeviceSessionStatus.Pending,
        allocatedSeconds: seconds,
      });
    } else {
      logger.info(
        {
          deviceNumber: device.deviceNumber,
          type: device.type,
          seconds,
        },
        "Found pending/active session. Updating it.",
      );

      // Has pending/active then update allocatedSeconds & endAt
      const allocatedSeconds =
        pendingOrActiveSession.allocatedSeconds + seconds;

      const endAt = pendingOrActiveSession.endAt
        ? new Date(pendingOrActiveSession.endAt.getTime() + seconds * 1_000)
        : null;

      await db
        .update(deviceSessions)
        .set({
          allocatedSeconds,
          endAt,
        })
        .where(eq(deviceSessions.id, pendingOrActiveSession.id));
    }

    logger.info(
      {
        deviceNumber: device.deviceNumber,
        type: device.type,
      },
      "Turning on device",
    );
    wakeonlan(device.macAddress);
  }

  if (device.status === DeviceStatus.Online) {
    logger.info(
      {
        deviceNumber: device.deviceNumber,
        type: device.type,
      },
      "Device is online",
    );

    let startAt: Date | null = null;
    let endAt: Date | null = null;

    // No pending/active session
    if (!pendingOrActiveSession) {
      logger.info(
        {
          deviceNumber: device.deviceNumber,
          type: device.type,
          seconds,
        },
        "No pending/active session. Creating new session.",
      );

      startAt = new Date();
      endAt = new Date(startAt.getTime() + seconds * 1_000);

      await db.insert(deviceSessions).values({
        deviceId: device.id,
        status: DeviceSessionStatus.Active,
        allocatedSeconds: seconds,
        startAt,
        endAt,
      });
    } else {
      logger.info(
        {
          deviceNumber: device.deviceNumber,
          type: device.type,
          seconds,
        },
        "Found pending/active session. Updating it.",
      );

      // Has pending/active then update allocatedSeconds & endAt
      const allocatedSeconds =
        pendingOrActiveSession.allocatedSeconds + seconds;

      startAt = pendingOrActiveSession.startAt;
      endAt = pendingOrActiveSession.endAt
        ? new Date(pendingOrActiveSession.endAt.getTime() + seconds * 1_000)
        : null;

      await db
        .update(deviceSessions)
        .set({
          allocatedSeconds,
          endAt,
        })
        .where(eq(deviceSessions.id, pendingOrActiveSession.id));
    }

    const serverClient = clients.get(id);

    if (serverClient) {
      logger.info(
        {
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
  }

  return c.json({ message: "Time added successfully." });
});

export default route;
