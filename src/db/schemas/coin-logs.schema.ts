import { deviceSessions } from "@/db/schemas/device-sessions.schema";
import { devices } from "@/db/schemas/devices.schema";
import { relations } from "drizzle-orm";
import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const coinLogs = pgTable("coin_logs", {
  id: uuid().primaryKey().defaultRandom(),
  deviceId: uuid()
    .notNull()
    .references(() => devices.id, { onDelete: "cascade" }),
  deviceSessionId: uuid()
    .notNull()
    .references(() => deviceSessions.id, { onDelete: "cascade" }),
  amount: integer().notNull(),
  createdAt: timestamp()
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp()
    .$defaultFn(() => new Date())
    .notNull(),
});

export const coinLogsRelations = relations(coinLogs, ({ one }) => ({
  device: one(devices, {
    fields: [coinLogs.deviceId],
    references: [devices.id],
  }),
  deviceSession: one(deviceSessions, {
    fields: [coinLogs.deviceSessionId],
    references: [deviceSessions.id],
  }),
}));
