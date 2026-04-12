import db from "@/db";
import { pointsPackages } from "@/db/schemas";
import { auth } from "@/lib/auth";
import { asc } from "drizzle-orm";
import { Hono } from "hono";

type Env = {
  Variables: {
    user: typeof auth.$Infer.Session.user;
  };
};

const route = new Hono<Env>();

route.get("/", async (c) => {
  const rows = await db.query.pointsPackages.findMany({
    orderBy: asc(pointsPackages.displayOrder),
  });

  return c.json({
    items: rows,
  });
});

export default route;
