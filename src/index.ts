import { auth } from "@/lib/auth";
import { clients } from "@/lib/clients";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { WSContext } from "hono/ws";
import clientsRoute from "@/routes/clients.route";
import accountRoute from "@/routes/account.route";
import { ClientEvent } from "@/common/types/client-event.type";
import { ServerEvent } from "@/common/types/server-event.type";
import { Client } from "@/common/types/client.type";
import env from "@/common/env.type";

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

app.on(["POST", "GET"], "/api/v1/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/v1", clientsRoute);
app.route("/api/v1", accountRoute);

app.get(
  "/ws",
  upgradeWebSocket((c) => {
    return {
      onMessage(event, ws) {
        handleEvent(JSON.parse(event.data.toString()), ws);
      },
      onClose: () => {
        console.log("Connection closed");
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
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);

// TODO:
const handleEvent = (
  event: { type: string; payload?: unknown },
  ws: WSContext<WebSocket>,
): void => {
  switch (event.type) {
    case ClientEvent.Ready:
      {
        const payload = event.payload as Client;
        clients.set(payload.deviceId, { ws, ...payload });
        ws.send(
          JSON.stringify({
            type: ServerEvent.Ack,
            payload: {},
          }),
        );
      }
      break;
    case ClientEvent.Heartbeat:
      {
        const payload = event.payload as Client;
        clients.set(payload.deviceId, { ws, ...payload });
      }
      break;
    default:
      console.warn("unknown event", event.type);
  }
};

injectWebSocket(server);
