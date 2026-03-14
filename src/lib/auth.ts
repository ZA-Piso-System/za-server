import env from "@/common/env.type";
import db from "@/db";
import { getUserRole } from "@/repositories/user.repository";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession } from "better-auth/plugins";

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
  trustedOrigins: ["http://localhost:3000", "http://192.168.100.197:3000"],
  plugins: [
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
