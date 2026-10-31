import { z } from "zod";
import { serviceCategories } from "./serviceCategories.js";

const categorySlugs = serviceCategories.map(({ slug }) => slug);
const assetSchema = z
  .object({
    url: z.string().url().max(2048),
    publicId: z
      .string()
      .min(1)
      .max(255)
      .regex(/^[A-Za-z0-9/_-]+$/),
  })
  .strict();

const fields = {
  title: z.string().trim().min(4).max(100),
  description: z.string().trim().min(20).max(2000),
  category: z.enum(categorySlugs),
  price: z.number().finite().min(1).max(100_000_000),
  deliveryDays: z.number().int().min(1).max(365),
  revisions: z.number().int().min(0).max(100),
  images: z.array(assetSchema).max(10),
  skills: z.array(z.string().trim().min(1).max(40)).max(30),
};

export const serviceCreateSchema = z.object(fields).strict();

export const serviceUpdateSchema = z
  .object({
    title: fields.title.optional(),
    description: fields.description.optional(),
    category: fields.category.optional(),
    price: fields.price.optional(),
    deliveryDays: fields.deliveryDays.optional(),
    revisions: fields.revisions.optional(),
    images: fields.images.optional(),
    skills: fields.skills.optional(),
  })
  .strict()
  .refine((service) => Object.keys(service).length > 0, {
    message: "At least one service field must be provided",
  });

const pageFields = {
  limit: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .refine((value) => value <= 50, "limit must be from 1 to 50")
    .optional(),
  cursor: z.string().min(1).max(2048).optional(),
};

export const serviceListQuerySchema = z
  .object({
    ...pageFields,
    q: z.string().trim().max(80).optional(),
    category: z.enum(categorySlugs).optional(),
    skills: z
      .string()
      .transform((value) =>
        value
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
      )
      .pipe(
        z
          .array(z.string().min(1).max(40))
          .min(1)
          .max(10)
          .refine(
            (skills) =>
              new Set(skills.map((skill) => skill.toLowerCase())).size ===
              skills.length,
            "skills must be unique",
          ),
      )
      .optional(),
    minPrice: z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/)
      .transform(Number)
      .pipe(z.number().finite().min(0).max(100_000_000))
      .optional(),
    maxPrice: z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/)
      .transform(Number)
      .pipe(z.number().finite().min(0).max(100_000_000))
      .optional(),
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

export const serviceIdParamsSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();

export const emptyObjectSchema = z.object({}).strict();
