import CustomError from "@/lib/error";
import { logger } from "@/lib/pino.lib";
import { Context } from "hono";
import { BlankEnv } from "hono/types";

export const errorHandler = (error: unknown, c: Context<BlankEnv, any, {}>) => {
  if (error instanceof CustomError) {
    return c.json({ message: error.message }, error.status);
  }
  logger.error(error, "Internal Server Error");
  return c.json({ message: "Internal Server Error" }, 500);
};
