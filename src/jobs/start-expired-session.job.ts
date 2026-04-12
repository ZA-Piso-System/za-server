import { DeviceSessionStatus } from "@/common/types/device-session.type";
import { SessionEvent } from "@/common/types/session-event.type";
import db from "@/db";
import { deviceSessions } from "@/db/schemas";
import { clients } from "@/lib/clients";
import { logger } from "@/lib/pino.lib";
import { and, eq, lte } from "drizzle-orm";

export const startExpiredSessionJob = () => {
  logger.info("Starting expired session job");
  setInterval(async () => {
    const expiredSessions = await db.query.deviceSessions.findMany({
      where: and(
        eq(deviceSessions.status, DeviceSessionStatus.Active),
        lte(deviceSessions.endAt, new Date()),
      ),
    });

    for (const expiredSession of expiredSessions) {
      logger.info(
        { id: expiredSession.id },
        "Terminating expired device session",
      );

      await db
        .update(deviceSessions)
        .set({
          status: DeviceSessionStatus.Terminated,
        })
        .where(eq(deviceSessions.id, expiredSession.id));

      const serverClient = clients.get(expiredSession.deviceId);

      if (serverClient) {
        serverClient.ws.send(
          JSON.stringify({
            type: SessionEvent.Stop,
          }),
        );
      }
    }
  }, 5_000);
};
