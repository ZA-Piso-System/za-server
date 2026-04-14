import { InsertDeviceSchema } from "@/common/schemas/device.schema";
import { DeviceSessionStatus } from "@/common/types/device-session.type";
import { DeviceType } from "@/common/types/device.type";
import { SessionEvent } from "@/common/types/session-event.type";
import db from "@/db";
import { deviceSessions } from "@/db/schemas";
import { devices } from "@/db/schemas/devices.schema";
import { clients } from "@/lib/clients";
import { logger } from "@/lib/pino.lib";
import { addTime } from "@/services/device.service";
import { randomBytes } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";

const route = new Hono();

route.post("/", async (c) => {
  const parsedData = InsertDeviceSchema.parse(await c.req.json());

  const [device] = await db
    .insert(devices)
    .values({
      deviceNumber: parsedData.deviceNumber,
      type: parsedData.type as DeviceType,
      registrationToken: randomBytes(4).toString("hex"),
    })
    .returning();

  return c.json({ message: "Device created successfully.", data: device });
});

route.get("/:id", async (c) => {
  const id = c.req.param("id");

  const device = await db.query.devices.findFirst({
    where: eq(devices.id, id),
    with: {
      deviceSessions: {
        where: inArray(deviceSessions.status, [
          DeviceSessionStatus.Pending,
          DeviceSessionStatus.Active,
        ]),
      },
    },
  });

  return c.json(device);
});

route.post("/:id/add-time", async (c) => {
  const id = c.req.param("id");
  const { seconds } = await c.req.json();
  await addTime(id, seconds, "add-time");
  return c.json({ message: "Time added successfully." });
});

route.post("/:id/stop", async (c) => {
  const id = c.req.param("id");

  logger.info({ id }, "Stop session API");

  logger.info({ id }, "Updating session to Terminated");
  await db
    .update(deviceSessions)
    .set({
      status: DeviceSessionStatus.Terminated,
    })
    .where(
      and(
        eq(deviceSessions.deviceId, id),
        eq(deviceSessions.status, DeviceSessionStatus.Active),
      ),
    );

  const serverClient = clients.get(id);

  if (serverClient) {
    serverClient.ws.send(
      JSON.stringify({
        type: SessionEvent.Stop,
      }),
    );
  }

  return c.json({ message: "Session stopped successfully." });
});

export default route;
