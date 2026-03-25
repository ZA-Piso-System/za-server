import { z } from "zod/v4";

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
} from "@/common/constants/pagination.constant";

export const PaginationSchema = z.object({
  page: z.coerce.number().default(DEFAULT_PAGE),
  page_size: z.coerce
    .number()
    .refine((val) => PAGE_SIZES.includes(val), {
      message: "Invalid page size",
    })
    .default(DEFAULT_PAGE_SIZE),
});
