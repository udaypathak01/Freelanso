import { createHash } from "node:crypto";
import { realtimeDatabase } from "../../config/firebase.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../utils/AppError.js";

function pairKey(uids) {
  return `conv_${createHash("sha256")
    .update([...uids].sort().join("\n"))
    .digest("hex")}`;
}

function participantIds(conversation) {
  const participants = conversation?.participants;
  if (Array.isArray(participants)) {
    return [...new Set(participants.filter((uid) => typeof uid === "string"))].sort();
  }
  if (participants && typeof participants === "object") {
    return [
      ...new Set(
        Object.entries(participants)
          .filter(([_key, value]) => value === true || typeof value === "string")
          .map(([key, value]) => (typeof value === "string" ? value : key)),
      ),
    ].sort();
  }
  const map = conversation?.participantsMap;
  if (map && typeof map === "object") {
    return Object.entries(map)
      .filter(([, value]) => value === true)
      .map(([uid]) => uid)
      .sort();
  }
  return [];
}

function isPair(conversation, expected) {
  const actual = participantIds(conversation);
  return (
    actual.length === expected.length &&
    actual.every((uid, index) => uid === expected[index])
  );
}

async function runCachedTransaction(reference, update) {
  let resolveInitialValue;
  let rejectInitialValue;
  const initialValue = new Promise((resolve, reject) => {
    resolveInitialValue = resolve;
    rejectInitialValue = reject;
  });
  let hasInitialValue = false;
  const onValue = (snapshot) => {
    if (hasInitialValue) return;
    hasInitialValue = true;
    resolveInitialValue(snapshot);
  };
  const onCancelled = (error) => {
    if (hasInitialValue) return;
    hasInitialValue = true;
    rejectInitialValue(error);
  };

  reference.on("value", onValue, onCancelled);
  try {
    await initialValue;
    return await reference.transaction(update);
  } finally {
    reference.off("value", onValue);
  }
}

export async function createOrFindConversation(uids, userInfo, postId, postTitle) {
  const participants = [...new Set(uids)].sort();
  const conversationId = pairKey(participants);
  const canonicalRef = realtimeDatabase.ref(`conversations/${conversationId}`);
  const legacyId = participants.join("_");
  const legacyRef =
    legacyId === conversationId
      ? canonicalRef
      : realtimeDatabase.ref(`conversations/${legacyId}`);

  const [canonicalSnapshot, legacySnapshot] = await Promise.all([
    canonicalRef.get(),
    legacyRef.get(),
  ]);
  const existingRef = canonicalSnapshot.exists()
    ? canonicalRef
    : legacySnapshot.exists()
      ? legacyRef
      : canonicalRef;
  const existingId = existingRef.key;
  let invalidExisting = false;

  const result = await runCachedTransaction(existingRef, (current) => {
    if (current && !isPair(current, participants)) {
      invalidExisting = true;
      return;
    }
    const previousInfo =
      current?.userInfo &&
      typeof current.userInfo === "object" &&
      !Array.isArray(current.userInfo)
        ? current.userInfo
        : {};
    return {
      ...(current ?? {}),
      participants,
      participantsMap: Object.fromEntries(
        participants.map((uid) => [uid, true]),
      ),
      userInfo: { ...previousInfo, ...userInfo },
      ...(postId && !current?.postId ? { postId } : {}),
      ...(postTitle && !current?.postTitle ? { postTitle } : {}),
      createdAt: current?.createdAt ?? Date.now(),
      updatedAt: current?.updatedAt ?? Date.now(),
      lastMessage:
        typeof current?.lastMessage === "string"
          ? current.lastMessage
          : "Started a conversation",
      lastMessageTime: current?.lastMessageTime ?? Date.now(),
      unread: current?.unread ?? Object.fromEntries(participants.map((uid) => [uid, 0])),
    };
  });

  if (!result.committed || invalidExisting) {
    throw new ConflictError("Existing conversation participants are invalid");
  }
  await realtimeDatabase
    .ref("userConversations")
    .update(
      Object.fromEntries(
        participants.map((uid) => [`${uid}/${existingId}`, true]),
      ),
    );
  return { id: existingId, ...result.snapshot.val() };
}

export async function findConversation(id) {
  const snapshot = await realtimeDatabase.ref(`conversations/${id}`).get();
  if (!snapshot.exists()) throw new NotFoundError("Conversation not found");
  return { id, ...snapshot.val() };
}

export async function listUserConversations(uid) {
  const index = await realtimeDatabase.ref(`userConversations/${uid}`).get();
  const ids = Object.keys(index.val() ?? {});
  const snapshots = await Promise.all(
    ids.map((id) => realtimeDatabase.ref(`conversations/${id}`).get()),
  );
  return snapshots
    .filter((snapshot) => snapshot.exists())
    .map((snapshot) => ({ id: snapshot.key, ...snapshot.val() }))
    .filter((conversation) => participantIds(conversation).includes(uid))
    .sort((left, right) => (right.updatedAt ?? right.lastMessageTime ?? 0) - (left.updatedAt ?? left.lastMessageTime ?? 0));
}

export async function listConversationMessages(id, { before, limit }) {
  let query = realtimeDatabase.ref(`messages/${id}`).orderByKey();
  if (before) query = query.endAt(before);
  const snapshot = await query.limitToLast(limit + (before ? 2 : 1)).get();
  const entries = Object.entries(snapshot.val() ?? {}).filter(
    ([messageId]) => messageId !== before,
  );
  const hasMore = entries.length > limit;
  const page = hasMore ? entries.slice(-limit) : entries;
  return {
    items: page.map(([messageId, message]) => ({ id: messageId, ...message })),
    hasMore,
    nextCursor: hasMore ? page[0]?.[0] ?? null : null,
  };
}

export async function createConversationMessage(id, senderId, text, tempId) {
  const conversationRef = realtimeDatabase.ref(`conversations/${id}`);
  const conversationSnapshot = await conversationRef.get();
  if (!conversationSnapshot.exists()) throw new NotFoundError("Conversation not found");
  const conversation = conversationSnapshot.val();
  const participants = participantIds(conversation);
  if (!participants.includes(senderId)) throw new ForbiddenError();
  const recipientId = participants.find((uid) => uid !== senderId);
  if (!recipientId) throw new ConflictError("Conversation participants are invalid");
  const createdAt = Date.now();
  const presence = await realtimeDatabase
    .ref(`presence/${recipientId}/connections`)
    .get();
  const connected = Object.values(presence.val() ?? {}).some((value) => value === true);
  const messagesRef = realtimeDatabase.ref(`messages/${id}`);
  const messageRef = messagesRef.push();
  const idempotencyRef = tempId
    ? realtimeDatabase.ref(
        `messageIds/${id}/${createHash("sha256").update(senderId).digest("hex")}/${tempId}`,
      )
    : null;
  if (idempotencyRef) {
    const reservation = await idempotencyRef.transaction(
      (current) => current ?? messageRef.key,
    );
    if (!reservation.committed) {
      const existing = await messagesRef.child(reservation.snapshot.val()).get();
      const stored = existing.val();
      if (!stored || stored.senderId !== senderId) {
        throw new ConflictError("Message id is already in use");
      }
      return { id: existing.key, conversationId: id, ...stored };
    }
  }
  const message = {
    senderId,
    text,
    createdAt,
    ...(tempId ? { tempId } : {}),
    ...(connected ? { deliveredAt: createdAt } : {}),
  };
  let invalidConversation = false;
  try {
    if (tempId) {
      const result = await messageRef.transaction((current) => current ?? message);
      if (!result.committed) {
        const stored = result.snapshot.val();
        if (stored.senderId !== senderId) {
          throw new ConflictError("Message id is already in use");
        }
        return { id: messageRef.key, conversationId: id, ...stored };
      }
    } else {
      await messageRef.set(message);
    }

    const updateResult = await runCachedTransaction(conversationRef, (current) => {
      if (!current || !participantIds(current).includes(senderId)) {
        invalidConversation = true;
        return;
      }
      const unread = { ...(current.unread ?? {}) };
      unread[recipientId] = (Number(unread[recipientId]) || 0) + 1;
      unread[senderId] = 0;
      return {
        ...current,
        unread,
        lastMessage: text,
        lastMessageSenderId: senderId,
        lastMessageTime: createdAt,
        updatedAt: createdAt,
        lastRead: { ...(current.lastRead ?? {}), [senderId]: createdAt },
      };
    });
    if (!updateResult.committed || invalidConversation) {
      throw new ConflictError("Conversation could not be updated");
    }
  } catch (error) {
    await messageRef.remove();
    if (idempotencyRef) await idempotencyRef.remove();
    throw error;
  }
  return { id: messageRef.key, conversationId: id, ...message };
}

export async function markConversationRead(id, uid) {
  const conversation = await findConversation(id);
  if (!participantIds(conversation).includes(uid)) throw new ForbiddenError();
  const snapshot = await realtimeDatabase.ref(`messages/${id}`).get();
  const readAt = Date.now();
  const updates = {};
  for (const [messageId, message] of Object.entries(snapshot.val() ?? {})) {
    if (message.senderId !== uid && !message.readAt) {
      updates[`messages/${id}/${messageId}/readAt`] = readAt;
    }
  }
  updates[`conversations/${id}/unread/${uid}`] = 0;
  updates[`conversations/${id}/lastRead/${uid}`] = readAt;
  updates[`readReceipts/${id}/${uid}`] = readAt;
  await realtimeDatabase.ref().update(updates);
  return { readAt };
}

export async function getUserUnreadCount(uid) {
  const conversations = await listUserConversations(uid);
  return conversations.reduce((total, conversation) => {
    const unreadCount = Number(conversation.unread?.[uid]) || 0;
    return total + unreadCount;
  }, 0);
}

export async function migrateConversationShapes({ dryRun = false } = {}) {
  const snapshot = await realtimeDatabase.ref("conversations").get();
  const conversations = snapshot.val() ?? {};
  const updates = {};
  let migrated = 0;
  let skipped = 0;

  for (const [id, conversation] of Object.entries(conversations)) {
    const participants = participantIds(conversation);
    if (participants.length < 2) {
      skipped += 1;
      continue;
    }
    const participantsMap = Object.fromEntries(
      participants.map((uid) => [uid, true]),
    );
    if (
      Array.isArray(conversation.participants) &&
      JSON.stringify([...conversation.participants].sort()) ===
        JSON.stringify(participants) &&
      JSON.stringify(conversation.participantsMap ?? {}) ===
        JSON.stringify(participantsMap)
    ) {
      continue;
    }
    migrated += 1;
    if (dryRun) continue;
    updates[`conversations/${id}/participants`] = participants;
    updates[`conversations/${id}/participantsMap`] = participantsMap;
    for (const uid of participants) {
      updates[`userConversations/${uid}/${id}`] = true;
    }
  }

  if (!dryRun) {
    const paths = Object.keys(updates);
    for (let offset = 0; offset < paths.length; offset += 200) {
      const batch = Object.fromEntries(paths.slice(offset, offset + 200).map((path) => [path, updates[path]]));
      await realtimeDatabase.ref().update(batch);
    }
  }
  return { migrated, skipped };
}
