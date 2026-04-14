import { logger } from "@/lib/pino.lib";
import { randomUUID } from "crypto";
import { pinoLogger } from "hono-pino";

export const pinoLoggerMiddleware = () => {
  return pinoLogger({
    http: {
      reqId: () => randomUUID(),
    },
    pino: logger,
  });
};
