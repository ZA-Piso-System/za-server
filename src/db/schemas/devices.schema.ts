import { DeviceStatus, DeviceType } from "@/common/types/device.type";
import { deviceSessions } from "@/db/schemas/device-sessions.schema";
import { relations } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const deviceType = pgEnum("device_type", DeviceType);
export const deviceStatus = pgEnum("device_status", DeviceStatus);

export const devices = pgTable("devices", {
  id: uuid().primaryKey().defaultRandom(),
  deviceNumber: integer().notNull(),
  macAddress: text(),
  type: deviceType().notNull(),
  registrationToken: text().notNull(),
  status: deviceStatus().notNull().default(DeviceStatus.Pending),
  createdAt: timestamp()
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp()
    .$defaultFn(() => new Date())
    .notNull(),
});

export const devicesRelations = relations(devices, ({ many }) => ({
  deviceSessions: many(deviceSessions),
}));
