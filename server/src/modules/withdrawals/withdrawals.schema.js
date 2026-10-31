import { z } from "zod";
import { env } from "../../config/env.js";

const pageFields = {
  limit: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .refine((value) => value <= 50, "limit must be from 1 to 50")
    .optional(),
  cursor: z.string().min(1).max(2048).optional(),
};

export const withdrawalCreateSchema = z
  .object({
    amount: z
      .number()
      .int()
      .min(env.withdrawalMinMinor)
      .max(env.withdrawalMaxMinor),
  })
  .strict();

export const withdrawalStatusSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
  })
  .strict();

export const withdrawalListQuerySchema = z.object(pageFields).strict();

export const withdrawalParamsSchema = z
  .object({
    id: z.string().min(1).max(128).regex(/^withdraw_[a-f0-9]{64}$/),
  })
  .strict();

export const withdrawalEmptySchema = z.object({}).strict();
