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
import { logger } from "@/lib/pino.lib";
import { and, eq, inArray } from "drizzle-orm";

export const eventHandler = async (
  event: { type: string; payload?: unknown },
  ws: CustomWebscoket,
): Promise<void> => {
  switch (event.type) {
    case ClientEvent.Ready:
      {
        const payload = event.payload as Client;

        logger.info(payload, "Received client ready");

        const device = await db.query.devices.findFirst({
          where: eq(devices.id, payload.id),
        });
        if (!device) return;
        ws.deviceId = payload.id;
        clients.set(payload.id, { id: payload.id, ws });

        logger.info(
          {
            deviceNumber: device.deviceNumber,
            type: device.type,
          },
          "Updating device status to Online",
        );

        await db
          .update(devices)
          .set({ status: DeviceStatus.Online })
          .where(eq(devices.id, payload.id));

        logger.info(
          {
            deviceNumber: device.deviceNumber,
            type: device.type,
          },
          "Fetching pending or active device session",
        );

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
          logger.info(
            {
              deviceNumber: device.deviceNumber,
              type: device.type,
            },
            "No active device session found. Sending null session.",
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

        logger.info(
          {
            deviceNumber: device.deviceNumber,
            type: device.type,
          },
          "Found device session.",
        );

        if (pendingOrActiveSession.status === DeviceSessionStatus.Pending) {
          logger.info(
            {
              deviceNumber: device.deviceNumber,
              type: device.type,
            },
            "Device session is Pending",
          );

          const startAt = new Date();
          const endAt = new Date(
            Date.now() + pendingOrActiveSession.allocatedSeconds * 1_000,
          );

          logger.info(
            {
              deviceNumber: device.deviceNumber,
              type: device.type,
            },
            "Updating device session to Active",
          );
          await db
            .update(deviceSessions)
            .set({
              status: DeviceSessionStatus.Active,
              startAt,
              endAt,
            })
            .where(eq(deviceSessions.id, pendingOrActiveSession.id));

          logger.info(
            {
              deviceNumber: device.deviceNumber,
              type: device.type,
              session: {
                startAt,
                endAt,
              },
            },
            "Sending session",
          );
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
          logger.info(
            {
              deviceNumber: device.deviceNumber,
              type: device.type,
            },
            "Device session is Active",
          );

          const startAt = pendingOrActiveSession.startAt;
          const endAt = pendingOrActiveSession.endAt;

          if (startAt && endAt) {
            logger.info(
              {
                deviceNumber: device.deviceNumber,
                type: device.type,
              },
              "Checking remaining time",
            );
            const remainingMs = Math.max(0, endAt.getTime() - Date.now());

            if (remainingMs <= 0) {
              logger.info(
                {
                  deviceNumber: device.deviceNumber,
                  type: device.type,
                },
                "Already expired. Updating device session to Expired",
              );

              await db
                .update(deviceSessions)
                .set({
                  status: DeviceSessionStatus.Expired,
                })
                .where(eq(deviceSessions.id, pendingOrActiveSession.id));

              logger.info(
                {
                  deviceNumber: device.deviceNumber,
                  type: device.type,
                },
                "Sending null session.",
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
            } else {
              logger.info(
                {
                  deviceNumber: device.deviceNumber,
                  type: device.type,
                  session: {
                    startAt,
                    endAt,
                  },
                },
                "Sending session",
              );

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
      logger.warn(event, "Unknown event");
  }
};
