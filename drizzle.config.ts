import env from "@/common/env.type";
import { type Config } from "drizzle-kit";

export default {
  casing: "snake_case",
  schema: "./src/db/schemas",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
} satisfies Config;
