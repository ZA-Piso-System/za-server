import { CoinLogSearchParamsSchema } from "@/common/schemas/coin-log.schema";
import { SalesOverviewParamsSchema } from "@/common/schemas/dashboard.schema";
import db from "@/db";
import { coinLogs } from "@/db/schemas";
import {
  endOfDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
} from "date-fns";
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
  const { period } = SalesOverviewParamsSchema.parse(c.req.query());

  const today = new Date();
  let rows: { label: string; value: number }[] = [];

  if (period === "this_week") {
    const weekStart = startOfWeek(today);

    rows = await db
      .select({
        label: sql<string>`TO_CHAR(created_at, 'Dy')`,
        value: sum(coinLogs.amount).mapWith(Number),
      })
      .from(coinLogs)
      .where(and(gte(coinLogs.createdAt, weekStart)))
      .groupBy(sql`TO_CHAR(created_at, 'Dy')`)
      .orderBy(sql`MIN(created_at)`);
  }

  if (period === "this_month") {
    const monthStart = startOfMonth(today);

    rows = await db
      .select({
        label: sql<string>`TO_CHAR(created_at, 'DD')`,
        value: sum(coinLogs.amount).mapWith(Number),
      })
      .from(coinLogs)
      .where(and(gte(coinLogs.createdAt, monthStart)))
      .groupBy(sql`TO_CHAR(created_at, 'DD')`)
      .orderBy(sql`MIN(created_at)`);
  }

  if (period === "last_3_months") {
    const threeMonthsAgo = startOfMonth(subMonths(today, 3));

    rows = await db
      .select({
        label: sql<string>`'Week ' || EXTRACT(WEEK FROM created_at)`,
        value: sum(coinLogs.amount).mapWith(Number),
      })
      .from(coinLogs)
      .where(and(gte(coinLogs.createdAt, threeMonthsAgo)))
      .groupBy(sql`EXTRACT(WEEK FROM created_at)`)
      .orderBy(sql`MIN(created_at)`);
  }

  if (period === "this_year") {
    const yearStart = startOfYear(today);

    rows = await db
      .select({
        label: sql<string>`TO_CHAR(created_at, 'Mon')`,
        value: sum(coinLogs.amount).mapWith(Number),
      })
      .from(coinLogs)
      .where(and(gte(coinLogs.createdAt, yearStart)))
      .groupBy(sql`TO_CHAR(created_at, 'Mon')`)
      .orderBy(sql`MIN(created_at)`);
  }

  return c.json(rows);
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
