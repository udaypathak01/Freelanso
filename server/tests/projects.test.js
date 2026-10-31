import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { auth } from "../src/config/firebase.js";
import {
  addProjectView,
  createProjectComment,
  deleteProjectComment,
  deleteProjectTree,
  findProjectComment,
  findPendingCloudinaryDeletions,
  hasProjectLike,
  queueCloudinaryDeletions,
  removeCloudinaryDeletionJob,
  rescheduleCloudinaryDeletion,
  rollbackCloudinaryDeletions,
  toggleProjectLike,
  updateProject,
} from "../src/modules/projects/projects.repository.js";
import {
  addProjectComment,
  buildSearchKeywords,
  deleteExistingProject,
  getProject,
  likeProject,
  listProjectComments,
  processCloudinaryDeletionQueue,
  removeProjectComment,
  updateExistingProject,
} from "../src/modules/projects/projects.service.js";
import { toProjectDto } from "../src/modules/projects/projects.mapper.js";

const state = vi.hoisted(() => ({
  projects: new Map(),
  likes: new Map(),
  comments: new Map(),
  id: 0,
}));

vi.mock("../src/modules/projects/projects.repository.js", () => ({
  createProject: vi.fn(async (ownerId, input, searchKeywords) => {
    const id = `project-${++state.id}`;
    const project = {
      ...input,
      id,
      ownerId,
      status: "published",
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      searchKeywords,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    state.projects.set(id, project);
    state.likes.set(id, new Set());
    state.comments.set(id, new Map());
    return project;
  }),
  findProject: vi.fn(async (id) => state.projects.get(id) ?? null),
  hasProjectLike: vi.fn(
    async (id, uid) => state.likes.get(id)?.has(uid) ?? false,
  ),
  findProjects: vi.fn(async (_filters, { limit = 20 } = {}) => {
    const items = [...state.projects.values()].filter(
      (project) => project.status === "published",
    );
    return { items: items.slice(0, limit), nextCursor: null };
  }),
  findProjectsByOwner: vi.fn(async (ownerId) => ({
    items: [...state.projects.values()].filter(
      (project) => project.ownerId === ownerId,
    ),
    nextCursor: null,
  })),
  findProjectOwners: vi.fn(async (projects) => {
    const owners = new Map();
    for (const project of projects) {
      owners.set(project.ownerId, {
        displayName: `Name ${project.ownerId}`,
        photoURL:
          "https://res.cloudinary.com/test-cloud/image/upload/v1/avatar.jpg",
        email: "private@example.test",
        stats: { ratingAvg: 4.8 },
      });
    }
    return owners;
  }),
  updateProject: vi.fn(async (id, updates, searchKeywords) => {
    const project = state.projects.get(id);
    if (!project) return null;
    Object.assign(project, updates, { updatedAt: new Date() });
    if (searchKeywords) project.searchKeywords = searchKeywords;
    return project;
  }),
  deleteProjectTree: vi.fn(async (id) => {
    const existed = state.projects.delete(id);
    state.likes.delete(id);
    state.comments.delete(id);
    return existed;
  }),
  toggleProjectLike: vi.fn(async (id, uid) => {
    const project = state.projects.get(id);
    if (!project) return null;
    const likes = state.likes.get(id);
    const liked = !likes.has(uid);
    if (liked) likes.add(uid);
    else likes.delete(uid);
    project.likesCount = likes.size;
    return { liked, count: likes.size };
  }),
  findProjectLikesCount: vi.fn(async (id) => state.likes.get(id)?.size ?? 0),
  addProjectView: vi.fn(async () => true),
  createProjectComment: vi.fn(async (id, authorId, text) => {
    const project = state.projects.get(id);
    if (!project) return null;
    const idForComment = `comment-${state.comments.get(id).size + 1}`;
    const comment = {
      id: idForComment,
      projectId: id,
      authorId,
      text,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    state.comments.get(id).set(idForComment, comment);
    project.commentsCount += 1;
    return comment;
  }),
  findProjectComments: vi.fn(async (id) => ({
    items: [...(state.comments.get(id)?.values() ?? [])].map((comment) => ({
      ...comment,
      author: { displayName: `Name ${comment.authorId}` },
    })),
    nextCursor: null,
  })),
  findProjectComment: vi.fn(
    async (id, commentId) => state.comments.get(id)?.get(commentId) ?? null,
  ),
  deleteProjectComment: vi.fn(async (id, commentId) => {
    const deleted = state.comments.get(id)?.delete(commentId) ?? false;
    if (deleted) state.projects.get(id).commentsCount -= 1;
    return deleted;
  }),
  queueCloudinaryDeletions: vi.fn(async () => []),
  removeCloudinaryDeletionJob: vi.fn(async () => {}),
  rescheduleCloudinaryDeletion: vi.fn(async () => {}),
  findPendingCloudinaryDeletions: vi.fn(async () => []),
  rollbackCloudinaryDeletions: vi.fn(async () => {}),
}));

vi.mock("../src/modules/notifications/notifications.service.js", () => ({
  notifyUser: vi.fn(),
  getNotifications: vi.fn(),
  readNotification: vi.fn(),
  readAllNotifications: vi.fn(),
}));

const validAsset = {
  url: "https://res.cloudinary.com/test-cloud/image/upload/v123/projects/sample.jpg",
  publicId: "projects/sample",
  mediaType: "image",
  resourceType: "image",
};

const validProject = () => ({
  title: "A project title",
  description: "A".repeat(100),
  category: "logo-design",
  tags: ["branding"],
  skills: ["Figma", "Illustrator"],
  price: 2500,
  deliveryDays: 5,
  level: "Intermediate",
  images: [validAsset],
});

const identities = {
  "token-a": { uid: "user-a", role: "freelancer", name: "A" },
  "token-b": { uid: "user-b", role: "freelancer", name: "B" },
  "token-client": { uid: "user-client", role: "client", name: "Client" },
  "token-admin": { uid: "user-admin", role: "admin", name: "Admin" },
};

function withToken(token) {
  return { Authorization: `Bearer ${token}` };
}

beforeEach(() => {
  state.projects.clear();
  state.likes.clear();
  state.comments.clear();
  state.id = 0;
  vi.spyOn(auth, "verifyIdToken").mockImplementation(async (token) => {
    const identity = identities[token];
    if (!identity)
      throw Object.assign(new Error("Invalid"), {
        code: "auth/invalid-id-token",
      });
    return identity;
  });
});

afterEach(() => vi.restoreAllMocks());

describe("projects API", () => {
  it("requires authentication for create, update, delete, likes, and comments", async () => {
    await request(app).post("/api/projects").send(validProject()).expect(401);
    await request(app)
      .put("/api/projects/project-1")
      .send({ title: "Updated title" })
      .expect(401);
    await request(app).delete("/api/projects/project-1").expect(401);
    await request(app)
      .post("/api/projects/project-1/like")
      .send({})
      .expect(401);
    await request(app)
      .post("/api/projects/project-1/comments")
      .send({ text: "Hello" })
      .expect(401);
  });

  it("forbids client accounts from publishing", async () => {
    const response = await request(app)
      .post("/api/projects")
      .set(withToken("token-client"))
      .send(validProject())
      .expect(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(state.projects.size).toBe(0);
  });

  it.each([
    [
      "missing title",
      (project) => {
        const invalid = { ...project };
        delete invalid.title;
        return invalid;
      },
    ],
    ["negative price", (project) => ({ ...project, price: -1 })],
    [
      "eleven assets",
      (project) => ({ ...project, images: Array(11).fill(validAsset) }),
    ],
    [
      "foreign image URL",
      (project) => ({
        ...project,
        images: [{ ...validAsset, url: "https://example.test/asset.jpg" }],
      }),
    ],
    ["extra field", (project) => ({ ...project, extra: true })],
    ["owner tampering", (project) => ({ ...project, ownerId: "user-b" })],
    ["counter tampering", (project) => ({ ...project, likesCount: 999 })],
    ["status tampering", (project) => ({ ...project, status: "draft" })],
  ])("rejects invalid create input: %s", async (_name, modify) => {
    const response = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send(modify(validProject()))
      .expect(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(state.projects.size).toBe(0);
  });

  it("creates an owner-bound project and returns a safe DTO", async () => {
    const response = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send(validProject())
      .expect(201);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        ownerId: "user-a",
        authorUid: "user-a",
        status: "published",
        price: 2500,
        category: "logo-design",
        owner: { displayName: "Name user-a", ratingAvg: 4.8 },
      },
    });
    expect(response.body.data.owner.email).toBeUndefined();
    expect(response.body.data.searchKeywords).toBeUndefined();
    expect([...state.projects.values()][0].searchKeywords).toEqual(
      expect.arrayContaining(["project", "title", "branding", "figma"]),
    );
  });

  it("creates five media items with links and preserves a selected cover", async () => {
    const additionalImages = [2, 3, 4].map((number) => ({
      ...validAsset,
      url: `https://res.cloudinary.com/test-cloud/image/upload/v123/projects/sample-${number}.jpg`,
      publicId: `projects/sample-${number}`,
      isCover: false,
    }));
    const videoAsset = {
      url: "https://res.cloudinary.com/test-cloud/video/upload/v123/projects/demo.mp4",
      publicId: "projects/demo",
      mediaType: "video",
      resourceType: "video",
      type: "video",
      isCover: false,
    };
    const response = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send({
        ...validProject(),
        images: undefined,
        media: [
          { ...validAsset, type: "image", isCover: true },
          {
            ...validAsset,
            url: "https://res.cloudinary.com/test-cloud/image/upload/v123/projects/sample-2.jpg",
            publicId: "projects/sample-2",
            type: "image",
            isCover: false,
          },
          ...additionalImages.slice(1).map((asset) => ({
            ...asset,
            type: "image",
          })),
          videoAsset,
        ],
        links: [
          { label: "Live Demo", url: "https://demo.example.test" },
          { label: "GitHub", url: "https://github.com/example/project" },
        ],
      })
      .expect(201);

    expect(response.body.data.media).toHaveLength(5);
    expect(response.body.data.media.filter((asset) => asset.isCover)).toHaveLength(1);
    expect(response.body.data.media.map((asset) => asset.type)).toEqual([
      "image",
      "image",
      "image",
      "image",
      "video",
    ]);
    expect(response.body.data.links).toHaveLength(2);
    expect([...state.projects.values()][0].coverImage).toBe(validAsset.url);
  });

  it("maps a legacy coverImage-only project to one media item", () => {
    const legacyUrl =
      "https://res.cloudinary.com/test-cloud/image/upload/v123/projects/legacy.jpg";
    const dto = toProjectDto(
      "legacy-project",
      {
        coverImage: legacyUrl,
        mediaType: "image",
        ownerId: "user-a",
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
      },
    );

    expect(dto.media).toEqual([
      { url: legacyUrl, type: "image", isCover: true, resourceType: "image" },
    ]);
    expect(dto.imageUrl).toBe(legacyUrl);
  });

  it("does not allow another owner to edit or delete a project, while admins can", async () => {
    const created = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send(validProject())
      .expect(201);
    const id = created.body.data.id;

    await request(app)
      .put(`/api/projects/${id}`)
      .set(withToken("token-b"))
      .send({ title: "Changed title" })
      .expect(403);
    await request(app)
      .delete(`/api/projects/${id}`)
      .set(withToken("token-b"))
      .expect(403);
    expect(state.projects.get(id).title).toBe("A project title");

    await request(app)
      .put(`/api/projects/${id}`)
      .set(withToken("token-admin"))
      .send({ title: "Admin updated title" })
      .expect(200);
    await request(app)
      .delete(`/api/projects/${id}`)
      .set(withToken("token-admin"))
      .expect(204);
    expect(state.projects.has(id)).toBe(false);
  });

  it("rejects protected-field updates and hides another user's draft", async () => {
    const created = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send(validProject())
      .expect(201);
    const id = created.body.data.id;

    const tampered = await request(app)
      .put(`/api/projects/${id}`)
      .set(withToken("token-a"))
      .send({ status: "archived", ownerId: "user-b", likesCount: 900 })
      .expect(400);
    expect(tampered.body.error.code).toBe("VALIDATION_ERROR");
    expect(state.projects.get(id)).toMatchObject({
      status: "published",
      ownerId: "user-a",
      likesCount: 0,
    });

    state.projects.get(id).status = "draft";
    await request(app).get(`/api/projects/${id}`).expect(404);
    const ownDraft = await request(app)
      .get(`/api/projects/${id}`)
      .set(withToken("token-a"))
      .expect(200);
    expect(ownDraft.body.data.status).toBe("draft");
  });

  it("returns created projects from a fresh list request without static data", async () => {
    const created = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send(validProject())
      .expect(201);
    const response = await request(app)
      .get("/api/projects?category=logo-design")
      .expect(200);
    expect(response.body.data.map((project) => project.id)).toContain(
      created.body.data.id,
    );
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].source).toBe("live");
  });

  it("toggles likes using the authenticated uid and strips markup from comments", async () => {
    const created = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send(validProject())
      .expect(201);
    const id = created.body.data.id;

    const like = await request(app)
      .post(`/api/projects/${id}/like`)
      .set(withToken("token-b"))
      .send({})
      .expect(200);
    expect(like.body.data).toEqual({ liked: true, count: 1 });
    const unlike = await request(app)
      .post(`/api/projects/${id}/like`)
      .set(withToken("token-b"))
      .send({})
      .expect(200);
    expect(unlike.body.data).toEqual({ liked: false, count: 0 });

    const comment = await request(app)
      .post(`/api/projects/${id}/comments`)
      .set(withToken("token-b"))
      .send({ text: "<script>alert(1)</script><b>Hello</b>" })
      .expect(201);
    expect(comment.body.data.text).toBe("Hello");
    await request(app)
      .delete(`/api/projects/${id}/comments/${comment.body.data.id}`)
      .set(withToken("token-a"))
      .expect(204);
  });

  it("validates pagination, filters, skill limits, and unknown query fields", async () => {
    await request(app).get("/api/projects?limit=51").expect(400);
    await request(app)
      .get("/api/projects?minPrice=200&maxPrice=100")
      .expect(400);
    await request(app)
      .get("/api/projects?skills=figma,react&sort=popular")
      .expect(200);
    await request(app)
      .get(
        "/api/projects?skills=one,two,three,four,five,six,seven,eight,nine,ten,eleven",
      )
      .expect(400);
    await request(app)
      .get(`/api/projects?q=${"x".repeat(81)}`)
      .expect(400);
    await request(app).get("/api/projects?unexpected=1").expect(400);
  });
});

describe("project service edge cases", () => {
  const cloudinaryJob = {
    id: "job-1",
    projectId: "project-1",
    publicId: "projects/sample",
    resourceType: "image",
    attemptCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds bounded lowercase search keywords from the submitted fields", () => {
    expect(
      buildSearchKeywords({
        title: "Design Design",
        tags: ["BRANDING", "Web-Design"],
        skills: ["Figma"],
      }),
    ).toEqual(["design", "branding", "web", "figma"]);
    expect(buildSearchKeywords({ title: "Title" })).toEqual(["title"]);
  });

  it("returns a not-found error when deleting a missing project", async () => {
    await expect(
      deleteExistingProject(
        { uid: "user-a", role: "freelancer" },
        "missing-project",
        "request-1",
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rolls back queued Cloudinary deletions if recursive deletion fails", async () => {
    const created = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send(validProject())
      .expect(201);
    vi.mocked(queueCloudinaryDeletions).mockResolvedValueOnce([cloudinaryJob]);
    vi.mocked(deleteProjectTree).mockRejectedValueOnce(
      new Error("Firestore delete failed"),
    );

    await expect(
      deleteExistingProject(
        { uid: "user-a", role: "freelancer" },
        created.body.data.id,
        "request-2",
      ),
    ).rejects.toThrow("Firestore delete failed");
    expect(rollbackCloudinaryDeletions).toHaveBeenCalledWith([cloudinaryJob]);
  });

  it("removes Cloudinary assets after project deletion", async () => {
    const created = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send(validProject())
      .expect(201);
    vi.mocked(queueCloudinaryDeletions).mockResolvedValueOnce([cloudinaryJob]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ result: "ok" }),
      })),
    );

    await deleteExistingProject(
      { uid: "user-a", role: "freelancer" },
      created.body.data.id,
      "request-3",
    );
    expect(removeCloudinaryDeletionJob).toHaveBeenCalledWith(cloudinaryJob.id);
  });

  it("reschedules Cloudinary cleanup after the provider repeatedly fails", async () => {
    const created = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send(validProject())
      .expect(201);
    vi.mocked(queueCloudinaryDeletions).mockResolvedValueOnce([cloudinaryJob]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ result: "error" }),
      })),
    );

    await deleteExistingProject(
      { uid: "user-a", role: "freelancer" },
      created.body.data.id,
      "request-4",
    );
    expect(rescheduleCloudinaryDeletion).toHaveBeenCalledWith(
      cloudinaryJob.id,
      1,
    );
    expect(removeCloudinaryDeletionJob).not.toHaveBeenCalled();
  });

  it("reports a failed retry-queue write without failing project deletion", async () => {
    const created = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send(validProject())
      .expect(201);
    vi.mocked(queueCloudinaryDeletions).mockResolvedValueOnce([cloudinaryJob]);
    vi.mocked(rescheduleCloudinaryDeletion).mockRejectedValueOnce(
      new Error("Queue unavailable"),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ result: "error" }),
      })),
    );

    await expect(
      deleteExistingProject(
        { uid: "user-a", role: "freelancer" },
        created.body.data.id,
        "request-5",
      ),
    ).resolves.toBeUndefined();
  });

  it("retries queued assets and reschedules failures with incremented attempts", async () => {
    vi.mocked(findPendingCloudinaryDeletions).mockResolvedValue([
      { ...cloudinaryJob, id: "success-job" },
      { ...cloudinaryJob, id: "retry-job", attemptCount: 2 },
    ]);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: "not found" }),
        })
        .mockResolvedValue({
          ok: false,
          json: async () => ({ result: "error" }),
        }),
    );

    await processCloudinaryDeletionQueue();
    expect(removeCloudinaryDeletionJob).toHaveBeenCalledWith("success-job");
    expect(rescheduleCloudinaryDeletion).toHaveBeenCalledWith("retry-job", 3);
  });

  it("returns correct anonymous and authenticated like/view state", async () => {
    const created = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send(validProject())
      .expect(201);
    vi.mocked(addProjectView)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    vi.mocked(hasProjectLike).mockResolvedValueOnce(true);

    const anonymous = await getProject(
      created.body.data.id,
      undefined,
      undefined,
      new Date("2026-01-01T00:00:00.000Z"),
    );
    expect(anonymous.viewsCount).toBe(0);
    expect(anonymous.likedByMe).toBe(false);

    const authenticated = await getProject(
      created.body.data.id,
      { uid: "user-b", role: "client" },
      "127.0.0.1",
      new Date("2026-01-02T00:00:00.000Z"),
    );
    expect(authenticated.viewsCount).toBe(1);
    expect(authenticated.likedByMe).toBe(true);
  });

  it("does not recompute search tokens for unrelated updates and detects stale writes", async () => {
    const created = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send(validProject())
      .expect(201);
    await updateExistingProject(
      { uid: "user-a", role: "freelancer" },
      created.body.data.id,
      { price: 3000 },
    );
    expect(updateProject).toHaveBeenLastCalledWith(
      created.body.data.id,
      { price: 3000 },
      undefined,
    );

    vi.mocked(updateProject).mockResolvedValueOnce(null);
    await expect(
      updateExistingProject(
        { uid: "user-a", role: "freelancer" },
        created.body.data.id,
        { tags: ["new"] },
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rejects invalid Cloudinary resource metadata and non-Cloudinary update URLs", async () => {
    const created = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send(validProject())
      .expect(201);
    const badAssets = [
      { ...validAsset, resourceType: "video" },
      { ...validAsset, publicId: "projects/other" },
      {
        ...validAsset,
        url: "https://res.cloudinary.com/test-cloud/image/upload/",
      },
      {
        ...validAsset,
        url: "https://res.cloudinary.com/test-cloud/image/upload/projects/%ZZ.jpg",
      },
      {
        ...validAsset,
        url: "http://res.cloudinary.com/test-cloud/image/upload/v123/projects/sample.jpg",
      },
    ];

    for (const asset of badAssets) {
      await expect(
        updateExistingProject(
          { uid: "user-a", role: "freelancer" },
          created.body.data.id,
          { images: [asset] },
        ),
      ).rejects.toMatchObject({ status: 400 });
    }
  });

  it("returns not found for stale like and comment operations", async () => {
    vi.mocked(toggleProjectLike).mockResolvedValueOnce(null);
    await expect(
      likeProject({ uid: "user-a", role: "client" }, "missing"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(listProjectComments("missing", {})).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      addProjectComment({ uid: "user-a" }, "missing", "<script>x</script>"),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      addProjectComment({ uid: "user-a" }, "missing", "hello"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("validates comment content, project status, and author/moderator deletion", async () => {
    const created = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send(validProject())
      .expect(201);
    const id = created.body.data.id;
    const actor = { uid: "user-b", role: "client" };

    vi.mocked(createProjectComment).mockResolvedValueOnce(null);
    await expect(
      addProjectComment(actor, id, "Valid text"),
    ).rejects.toMatchObject({
      status: 404,
    });

    vi.mocked(findProjectComment).mockResolvedValueOnce(null);
    await expect(
      removeProjectComment(actor, id, "missing-comment"),
    ).rejects.toMatchObject({ status: 404 });
    vi.mocked(findProjectComment).mockResolvedValueOnce({
      id: "comment-1",
      authorId: "user-c",
    });
    await expect(
      removeProjectComment(actor, id, "comment-1"),
    ).rejects.toMatchObject({ status: 403 });

    vi.mocked(findProjectComment).mockResolvedValueOnce({
      id: "comment-1",
      authorId: "user-b",
    });
    vi.mocked(deleteProjectComment).mockResolvedValueOnce(false);
    await expect(
      removeProjectComment(actor, id, "comment-1"),
    ).rejects.toMatchObject({ status: 404 });

    state.projects.get(id).status = "draft";
    await expect(listProjectComments(id, {})).rejects.toMatchObject({
      status: 404,
    });
  });

  it("rolls back a queued cleanup when recursive deletion reports a missing tree", async () => {
    const created = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send(validProject())
      .expect(201);
    vi.mocked(deleteProjectTree).mockResolvedValueOnce(false);

    await expect(
      deleteExistingProject(
        { uid: "user-a", role: "freelancer" },
        created.body.data.id,
        "request-6",
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(rollbackCloudinaryDeletions).toHaveBeenCalledWith([]);
  });

  it("keeps delete successful when cleanup credentials are missing", async () => {
    const created = await request(app)
      .post("/api/projects")
      .set(withToken("token-a"))
      .send(validProject())
      .expect(201);
    vi.mocked(queueCloudinaryDeletions).mockResolvedValueOnce([cloudinaryJob]);
    const { env } = await import("../src/config/env.js");
    const secret = env.cloudinaryApiSecret;
    env.cloudinaryApiSecret = undefined;
    try {
      await expect(
        deleteExistingProject(
          { uid: "user-a", role: "freelancer" },
          created.body.data.id,
          "request-7",
        ),
      ).resolves.toBeUndefined();
    } finally {
      env.cloudinaryApiSecret = secret;
    }
  });
});
