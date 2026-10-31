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

export const supportTicketCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(254),
    subject: z.string().trim().min(3).max(120),
    message: z.string().trim().min(10).max(5000),
    companyWebsite: z.string().max(500).optional().default(""),
  })
  .strict();

export const supportTicketPageSchema = z.object(pageFields).strict();

export const supportTicketStatusSchema = z
  .object({
    status: z.enum(["open", "in_progress", "resolved"]),
  })
  .strict();

export const supportTicketParamsSchema = z
  .object({
    id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();

export const supportEmptySchema = z.object({}).strict();
