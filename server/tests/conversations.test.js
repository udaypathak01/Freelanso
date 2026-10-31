import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  repository: {
    createConversationMessage: vi.fn(),
    createOrFindConversation: vi.fn(),
    findConversation: vi.fn(),
    getUserUnreadCount: vi.fn(),
    listConversationMessages: vi.fn(),
    listUserConversations: vi.fn(),
    markConversationRead: vi.fn(),
  },
  findProject: vi.fn(),
  findUserProfile: vi.fn(),
}));

vi.mock("../src/modules/conversations/conversations.repository.js", () => state.repository);
vi.mock("../src/modules/users/users.repository.js", () => ({
  findUserProfile: state.findUserProfile,
}));
vi.mock("../src/modules/projects/projects.repository.js", () => ({
  findProject: state.findProject,
}));
vi.mock("../src/modules/notifications/notifications.service.js", () => ({
  notifyUser: vi.fn(),
  getNotifications: vi.fn(),
  readNotification: vi.fn(),
  readAllNotifications: vi.fn(),
}));

const {
  getConversationHistory,
  readConversation,
  startConversation,
} = await import("../src/modules/conversations/conversations.service.js");
const { createConversationSchema, sendMessageSchema } = await import(
  "../src/modules/conversations/conversations.schema.js"
);
const { toConversationDto } = await import(
  "../src/modules/conversations/conversations.mapper.js"
);

describe("conversation messaging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.findUserProfile.mockImplementation(async (uid) => ({
      displayName: `User ${uid}`,
      photoURL: null,
    }));
    state.findProject.mockResolvedValue({
      id: "project-1",
      title: "Project context",
      status: "published",
    });
    state.repository.createOrFindConversation.mockResolvedValue({
      id: "pair-id",
      participants: ["user-a", "user-b"],
    });
    state.repository.findConversation.mockResolvedValue({
      id: "pair-id",
      participants: ["user-a", "user-b"],
    });
    state.repository.markConversationRead.mockResolvedValue({ readAt: 123 });
  });

  it("accepts recipientId with optional post context and rejects self-chat inputs", () => {
    expect(
      createConversationSchema.safeParse({
        recipientId: "user-b",
        postId: "project-1",
      }).success,
    ).toBe(true);
    expect(
      createConversationSchema.safeParse({ recipientUid: "user-b" }).success,
    ).toBe(true);
    expect(
      createConversationSchema.safeParse({
        recipientId: "user-a",
        recipientUid: "user-b",
      }).success,
    ).toBe(false);
    expect(
      sendMessageSchema.safeParse({ text: "Hello", tempId: "local-message-1" })
        .success,
    ).toBe(true);
    expect(sendMessageSchema.safeParse({ text: "x".repeat(2001) }).success).toBe(
      false,
    );
  });

  it("creates a deterministic one-to-one conversation with post context", async () => {
    const result = await startConversation(
      { uid: "user-a", role: "freelancer" },
      "user-b",
      "project-1",
    );

    expect(result.id).toBe("pair-id");
    expect(state.repository.createOrFindConversation).toHaveBeenCalledWith(
      ["user-a", "user-b"],
      expect.objectContaining({
        "user-a": expect.objectContaining({ name: "User user-a" }),
        "user-b": expect.objectContaining({ name: "User user-b" }),
      }),
      "project-1",
      "Project context",
    );
    await expect(
      startConversation({ uid: "user-a" }, "user-a"),
    ).rejects.toThrow("A conversation must include another user");
  });

  it("checks membership for history and read requests", async () => {
    await expect(
      getConversationHistory(
        { uid: "outsider" },
        "pair-id",
        { limit: 30 },
      ),
    ).rejects.toThrow("not allowed to perform this action");
    await expect(
      readConversation({ uid: "user-a" }, "pair-id"),
    ).resolves.toEqual({ readAt: 123 });
  });

  it("maps legacy message strings and new unread/context fields", () => {
    expect(
      toConversationDto("pair-id", {
        participants: ["user-a", "user-b"],
        userInfo: {},
        lastMessage: "hello",
        lastMessageSenderId: "user-a",
        lastMessageTime: 123,
        unread: { "user-b": 1 },
        postId: "project-1",
        postTitle: "Project context",
      }),
    ).toMatchObject({
      lastMessage: { text: "hello", senderId: "user-a", createdAt: 123 },
      unread: { "user-b": 1 },
      postId: "project-1",
      postTitle: "Project context",
    });
  });
});
