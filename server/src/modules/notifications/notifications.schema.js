import { z } from "zod";

export const notificationsEmptySchema = z.object({}).strict();
export const notificationIdParamsSchema = z
  .object({
    id: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
