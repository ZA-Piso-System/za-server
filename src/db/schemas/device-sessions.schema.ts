import { DeviceSessionStatus } from "@/common/types/device-session.type";
import { coinLogs } from "@/db/schemas/coin-logs.schema";
import { devices } from "@/db/schemas/devices.schema";
import { users } from "@/db/schemas/users.schema";
import { relations } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const deviceSessionStatus = pgEnum(
  "device_session_status",
  DeviceSessionStatus,
);

export const deviceSessions = pgTable("device_sessions", {
  id: uuid().primaryKey().defaultRandom(),
  userId: text().references(() => users.id, { onDelete: "cascade" }),
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

export const deviceSessionsRelations = relations(
  deviceSessions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [deviceSessions.userId],
      references: [users.id],
    }),
    device: one(devices, {
      fields: [deviceSessions.deviceId],
      references: [devices.id],
    }),
    coinLogs: many(coinLogs),
  }),
);
