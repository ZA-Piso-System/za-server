import { users } from "@/db/schemas/users.schema";
import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userCoinLogs = pgTable("user_coin_logs", {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: integer().notNull(),
  createdAt: timestamp()
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp()
    .$defaultFn(() => new Date())
    .notNull(),
});

export const userCoinLogsRelations = relations(userCoinLogs, ({ one }) => ({
  user: one(users, {
    fields: [userCoinLogs.userId],
    references: [users.id],
  }),
}));
