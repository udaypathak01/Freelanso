import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { auth, firestore } from "../src/config/firebase.js";
import { serviceCategories } from "../src/modules/services/serviceCategories.js";
import { migrateLegacyServiceCategories } from "../src/modules/services/services.repository.js";

const emulatorReady = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
const cloudinaryAsset = {
  url: "https://res.cloudinary.com/test-cloud/image/upload/v123/projects/emulator-test.jpg",
  publicId: "projects/emulator-test",
  mediaType: "image",
  resourceType: "image",
};

async function createAccount(role = null) {
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const email = `projects-${crypto.randomUUID()}@freelanso.test`;
  const password = "A-valid-test-password-123";
  const signupResponse = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  expect(signupResponse.ok).toBe(true);
  const account = await signupResponse.json();
  if (!role) return { uid: account.localId, token: account.idToken, email };

  await auth.setCustomUserClaims(account.localId, { role });
  const signinResponse = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );
  expect(signinResponse.ok).toBe(true);
  const signedIn = await signinResponse.json();
  return { uid: account.localId, token: signedIn.idToken, email };
}

function projectInput(title, asset = cloudinaryAsset) {
  return {
    title,
    description: `A detailed project description for ${title}. `.padEnd(
      100,
      "x",
    ),
    category: "logo-design",
    tags: ["brand"],
    skills: ["Figma"],
    price: 2500,
    deliveryDays: 5,
    images: [asset],
  };
}

function serviceInput(title, overrides = {}) {
  return {
    title,
    description: `Complete service description for ${title}.`,
    category: "tech-development",
    price: 2500,
    deliveryDays: 5,
    revisions: 2,
    images: [],
    skills: ["Node.js"],
    ...overrides,
  };
}

function jobInput(title, overrides = {}) {
  return {
    title,
    description: `A detailed job description for ${title}.`,
    category: "technology",
    skills: ["Phase7", "Node.js"],
    budgetMin: 500,
    budgetMax: 1500,
    jobType: "freelance",
    location: "Remote",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Firebase Auth emulator", () => {
  it.runIf(emulatorReady)(
    "creates one application under concurrency and enforces access and status transitions",
    async () => {
      const owner = await createAccount("client");
      const applicant = await createAccount("freelancer");
      const otherApplicant = await createAccount("freelancer");
      const thirdParty = await createAccount("client");
      const job = (
        await request(app)
          .post("/api/jobs")
          .auth(owner.token, { type: "bearer" })
          .send(jobInput(`application-atomic-${crypto.randomUUID()}`))
          .expect(201)
      ).body.data;

      const submissions = await Promise.all([
        request(app)
          .post(`/api/jobs/${job.id}/applications`)
          .auth(applicant.token, { type: "bearer" })
          .send({
            coverLetter: "I can complete this work with the requested skills.",
            proposedRate: 900,
          }),
        request(app)
          .post(`/api/jobs/${job.id}/applications`)
          .auth(applicant.token, { type: "bearer" })
          .send({
            coverLetter: "I can complete this work with the requested skills.",
            proposedRate: 900,
          }),
      ]);
      expect(submissions.map(({ status }) => status).sort()).toEqual([
        201, 409,
      ]);

      const applicationId = `${job.id}_${applicant.uid}`;
      const applicationSnapshot = await firestore
        .collection("applications")
        .doc(applicationId)
        .get();
      expect(applicationSnapshot.exists).toBe(true);
      expect(applicationSnapshot.get("status")).toBe("submitted");
      expect(
        (
          await firestore
            .collection("applications")
            .where("jobId", "==", job.id)
            .count()
            .get()
        ).data().count,
      ).toBe(1);
      expect(
        (await firestore.collection("jobs").doc(job.id).get()).get(
          "applicationsCount",
        ),
      ).toBe(1);
      const ownerDashboard = await request(app)
        .get("/api/dashboard")
        .auth(owner.token, { type: "bearer" })
        .expect(200);
      const applicantDashboard = await request(app)
        .get("/api/dashboard")
        .auth(applicant.token, { type: "bearer" })
        .expect(200);
      expect(ownerDashboard.body.data.applications.received).toBe(1);
      expect(ownerDashboard.body.data.applications.sent).toBe(0);
      expect(applicantDashboard.body.data.applications.sent).toBe(1);
      expect(applicantDashboard.body.data.applications.received).toBe(0);

      await request(app)
        .get(`/api/jobs/${job.id}/applications`)
        .auth(owner.token, { type: "bearer" })
        .expect(200)
        .expect(({ body }) => expect(body.data).toHaveLength(1));
      await request(app)
        .get(`/api/jobs/${job.id}/applications`)
        .auth(thirdParty.token, { type: "bearer" })
        .expect(403);
      await request(app)
        .get("/api/applications/me")
        .auth(applicant.token, { type: "bearer" })
        .expect(200)
        .expect(({ body }) => expect(body.data).toHaveLength(1));
      await request(app)
        .get("/api/applications/me")
        .auth(otherApplicant.token, { type: "bearer" })
        .expect(200)
        .expect(({ body }) => expect(body.data).toHaveLength(0));

      await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .auth(owner.token, { type: "bearer" })
        .send({ status: "shortlisted" })
        .expect(200);
      await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .auth(owner.token, { type: "bearer" })
        .send({ status: "hired" })
        .expect(409);
      await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .auth(thirdParty.token, { type: "bearer" })
        .send({ status: "rejected" })
        .expect(403);
      await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .auth(applicant.token, { type: "bearer" })
        .send({ status: "withdrawn" })
        .expect(200);
      expect(
        (
          await firestore.collection("applications").doc(applicationId).get()
        ).get("status"),
      ).toBe("withdrawn");

      await request(app)
        .put(`/api/jobs/${job.id}`)
        .auth(owner.token, { type: "bearer" })
        .send({ status: "closed" })
        .expect(200);
      await request(app)
        .post(`/api/jobs/${job.id}/applications`)
        .auth(otherApplicant.token, { type: "bearer" })
        .send({
          coverLetter: "I can complete this work with the requested skills.",
          proposedRate: 900,
        })
        .expect(409);
      await request(app)
        .delete(`/api/jobs/${job.id}`)
        .auth(owner.token, { type: "bearer" })
        .expect(204);
      await request(app).get(`/api/jobs/${job.id}`).expect(404);
      const publicJobs = await request(app).get("/api/jobs").expect(200);
      expect(publicJobs.body.data.some(({ id }) => id === job.id)).toBe(false);
    },
    60_000,
  );

  it.runIf(emulatorReady)(
    "supports job search, filters, deterministic price sorts, and gap-free cursor pages",
    async () => {
      const owner = await createAccount("client");
      const term = `phase7needle${crypto.randomUUID().replaceAll("-", "")}`;
      const values = [900, 200, 500, 300, 700];
      const created = [];
      for (const [index, budgetMin] of values.entries()) {
        const response = await request(app)
          .post("/api/jobs")
          .auth(owner.token, { type: "bearer" })
          .send(
            jobInput(`${term} role ${index}`, {
              category: "phase7-pagination",
              budgetMin,
              budgetMax: budgetMin + 200,
              skills: ["Phase7", "Node.js"],
              jobType: index === 0 ? "full-time" : "freelance",
              location: index === 0 ? "Pune" : "Remote",
            }),
          )
          .expect(201);
        created.push(response.body.data);
        await firestore
          .collection("jobs")
          .doc(response.body.data.id)
          .update({
            createdAt: new Date(Date.UTC(2026, 0, index + 1)),
            applicationsCount: [1, 4, 2, 5, 3][index],
          });
      }

      const ascending = await request(app)
        .get(
          `/api/jobs?q=${term.toUpperCase()}&category=phase7-pagination&skills=Phase7&sort=price_asc`,
        )
        .expect(200);
      expect(ascending.body.data.map(({ budgetMin }) => budgetMin)).toEqual([
        200, 300, 500, 700, 900,
      ]);
      const descending = await request(app)
        .get(`/api/jobs?q=${term}&category=phase7-pagination&sort=price_desc`)
        .expect(200);
      expect(descending.body.meta.total).toBe(5);
      expect(descending.body.data.map(({ budgetMin }) => budgetMin)).toEqual([
        900, 700, 500, 300, 200,
      ]);
      const oldest = await request(app)
        .get(`/api/jobs?q=${term}&category=phase7-pagination&sort=oldest`)
        .expect(200);
      expect(oldest.body.data.map(({ budgetMin }) => budgetMin)).toEqual([
        900, 200, 500, 300, 700,
      ]);
      const newest = await request(app)
        .get(`/api/jobs?q=${term}&category=phase7-pagination&sort=newest`)
        .expect(200);
      expect(newest.body.data.map(({ budgetMin }) => budgetMin)).toEqual([
        700, 300, 500, 200, 900,
      ]);
      const filtered = await request(app)
        .get(
          `/api/jobs?q=${term}&category=phase7-pagination&jobType=full-time&location=Pune&minPrice=800&maxPrice=1000`,
        )
        .expect(200);
      expect(filtered.body.data.map(({ id }) => id)).toEqual([created[0].id]);
      const popular = await request(app)
        .get(`/api/jobs?q=${term}&category=phase7-pagination&sort=popular`)
        .expect(200);
      expect(
        popular.body.data.map(({ applicationsCount }) => applicationsCount),
      ).toEqual([5, 4, 3, 2, 1]);
      const tiedTimestamp = new Date(Date.UTC(2026, 0, 10));
      await Promise.all(
        [created[0], created[1]].map(({ id }) =>
          firestore.collection("jobs").doc(id).update({
            applicationsCount: 10,
            createdAt: tiedTimestamp,
          }),
        ),
      );
      const popularTie = await request(app)
        .get(`/api/jobs?q=${term}&category=phase7-pagination&sort=popular`)
        .expect(200);
      expect(popularTie.body.data.slice(0, 2).map(({ id }) => id)).toEqual(
        [created[0].id, created[1].id].sort().reverse(),
      );

      const pageIds = [];
      let cursor;
      do {
        const query = new URLSearchParams({
          q: term,
          category: "phase7-pagination",
          limit: "2",
          sort: "newest",
        });
        if (cursor) query.set("cursor", cursor);
        const page = await request(app).get(`/api/jobs?${query}`).expect(200);
        pageIds.push(...page.body.data.map(({ id }) => id));
        cursor = page.body.meta.nextCursor;
      } while (cursor);
      expect(pageIds).toHaveLength(5);
      expect(new Set(pageIds).size).toBe(5);
      for (const job of created) expect(pageIds).toContain(job.id);
    },
    60_000,
  );

  it.runIf(emulatorReady)(
    "rejects a freelancer applying to their own job",
    async () => {
      const applicant = await createAccount("freelancer");
      const jobId = `self-job-${crypto.randomUUID()}`;
      await firestore
        .collection("jobs")
        .doc(jobId)
        .create({
          ...jobInput("Self-owned job"),
          postedBy: applicant.uid,
          status: "open",
          applicationsCount: 0,
          searchKeywords: ["self", "owned", "job"],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      await request(app)
        .post(`/api/jobs/${jobId}/applications`)
        .auth(applicant.token, { type: "bearer" })
        .send({
          coverLetter: "I can complete this work with the requested skills.",
          proposedRate: 900,
        })
        .expect(403);
      expect(
        (await firestore.collection("jobs").doc(jobId).get()).get(
          "applicationsCount",
        ),
      ).toBe(0);
    },
  );

  it.runIf(emulatorReady)(
    "returns isolated dashboard aggregates and updates them after listing writes",
    async () => {
      const emptyUser = await createAccount();
      const empty = await request(app)
        .get("/api/dashboard")
        .auth(emptyUser.token, { type: "bearer" })
        .expect(200);
      expect(empty.body.data).toMatchObject({
        projects: [],
        services: [],
        counts: {
          projects: { total: 0 },
          services: { total: 0 },
          listings: 0,
        },
        engagement: { likes: 0, comments: 0, views: 0 },
        applications: { sent: 0, received: 0 },
        earnings: { total: 0, currency: null },
        satisfaction: { ratingAvg: null, ratingCount: 0 },
      });

      const owner = await createAccount("freelancer");
      const other = await createAccount("freelancer");
      const projectResponse = await request(app)
        .post("/api/projects")
        .auth(owner.token, { type: "bearer" })
        .send(projectInput(`dashboard-project-${crypto.randomUUID()}`))
        .expect(201);
      const project = projectResponse.body.data;
      const serviceResponse = await request(app)
        .post("/api/services")
        .auth(owner.token, { type: "bearer" })
        .send(serviceInput(`dashboard-service-${crypto.randomUUID()}`))
        .expect(201);
      await request(app)
        .post("/api/projects")
        .auth(other.token, { type: "bearer" })
        .send(projectInput(`other-dashboard-project-${crypto.randomUUID()}`))
        .expect(201);

      const projectRef = firestore.collection("projects").doc(project.id);
      await projectRef.update({
        likesCount: 4,
        commentsCount: 2,
        viewsCount: 11,
      });
      let dashboard = await request(app)
        .get("/api/dashboard")
        .auth(owner.token, { type: "bearer" })
        .expect(200);
      expect(dashboard.body.data.projects.map(({ id }) => id)).toEqual([
        project.id,
      ]);
      expect(dashboard.body.data.services.map(({ id }) => id)).toEqual([
        serviceResponse.body.data.id,
      ]);
      expect(dashboard.body.data.counts).toMatchObject({
        projects: { total: 1, byStatus: { published: 1 } },
        services: { total: 1, byStatus: { published: 1 } },
        listings: 2,
      });
      expect(dashboard.body.data.engagement).toEqual({
        likes: 4,
        comments: 2,
        views: 11,
      });

      const serviceOnlyPage = await request(app)
        .get("/api/dashboard?projectCursor=__done__")
        .auth(owner.token, { type: "bearer" })
        .expect(200);
      expect(serviceOnlyPage.body.data.projects).toEqual([]);
      expect(serviceOnlyPage.body.data.services).toHaveLength(1);

      await request(app)
        .put(`/api/projects/${project.id}`)
        .auth(owner.token, { type: "bearer" })
        .send({ title: "Dashboard project edited" })
        .expect(200);
      dashboard = await request(app)
        .get("/api/dashboard")
        .auth(owner.token, { type: "bearer" })
        .expect(200);
      expect(dashboard.body.data.projects[0].title).toBe(
        "Dashboard project edited",
      );
      expect(dashboard.body.data.counts.projects.byStatus.published).toBe(1);

      await request(app)
        .delete(`/api/projects/${project.id}`)
        .auth(owner.token, { type: "bearer" })
        .expect(204);
      dashboard = await request(app)
        .get("/api/dashboard")
        .auth(owner.token, { type: "bearer" })
        .expect(200);
      expect(dashboard.body.data.projects).toEqual([]);
      expect(dashboard.body.data.counts.projects.total).toBe(0);
      expect(dashboard.body.data.counts.listings).toBe(1);
      expect(dashboard.body.data.engagement).toEqual({
        likes: 0,
        comments: 0,
        views: 0,
      });

      const otherDashboard = await request(app)
        .get("/api/dashboard")
        .auth(other.token, { type: "bearer" })
        .expect(200);
      expect(otherDashboard.body.data.projects).toHaveLength(1);
      expect(otherDashboard.body.data.projects[0].ownerId).toBe(other.uid);
    },
    60_000,
  );

  it.runIf(emulatorReady)(
    "reports Firestore ready when the emulator is reachable",
    async () => {
      await request(app)
        .get("/readyz")
        .expect(200)
        .expect(({ body }) => expect(body.data.status).toBe("ready"));
    },
  );

  it.runIf(emulatorReady)(
    "creates exactly one profile for parallel first authenticated requests",
    async () => {
      const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
      const email = `parallel-${Date.now()}@freelanso.test`;
      const identityResponse = await fetch(
        `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password: "A-valid-test-password-123",
            returnSecureToken: true,
          }),
        },
      );
      expect(identityResponse.ok).toBe(true);
      const identity = await identityResponse.json();

      const responses = await Promise.all([
        request(app)
          .get("/api/users/me")
          .set("Authorization", `Bearer ${identity.idToken}`),
        request(app)
          .get("/api/users/me")
          .set("Authorization", `Bearer ${identity.idToken}`),
      ]);
      expect(responses.map(({ status }) => status)).toEqual([200, 200]);

      const profiles = await firestore
        .collection("users")
        .where("email", "==", email)
        .get();
      expect(profiles.size).toBe(1);
      expect(profiles.docs[0].id).toBe(identity.localId);
      expect(profiles.docs[0].data().stats).toEqual({
        projectsCount: 0,
        ratingAvg: 0,
        ratingCount: 0,
      });
    },
  );

  it.runIf(emulatorReady)(
    "accepts a valid emulator-issued Firebase ID token",
    async () => {
      const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
      const email = `test-${Date.now()}@freelanso.test`;
      const identityResponse = await fetch(
        `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password: "A-valid-test-password-123",
            returnSecureToken: true,
          }),
        },
      );
      expect(identityResponse.ok).toBe(true);
      const identity = await identityResponse.json();

      const response = await request(app)
        .get("/api/me")
        .set("Authorization", `Bearer ${identity.idToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          uid: identity.localId,
          email,
          role: null,
          emailVerified: false,
        },
      });
    },
  );

  it.runIf(emulatorReady)("rejects a garbage ID token with 401", async () => {
    const response = await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer definitely-not-a-firebase-id-token")
      .expect(401);
    expect(response.body.error.code).toBe("INVALID_TOKEN");
  });

  it.runIf(emulatorReady)(
    "persists projects and returns gap-free cursor pages",
    async () => {
      const owner = await createAccount("freelancer");
      const created = [];
      for (let index = 0; index < 3; index += 1) {
        const response = await request(app)
          .post("/api/projects")
          .set("Authorization", "Bearer " + owner.token)
          .send(projectInput(`cursor-project-${crypto.randomUUID()}-${index}`))
          .expect(201);
        created.push(response.body.data);
      }

      const fresh = await request(app)
        .get(`/api/projects/${created[0].id}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .expect(200);
      expect(fresh.body.data).toMatchObject({
        id: created[0].id,
        ownerId: owner.uid,
        status: "published",
      });

      const firstPage = await request(app)
        .get("/api/projects?limit=2")
        .expect(200);
      expect(firstPage.body.data).toHaveLength(2);
      expect(firstPage.body.meta.nextCursor).toBeTruthy();
      const secondPage = await request(app)
        .get(
          `/api/projects?limit=2&cursor=${encodeURIComponent(firstPage.body.meta.nextCursor)}`,
        )
        .expect(200);
      const allIds = [
        ...firstPage.body.data.map((project) => project.id),
        ...secondPage.body.data.map((project) => project.id),
      ];
      expect(new Set(allIds).size).toBe(allIds.length);
      for (const project of created) expect(allIds).toContain(project.id);
    },
  );

  it.runIf(emulatorReady)(
    "searches, filters, sorts, and paginates projects with stable ordering",
    async () => {
      const owner = await createAccount("freelancer");
      const labels = [
        "Needle alpha starter",
        "Needle beta starter",
        "Needle alpha beta starter",
        "Needle gamma starter",
        "Needle delta starter",
      ];
      const created = [];
      for (const [index, title] of labels.entries()) {
        const publicId = `projects/search-${crypto.randomUUID()}`;
        const response = await request(app)
          .post("/api/projects")
          .auth(owner.token, { type: "bearer" })
          .send(
            projectInput(title, {
              ...cloudinaryAsset,
              url: `https://res.cloudinary.com/test-cloud/image/upload/v123/${publicId}.jpg`,
              publicId,
            }),
          )
          .expect(201);
        created.push(response.body.data);
        await firestore
          .collection("projects")
          .doc(response.body.data.id)
          .update({
            category: index % 2 === 0 ? "logo-design" : "web-development",
            skills: index % 2 === 0 ? ["Figma"] : ["React"],
            price: (index + 1) * 100,
            likesCount: [2, 2, 3, 1, 2][index],
            viewsCount: [5, 8, 2, 0, 9][index],
            createdAt: new Date(Date.UTC(2026, 0, index + 1)),
          });
      }

      const search = await request(app)
        .get("/api/projects?q=NEEDLE")
        .expect(200);
      expect(search.body.data).toHaveLength(5);
      expect(search.body.meta.total).toBe(5);
      expect(search.body.meta.appliedFilters).toMatchObject({
        q: "NEEDLE",
        sort: "newest",
      });
      const categoryOnly = await request(app)
        .get("/api/projects?category=logo-design")
        .expect(200);
      expect(categoryOnly.body.data.map(({ id }) => id)).toContain(
        created[0].id,
      );
      const skillsOnly = await request(app)
        .get("/api/projects?skills=Figma")
        .expect(200);
      expect(skillsOnly.body.data.map(({ id }) => id)).toContain(created[0].id);
      const minimumOnly = await request(app)
        .get("/api/projects?minPrice=300&sort=oldest")
        .expect(200);
      expect(minimumOnly.body.data.map(({ id }) => id)).toContain(
        created[2].id,
      );
      const maximumOnly = await request(app)
        .get("/api/projects?maxPrice=200&sort=newest")
        .expect(200);
      expect(maximumOnly.body.data.map(({ id }) => id)).toContain(
        created[0].id,
      );
      const ranked = await request(app)
        .get("/api/projects?q=needle%20alpha")
        .expect(200);
      expect(ranked.body.data[0].id).toBe(created[2].id);

      const combined = await request(app)
        .get(
          "/api/projects?q=needle&category=logo-design&skills=Figma&minPrice=200&maxPrice=500&sort=price_asc",
        )
        .expect(200);
      expect(combined.body.data.map((item) => item.id)).toEqual([
        created[2].id,
        created[4].id,
      ]);
      const ascending = await request(app)
        .get("/api/projects?q=needle&sort=price_asc")
        .expect(200);
      const descending = await request(app)
        .get("/api/projects?q=needle&sort=price_desc")
        .expect(200);
      expect(ascending.body.data.map((item) => item.price)).toEqual([
        100, 200, 300, 400, 500,
      ]);
      expect(descending.body.data.map((item) => item.price)).toEqual([
        500, 400, 300, 200, 100,
      ]);
      const boundedOldest = await request(app)
        .get(
          "/api/projects?q=needle&minPrice=200&maxPrice=400&sort=oldest&limit=2",
        )
        .expect(200);
      expect(boundedOldest.body.data.map(({ id }) => id)).toEqual([
        created[1].id,
        created[2].id,
      ]);
      const boundedOldestNext = await request(app)
        .get(
          `/api/projects?q=needle&minPrice=200&maxPrice=400&sort=oldest&limit=2&cursor=${encodeURIComponent(boundedOldest.body.meta.nextCursor)}`,
        )
        .expect(200);
      expect(boundedOldestNext.body.data.map(({ id }) => id)).toEqual([
        created[3].id,
      ]);

      const newest = await request(app)
        .get("/api/projects?q=needle&sort=newest")
        .expect(200);
      const oldest = await request(app)
        .get("/api/projects?q=needle&sort=oldest")
        .expect(200);
      expect(newest.body.data[0].id).toBe(created[4].id);
      expect(oldest.body.data[0].id).toBe(created[0].id);
      const popular = await request(app)
        .get("/api/projects?q=needle&sort=popular")
        .expect(200);
      expect(popular.body.data.map((item) => item.id)).toEqual([
        created[2].id,
        created[4].id,
        created[1].id,
        created[0].id,
        created[3].id,
      ]);

      const pages = [];
      let cursor;
      do {
        const query = new URLSearchParams({
          q: "needle",
          sort: "price_asc",
          limit: "2",
        });
        if (cursor) query.set("cursor", cursor);
        const page = await request(app)
          .get(`/api/projects?${query}`)
          .expect(200);
        pages.push(...page.body.data.map(({ id }) => id));
        cursor = page.body.meta.nextCursor;
      } while (cursor);
      expect(pages).toHaveLength(5);
      expect(new Set(pages)).toEqual(new Set(created.map(({ id }) => id)));

      const injection = await request(app)
        .get(`/api/projects?q=${encodeURIComponent(`'"$.*🔥`)}`)
        .expect(200);
      expect(injection.body.data).toEqual([]);
      const literalInjection = await request(app)
        .get(`/api/projects?q=${encodeURIComponent(`needle'"$.*🔥`)}`)
        .expect(200);
      expect(literalInjection.body.data).toHaveLength(5);
      const emptyQuery = await request(app).get("/api/projects?q=").expect(200);
      expect(emptyQuery.body.data.length).toBeGreaterThan(0);
      await request(app)
        .get(`/api/projects?q=${"x".repeat(81)}`)
        .expect(400);
      await request(app)
        .get(
          "/api/projects?skills=one,two,three,four,five,six,seven,eight,nine,ten,eleven",
        )
        .expect(400);
    },
    60_000,
  );

  it.runIf(emulatorReady)(
    "increments views at most once per authenticated user in a 24-hour window",
    async () => {
      const owner = await createAccount("freelancer");
      const project = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${owner.token}`)
        .send(projectInput(`view-project-${crypto.randomUUID()}`))
        .expect(201);

      await request(app)
        .get(`/api/projects/${project.body.data.id}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .expect(200);
      await request(app)
        .get(`/api/projects/${project.body.data.id}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .expect(200);

      const storedProject = await firestore
        .collection("projects")
        .doc(project.body.data.id)
        .get();
      const views = await firestore
        .collection("projects")
        .doc(project.body.data.id)
        .collection("views")
        .get();
      expect(storedProject.get("viewsCount")).toBe(1);
      expect(views.size).toBe(1);
    },
  );

  it.runIf(emulatorReady)(
    "keeps likes and counters consistent across 50 concurrent users",
    async () => {
      const owner = await createAccount("freelancer");
      const project = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${owner.token}`)
        .send(projectInput(`concurrent-like-${crypto.randomUUID()}`))
        .expect(201);
      const projectRef = firestore
        .collection("projects")
        .doc(project.body.data.id);

      vi.spyOn(auth, "verifyIdToken").mockImplementation(async (token) => ({
        uid: token,
        role: "client",
      }));
      const responses = await Promise.all(
        Array.from({ length: 50 }, (_, index) =>
          request(app)
            .post(`/api/projects/${project.body.data.id}/like`)
            .set("Authorization", `Bearer concurrent-user-${index}`)
            .send({})
            .expect(200),
        ),
      );
      expect(responses.every((response) => response.body.data.liked)).toBe(
        true,
      );

      const [storedProject, likes] = await Promise.all([
        projectRef.get(),
        projectRef.collection("likes").get(),
      ]);
      expect(storedProject.get("likesCount")).toBe(50);
      expect(likes.size).toBe(storedProject.get("likesCount"));
    },
    60_000,
  );

  it.runIf(emulatorReady)(
    "toggles the same user's deterministic like document off on the second call",
    async () => {
      const owner = await createAccount("freelancer");
      const liker = await createAccount();
      const project = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${owner.token}`)
        .send(projectInput(`same-like-${crypto.randomUUID()}`))
        .expect(201);
      const path = `/api/projects/${project.body.data.id}/like`;

      await request(app)
        .post(path)
        .set("Authorization", `Bearer ${liker.token}`)
        .send({})
        .expect(200)
        .expect(({ body }) =>
          expect(body.data).toMatchObject({ liked: true, count: 1 }),
        );
      await request(app)
        .post(path)
        .set("Authorization", `Bearer ${liker.token}`)
        .send({})
        .expect(200)
        .expect(({ body }) =>
          expect(body.data).toMatchObject({ liked: false, count: 0 }),
        );

      const projectRef = firestore
        .collection("projects")
        .doc(project.body.data.id);
      expect((await projectRef.collection("likes").get()).size).toBe(0);
      expect((await projectRef.get()).get("likesCount")).toBe(0);
    },
  );

  it.runIf(emulatorReady)(
    "deletes project subcollections and removes deleted projects from public reads",
    async () => {
      const owner = await createAccount("freelancer");
      const commenter = await createAccount();
      const title = `cascade-${crypto.randomUUID()}`;
      const project = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${owner.token}`)
        .send(projectInput(title))
        .expect(201);
      const projectId = project.body.data.id;
      await request(app)
        .post(`/api/projects/${projectId}/like`)
        .set("Authorization", `Bearer ${commenter.token}`)
        .send({})
        .expect(200);
      await request(app)
        .post(`/api/projects/${projectId}/comments`)
        .set("Authorization", `Bearer ${commenter.token}`)
        .send({ text: "A persistent comment" })
        .expect(201);

      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({ result: "ok" }),
        })),
      );
      await request(app)
        .delete(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .expect(204);

      await request(app).get(`/api/projects/${projectId}`).expect(404);
      const search = await request(app)
        .get(`/api/projects?q=${encodeURIComponent(title.split("-")[0])}`)
        .expect(200);
      expect(search.body.data.some((item) => item.id === projectId)).toBe(
        false,
      );
      const projectRef = firestore.collection("projects").doc(projectId);
      expect((await projectRef.collection("likes").get()).size).toBe(0);
      expect((await projectRef.collection("comments").get()).size).toBe(0);
    },
  );

  it.runIf(emulatorReady)("returns gap-free comment cursor pages", async () => {
    const owner = await createAccount("freelancer");
    const commenter = await createAccount();
    const project = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(projectInput(`comments-${crypto.randomUUID()}`))
      .expect(201);
    for (let index = 0; index < 3; index += 1) {
      await request(app)
        .post(`/api/projects/${project.body.data.id}/comments`)
        .set("Authorization", `Bearer ${commenter.token}`)
        .send({ text: `comment-${index}` })
        .expect(201);
    }
    const first = await request(app)
      .get(`/api/projects/${project.body.data.id}/comments?limit=1`)
      .expect(200);
    const second = await request(app)
      .get(
        `/api/projects/${project.body.data.id}/comments?limit=1&cursor=${encodeURIComponent(first.body.meta.nextCursor)}`,
      )
      .expect(200);
    const third = await request(app)
      .get(
        `/api/projects/${project.body.data.id}/comments?limit=1&cursor=${encodeURIComponent(second.body.meta.nextCursor)}`,
      )
      .expect(200);
    const texts = [
      first.body.data[0].text,
      second.body.data[0].text,
      third.body.data[0].text,
    ];
    expect(new Set(texts).size).toBe(3);
    expect(new Set(texts)).toEqual(
      new Set(["comment-0", "comment-1", "comment-2"]),
    );
  });

  it.runIf(emulatorReady)(
    "persists services, filters all canonical categories, and paginates sorted prices",
    async () => {
      const owner = await createAccount("freelancer");
      const categoriesResponse = await request(app)
        .get("/api/meta/categories")
        .expect(200);
      expect(categoriesResponse.body.data).toEqual(serviceCategories);

      for (const [index, category] of serviceCategories.entries()) {
        const created = await request(app)
          .post("/api/services")
          .auth(owner.token, { type: "bearer" })
          .send(
            serviceInput(`service-category-${index}-${crypto.randomUUID()}`, {
              category: category.slug,
              price: (index + 1) * 100,
              skills: ["SortProbe"],
            }),
          )
          .expect(201);
        const persisted = await request(app)
          .get(`/api/services/${created.body.data.id}`)
          .expect(200);
        expect(persisted.body.data.category).toBe(category.slug);
        const filtered = await request(app)
          .get(`/api/services?category=${category.slug}`)
          .expect(200);
        expect(
          filtered.body.data.some((item) => item.id === created.body.data.id),
        ).toBe(true);
        expect(filtered.body.data[0].categoryLabel).toBe(category.label);
      }

      const low = await request(app)
        .get("/api/services?skills=SortProbe&sort=price_asc&limit=2")
        .expect(200);
      const next = await request(app)
        .get(
          `/api/services?skills=SortProbe&sort=price_asc&limit=2&cursor=${encodeURIComponent(low.body.meta.nextCursor)}`,
        )
        .expect(200);
      expect(low.body.data.map((item) => item.price)).toEqual([100, 200]);
      expect(next.body.data.map((item) => item.price)).toEqual([300, 400]);
      expect(
        new Set([...low.body.data, ...next.body.data].map((item) => item.id))
          .size,
      ).toBe(4);

      const descending = await request(app)
        .get("/api/services?skills=SortProbe&sort=price_desc&limit=2")
        .expect(200);
      expect(descending.body.data.map((item) => item.price)).toEqual([
        700, 600,
      ]);
    },
  );

  it.runIf(emulatorReady)(
    "supports service text and skills filters, all sorts, and cursor metadata",
    async () => {
      const owner = await createAccount("freelancer");
      const created = [];
      for (const [index, title] of [
        "Service Needle Alpha",
        "Service Needle Beta",
        "Service Needle Alpha Beta",
        "Service Needle Gamma",
        "Service Needle Delta",
      ].entries()) {
        const response = await request(app)
          .post("/api/services")
          .auth(owner.token, { type: "bearer" })
          .send(
            serviceInput(title, {
              price: (index + 1) * 100,
              category:
                index % 2 === 0 ? "tech-development" : "design-creative",
              skills: index % 2 === 0 ? ["Node.js"] : ["React"],
            }),
          )
          .expect(201);
        created.push(response.body.data);
        await firestore
          .collection("services")
          .doc(response.body.data.id)
          .update({
            ratingAvg: [4, 4, 5, 2, 4][index],
            ratingCount: [2, 8, 1, 0, 9][index],
            createdAt: new Date(Date.UTC(2026, 0, index + 1)),
          });
      }

      const search = await request(app)
        .get("/api/services?q=NEEDLE")
        .expect(200);
      expect(search.body.data).toHaveLength(5);
      expect(search.body.meta.total).toBe(5);
      expect(search.body.meta.limit).toBe(20);
      expect(search.body.meta.appliedFilters.q).toBe("NEEDLE");
      const skillsOnly = await request(app)
        .get("/api/services?skills=Node.js")
        .expect(200);
      expect(skillsOnly.body.data.map(({ id }) => id)).toContain(created[0].id);
      const minimumOnly = await request(app)
        .get("/api/services?minPrice=300&sort=oldest")
        .expect(200);
      expect(minimumOnly.body.data.map(({ id }) => id)).toContain(
        created[2].id,
      );
      const maximumOnly = await request(app)
        .get("/api/services?maxPrice=200&sort=newest")
        .expect(200);
      expect(maximumOnly.body.data.map(({ id }) => id)).toContain(
        created[0].id,
      );
      const ranked = await request(app)
        .get("/api/services?q=needle%20alpha")
        .expect(200);
      expect(ranked.body.data[0].id).toBe(created[2].id);

      const filtered = await request(app)
        .get(
          "/api/services?q=needle&category=tech-development&skills=Node.js&minPrice=200&maxPrice=500&sort=price_asc",
        )
        .expect(200);
      expect(filtered.body.data.map(({ id }) => id)).toEqual([
        created[2].id,
        created[4].id,
      ]);
      const ascending = await request(app)
        .get("/api/services?q=needle&sort=price_asc")
        .expect(200);
      const descending = await request(app)
        .get("/api/services?q=needle&sort=price_desc")
        .expect(200);
      expect(ascending.body.data.map(({ price }) => price)).toEqual([
        100, 200, 300, 400, 500,
      ]);
      expect(descending.body.data.map(({ price }) => price)).toEqual([
        500, 400, 300, 200, 100,
      ]);
      const boundedPopular = await request(app)
        .get("/api/services?q=needle&minPrice=200&maxPrice=400&sort=popular")
        .expect(200);
      expect(boundedPopular.body.data.map(({ id }) => id)).toEqual([
        created[2].id,
        created[1].id,
        created[3].id,
      ]);
      const newest = await request(app)
        .get("/api/services?q=needle&sort=newest")
        .expect(200);
      const oldest = await request(app)
        .get("/api/services?q=needle&sort=oldest")
        .expect(200);
      expect(newest.body.data[0].id).toBe(created[4].id);
      expect(oldest.body.data[0].id).toBe(created[0].id);
      const popular = await request(app)
        .get("/api/services?q=needle&sort=popular")
        .expect(200);
      expect(popular.body.data.map(({ id }) => id)).toEqual([
        created[2].id,
        created[4].id,
        created[1].id,
        created[0].id,
        created[3].id,
      ]);

      const pages = [];
      let cursor;
      do {
        const query = new URLSearchParams({
          q: "needle",
          sort: "price_asc",
          limit: "2",
        });
        if (cursor) query.set("cursor", cursor);
        const page = await request(app)
          .get(`/api/services?${query}`)
          .expect(200);
        pages.push(...page.body.data.map(({ id }) => id));
        cursor = page.body.meta.nextCursor;
      } while (cursor);
      expect(pages).toHaveLength(5);
      expect(new Set(pages)).toEqual(new Set(created.map(({ id }) => id)));

      const injection = await request(app)
        .get(`/api/services?q=${encodeURIComponent(`'"$.*🔥`)}`)
        .expect(200);
      expect(injection.body.data).toEqual([]);
      const literalInjection = await request(app)
        .get(`/api/services?q=${encodeURIComponent(`needle'"$.*🔥`)}`)
        .expect(200);
      expect(literalInjection.body.data).toHaveLength(5);
      const emptyQuery = await request(app).get("/api/services?q=").expect(200);
      expect(emptyQuery.body.data.length).toBeGreaterThan(0);
      await request(app)
        .get(`/api/services?q=${"x".repeat(81)}`)
        .expect(400);
      await request(app)
        .get(
          "/api/services?skills=one,two,three,four,five,six,seven,eight,nine,ten,eleven",
        )
        .expect(400);
    },
    60_000,
  );

  it.runIf(emulatorReady)(
    "migrates legacy service category labels idempotently and supports dry-run",
    async () => {
      const legacyRefs = [
        firestore
          .collection("services")
          .doc(`legacy-category-${crypto.randomUUID()}`),
        firestore
          .collection("services")
          .doc(`legacy-category-${crypto.randomUUID()}`),
      ];
      await Promise.all(
        legacyRefs.map((ref, index) =>
          ref.create({
            ...serviceInput(`legacy-${index}`),
            ownerId: `legacy-owner-${index}`,
            status: "published",
            category: index === 0 ? "Tech And Development" : "IT",
            ratingAvg: 0,
            ratingCount: 0,
            searchKeywords: ["legacy"],
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      );

      expect(await migrateLegacyServiceCategories({ dryRun: true })).toBe(2);
      expect((await legacyRefs[0].get()).get("category")).toBe(
        "Tech And Development",
      );
      expect(await migrateLegacyServiceCategories()).toBe(2);
      expect(await migrateLegacyServiceCategories()).toBe(0);
      const remainingLegacy = await firestore
        .collection("services")
        .where("category", "==", "Tech And Development")
        .get();
      expect(remainingLegacy.empty).toBe(true);
      const migratedResults = await request(app)
        .get("/api/services?category=tech-development")
        .expect(200);
      for (const ref of legacyRefs) {
        expect(
          migratedResults.body.data.some((item) => item.id === ref.id),
        ).toBe(true);
      }
    },
  );
});
