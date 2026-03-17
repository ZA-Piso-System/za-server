import { ClientEvent } from "@/common/types/client-event.type";
import { Client } from "@/common/types/client.type";
import { DeviceSessionStatus } from "@/common/types/device-session.type";
import { DeviceStatus } from "@/common/types/device.type";
import { ServerEvent } from "@/common/types/server-event.type";
import { Session } from "@/common/types/session.type";
import { CustomWebscoket } from "@/common/types/websocket.type";
import db from "@/db";
import { devices, deviceSessions } from "@/db/schemas";
import { clients } from "@/lib/clients";
import { and, eq, inArray } from "drizzle-orm";

export const eventHandler = async (
  event: { type: string; payload?: unknown },
  ws: CustomWebscoket,
): Promise<void> => {
  switch (event.type) {
    case ClientEvent.Ready:
      {
        console.log("# Client Ready");

        const payload = event.payload as Client;
        const device = await db.query.devices.findFirst({
          where: eq(devices.id, payload.id),
        });
        if (!device) return;
        ws.deviceId = payload.id;
        clients.set(payload.id, { id: payload.id, ws });

        console.log("- Updating device status to Online");
        await db
          .update(devices)
          .set({ status: DeviceStatus.Online })
          .where(eq(devices.id, payload.id));

        console.log("- Fetching pending or active device session");
        const pendingOrActiveSession = await db.query.deviceSessions.findFirst({
          where: and(
            eq(deviceSessions.deviceId, payload.id),
            inArray(deviceSessions.status, [
              DeviceSessionStatus.Pending,
              DeviceSessionStatus.Active,
            ]),
          ),
        });

        if (!pendingOrActiveSession) {
          console.log(
            "- No active device session found. Sending null session.",
          );

          ws.send(
            JSON.stringify({
              type: ServerEvent.Ack,
              payload: {
                startAt: null,
                endAt: null,
              } satisfies Session,
            }),
          );
          return;
        }

        console.log("- Found device session.");

        if (pendingOrActiveSession.status === DeviceSessionStatus.Pending) {
          console.log("- Device session is Pending");

          const startAt = new Date();
          const endAt = new Date(
            Date.now() + pendingOrActiveSession.allocatedSeconds * 1_000,
          );

          console.log("- Updating device session to Active");
          await db
            .update(deviceSessions)
            .set({
              status: DeviceSessionStatus.Active,
              startAt,
              endAt,
            })
            .where(eq(deviceSessions.id, pendingOrActiveSession.id));

          console.log("- Sending session", { startAt, endAt });
          ws.send(
            JSON.stringify({
              type: ServerEvent.Ack,
              payload: {
                startAt: startAt.getTime(),
                endAt: endAt.getTime(),
              } satisfies Session,
            }),
          );
        }

        if (pendingOrActiveSession.status === DeviceSessionStatus.Active) {
          console.log("- Device session is Active");

          const startAt = pendingOrActiveSession.startAt;
          const endAt = pendingOrActiveSession.endAt;

          if (startAt && endAt) {
            console.log("- Checking remaining time");
            const remainingMs = Math.max(0, endAt.getTime() - Date.now());

            if (remainingMs <= 0) {
              console.log(
                "- Already expired. Updating device session to Expired",
              );

              await db
                .update(deviceSessions)
                .set({
                  status: DeviceSessionStatus.Expired,
                })
                .where(eq(deviceSessions.id, pendingOrActiveSession.id));

              console.log("- Sending null session.");

              ws.send(
                JSON.stringify({
                  type: ServerEvent.Ack,
                  payload: {
                    startAt: null,
                    endAt: null,
                  } satisfies Session,
                }),
              );
            } else {
              console.log("- Sending session", { startAt, endAt });

              ws.send(
                JSON.stringify({
                  type: ServerEvent.Ack,
                  payload: {
                    startAt: startAt.getTime(),
                    endAt: endAt.getTime(),
                  } satisfies Session,
                }),
              );
            }
          }
        }
      }
      break;
    case ClientEvent.Heartbeat:
      {
        const payload = event.payload as Client;
        const client = clients.get(payload.id);
        if (!client) return;
        ws.deviceId = payload.id;
        clients.set(payload.id, { ...payload, ws });

        // Update device session lastSeen if available
      }
      break;
    default:
      console.warn("Unknown event", event.type);
  }
};
