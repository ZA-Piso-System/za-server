import { DeviceSessionStatus } from "@/common/types/device-session.type";
import { devices } from "@/db/schemas/devices.schema";
import { relations } from "drizzle-orm";
import { integer, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const deviceSessionStatus = pgEnum(
  "device_session_status",
  DeviceSessionStatus,
);

export const deviceSessions = pgTable("device_sessions", {
  id: uuid().primaryKey().defaultRandom(),
  deviceId: uuid()
    .notNull()
    .references(() => devices.id, { onDelete: "cascade" }),
  status: deviceSessionStatus().notNull().default(DeviceSessionStatus.Pending),
  allocatedSeconds: integer().notNull(),
  startAt: timestamp(),
  endAt: timestamp(),
  lastSeen: timestamp(),
  createdAt: timestamp()
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp()
    .$defaultFn(() => new Date())
    .notNull(),
});

export const deviceSessionsRelations = relations(deviceSessions, ({ one }) => ({
  device: one(devices, {
    fields: [deviceSessions.deviceId],
    references: [devices.id],
  }),
}));
