import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const verifications = pgTable("verifications", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp().notNull(),
  createdAt: timestamp(),
  updatedAt: timestamp(),
});
