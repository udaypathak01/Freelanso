import { z } from "zod";

const cursorSchema = z.string().min(1).max(2048).optional();

export const dashboardQuerySchema = z
  .object({
    limit: z
      .string()
      .regex(/^[1-9]\d*$/)
      .transform(Number)
      .refine((value) => value <= 50, "limit must be from 1 to 50")
      .optional(),
    projectCursor: cursorSchema,
    serviceCursor: cursorSchema,
  })
  .strict();

export const dashboardEmptySchema = z.object({}).strict();
