import { CoinLogSearchParamsSchema } from "@/common/schemas/coin-log.schema";
import { SalesOverviewParamsSchema } from "@/common/schemas/dashboard.schema";
import db from "@/db";
import { coinLogs, userCoinLogs, users } from "@/db/schemas";
import {
  endOfDay,
  endOfMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
} from "date-fns";
import { and, desc, gte, lte, sql, sum } from "drizzle-orm";
import { Hono } from "hono";

type SourceType = "device" | "user";

const route = new Hono();

route.get("/", async (c) => {
  const [coinRevenueToday] = await db
    .select({ today: sum(coinLogs.amount) })
    .from(coinLogs)
    .where(
      and(
        gte(coinLogs.createdAt, startOfDay(new Date())),
        lte(coinLogs.createdAt, endOfDay(new Date())),
      ),
    );

  const [userRevenueToday] = await db
    .select({ today: sum(userCoinLogs.amount) })
    .from(userCoinLogs)
    .where(
      and(
        gte(userCoinLogs.createdAt, startOfDay(new Date())),
        lte(userCoinLogs.createdAt, endOfDay(new Date())),
      ),
    );

  const [coinRevenueMonthly] = await db
    .select({ total: sum(coinLogs.amount) })
    .from(coinLogs)
    .where(
      and(
        gte(coinLogs.createdAt, startOfMonth(new Date())),
        lte(coinLogs.createdAt, endOfMonth(new Date())),
      ),
    );

  const [userRevenueMonthly] = await db
    .select({ total: sum(userCoinLogs.amount) })
    .from(userCoinLogs)
    .where(
      and(
        gte(userCoinLogs.createdAt, startOfMonth(new Date())),
        lte(userCoinLogs.createdAt, endOfMonth(new Date())),
      ),
    );

  const totalUsers = await db.$count(users);

  return c.json({
    revenue: {
      today: Number(coinRevenueToday.today) + Number(userRevenueToday.today),
      monthly:
        Number(coinRevenueMonthly.total) + Number(userRevenueMonthly.total),
    },
    totalUsers,
  });
});

route.get("/sales-overview", async (c) => {
  const { period } = SalesOverviewParamsSchema.parse(c.req.query());

  const today = new Date();
  let rows: { label: string; device: number; user: number }[] = [];

  if (period === "this_week") {
    const weekStart = startOfWeek(today);

    const combined = db
      .select({
        amount: coinLogs.amount,
        createdAt: coinLogs.createdAt,
        source: sql<SourceType>`'device'`.as("source"),
      })
      .from(coinLogs)
      .where(gte(coinLogs.createdAt, weekStart))
      .unionAll(
        db
          .select({
            amount: userCoinLogs.amount,
            createdAt: userCoinLogs.createdAt,
            source: sql<SourceType>`'user'`.as("source"),
          })
          .from(userCoinLogs)
          .where(gte(userCoinLogs.createdAt, weekStart)),
      )
      .as("combined");

    rows = await db
      .select({
        label: sql<string>`TO_CHAR(${combined.createdAt}, 'Dy')`,
        device:
          sql<number>`SUM(CASE WHEN ${combined.source} = 'device' THEN ${combined.amount} ELSE 0 END)`.mapWith(
            Number,
          ),
        user: sql<number>`SUM(CASE WHEN ${combined.source} = 'user' THEN ${combined.amount} ELSE 0 END)`.mapWith(
          Number,
        ),
      })
      .from(combined)
      .groupBy(sql`TO_CHAR(${combined.createdAt}, 'Dy')`)
      .orderBy(sql`MIN(${combined.createdAt})`);
  }

  if (period === "this_month") {
    const monthStart = startOfMonth(today);

    const combined = db
      .select({
        amount: coinLogs.amount,
        createdAt: coinLogs.createdAt,
        source: sql<SourceType>`'device'`.as("source"),
      })
      .from(coinLogs)
      .where(gte(coinLogs.createdAt, monthStart))
      .unionAll(
        db
          .select({
            amount: userCoinLogs.amount,
            createdAt: userCoinLogs.createdAt,
            source: sql<SourceType>`'user'`.as("source"),
          })
          .from(userCoinLogs)
          .where(gte(userCoinLogs.createdAt, monthStart)),
      )
      .as("combined");

    rows = await db
      .select({
        label: sql<string>`TO_CHAR(${combined.createdAt}, 'DD')`,
        device: sql<number>`
        SUM(CASE 
          WHEN ${combined.source} = 'device' 
          THEN ${combined.amount} 
          ELSE 0 
        END)
      `.mapWith(Number),
        user: sql<number>`
        SUM(CASE 
          WHEN ${combined.source} = 'user' 
          THEN ${combined.amount} 
          ELSE 0 
        END)
      `.mapWith(Number),
      })
      .from(combined)
      .groupBy(sql`TO_CHAR(${combined.createdAt}, 'DD')`)
      .orderBy(sql`MIN(${combined.createdAt})`);
  }

  if (period === "last_3_months") {
    const threeMonthsAgo = startOfMonth(subMonths(today, 3));

    const combined = db
      .select({
        amount: coinLogs.amount,
        createdAt: coinLogs.createdAt,
        source: sql<SourceType>`'device'`.as("source"),
      })
      .from(coinLogs)
      .where(gte(coinLogs.createdAt, threeMonthsAgo))
      .unionAll(
        db
          .select({
            amount: userCoinLogs.amount,
            createdAt: userCoinLogs.createdAt,
            source: sql<SourceType>`'user'`.as("source"),
          })
          .from(userCoinLogs)
          .where(gte(userCoinLogs.createdAt, threeMonthsAgo)),
      )
      .as("combined");

    rows = await db
      .select({
        label: sql<string>`'Week ' || EXTRACT(WEEK FROM ${combined.createdAt})`,
        device: sql<number>`
        SUM(CASE WHEN ${combined.source} = 'device' THEN ${combined.amount} ELSE 0 END)
      `.mapWith(Number),
        user: sql<number>`
        SUM(CASE WHEN ${combined.source} = 'user' THEN ${combined.amount} ELSE 0 END)
      `.mapWith(Number),
      })
      .from(combined)
      .groupBy(sql`EXTRACT(WEEK FROM ${combined.createdAt})`)
      .orderBy(sql`MIN(${combined.createdAt})`);
  }

  if (period === "this_year") {
    const yearStart = startOfYear(today);

    const combined = db
      .select({
        amount: coinLogs.amount,
        createdAt: coinLogs.createdAt,
        source: sql<SourceType>`'device'`.as("source"),
      })
      .from(coinLogs)
      .where(gte(coinLogs.createdAt, yearStart))
      .unionAll(
        db
          .select({
            amount: userCoinLogs.amount,
            createdAt: userCoinLogs.createdAt,
            source: sql<SourceType>`'user'`.as("source"),
          })
          .from(userCoinLogs)
          .where(gte(userCoinLogs.createdAt, yearStart)),
      )
      .as("combined");

    rows = await db
      .select({
        label: sql<string>`TO_CHAR(${combined.createdAt}, 'Mon')`,
        device: sql<number>`
        SUM(CASE WHEN ${combined.source} = 'device' THEN ${combined.amount} ELSE 0 END)
      `.mapWith(Number),
        user: sql<number>`
        SUM(CASE WHEN ${combined.source} = 'user' THEN ${combined.amount} ELSE 0 END)
      `.mapWith(Number),
      })
      .from(combined)
      .groupBy(sql`TO_CHAR(${combined.createdAt}, 'Mon')`)
      .orderBy(sql`MIN(${combined.createdAt})`);
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

// TODO: refactor API route
route.get("/user-coin-logs", async (c) => {
  const { from, to, page, page_size } = CoinLogSearchParamsSchema.parse(
    c.req.query(),
  );

  const items = await db.query.userCoinLogs.findMany({
    where: and(
      from && to
        ? and(
            gte(userCoinLogs.createdAt, new Date(from)),
            lte(userCoinLogs.createdAt, new Date(to)),
          )
        : undefined,
    ),
    limit: page_size,
    offset: (page - 1) * page_size,
    orderBy: desc(userCoinLogs.createdAt),
    with: {
      user: {
        columns: {
          username: true,
        },
      },
    },
  });

  const total = await db.$count(
    userCoinLogs,
    and(
      from && to
        ? and(
            gte(userCoinLogs.createdAt, new Date(from)),
            lte(userCoinLogs.createdAt, new Date(to)),
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
