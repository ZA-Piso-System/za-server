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
import { addTime } from "@/services/device.service";
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

  logger.info({ id }, "Use Time API");

  await db
    .update(users)
    .set({ balanceSeconds: 0 })
    .where(eq(users.id, user.id));

  const session = await addTime(id, seconds, "use-time");

  await db
    .update(deviceSessions)
    .set({ userId: user.id })
    .where(eq(deviceSessions.id, session.id));

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
    logger.debug({ id }, "Device not found");
    return c.json({ message: "Device not found." }, 404);
  }

  if (!device.macAddress || device.status === DeviceStatus.Pending) {
    logger.debug(
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
    logger.debug(
      {
        deviceNumber: device.deviceNumber,
        type: device.type,
      },
      "Device session is Active",
    );

    const startAt = pendingOrActiveSession.startAt;
    const endAt = pendingOrActiveSession.endAt;

    if (startAt && endAt) {
      logger.debug(
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
