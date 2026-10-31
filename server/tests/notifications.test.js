import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { auth } from "../src/config/firebase.js";

const mocks = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  readNotification: vi.fn(),
  readAllNotifications: vi.fn(),
}));

vi.mock("../src/modules/notifications/notifications.service.js", () => ({
  notifyUser: vi.fn(),
  getNotifications: mocks.getNotifications,
  readNotification: mocks.readNotification,
  readAllNotifications: mocks.readAllNotifications,
}));

beforeEach(() => {
  vi.spyOn(auth, "verifyIdToken").mockImplementation(async (token) => {
    if (token !== "notification-user-token") {
      throw Object.assign(new Error("Invalid"), {
        code: "auth/invalid-id-token",
      });
    }
    return { uid: "notification-user", role: "client" };
  });
  mocks.getNotifications.mockResolvedValue([]);
  mocks.readNotification.mockResolvedValue({
    id: "a".repeat(64),
    readAt: 123,
  });
  mocks.readAllNotifications.mockResolvedValue({ readAt: 123, count: 2 });
});

afterEach(() => vi.restoreAllMocks());

describe("notifications API", () => {
  it("requires authentication and scopes list results to the caller", async () => {
    await request(app).get("/api/notifications").expect(401);

    await request(app)
      .get("/api/notifications")
      .auth("notification-user-token", { type: "bearer" })
      .expect(200);
    expect(mocks.getNotifications).toHaveBeenCalledWith("notification-user");
  });

  it("marks one notification read for the authenticated user", async () => {
    await request(app)
      .post(`/api/notifications/${"a".repeat(64)}/read`)
      .auth("notification-user-token", { type: "bearer" })
      .send({})
      .expect(200);
    expect(mocks.readNotification).toHaveBeenCalledWith(
      "notification-user",
      "a".repeat(64),
    );
  });

  it("marks all notifications read for the authenticated user", async () => {
    await request(app)
      .post("/api/notifications/read-all")
      .auth("notification-user-token", { type: "bearer" })
      .send({})
      .expect(200);
    expect(mocks.readAllNotifications).toHaveBeenCalledWith(
      "notification-user",
    );
  });
});
