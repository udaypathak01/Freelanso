import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { auth } from "../src/config/firebase.js";
import { canTransitionApplication } from "../src/modules/applications/applications.service.js";
import { notifyUser } from "../src/modules/notifications/notifications.service.js";

const state = vi.hoisted(() => ({
  jobs: new Map(),
  applications: new Map(),
  nextJobId: 0,
}));

vi.mock("../src/modules/notifications/notifications.service.js", () => ({
  notifyUser: vi.fn(),
  getNotifications: vi.fn(),
  readNotification: vi.fn(),
  readAllNotifications: vi.fn(),
}));

vi.mock("../src/modules/jobs/jobs.repository.js", () => ({
  createJob: vi.fn(async (postedBy, input, searchKeywords) => {
    const id = `job-${++state.nextJobId}`;
    const job = {
      ...input,
      id,
      postedBy,
      status: "open",
      applicationsCount: 0,
      searchKeywords,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    state.jobs.set(id, job);
    return job;
  }),
  findJob: vi.fn(async (id) => state.jobs.get(id) ?? null),
  findJobs: vi.fn(async (filters) => {
    let items = [...state.jobs.values()].filter((job) => job.status === "open");
    if (filters.category) {
      items = items.filter((job) => job.category === filters.category);
    }
    if (filters.q) {
      const terms = filters.q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
      items = items.filter((job) =>
        terms.some((term) => job.searchKeywords.includes(term)),
      );
    }
    if (filters.skills?.length) {
      items = items.filter((job) =>
        filters.skills.some((skill) => job.skills.includes(skill)),
      );
    }
    if (filters.sort === "price_asc") {
      items.sort((left, right) => left.budgetMin - right.budgetMin);
    }
    if (filters.sort === "price_desc") {
      items.sort((left, right) => right.budgetMin - left.budgetMin);
    }
    if (filters.sort === "popular") {
      items.sort(
        (left, right) =>
          right.applicationsCount - left.applicationsCount ||
          right.createdAt - left.createdAt ||
          right.id.localeCompare(left.id),
      );
    }
    return { items, nextCursor: null, total: items.length };
  }),
  findJobsByOwner: vi.fn(async (ownerId) => ({
    items: [...state.jobs.values()].filter(
      (job) => job.postedBy === ownerId && job.status !== "deleted",
    ),
    nextCursor: null,
  })),
  findJobOwners: vi.fn(
    async (items) =>
      new Map(
        items.map((job) => [
          job.postedBy,
          {
            displayName: `Client ${job.postedBy}`,
            photoURL: null,
            email: "private@example.test",
          },
        ]),
      ),
  ),
  updateJob: vi.fn(async (id, updates, searchKeywords) => {
    const job = state.jobs.get(id);
    if (!job || job.status === "deleted") return null;
    Object.assign(job, updates);
    if (searchKeywords) job.searchKeywords = searchKeywords;
    return job;
  }),
  softDeleteJob: vi.fn(async (id) => {
    const job = state.jobs.get(id);
    if (!job || job.status === "deleted") return false;
    job.status = "deleted";
    return true;
  }),
}));

vi.mock("../src/modules/applications/applications.repository.js", () => ({
  createApplication: vi.fn(async (jobId, applicantId, input) => {
    const job = state.jobs.get(jobId);
    if (!job || job.status === "deleted") return { reason: "job_not_found" };
    if (job.postedBy === applicantId) return { reason: "own_job" };
    if (job.status !== "open") return { reason: "job_not_open" };
    const id = `${jobId}_${applicantId}`;
    if (state.applications.has(id)) return { reason: "duplicate" };
    const application = {
      id,
      jobId,
      applicantId,
      jobOwnerId: job.postedBy,
      ...input,
      status: "submitted",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    state.applications.set(id, application);
    job.applicationsCount += 1;
    return { reason: "created", application };
  }),
  findApplication: vi.fn(async (id) => state.applications.get(id) ?? null),
  findApplicationsForApplicant: vi.fn(async (applicantId) => ({
    items: [...state.applications.values()].filter(
      (application) => application.applicantId === applicantId,
    ),
    nextCursor: null,
    total: [...state.applications.values()].filter(
      (application) => application.applicantId === applicantId,
    ).length,
  })),
  findApplicationsForJob: vi.fn(async (jobId) => ({
    items: [...state.applications.values()].filter(
      (application) => application.jobId === jobId,
    ),
    nextCursor: null,
    total: [...state.applications.values()].filter(
      (application) => application.jobId === jobId,
    ).length,
  })),
  findApplicationJobs: vi.fn(
    async (items) =>
      new Map(
        items
          .map((application) => state.jobs.get(application.jobId))
          .filter(Boolean)
          .map((job) => [job.id, job]),
      ),
  ),
  findApplicants: vi.fn(
    async (items) =>
      new Map(
        items.map((application) => [
          application.applicantId,
          {
            displayName: `Freelancer ${application.applicantId}`,
            photoURL: null,
            email: "private@example.test",
          },
        ]),
      ),
  ),
  updateApplicationStatus: vi.fn(async (id, expectedStatus, status) => {
    const application = state.applications.get(id);
    if (!application || application.status !== expectedStatus) return null;
    application.status = status;
    return application;
  }),
}));

const identities = {
  "token-client": { uid: "client-1", role: "client" },
  "token-client-other": { uid: "client-2", role: "client" },
  "token-freelancer": { uid: "freelancer-1", role: "freelancer" },
  "token-freelancer-other": { uid: "freelancer-2", role: "freelancer" },
  "token-admin": { uid: "admin-1", role: "admin" },
};

const validJob = (overrides = {}) => ({
  title: "Need a product designer",
  description: "Design a product interface and deliver the source files.",
  category: "design-creative",
  skills: ["Figma", "Product Design"],
  budgetMin: 500,
  budgetMax: 1500,
  projectDuration: "1-2 weeks",
  jobType: "freelance",
  workMode: "remote",
  location: "Remote",
  ...overrides,
});

const validApplication = (overrides = {}) => ({
  coverLetter: "I have relevant experience and would be glad to help.",
  proposedRate: 900,
  ...overrides,
});

const withToken = (token) => ({ Authorization: `Bearer ${token}` });

beforeEach(() => {
  state.jobs.clear();
  state.applications.clear();
  state.nextJobId = 0;
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

describe("jobs API", () => {
  it("requires authentication for job writes and applications", async () => {
    await request(app).post("/api/jobs").send(validJob()).expect(401);
    await request(app)
      .put("/api/jobs/job-1")
      .send({ title: "Changed job title" })
      .expect(401);
    await request(app).delete("/api/jobs/job-1").expect(401);
    await request(app)
      .post("/api/jobs/job-1/applications")
      .send(validApplication())
      .expect(401);
    await request(app).get("/api/applications/me").expect(401);
    await request(app).get("/api/jobs/job-1/applications").expect(401);
    await request(app)
      .patch("/api/applications/job-1_applicant/status")
      .send({ status: "withdrawn" })
      .expect(401);
  });

  it("creates jobs for clients with server-owned fields and public owner DTOs", async () => {
    const response = await request(app)
      .post("/api/jobs")
      .set(withToken("token-client"))
      .send(validJob())
      .expect(201);
    expect(response.body.data).toMatchObject({
      postedBy: "client-1",
      status: "open",
      applicationsCount: 0,
      owner: { displayName: "Client client-1" },
    });
    expect(response.body.data.owner.email).toBeUndefined();
    expect(response.body.data.searchKeywords).toBeUndefined();
  });

  it("stores deadline and experience requirements and returns them in the job DTO", async () => {
    const response = await request(app)
      .post("/api/jobs")
      .set(withToken("token-client"))
      .send(
        validJob({
          budgetType: "hourly",
          deadlineDate: "2026-12-15",
          experienceLevel: "intermediate",
          projectDuration: "1-2 months",
          workMode: "hybrid",
          additionalDetails: "Weekly progress updates are required.",
        }),
      )
      .expect(201);
    expect(response.body.data).toMatchObject({
      budgetType: "hourly",
      deadlineDate: "2026-12-15",
      experienceLevel: "intermediate",
      projectDuration: "1-2 months",
      workMode: "hybrid",
      additionalDetails: "Weekly progress updates are required.",
    });
  });

  it("publishes created client jobs to the public browse feed", async () => {
    const created = await request(app)
      .post("/api/jobs")
      .set(withToken("token-client"))
      .send(
        validJob({
          title: "Public client job listing",
          budgetType: "hourly",
          deadlineDate: "2026-12-15",
          additionalDetails: "Weekly progress updates are required.",
        }),
      )
      .expect(201);

    const response = await request(app).get("/api/jobs").expect(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.data.id,
          title: "Public client job listing",
          postedBy: "client-1",
          status: "open",
          budgetType: "hourly",
          deadlineDate: "2026-12-15",
          projectDuration: "1-2 weeks",
          workMode: "remote",
          additionalDetails: "Weekly progress updates are required.",
        }),
      ]),
    );
  });

  it("requires a project duration and rejects invalid deadline dates", async () => {
    const missingDuration = validJob();
    delete missingDuration.projectDuration;
    await request(app)
      .post("/api/jobs")
      .set(withToken("token-client"))
      .send(missingDuration)
      .expect(400);

    await request(app)
      .post("/api/jobs")
      .set(withToken("token-client"))
      .send(validJob({ deadlineDate: "2026-02-31" }))
      .expect(400);
    expect(state.jobs.size).toBe(0);
  });

  it("returns only the authenticated client's own job posts", async () => {
    await request(app)
      .post("/api/jobs")
      .set(withToken("token-client"))
      .send(validJob())
      .expect(201);
    await request(app)
      .post("/api/jobs")
      .set(withToken("token-client-other"))
      .send(validJob({ title: "Another client project" }))
      .expect(201);
    const response = await request(app)
      .get("/api/jobs/mine")
      .set(withToken("token-client"))
      .expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].postedBy).toBe("client-1");
  });

  it.each([
    ["freelancer role", "token-freelancer", validJob()],
    ["negative budget", "token-client", validJob({ budgetMin: -1 })],
    [
      "reversed budget range",
      "token-client",
      validJob({ budgetMin: 1500, budgetMax: 100 }),
    ],
    [
      "protected fields",
      "token-client",
      validJob({ postedBy: "attacker", status: "filled" }),
    ],
  ])("rejects invalid create request: %s", async (_label, token, body) => {
    const response = await request(app)
      .post("/api/jobs")
      .set(withToken(token))
      .send(body);
    expect(response.status).toBe(token === "token-freelancer" ? 403 : 400);
    expect(state.jobs.size).toBe(0);
  });

  it("rejects a missing required job field", async () => {
    const body = validJob();
    delete body.title;
    await request(app)
      .post("/api/jobs")
      .set(withToken("token-client"))
      .send(body)
      .expect(400);
  });

  it("supports owner/admin updates and soft deletion, but denies other owners", async () => {
    const created = await request(app)
      .post("/api/jobs")
      .set(withToken("token-client"))
      .send(validJob())
      .expect(201);
    const id = created.body.data.id;

    await request(app)
      .put(`/api/jobs/${id}`)
      .set(withToken("token-client-other"))
      .send({ title: "A different job title" })
      .expect(403);
    const edited = await request(app)
      .put(`/api/jobs/${id}`)
      .set(withToken("token-client"))
      .send({
        title: "Updated client project",
        budgetType: "hourly",
        projectDuration: "1-3 months",
        deadlineDate: "2026-12-20",
        additionalDetails: "Weekly demos are required.",
      })
      .expect(200);
    expect(edited.body.data).toMatchObject({
      title: "Updated client project",
      budgetType: "hourly",
      projectDuration: "1-3 months",
      deadlineDate: "2026-12-20",
      additionalDetails: "Weekly demos are required.",
    });
    const clearedOptionalFields = await request(app)
      .put(`/api/jobs/${id}`)
      .set(withToken("token-client"))
      .send({
        deadlineDate: null,
        projectDuration: null,
        additionalDetails: null,
      })
      .expect(200);
    expect(clearedOptionalFields.body.data).toMatchObject({
      deadlineDate: null,
      projectDuration: null,
      additionalDetails: null,
    });
    await request(app)
      .put(`/api/jobs/${id}`)
      .set(withToken("token-client"))
      .send({ applicationsCount: 20 })
      .expect(400);
    await request(app)
      .put(`/api/jobs/${id}`)
      .set(withToken("token-admin"))
      .send({ title: "Admin updated title" })
      .expect(200);
    expect(state.jobs.get(id).title).toBe("Admin updated title");

    await request(app)
      .delete(`/api/jobs/${id}`)
      .set(withToken("token-client-other"))
      .expect(403);
    await request(app)
      .delete(`/api/jobs/${id}`)
      .set(withToken("token-client"))
      .expect(204);
    expect(state.jobs.get(id).status).toBe("deleted");
    await request(app).get(`/api/jobs/${id}`).expect(404);
  });

  it("returns job search results with validated filters and stable price sort", async () => {
    for (const budgetMin of [900, 200, 500]) {
      await request(app)
        .post("/api/jobs")
        .set(withToken("token-client"))
        .send(validJob({ budgetMin, budgetMax: budgetMin + 200 }))
        .expect(201);
    }
    const response = await request(app)
      .get("/api/jobs?q=PRODUCT&skills=Figma&sort=price_asc")
      .expect(200);
    expect(response.body.data.map(({ budgetMin }) => budgetMin)).toEqual([
      200, 500, 900,
    ]);
    expect(response.body.meta.appliedFilters).toMatchObject({
      q: "PRODUCT",
      skills: ["Figma"],
      sort: "price_asc",
    });
    await request(app).get("/api/jobs?sort=not-a-sort").expect(400);
    await request(app).get("/api/jobs?minPrice=100&maxPrice=50").expect(400);
  });
});

describe("job applications API", () => {
  async function createOpenJob() {
    const response = await request(app)
      .post("/api/jobs")
      .set(withToken("token-client"))
      .send(validJob())
      .expect(201);
    return response.body.data;
  }

  it("rejects duplicates, own-job applications, closed jobs, and non-freelancers", async () => {
    const job = await createOpenJob();
    await request(app)
      .post(`/api/jobs/${job.id}/applications`)
      .set(withToken("token-freelancer"))
      .send(validApplication())
      .expect(201);
    await request(app)
      .post(`/api/jobs/${job.id}/applications`)
      .set(withToken("token-freelancer"))
      .send(validApplication())
      .expect(409);
    await request(app)
      .post(`/api/jobs/${job.id}/applications`)
      .set(withToken("token-client"))
      .send(validApplication())
      .expect(403);
    await request(app)
      .post(`/api/jobs/${job.id}/applications`)
      .set(withToken("token-client"))
      .send(validApplication({ unexpected: true }))
      .expect(400);
    await request(app)
      .put(`/api/jobs/${job.id}`)
      .set(withToken("token-client"))
      .send({ status: "closed" })
      .expect(200);
    await request(app)
      .post(`/api/jobs/${job.id}/applications`)
      .set(withToken("token-freelancer-other"))
      .send(validApplication())
      .expect(409);
  });

  it("notifies the job owner when a freelancer successfully applies", async () => {
    const job = await createOpenJob();
    vi.mocked(notifyUser).mockClear();

    const response = await request(app)
      .post(`/api/jobs/${job.id}/applications`)
      .set(withToken("token-freelancer"))
      .send(validApplication())
      .expect(201);

    expect(notifyUser).toHaveBeenCalledTimes(1);
    expect(notifyUser).toHaveBeenCalledWith(
      "client-1",
      expect.objectContaining({
        type: "application",
        title: "New job application",
        body: "A freelancer applied for your job",
        href: `/jobs/${job.id}`,
        actorUid: "freelancer-1",
        readAt: null,
      }),
      response.body.data.id,
    );

    await request(app)
      .post(`/api/jobs/${job.id}/applications`)
      .set(withToken("token-freelancer"))
      .send(validApplication())
      .expect(409);
    expect(notifyUser).toHaveBeenCalledTimes(1);
  });

  it("limits application reads to the applicant and job owner", async () => {
    const job = await createOpenJob();
    await request(app)
      .post(`/api/jobs/${job.id}/applications`)
      .set(withToken("token-freelancer"))
      .send(validApplication())
      .expect(201);

    await request(app)
      .get(`/api/jobs/${job.id}/applications`)
      .set(withToken("token-client"))
      .expect(200);
    await request(app)
      .get(`/api/jobs/${job.id}/applications`)
      .set(withToken("token-client-other"))
      .expect(403);
    const myApplications = await request(app)
      .get("/api/applications/me")
      .set(withToken("token-freelancer"))
      .expect(200);
    expect(myApplications.body.data).toHaveLength(1);
    await request(app)
      .get("/api/applications/me")
      .set(withToken("token-freelancer-other"))
      .expect(200)
      .expect(({ body }) => expect(body.data).toHaveLength(0));
  });

  it("enforces application status transitions and persists valid changes", async () => {
    const job = await createOpenJob();
    const created = await request(app)
      .post(`/api/jobs/${job.id}/applications`)
      .set(withToken("token-freelancer"))
      .send(validApplication())
      .expect(201);
    const id = created.body.data.id;

    await request(app)
      .patch(`/api/applications/${id}/status`)
      .set(withToken("token-client-other"))
      .send({ status: "shortlisted" })
      .expect(403);
    await request(app)
      .patch(`/api/applications/${id}/status`)
      .set(withToken("token-client"))
      .send({ status: "withdrawn" })
      .expect(409);
    const shortlisted = await request(app)
      .patch(`/api/applications/${id}/status`)
      .set(withToken("token-client"))
      .send({ status: "shortlisted" })
      .expect(200);
    expect(shortlisted.body.data.status).toBe("shortlisted");
    await request(app)
      .patch(`/api/applications/${id}/status`)
      .set(withToken("token-client"))
      .send({ status: "hired" })
      .expect(409);
    const withdrawn = await request(app)
      .patch(`/api/applications/${id}/status`)
      .set(withToken("token-freelancer"))
      .send({ status: "withdrawn" })
      .expect(200);
    expect(withdrawn.body.data.status).toBe("withdrawn");
  });

  it.each([
    ["rejected", "Application rejected", "The client rejected your application"],
    ["hired", "You've been hired!", "The client hired you for this job"],
  ])(
    "notifies the freelancer when the client marks an application %s",
    async (status, title, body) => {
      const job = await createOpenJob();
      const created = await request(app)
        .post(`/api/jobs/${job.id}/applications`)
        .set(withToken("token-freelancer"))
        .send(validApplication())
        .expect(201);
      vi.mocked(notifyUser).mockClear();

      await request(app)
        .patch(`/api/applications/${created.body.data.id}/status`)
        .set(withToken("token-client"))
        .send({ status })
        .expect(200);

      expect(notifyUser).toHaveBeenCalledWith(
        "freelancer-1",
        expect.objectContaining({
          type: "application_status",
          title,
          body,
          href: `/jobs/${job.id}`,
          actorUid: "client-1",
          readAt: null,
        }),
        `${created.body.data.id}:${status}`,
      );
    },
  );
});

describe("application transition rules", () => {
  it("allows only the specified state-machine transitions", () => {
    const application = {
      jobOwnerId: "client-1",
      applicantId: "freelancer-1",
      status: "submitted",
    };
    expect(
      canTransitionApplication({ uid: "client-1" }, application, "shortlisted"),
    ).toBe(true);
    expect(
      canTransitionApplication(
        { uid: "freelancer-1" },
        application,
        "withdrawn",
      ),
    ).toBe(true);
    expect(
      canTransitionApplication({ uid: "client-2" }, application, "rejected"),
    ).toBe(false);
    expect(
      canTransitionApplication(
        { uid: "client-1" },
        { ...application, status: "shortlisted" },
        "hired",
      ),
    ).toBe(false);
  });
});
