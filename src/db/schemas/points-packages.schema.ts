import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const pointsPackages = pgTable("points_packages", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  pointsCost: integer().notNull(),
  timeSeconds: integer().notNull(),
  displayOrder: integer().notNull(),
  isActive: boolean()
    .$defaultFn(() => false)
    .notNull(),
  createdAt: timestamp()
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp()
    .$defaultFn(() => new Date())
    .notNull(),
});
