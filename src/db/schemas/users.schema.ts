import { boolean, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
  createdAt: timestamp()
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp()
    .$defaultFn(() => new Date())
    .notNull(),
});
