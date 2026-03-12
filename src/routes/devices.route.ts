import { SessionEvents } from "@/common/constants/session-events.constant";
import { clients } from "@/lib/clients";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { Hono } from "hono";

const route = new Hono();

route.use("*", authMiddleware);

route.get("/devices", async (c) => {
  return c.json({
    items: Array.from(clients, ([id, value]) => ({
      id,
      status: "todo",
    })),
  });
});

route.post("/devices/:id/add-time", async (c) => {
  const id = c.req.param("id");
  const { seconds } = await c.req.json();

  const ws = clients.get(id);

  if (!ws) {
    return c.json({ message: "PC not connected" }, 404);
  }

  ws.send(
    JSON.stringify({
      type: SessionEvents.AddTime,
      payload: seconds,
    }),
  );

  return c.json({ message: "Time added successfully." });
});

route.post("/devices/:id/stop", async (c) => {
  const id = c.req.param("id");

  const ws = clients.get(id);

  if (!ws) {
    return c.json({ message: "PC not connected" }, 404);
  }

  ws.send(
    JSON.stringify({
      type: SessionEvents.Stop,
    }),
  );

  return c.json({ message: "Session stopped successfully." });
});

export default route;
