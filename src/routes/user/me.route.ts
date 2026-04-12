import { UseTimeSchema } from "@/common/schemas/me.schema";
import { DeviceSessionStatus } from "@/common/types/device-session.type";
import { DeviceStatus } from "@/common/types/device.type";
import { SessionEvent } from "@/common/types/session-event.type";
import { Session } from "@/common/types/session.type";
import db from "@/db";
import { devices, deviceSessions, pointsPackages, users } from "@/db/schemas";
import { auth } from "@/lib/auth";
import { clients } from "@/lib/clients";
import { logger } from "@/lib/pino.lib";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import wakeonlan from "wakeonlan";

type Env = {
  Variables: {
    user: typeof auth.$Infer.Session.user;
  };
};

const route = new Hono<Env>();

route.get("/balance", async (c) => {
  const user = c.get("user");

  const result = await db.query.users.findFirst({
    columns: {
      balanceSeconds: true,
      points: true,
    },
    where: eq(users.id, user.id),
  });

  return c.json(result);
});

// TODO: refactor
route.post("/use-time", async (c) => {
  const user = c.get("user");
  const parsedData = UseTimeSchema.parse(await c.req.json());

  const result = await db.query.users.findFirst({
    columns: {
      balanceSeconds: true,
    },
    where: eq(users.id, user.id),
  });

  const id = parsedData.id;
  const seconds = result?.balanceSeconds ?? 0;

  await db
    .update(users)
    .set({ balanceSeconds: 0 })
    .where(eq(users.id, user.id));

  logger.info({ id }, "Use Time API");

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

      await db
        .insert(deviceSessions)
        .values({
          deviceId: device.id,
          status: DeviceSessionStatus.Pending,
          allocatedSeconds: seconds,
        })
        .returning();
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

    await db
      .update(devices)
      .set({
        status: DeviceStatus.Starting,
      })
      .where(eq(devices.id, device.id));

    logger.info(
      {
        deviceNumber: device.deviceNumber,
        type: device.type,
      },
      "Turning on device",
    );
    wakeonlan(device.macAddress);
  }

  if (device.status === DeviceStatus.Starting) {
    logger.info(
      {
        deviceNumber: device.deviceNumber,
        type: device.type,
      },
      "Device is starting",
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

      await db
        .insert(deviceSessions)
        .values({
          deviceId: device.id,
          status: DeviceSessionStatus.Pending,
          allocatedSeconds: seconds,
        })
        .returning();
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

      await db
        .insert(deviceSessions)
        .values({
          deviceId: device.id,
          status: DeviceSessionStatus.Active,
          allocatedSeconds: seconds,
          startAt,
          endAt,
        })
        .returning();
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

route.post("/stop-time", async (c) => {
  const user = c.get("user");
  const parsedData = UseTimeSchema.parse(await c.req.json());

  const id = parsedData.id;

  logger.info({ id }, "Stop Time API");

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
          userId: user.id,
          deviceNumber: device.deviceNumber,
          type: device.type,
        },
        "Updating balance seconds",
      );
      const remainingMs = Math.max(0, endAt.getTime() - Date.now());
      const remainingSeconds = Math.ceil(remainingMs / 1000);

      await db
        .update(deviceSessions)
        .set({
          status: DeviceSessionStatus.Terminated,
        })
        .where(eq(deviceSessions.id, pendingOrActiveSession.id));

      await db
        .update(users)
        .set({
          balanceSeconds: sql`${users.balanceSeconds} + ${remainingSeconds}`,
        })
        .where(eq(users.id, user.id));
    }
  }

  const serverClient = clients.get(id);

  if (serverClient) {
    serverClient.ws.send(
      JSON.stringify({
        type: SessionEvent.Stop,
      }),
    );
  }

  return c.json({ message: "Time stopped successfully." });
});

route.post("/points-packages/:id/redeem", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  logger.info({ id }, "Points Packages Redeem API");

  try {
    await db.transaction(async (tx) => {
      const pkg = await tx.query.pointsPackages.findFirst({
        where: eq(pointsPackages.id, id),
      });

      if (!pkg) {
        throw new Error("Package not found");
      }

      const balance = await tx.query.users.findFirst({
        columns: {
          balanceSeconds: true,
          points: true,
        },
        where: eq(users.id, user.id),
      });

      if (!balance) {
        throw new Error("User nout found");
      }

      if (balance.points < pkg.pointsCost) {
        throw new Error("Not enough points");
      }

      await tx
        .update(users)
        .set({
          balanceSeconds: sql`${users.balanceSeconds} + ${pkg.timeSeconds}`,
          points: balance.points - pkg.pointsCost,
        })
        .where(eq(users.id, user.id));
    });

    return c.json({ message: "Points package redeemed successfully." });
  } catch (error) {
    logger.error(error);

    return c.json(
      {
        message: "Something went wrong",
      },
      500,
    );
  }
});

export default route;
