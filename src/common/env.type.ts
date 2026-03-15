import { Environment } from "@/common/types/environment.type";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import * as path from "node:path";
import z, { ZodError } from "zod/v4";

expand(
  config({
    path: path.resolve(
      process.cwd(),
      process.env.NODE_ENV === Environment.TEST ? ".env.test" : ".env",
    ),
  }),
);

export const EnvSchema = z.object({
  NODE_ENV: z.string().default(Environment.DEVELOPMENT),
  PORT: z.coerce.number().default(5000),
  LOG_LEVEL: z.enum([
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
    "silent",
  ]),
  ALLOWED_ORIGINS: z.string(),
  DATABASE_URL: z.url(),
  DATABASE_LOGGER: z
    .string()
    .transform((value) => value === "true")
    .default(false),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  BETTER_AUTH_URL: z.string(),
  BETTER_AUTH_SECRET: z.string(),
});

type env = z.infer<typeof EnvSchema>;

let env: env;

try {
  env = EnvSchema.parse(process.env);
} catch (e) {
  const error = e as ZodError;
  // eslint-disable-next-line no-console
  console.error("❌ Invalid env:", error.flatten().fieldErrors);
  process.exit(1);
}

export default env;
