import env from "@/common/env.type";
import db from "@/db";
import { getUserRole } from "@/repositories/user.repository";
import { electron } from "@better-auth/electron";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, customSession } from "better-auth/plugins";

export const auth = betterAuth({
  basePath: "/api/v1/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  user: {
    modelName: "users",
  },
  session: {
    modelName: "sessions",
  },
  account: {
    modelName: "accounts",
  },
  verification: {
    modelName: "verifications",
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  advanced: {
    defaultCookieAttributes: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
    },
  },
  trustedOrigins: env.ALLOWED_ORIGINS.split(","),
  plugins: [
    bearer(),
    electron(),
    customSession(async ({ user, session }) => {
      const role = await getUserRole(user.id);
      return {
        user: {
          ...user,
          role,
        },
        session,
      };
    }),
  ],
});
