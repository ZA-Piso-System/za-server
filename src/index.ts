import { auth } from "@/lib/auth";
import { clients } from "@/lib/clients";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { WSContext } from "hono/ws";
import devicesRoute from "@/routes/devices.route";
import { ClientEvents } from "@/common/constants/client-events.constant";

const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use(
  "*",
  cors({
    origin: ["http://localhost:3000"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/v1/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/v1", devicesRoute);

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
    case ClientEvents.Ready:
      clients.set(event.payload as string, ws);
      console.log("new client connected", event.payload);
      break;
    case ClientEvents.Heartbeat:
      // clients.set(event.payload.id, { ws, ...event.payload });
      break;
    default:
      console.warn("unknown event", event.type);
  }
};

injectWebSocket(server);
