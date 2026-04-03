import { Role } from "@/common/types/role.type";
import { auth } from "@/lib/auth";
import { createMiddleware } from "hono/factory";

export const adminMiddleware = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  if (session.user.role !== Role.Admin) {
    return c.json({ message: "Forbidden" }, 403);
  }

  await next();
});
