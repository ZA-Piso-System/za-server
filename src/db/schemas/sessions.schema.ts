import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema";

export const sessions = pgTable("sessions", {
  id: text().primaryKey(),
  expiresAt: timestamp().notNull(),
  token: text().notNull().unique(),
  createdAt: timestamp().notNull(),
  updatedAt: timestamp().notNull(),
  ipAddress: text(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});
