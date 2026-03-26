import { PaginationSchema } from "@/common/schemas/pagination.schema";
import { coinLogs } from "@/db/schemas";
import { createInsertSchema } from "drizzle-zod";
import z from "zod/v4";

export const CoinLogSearchParamsSchema = PaginationSchema.extend({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

export const InsertCoinLogSchema = createInsertSchema(coinLogs, {
  amount: z.number(),
}).omit({
  id: true,
  deviceId: true,
  deviceSessionId: true,
  createdAt: true,
  updatedAt: true,
});
