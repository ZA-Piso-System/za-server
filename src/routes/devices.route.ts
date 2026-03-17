import { RegisterDeviceSchema } from "@/common/schemas/device.schema";
import { DeviceStatus } from "@/common/types/device.type";
import db from "@/db";
import { devices } from "@/db/schemas";
import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";

const route = new Hono();

route.post("/devices/register", async (c) => {
  const parsedData = RegisterDeviceSchema.parse(await c.req.json());

  const existingDevice = await db.query.devices.findFirst({
    where: and(
      isNull(devices.macAddress),
      eq(devices.registrationToken, parsedData.registrationToken),
    ),
  });

  if (!existingDevice) {
    return c.json({ message: "Device not found." }, 404);
  }

  const [updatedDevice] = await db
    .update(devices)
    .set({
      macAddress: parsedData.macAddress,
      status: DeviceStatus.Offline,
    })
    .where(eq(devices.id, existingDevice.id))
    .returning();

  return c.json({
    message: "Device registered successfully.",
    data: {
      id: updatedDevice.id,
      deviceNumber: updatedDevice.deviceNumber,
      macAddress: updatedDevice.macAddress,
      type: updatedDevice.type,
    },
  });
});

export default route;
