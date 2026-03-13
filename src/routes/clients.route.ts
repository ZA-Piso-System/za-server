import { Client } from "@/common/types/client.type";
import { SessionEvent } from "@/common/types/session-event.type";
import { clients } from "@/lib/clients";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { Hono } from "hono";

const route = new Hono();

route.use("*", authMiddleware);

route.get("/clients", async (c) => {
  return c.json({
    items: Array.from(
      clients,
      ([_, value]) =>
        ({
          deviceId: value.deviceId,
          pcNo: value.pcNo,
          status: value.status,
          startAt: value.startAt,
          endAt: value.endAt,
          remainingSeconds: value.remainingSeconds,
          lastSeen: value.lastSeen,
        }) satisfies Client,
    ),
  });
});

route.get("/clients/:id", async (c) => {
  const id = c.req.param("id");

  const serverClient = clients.get(id);

  if (!serverClient) {
    return c.json({ message: "PC not connected" }, 404);
  }

  return c.json({
    deviceId: serverClient.deviceId,
    pcNo: serverClient.pcNo,
    status: serverClient.status,
    startAt: serverClient.startAt,
    endAt: serverClient.endAt,
    remainingSeconds: serverClient.remainingSeconds,
    lastSeen: serverClient.lastSeen,
  } satisfies Client);
});

route.post("/clients/:id/add-time", async (c) => {
  const id = c.req.param("id");
  const { seconds } = await c.req.json();

  const serverClient = clients.get(id);

  if (!serverClient) {
    return c.json({ message: "PC not connected" }, 404);
  }

  serverClient.ws.send(
    JSON.stringify({
      type: SessionEvent.AddTime,
      payload: seconds,
    }),
  );

  return c.json({ message: "Time added successfully." });
});

route.post("/clients/:id/stop", async (c) => {
  const id = c.req.param("id");

  const serverClient = clients.get(id);

  if (!serverClient) {
    return c.json({ message: "PC not connected" }, 404);
  }

  serverClient.ws.send(
    JSON.stringify({
      type: SessionEvent.Stop,
    }),
  );

  return c.json({ message: "Session stopped successfully." });
});

export default route;
