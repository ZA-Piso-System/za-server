import z from "zod/v4";

export const SalesOverviewParamsSchema = z.object({
  period: z.enum(["this_week", "this_month", "last_3_months", "this_year"]),
});
