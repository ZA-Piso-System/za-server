import { coinLogs } from "@/db/schemas";
import { createInsertSchema } from "drizzle-zod";
import z from "zod/v4";

export const InsertCoinLogSchema = createInsertSchema(coinLogs, {
  amount: z.number(),
}).omit({
  id: true,
  deviceId: true,
  deviceSessionId: true,
  createdAt: true,
  updatedAt: true,
});
