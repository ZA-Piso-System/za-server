import db from "@/db";
import { pointsPackages } from "@/db/schemas";
import { asc } from "drizzle-orm";
import { Hono } from "hono";

const route = new Hono();

route.get("/", async (c) => {
  const rows = await db.query.pointsPackages.findMany({
    orderBy: asc(pointsPackages.displayOrder),
  });

  return c.json({
    items: rows,
  });
});

export default route;
