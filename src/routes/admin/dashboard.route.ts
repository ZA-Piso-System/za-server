import db from "@/db";
import { coinLogs } from "@/db/schemas";
import { endOfDay, startOfDay } from "date-fns";
import { and, gte, lte, sum } from "drizzle-orm";
import { Hono } from "hono";

const route = new Hono();

route.get("/", async (c) => {
  const [result] = await db
    .select({ today: sum(coinLogs.amount) })
    .from(coinLogs)
    .where(
      and(
        gte(coinLogs.createdAt, startOfDay(new Date())),
        lte(coinLogs.createdAt, endOfDay(new Date())),
      ),
    );

  return c.json({
    revenue: {
      today: Number(result.today),
    },
  });
});

export default route;
