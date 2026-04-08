import z from "zod/v4";

export const UserParamsSchema = z.object({
  username: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_ ]+$/),
});
