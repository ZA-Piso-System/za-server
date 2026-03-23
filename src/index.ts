import env from "@/common/env.type";
import { DeviceSessionStatus } from "@/common/types/device-session.type";
import { DeviceStatus } from "@/common/types/device.type";
import { CustomWebscoket } from "@/common/types/websocket.type";
import db from "@/db";
import { devices, deviceSessions } from "@/db/schemas";
import { auth } from "@/lib/auth";
import { clients } from "@/lib/clients";
import { eventHandler } from "@/lib/event-handler";
import { logger } from "@/lib/pino.lib";
import { authMiddleware } from "@/middlewares/auth.middleware";
import adminAccountRoute from "@/routes/admin/account.route";
import adminDashboardRoute from "@/routes/admin/dashboard.route";
import adminDevicesRoute from "@/routes/admin/devices.route";
import devicesRoute from "@/routes/devices.route";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use(
  "*",
  cors({
    origin: env.ALLOWED_ORIGINS.split(","),
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// better auth
app.on(["POST", "GET"], "/api/v1/auth/*", (c) => auth.handler(c.req.raw));

// public routes
app.route("/api/v1", devicesRoute);

// admin routes
app.use("/api/v1/admin/*", authMiddleware);
app.route("/api/v1/admin/account", adminAccountRoute);
app.route("/api/v1/admin/dashboard", adminDashboardRoute);
app.route("/api/v1/admin/devices", adminDevicesRoute);

// websocket
app.get(
  "/ws",
  upgradeWebSocket((c) => {
    return {
      onMessage(event, ws) {
        eventHandler(JSON.parse(event.data.toString()), ws);
      },
      onClose: async (_, ws: CustomWebscoket) => {
        if (!ws.deviceId) return;
        const client = clients.get(ws.deviceId);
        if (!client) return;

        logger.info({ id: client.id }, "Device offline");

        await db
          .update(devices)
          .set({ status: DeviceStatus.Offline })
          .where(eq(devices.id, client.id));

        const pendingOrActiveSession = await db.query.deviceSessions.findFirst({
          where: and(
            eq(deviceSessions.deviceId, client.id),
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
          const startAt = pendingOrActiveSession.startAt;
          const endAt = pendingOrActiveSession.endAt;

          if (startAt && endAt) {
            const remainingMs = Math.max(0, endAt.getTime() - Date.now());

            if (remainingMs <= 0) {
              logger.info(
                { id: client.id },
                "Already expired. Updating device session to Expired",
              );

              await db
                .update(deviceSessions)
                .set({
                  status: DeviceSessionStatus.Expired,
                })
                .where(eq(deviceSessions.id, pendingOrActiveSession.id));
            }
          }
        }
      },
    };
  }),
);

const server = serve(
  {
    fetch: app.fetch,
    port: 5000,
  },
  (info) => {
    logger.info(`Server is running on http://localhost:${info.port}`);
  },
);

injectWebSocket(server);
