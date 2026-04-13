import { UserSearchParamsSchema } from "@/common/schemas/user.schema";
import db from "@/db";
import { users } from "@/db/schemas";
import { desc, ilike } from "drizzle-orm";
import { Hono } from "hono";

const route = new Hono();

route.get("/", async (c) => {
  const { username, page, page_size } = UserSearchParamsSchema.parse(
    c.req.query(),
  );

  const items = await db.query.users.findMany({
    where: username ? ilike(users.username, `%${username}%`) : undefined,
    limit: page_size,
    offset: (page - 1) * page_size,
    orderBy: desc(users.createdAt),
    columns: {
      id: true,
      name: true,
      email: true,
      balanceSeconds: true,
      points: true,
      username: true,
    },
  });

  const total = await db.$count(
    users,
    username ? ilike(users.username, `%${username}%`) : undefined,
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
