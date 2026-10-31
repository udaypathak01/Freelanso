import { z } from "zod";
import { serviceCategories } from "../services/serviceCategories.js";

const projectCategories = [
  "logo-design",
  "ui-ux-design",
  "web-development",
  "video-editing",
  "illustration",
  "content-writing",
  "seo-marketing",
  "motion-graphics",
];
const allowedCategories = [...projectCategories, ...serviceCategories.map(({ slug }) => slug)];

const filtersSchema = z
  .object({
    category: z.enum(allowedCategories).optional(),
    skills: z.array(z.string().trim().min(1).max(40)).min(1).max(10).optional(),
    minPrice: z.number().finite().min(0).max(100_000_000).optional(),
    maxPrice: z.number().finite().min(0).max(100_000_000).optional(),
    sort: z
      .enum(["newest", "oldest", "price_asc", "price_desc", "popular"])
      .default("newest"),
  })
  .strict()
  .refine(
    ({ minPrice, maxPrice }) =>
      minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
    {
      path: ["maxPrice"],
      message: "maxPrice must be greater than or equal to minPrice",
    },
  );

export const smartSearchSchema = z
  .object({
    query: z.string().trim().min(1).max(500),
    filters: filtersSchema.optional(),
  })
  .strict();

export const emptyObjectSchema = z.object({}).strict();
