import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import type { WSContext } from "hono/ws";
import { startDiscoveryServer } from "./discovery.js";
import { cors } from "hono/cors";

const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

const clients = new Map<string, WSContext<WebSocket>>();

app.use(
  "*",
  cors({
    origin: "http://localhost:3000",
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.get("/", (c) => {
  return c.json({
    message: "cool",
  });
});

app.get("/devices", (c) => {
  return c.json({
    items: Array.from(clients, ([id, value]) => ({
      id,
      status: "todo",
    })),
  });
});

app.post("/devices/:id/add-time", async (c) => {
  const id = c.req.param("id");
  const { seconds } = await c.req.json();

  const ws = clients.get(id);

  if (!ws) {
    return c.json({ error: "PC not connected" }, 404);
  }

  ws.send(
    JSON.stringify({
      type: "session:add-time",
      payload: seconds,
    }),
  );

  return c.json({ success: true });
});

app.post("/admin/stop", async (c) => {
  const { deviceId, seconds } = await c.req.json();

  const ws = clients.get(deviceId);

  if (!ws) {
    return c.json({ error: "PC not connected" }, 404);
  }

  ws.send(
    JSON.stringify({
      type: "session:stop",
      payload: seconds,
    }),
  );

  return c.json({ success: true });
});

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

const handleEvent = (
  event: { type: string; payload?: unknown },
  ws: WSContext<WebSocket>,
): void => {
  switch (event.type) {
    case "client:ready":
      clients.set(event.payload as string, ws);
      console.log("new client connected", event.payload);
      break;
    default:
      console.warn("unknown event", event.type);
  }
};

startDiscoveryServer();

injectWebSocket(server);
