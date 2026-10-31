import { asyncHandler } from "../../utils/asyncHandler.js";
import { created, ok, paginated } from "../../utils/response.js";
import { toConversationDto } from "./conversations.mapper.js";
import {
  getConversationHistory,
  listMyConversations,
  readConversation,
  sendConversationMessage,
  startConversation,
  unreadCount,
} from "./conversations.service.js";

export const postConversation = asyncHandler(async (req, res) => {
  const conversation = await startConversation(
    req.user,
    req.validated.body.recipientId ?? req.validated.body.recipientUid,
    req.validated.body.postId,
  );
  return created(
    res,
    toConversationDto(conversation.id, conversation),
  );
});

export const getConversations = asyncHandler(async (req, res) => {
  const conversations = await listMyConversations(req.user);
  return ok(
    res,
    conversations.map((conversation) =>
      toConversationDto(conversation.id, conversation),
    ),
  );
});

export const getMessages = asyncHandler(async (req, res) => {
  const { items, hasMore, nextCursor } = await getConversationHistory(
    req.user,
    req.validated.params.id,
    req.validated.query,
  );
  return paginated(res, items, nextCursor, {
    hasMore,
    limit: req.validated.query.limit,
  });
});

export const postMessage = asyncHandler(async (req, res) => {
  const message = await sendConversationMessage(
    req.user,
    req.validated.params.id,
    req.validated.body.text,
    req.validated.body.tempId,
  );
  return created(res, message, {
    tempId: req.validated.body.tempId ?? null,
  });
});

export const postReadReceipt = asyncHandler(async (req, res) => {
  const result = await readConversation(req.user, req.validated.params.id);
  return ok(res, result);
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  return ok(res, { total: await unreadCount(req.user) });
});
