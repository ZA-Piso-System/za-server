import { devices } from "@/db/schemas";
import { InferSelectModel } from "drizzle-orm";

export type Device = InferSelectModel<typeof devices>;

export const DeviceType = {
  Pc: "pc",
  Tablet: "tablet",
  phone: "phone",
} as const;

export const DeviceStatus = {
  Pending: "pending",
  Starting: "starting",
  Offline: "offline",
  Online: "online",
} as const;

export type DeviceType = (typeof DeviceType)[keyof typeof DeviceType];
export type DeviceStatus = (typeof DeviceStatus)[keyof typeof DeviceStatus];
