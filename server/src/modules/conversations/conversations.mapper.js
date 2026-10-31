function safeAvatar(value) {
  if (typeof value !== "string") return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

export function conversationParticipant(uid, profile = {}) {
  return {
    name:
      typeof profile.displayName === "string" && profile.displayName.trim()
        ? profile.displayName.trim().slice(0, 100)
        : "Freelanso member",
    avatar: safeAvatar(profile.photoURL),
    isOnline: false,
  };
}

function normalizeParticipants(participants) {
  if (Array.isArray(participants)) {
    return [...new Set(participants.filter((uid) => typeof uid === "string"))];
  }

  if (participants && typeof participants === "object") {
    return [
      ...new Set(
        Object.entries(participants)
          .filter(([_key, value]) => value === true || typeof value === "string")
          .map(([key, value]) => (typeof value === "string" ? value : key)),
      ),
    ];
  }

  return [];
}

export function toConversationDto(id, conversation) {
  let participants = normalizeParticipants(conversation?.participants);
  if (!participants.length) {
    participants = normalizeParticipants(conversation?.participantsMap);
  }
  const rawUserInfo =
    conversation.userInfo &&
    typeof conversation.userInfo === "object" &&
    !Array.isArray(conversation.userInfo)
      ? conversation.userInfo
      : {};
  const userInfo = Object.fromEntries(
    participants.map((uid) => {
      const profile = rawUserInfo[uid] ?? {};
      return [
        uid,
        {
          name:
            typeof profile.name === "string"
              ? profile.name.slice(0, 100)
              : "Freelanso member",
          avatar: safeAvatar(profile.avatar),
          isOnline: profile.isOnline === true,
        },
      ];
    }),
  );
  return {
    id,
    participants,
    participantsMap: Object.fromEntries(participants.map((uid) => [uid, true])),
    userInfo,
    lastMessage: {
      text:
        typeof conversation.lastMessage === "string"
          ? conversation.lastMessage
          : typeof conversation.lastMessage?.text === "string"
            ? conversation.lastMessage.text
            : "",
      senderId:
        typeof conversation.lastMessageSenderId === "string"
          ? conversation.lastMessageSenderId
          : conversation.lastMessage?.senderId ?? null,
      createdAt:
        conversation.lastMessageTime ??
        conversation.lastMessage?.createdAt ??
        null,
    },
    lastMessageTime: conversation.lastMessageTime ?? null,
    unread: conversation.unread && typeof conversation.unread === "object"
      ? conversation.unread
      : {},
    postId: typeof conversation.postId === "string" ? conversation.postId : null,
    postTitle:
      typeof conversation.postTitle === "string"
        ? conversation.postTitle.slice(0, 200)
        : null,
    createdAt: conversation.createdAt ?? null,
    updatedAt: conversation.updatedAt ?? conversation.lastMessageTime ?? null,
  };
}
