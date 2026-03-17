import { auth } from "@/lib/auth";
import { Hono } from "hono";

const route = new Hono();

route.post("/set-password", async (c) => {
  const { password } = await c.req.json();

  await auth.api.setPassword({
    body: {
      newPassword: password,
    },
    headers: c.req.raw.headers,
  });

  return c.json({ message: "Password updated successfully." });
});

export default route;
