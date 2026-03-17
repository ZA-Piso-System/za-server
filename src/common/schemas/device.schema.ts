import { DeviceType } from "@/common/types/device.type";
import { devices } from "@/db/schemas/devices.schema";
import { createInsertSchema } from "drizzle-zod";
import z from "zod/v4";

export const DeviceTypeSchema = z.enum(DeviceType);

export const InsertDeviceSchema = createInsertSchema(devices, {
  deviceNumber: z.number(),
  type: () => DeviceTypeSchema,
}).omit({
  id: true,
  registrationToken: true,
  createdAt: true,
  updatedAt: true,
});

export const RegisterDeviceSchema = z.object({
  macAddress: z.string(),
  registrationToken: z.string(),
});
