import env from "@/common/env.type";
import { InsertCoinLogSchema } from "@/common/schemas/coin-log.schema";
import { UserParamsSchema } from "@/common/schemas/user.schema";
import db from "@/db";
import { userCoinLogs, users } from "@/db/schemas";
import { logger } from "@/lib/pino.lib";
import { eq, ilike, sql } from "drizzle-orm";
import { Hono } from "hono";

const route = new Hono();

route.get("/users", async (c) => {
  const { username } = UserParamsSchema.parse(c.req.query());

  const rows = await db.query.users.findMany({
    where: ilike(users.username, `%${username}%`),
    columns: {
      id: true,
      username: true,
    },
  });

  return c.json({
    items: rows,
  });
});

// TODO: refactor
route.post("/users/:id/topup", async (c) => {
  const apiKey = c.req.raw.headers.get("x-api-key");
  if (apiKey !== env.COIN_SLOT_SECRET) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  const parsedData = InsertCoinLogSchema.parse(await c.req.json());
  const seconds = parsedData.amount * 4 * 60;

  logger.info({ id, amount: parsedData.amount }, "Top Up API");

  if (seconds <= 0) {
    logger.info({ id }, "Invalid time");
    return c.json({ message: "Invalid time" }, 400);
  }

  await db
    .update(users)
    .set({
      balanceSeconds: sql`${users.balanceSeconds} + ${seconds}`,
      points: sql`${users.points} + ${parsedData.amount}`,
    })
    .where(eq(users.id, id));

  await db.insert(userCoinLogs).values({
    userId: id,
    amount: parsedData.amount,
  });

  return c.json({ message: "Time added successfully." });
});

export default route;
