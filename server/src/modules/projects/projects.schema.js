import { z } from "zod";

const categories = [
  "logo-design",
  "ui-ux-design",
  "web-development",
  "video-editing",
  "illustration",
  "content-writing",
  "seo-marketing",
  "motion-graphics",
];
const experienceLevels = ["Beginner", "Intermediate", "Expert"];

const assetSchema = z
  .object({
    url: z.string().url().max(2048),
    publicId: z
      .string()
      .min(1)
      .max(255)
      .regex(/^[A-Za-z0-9/_-]+$/),
    mediaType: z.enum(["image", "video"]).default("image"),
    resourceType: z.enum(["image", "video"]).default("image"),
    type: z.enum(["image", "video"]).optional(),
    isCover: z.boolean().optional(),
  })
  .strict();

const projectMediaSchema = z
  .array(assetSchema)
  .min(1)
  .max(10);
const projectLinkSchema = z
  .object({
    label: z.enum([
      "Live Demo",
      "GitHub",
      "Behance",
      "Figma",
      "Dribbble",
      "Website",
      "Other",
    ]),
    url: z
      .string()
      .url()
      .max(2048)
      .refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
  })
  .strict();
const projectLinksSchema = z.array(projectLinkSchema).max(5);

const fields = {
  title: z.string().trim().min(4).max(80),
  description: z.string().trim().min(100).max(500),
  category: z.enum(categories),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  skills: z.array(z.string().trim().min(1).max(40)).max(30),
  price: z.number().finite().min(1).max(100_000_000),
  deliveryDays: z.number().int().min(1).max(365),
  level: z.enum(experienceLevels).optional(),
  images: projectMediaSchema.optional(),
  media: projectMediaSchema.optional(),
  links: projectLinksSchema.optional(),
};

export const projectCreateSchema = z
  .object(fields)
  .strict()
  .superRefine((project, context) => {
    if (!project.images?.length && !project.media?.length) {
      context.addIssue({
        code: "custom",
        path: ["images"],
        message: "At least one project media item is required",
      });
    }
    const coverItems = (project.media ?? project.images ?? []).filter(
      (asset) => asset.isCover,
    );
    if (coverItems.length > 1) {
      context.addIssue({
        code: "custom",
        path: ["media"],
        message: "Only one media item can be selected as the cover",
      });
    }
    if (new Set(project.skills).size !== project.skills.length) {
      context.addIssue({
        code: "custom",
        path: ["skills"],
        message: "Skills must be unique",
      });
    }
  });

export const projectUpdateSchema = z
  .object({
    title: fields.title.optional(),
    description: fields.description.optional(),
    category: fields.category.optional(),
    tags: fields.tags.optional(),
    skills: fields.skills.optional(),
    price: fields.price.optional(),
    deliveryDays: fields.deliveryDays.optional(),
    level: fields.level,
    images: projectMediaSchema.optional(),
    media: projectMediaSchema.optional(),
    links: projectLinksSchema.optional(),
  })
  .strict()
  .refine((project) => Object.keys(project).length > 0, {
    message: "At least one project field must be provided",
  });

const pageQueryFields = {
  limit: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .refine((value) => value <= 50, "limit must be from 1 to 50")
    .optional(),
  cursor: z.string().min(1).max(2048).optional(),
};

const priceQueryFields = {
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
};

export const projectListQuerySchema = z
  .object({
    ...pageQueryFields,
    category: z.enum(categories).optional(),
    q: z.string().trim().max(80).optional(),
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
    ...priceQueryFields,
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

export const commentsQuerySchema = z.object(pageQueryFields).strict();
export const projectIdParamsSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();
export const commentParamsSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
    commentId: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();
export const commentCreateSchema = z
  .object({ text: z.string().trim().min(1).max(1000) })
  .strict();
export const emptyObjectSchema = z.object({}).strict();
