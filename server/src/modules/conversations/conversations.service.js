import { ForbiddenError, NotFoundError, ValidationError } from "../../utils/AppError.js";
import { findUserProfile } from "../users/users.repository.js";
import { findProject } from "../projects/projects.repository.js";
import { conversationParticipant } from "./conversations.mapper.js";
import { notifyUser } from "../notifications/notifications.service.js";
import {
  createConversationMessage,
  createOrFindConversation,
  findConversation,
  getUserUnreadCount,
  listConversationMessages,
  listUserConversations,
  markConversationRead,
} from "./conversations.repository.js";

export async function startConversation(actor, recipientUid, postId) {
  if (actor.uid === recipientUid) {
    throw new ValidationError([], "A conversation must include another user");
  }
  const [callerProfile, recipientProfile, project] = await Promise.all([
    findUserProfile(actor.uid),
    findUserProfile(recipientUid),
    postId ? findProject(postId) : Promise.resolve(null),
  ]);
  if (!recipientProfile) throw new NotFoundError("Conversation recipient not found");
  if (postId && (!project || project.status !== "published")) {
    throw new NotFoundError("Project context not found");
  }
  if (actor.role !== "admin" && recipientProfile.status === "disabled") {
    throw new ForbiddenError();
  }
  const userInfo = {
    [actor.uid]: conversationParticipant(actor.uid, {
      displayName: callerProfile?.displayName ?? actor.displayName,
      photoURL: callerProfile?.photoURL ?? actor.photoURL,
    }),
    [recipientUid]: conversationParticipant(recipientUid, recipientProfile),
  };
  return createOrFindConversation(
    [actor.uid, recipientUid],
    userInfo,
    postId,
    project?.title,
  );
}

function getParticipantIds(conversation) {
  if (Array.isArray(conversation.participants)) {
    return conversation.participants;
  }
  if (conversation.participants && typeof conversation.participants === "object") {
    return Object.entries(conversation.participants)
      .filter(([, value]) => value === true || typeof value === "string")
      .map(([uid, value]) => (typeof value === "string" ? value : uid));
  }
  return Object.keys(conversation.participantsMap ?? {}).filter(
    (uid) => conversation.participantsMap[uid] === true,
  );
}

async function assertParticipant(conversationId, uid) {
  const conversation = await findConversation(conversationId);
  const participants = getParticipantIds(conversation);
  if (!participants.includes(uid)) {
    throw new ForbiddenError();
  }
  return conversation;
}

export async function listMyConversations(actor) {
  return listUserConversations(actor.uid);
}

export async function getConversationHistory(actor, conversationId, filters) {
  await assertParticipant(conversationId, actor.uid);
  return listConversationMessages(conversationId, filters);
}

export async function sendConversationMessage(actor, conversationId, text, tempId) {
  const conversation = await assertParticipant(conversationId, actor.uid);
  const participants = getParticipantIds(conversation);
  const recipientUid = participants.find((uid) => uid !== actor.uid);
  const message = await createConversationMessage(
    conversationId,
    actor.uid,
    text,
    tempId,
  );
  if (recipientUid) {
    await notifyUser(
      recipientUid,
      {
        type: "message",
        title: `New message from ${actor.displayName || "a freelancer"}`,
        body: text.slice(0, 160),
        href: `/messages/${encodeURIComponent(conversationId)}`,
        actorUid: actor.uid,
        actorName: actor.displayName || "Freelanso member",
        createdAt: message.createdAt,
        readAt: null,
      },
      message.id,
    );
  }
  return message;
}

export async function readConversation(actor, conversationId) {
  await assertParticipant(conversationId, actor.uid);
  return markConversationRead(conversationId, actor.uid);
}

export async function unreadCount(actor) {
  return getUserUnreadCount(actor.uid);
}
