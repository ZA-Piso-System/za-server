import { CoinLogSearchParamsSchema } from "@/common/schemas/coin-log.schema";
import db from "@/db";
import { coinLogs } from "@/db/schemas";
import { endOfDay, startOfDay, startOfWeek } from "date-fns";
import { and, desc, gte, lte, sql, sum } from "drizzle-orm";
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

route.get("/sales-overview", async (c) => {
  const today = new Date();
  const weekStart = startOfWeek(today);

  const result = await db
    .select({
      label: sql<string>`TO_CHAR(created_at, 'Dy')`,
      value: sum(coinLogs.amount).mapWith(Number),
    })
    .from(coinLogs)
    .where(and(gte(coinLogs.createdAt, weekStart)))
    .groupBy(sql`TO_CHAR(created_at, 'Dy')`)
    .orderBy(sql`MIN(created_at)`);

  return c.json(result);
});

// TODO: refactor API route
route.get("/coin-logs", async (c) => {
  const { from, to, page, page_size } = CoinLogSearchParamsSchema.parse(
    c.req.query(),
  );

  const items = await db.query.coinLogs.findMany({
    where: and(
      from && to
        ? and(
            gte(coinLogs.createdAt, new Date(from)),
            lte(coinLogs.createdAt, new Date(to)),
          )
        : undefined,
    ),
    limit: page_size,
    offset: (page - 1) * page_size,
    orderBy: desc(coinLogs.createdAt),
    with: {
      device: true,
    },
  });

  const total = await db.$count(
    coinLogs,
    and(
      from && to
        ? and(
            gte(coinLogs.createdAt, new Date(from)),
            lte(coinLogs.createdAt, new Date(to)),
          )
        : undefined,
    ),
  );

  const totalPages = Math.ceil(total / page_size);
  const previousPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  return c.json({
    items,
    metadata: {
      current_page: page,
      previous_page: previousPage,
      next_page: nextPage,
      total_count: total,
      total_pages: totalPages,
    },
  });
});

export default route;
