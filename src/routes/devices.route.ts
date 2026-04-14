import env from "@/common/env.type";
import { InsertCoinLogSchema } from "@/common/schemas/coin-log.schema";
import { RegisterDeviceSchema } from "@/common/schemas/device.schema";
import { DeviceSessionStatus } from "@/common/types/device-session.type";
import { DeviceStatus } from "@/common/types/device.type";
import db from "@/db";
import { coinLogs, devices, deviceSessions } from "@/db/schemas";
import { addTime } from "@/services/device.service";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { Hono } from "hono";

const route = new Hono();

route.get("/", async (c) => {
  const rows = await db.query.devices.findMany({
    where: ne(devices.status, DeviceStatus.Pending),
    with: {
      deviceSessions: {
        where: inArray(deviceSessions.status, [
          DeviceSessionStatus.Pending,
          DeviceSessionStatus.Active,
        ]),
      },
    },
  });

  return c.json({
    items: rows,
  });
});

route.post("/register", async (c) => {
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

route.post("/:id/insert-coin", async (c) => {
  const apiKey = c.req.raw.headers.get("x-api-key");
  if (apiKey !== env.COIN_SLOT_SECRET) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  const parsedData = InsertCoinLogSchema.parse(await c.req.json());
  const amount = parsedData.amount;
  const seconds = amount * 4 * 60;

  const session = await addTime(id, seconds, "insert-coin");

  await db.insert(coinLogs).values({
    deviceId: id,
    deviceSessionId: session.id,
    amount,
  });

  return c.json({ message: "Time added successfully." });
});

export default route;
