import { z } from "zod";

export const createConversationSchema = z
  .object({
    recipientId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/).optional(),
    recipientUid: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/).optional(),
    postId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/).optional(),
  })
  .strict()
  .refine(
    ({ recipientId, recipientUid }) => Boolean(recipientId) !== Boolean(recipientUid),
    { message: "Provide exactly one recipientId" },
  );

export const conversationParamsSchema = z
  .object({
    id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();

export const conversationsEmptySchema = z.object({}).strict();

export const messageParamsSchema = z
  .object({
    id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();

export const messageListQuerySchema = z
  .object({
    before: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(30),
  })
  .strict();

export const sendMessageSchema = z
  .object({
    text: z.string().trim().min(1).max(2000),
    tempId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/).optional(),
  })
  .strict();
