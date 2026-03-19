import env from "@/common/env.type";
import { Environment } from "@/common/types/environment.type";
import pino from "pino";
import pretty from "pino-pretty";

export const logger = pino(
  {
    level: env.LOG_LEVEL,
  },
  env.NODE_ENV === Environment.PRODUCTION ? undefined : pretty(),
);
