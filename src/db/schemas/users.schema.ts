import { userCoinLogs } from "@/db/schemas/user-coin-logs.schema";
import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Role } from "../../common/types/role.type";

export const userRole = pgEnum(
  "user_role",
  Object.values(Role) as [string, ...string[]],
);

export const users = pgTable("users", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean()
    .$defaultFn(() => false)
    .notNull(),
  image: text(),
  role: userRole().notNull().default(Role.User),
  balanceSeconds: integer().notNull().default(0),
  points: integer().notNull().default(0),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  createdAt: timestamp()
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp()
    .$defaultFn(() => new Date())
    .notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  userCoinLogs: many(userCoinLogs),
}));
