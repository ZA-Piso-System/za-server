import { InsertDeviceSchema } from "@/common/schemas/device.schema";
import { DeviceSessionStatus } from "@/common/types/device-session.type";
import { DeviceStatus, DeviceType } from "@/common/types/device.type";
import { SessionEvent } from "@/common/types/session-event.type";
import { Session } from "@/common/types/session.type";
import db from "@/db";
import { deviceSessions } from "@/db/schemas";
import { devices } from "@/db/schemas/devices.schema";
import { clients } from "@/lib/clients";
import { logger } from "@/lib/pino.lib";
import { randomBytes } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import wakeonlan from "wakeonlan";

const route = new Hono();

route.post("/", async (c) => {
  const parsedData = InsertDeviceSchema.parse(await c.req.json());

  const [device] = await db
    .insert(devices)
    .values({
      deviceNumber: parsedData.deviceNumber,
      type: parsedData.type as DeviceType,
      registrationToken: randomBytes(4).toString("hex"),
    })
    .returning();

  return c.json({ message: "Device created successfully.", data: device });
});

route.get("/:id", async (c) => {
  const id = c.req.param("id");

  const device = await db.query.devices.findFirst({
    where: eq(devices.id, id),
    with: {
      deviceSessions: {
        where: inArray(deviceSessions.status, [
          DeviceSessionStatus.Pending,
          DeviceSessionStatus.Active,
        ]),
      },
    },
  });

  return c.json(device);
});

route.post("/:id/add-time", async (c) => {
  const id = c.req.param("id");
  const { seconds } = await c.req.json();

  logger.info({ id }, "Add Time API");

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

  const pendingOrActiveSession = await db.query.deviceSessions.findFirst({
    where: and(
      eq(deviceSessions.deviceId, device.id),
      inArray(deviceSessions.status, [
        DeviceSessionStatus.Pending,
        DeviceSessionStatus.Active,
      ]),
    ),
  });

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

route.post("/:id/stop", async (c) => {
  const id = c.req.param("id");

  logger.info({ id }, "Stop session API");

  logger.info({ id }, "Updating session to Terminated");
  await db
    .update(deviceSessions)
    .set({
      status: DeviceSessionStatus.Terminated,
    })
    .where(
      and(
        eq(deviceSessions.deviceId, id),
        eq(deviceSessions.status, DeviceSessionStatus.Active),
      ),
    );

  const serverClient = clients.get(id);

  if (serverClient) {
    serverClient.ws.send(
      JSON.stringify({
        type: SessionEvent.Stop,
      }),
    );
  }

  return c.json({ message: "Session stopped successfully." });
});

export default route;
