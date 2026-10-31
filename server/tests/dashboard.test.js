import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { auth } from "../src/config/firebase.js";

const state = vi.hoisted(() => ({ dashboardByUid: new Map() }));

vi.mock("../src/modules/dashboard/dashboard.repository.js", () => ({
  getDashboardRepositoryData: vi.fn(async (uid) => {
    return (
      state.dashboardByUid.get(uid) ?? {
        projects: { items: [], nextCursor: null },
        services: { items: [], nextCursor: null },
        projectCounts: {
          total: 0,
          byStatus: {
            published: 0,
            draft: 0,
            archived: 0,
            deleted: 0,
            other: 0,
          },
        },
        serviceCounts: {
          total: 0,
          byStatus: {
            published: 0,
            draft: 0,
            archived: 0,
            deleted: 0,
            other: 0,
          },
        },
        engagement: { likes: 0, comments: 0, views: 0 },
        applications: { sent: 0, received: 0 },
        stats: { ratingAvg: 0, ratingCount: 0 },
      }
    );
  }),
}));

vi.mock("../src/modules/projects/projects.repository.js", () => ({
  findProjectOwners: vi.fn(async () => new Map()),
}));

vi.mock("../src/modules/services/services.repository.js", () => ({
  findServiceOwners: vi.fn(async () => new Map()),
}));

const identities = {
  "token-user-a": { uid: "user-a", role: "freelancer" },
  "token-user-b": { uid: "user-b", role: "client" },
};

beforeEach(() => {
  state.dashboardByUid.clear();
  vi.spyOn(auth, "verifyIdToken").mockImplementation(async (token) => {
    const identity = identities[token];
    if (!identity) {
      throw Object.assign(new Error("Invalid"), {
        code: "auth/invalid-id-token",
      });
    }
    return identity;
  });
});

afterEach(() => vi.restoreAllMocks());

describe("dashboard API", () => {
  it("requires authentication", async () => {
    await request(app).get("/api/dashboard").expect(401);
  });

  it("returns empty data and real zero/null metrics for a new user", async () => {
    const response = await request(app)
      .get("/api/dashboard")
      .auth("token-user-a", { type: "bearer" })
      .expect(200);
    expect(response.body.data).toMatchObject({
      projects: [],
      services: [],
      counts: { projects: { total: 0 }, services: { total: 0 }, listings: 0 },
      engagement: { likes: 0, comments: 0, views: 0 },
      applications: { sent: 0, received: 0 },
      earnings: { total: 0, currency: null },
      satisfaction: { ratingAvg: null, ratingCount: 0 },
    });
  });

  it("scopes repository access to the verified caller", async () => {
    const { getDashboardRepositoryData } = await import(
      "../src/modules/dashboard/dashboard.repository.js"
    );
    state.dashboardByUid.set("user-a", {
      projects: {
        items: [
          {
            id: "project-a",
            ownerId: "user-a",
            title: "Owner project",
            description: "Description",
            category: "logo-design",
            tags: [],
            skills: [],
            images: [],
            status: "published",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
        nextCursor: null,
      },
      services: { items: [], nextCursor: null },
      projectCounts: {
        total: 1,
        byStatus: {
          published: 1,
          draft: 0,
          archived: 0,
          deleted: 0,
          other: 0,
        },
      },
      serviceCounts: {
        total: 0,
        byStatus: {
          published: 0,
          draft: 0,
          archived: 0,
          deleted: 0,
          other: 0,
        },
      },
      engagement: { likes: 2, comments: 1, views: 8 },
      stats: { ratingAvg: 4.5, ratingCount: 2 },
    });

    const response = await request(app)
      .get("/api/dashboard")
      .auth("token-user-a", { type: "bearer" })
      .expect(200);
    expect(getDashboardRepositoryData).toHaveBeenCalledWith(
      "user-a",
      expect.objectContaining({ limit: 20 }),
    );
    expect(response.body.data.projects.map(({ id }) => id)).toEqual([
      "project-a",
    ]);
    expect(response.body.data.satisfaction).toEqual({
      ratingAvg: 4.5,
      ratingCount: 2,
    });
  });

  it("rejects invalid dashboard pagination", async () => {
    await request(app)
      .get("/api/dashboard?limit=51")
      .auth("token-user-a", { type: "bearer" })
      .expect(400);
    await request(app)
      .get("/api/dashboard?unexpected=true")
      .auth("token-user-a", { type: "bearer" })
      .expect(400);
  });
});
