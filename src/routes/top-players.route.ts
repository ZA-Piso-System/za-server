import db from "@/db";
import { userCoinLogs, users } from "@/db/schemas";
import { endOfMonth, startOfMonth } from "date-fns";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { Hono } from "hono";

const route = new Hono();

route.get("/", async (c) => {
  const totalTopup = sql<number>`SUM(${userCoinLogs.amount})`.mapWith(Number);

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      totalTopup,
    })
    .from(userCoinLogs)
    .where(
      and(
        gte(userCoinLogs.createdAt, startOfMonth(new Date())),
        lte(userCoinLogs.createdAt, endOfMonth(new Date())),
      ),
    )
    .innerJoin(users, eq(users.id, userCoinLogs.userId))
    .groupBy(users.id, users.username)
    .orderBy(desc(totalTopup))
    .limit(5);

  return c.json({
    items: rows,
  });
});

export default route;
