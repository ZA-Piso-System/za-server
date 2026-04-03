import z from "zod/v4";

export const UseTimeSchema = z.object({
  id: z.uuid(),
});
