import { z } from "zod";

export const matchScoreAllSchema = z
  .object({
    projectId: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();

export const emptyObjectSchema = z.object({}).strict();
