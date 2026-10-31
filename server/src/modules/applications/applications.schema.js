import { z } from "zod";

const pageFields = {
  limit: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .refine((value) => value <= 50, "limit must be from 1 to 50")
    .optional(),
  cursor: z.string().min(1).max(2048).optional(),
};

export const applicationCreateSchema = z
  .object({
    coverLetter: z.string().trim().min(10).max(2000),
    proposedRate: z.number().finite().min(0).max(100_000_000),
  })
  .strict();

export const applicationListQuerySchema = z.object(pageFields).strict();

export const applicationStatusSchema = z
  .object({
    status: z.enum(["shortlisted", "rejected", "hired", "withdrawn"]),
  })
  .strict();

export const applicationJobParamsSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();

export const applicationIdParamsSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(300)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();

export const applicationEmptySchema = z.object({}).strict();
