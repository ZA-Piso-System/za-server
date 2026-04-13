import { PaginationSchema } from "@/common/schemas/pagination.schema";
import z from "zod/v4";

export const UserSearchParamsSchema = PaginationSchema.extend({
  username: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_ ]+$/)
    .optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
