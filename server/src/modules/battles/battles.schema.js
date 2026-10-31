import { z } from "zod";

const categories = [
  "UI/UX",
  "Branding",
  "Web Dev",
  "Mobile",
  "Design",
  "Photography",
  "Illustration",
  "Animation",
];

const optionSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(1200),
    imageUrl: z.string().url().max(2048),
    author: z.string().trim().max(80).optional(),
  })
  .strict();

export const battleCreateSchema = z
  .object({
    title: z.string().trim().min(4).max(120),
    description: z.string().trim().max(2000).optional(),
    category: z.enum(categories),
    options: z.array(optionSchema).min(2).max(6),
    endsAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const battleListQuerySchema = z
  .object({
    filter: z.enum(["all", "live", "ended"]).default("all"),
    category: z.enum(categories).optional(),
    limit: z
      .string()
      .regex(/^[1-9]\d*$/)
      .transform(Number)
      .refine((value) => value <= 50, "limit must be from 1 to 50")
      .optional(),
    cursor: z.string().min(1).max(2048).optional(),
  })
  .strict();

export const battleIdParamsSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();

export const battleVoteSchema = z
  .object({
    optionId: z
      .string()
      .min(1)
      .max(16)
      .regex(/^[A-Z]$/),
  })
  .strict();

export const battleEmptySchema = z.object({}).strict();
