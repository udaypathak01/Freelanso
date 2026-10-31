import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { auth } from "../src/config/firebase.js";
import {
  normalizeServiceCategory,
  serviceCategories,
} from "../src/modules/services/serviceCategories.js";
import { buildServiceSearchKeywords } from "../src/modules/services/services.service.js";
import { deleteService } from "../src/modules/services/services.repository.js";

const state = vi.hoisted(() => ({
  services: new Map(),
  nextId: 0,
}));

vi.mock("../src/modules/services/services.repository.js", () => ({
  createService: vi.fn(async (ownerId, input, searchKeywords) => {
    const id = `service-${++state.nextId}`;
    const service = {
      ...input,
      id,
      ownerId,
      status: "published",
      ratingAvg: 0,
      ratingCount: 0,
      searchKeywords,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    state.services.set(id, service);
    return service;
  }),
  findService: vi.fn(async (id) => state.services.get(id) ?? null),
  findServices: vi.fn(async (filters) => {
    let items = [...state.services.values()].filter(
      (service) => service.status === "published",
    );
    if (filters.category) {
      items = items.filter((service) => service.category === filters.category);
    }
    if (filters.q) {
      const terms = filters.q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
      items = items.filter((service) =>
        terms.some((term) => service.searchKeywords.includes(term)),
      );
    }
    if (filters.skills?.length) {
      items = items.filter((service) =>
        service.skills.some((skill) => filters.skills.includes(skill)),
      );
    }
    if (filters.minPrice !== undefined) {
      items = items.filter((service) => service.price >= filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      items = items.filter((service) => service.price <= filters.maxPrice);
    }
    if (filters.sort === "price_asc") items.sort((a, b) => a.price - b.price);
    if (filters.sort === "price_desc") items.sort((a, b) => b.price - a.price);
    if (filters.sort === "oldest") items.reverse();
    if (filters.sort === "popular") {
      items.sort(
        (a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount,
      );
    }
    return { items, nextCursor: null };
  }),
  findServiceOwners: vi.fn(async (services) => {
    const owners = new Map();
    for (const service of services) {
      owners.set(service.ownerId, {
        displayName: `Name ${service.ownerId}`,
        photoURL:
          "https://res.cloudinary.com/test-cloud/image/upload/v1/avatar.jpg",
        email: "private@example.test",
        stats: { ratingAvg: 4.5 },
      });
    }
    return owners;
  }),
  updateService: vi.fn(async (id, updates, searchKeywords) => {
    const service = state.services.get(id);
    if (!service) return null;
    Object.assign(service, updates, { updatedAt: new Date() });
    if (searchKeywords) service.searchKeywords = searchKeywords;
    return service;
  }),
  deleteService: vi.fn(async (id) => state.services.delete(id)),
  serviceCategoryLabel: vi.fn(),
}));

const identities = {
  "token-freelancer": { uid: "freelancer-1", role: "freelancer" },
  "token-other": { uid: "freelancer-2", role: "freelancer" },
  "token-client": { uid: "client-1", role: "client" },
  "token-admin": { uid: "admin-1", role: "admin" },
};

const validService = (overrides = {}) => ({
  title: "Professional service listing",
  description: "A complete service description with clear delivery details.",
  category: "tech-development",
  price: 2500,
  deliveryDays: 5,
  revisions: 2,
  images: [],
  skills: ["Node.js"],
  ...overrides,
});

const withToken = (token) => ({ Authorization: `Bearer ${token}` });

beforeEach(() => {
  state.services.clear();
  state.nextId = 0;
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

describe("services API", () => {
  it("returns canonical category slugs and labels from the shared source", async () => {
    const response = await request(app).get("/api/meta/categories").expect(200);
    expect(response.body.data).toEqual(serviceCategories);
    expect(response.body.success).toBe(true);
  });

  it("normalizes, deduplicates, and safely handles empty search keywords", () => {
    expect(
      buildServiceSearchKeywords({
        title: "",
        description: "",
        category: "",
        skills: [],
      }),
    ).toEqual([]);
    expect(
      buildServiceSearchKeywords({
        title: "Design design",
        description: "",
        category: "design-creative",
        skills: ["Design"],
      }),
    ).toEqual(["design", "creative"]);
  });

  it("requires authentication for create, update, and delete", async () => {
    await request(app).post("/api/services").send(validService()).expect(401);
    await request(app)
      .put("/api/services/service-1")
      .send({ title: "Changed service title" })
      .expect(401);
    await request(app).delete("/api/services/service-1").expect(401);
  });

  it("denies clients from creating services", async () => {
    await request(app)
      .post("/api/services")
      .set(withToken("token-client"))
      .send(validService())
      .expect(403);
    expect(state.services.size).toBe(0);
  });

  it.each([
    ["unknown category", { category: "Tech And Development" }],
    ["invalid price", { price: -1 }],
    [
      "too many images",
      {
        images: Array.from({ length: 11 }, () => ({
          url: "https://res.cloudinary.com/test-cloud/image/upload/v1/a.jpg",
          publicId: "a",
        })),
      },
    ],
    [
      "foreign image URL",
      { images: [{ url: "https://example.test/a.jpg", publicId: "a" }] },
    ],
    ["protected owner field", { ownerId: "attacker" }],
    ["protected rating field", { ratingAvg: 5 }],
    ["protected status field", { status: "draft" }],
    ["unknown field", { isAdmin: true }],
  ])(
    "rejects invalid or protected create fields: %s",
    async (_name, override) => {
      await request(app)
        .post("/api/services")
        .set(withToken("token-freelancer"))
        .send(validService(override))
        .expect(400);
      expect(state.services.size).toBe(0);
    },
  );

  it("creates an owner-bound service with only public owner data", async () => {
    const response = await request(app)
      .post("/api/services")
      .set(withToken("token-freelancer"))
      .send(validService())
      .expect(201);
    expect(response.body.data).toMatchObject({
      ownerId: "freelancer-1",
      authorUid: "freelancer-1",
      category: "tech-development",
      categoryLabel: "Tech & Development",
      status: "published",
      owner: { displayName: "Name freelancer-1", ratingAvg: 4.5 },
    });
    expect(response.body.data.owner.email).toBeUndefined();
    expect(response.body.data.searchKeywords).toBeUndefined();
    expect(state.services.get(response.body.data.id).ratingAvg).toBe(0);
  });

  it("accepts valid Cloudinary assets and admin-created services", async () => {
    const response = await request(app)
      .post("/api/services")
      .set(withToken("token-admin"))
      .send(
        validService({
          images: [
            {
              url: "https://res.cloudinary.com/test-cloud/image/upload/v123/services/sample.jpg",
              publicId: "services/sample",
            },
          ],
        }),
      )
      .expect(201);
    expect(response.body.data.images[0].publicId).toBe("services/sample");
    expect(response.body.data.ownerId).toBe("admin-1");
  });

  it("prevents another owner from updating or deleting while admins can", async () => {
    const created = await request(app)
      .post("/api/services")
      .set(withToken("token-freelancer"))
      .send(validService())
      .expect(201);
    const id = created.body.data.id;

    await request(app)
      .put(`/api/services/${id}`)
      .set(withToken("token-other"))
      .send({ title: "Changed service title" })
      .expect(403);
    await request(app)
      .delete(`/api/services/${id}`)
      .set(withToken("token-other"))
      .expect(403);
    expect(state.services.get(id).title).toBe(validService().title);

    await request(app)
      .put(`/api/services/${id}`)
      .set(withToken("token-admin"))
      .send({ title: "Admin updated service" })
      .expect(200);
    await request(app)
      .delete(`/api/services/${id}`)
      .set(withToken("token-admin"))
      .expect(204);
    expect(state.services.has(id)).toBe(false);
  });

  it("rejects unknown categories and server-managed update fields", async () => {
    const created = await request(app)
      .post("/api/services")
      .set(withToken("token-freelancer"))
      .send(validService())
      .expect(201);
    const id = created.body.data.id;

    await request(app)
      .put(`/api/services/${id}`)
      .set(withToken("token-freelancer"))
      .send({ category: "Tech And Development" })
      .expect(400);
    await request(app)
      .put(`/api/services/${id}`)
      .set(withToken("token-freelancer"))
      .send({ ownerId: "attacker", ratingCount: 10, status: "deleted" })
      .expect(400);
    expect(state.services.get(id)).toMatchObject({
      category: "tech-development",
      ownerId: "freelancer-1",
      status: "published",
      ratingCount: 0,
    });
  });

  it("returns 404 for missing and deleted services", async () => {
    await request(app).get("/api/services/missing").expect(404);
    await request(app)
      .delete("/api/services/missing")
      .set(withToken("token-admin"))
      .expect(404);
  });

  it("handles empty lists, unpublished details, non-keyword updates, and delete races", async () => {
    await request(app)
      .get("/api/services")
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual([]);
      });
    state.services.set("draft-service", {
      ...validService(),
      id: "draft-service",
      ownerId: "freelancer-1",
      status: "draft",
    });
    await request(app).get("/api/services/draft-service").expect(404);

    const created = await request(app)
      .post("/api/services")
      .set(withToken("token-freelancer"))
      .send(validService())
      .expect(201);
    const id = created.body.data.id;
    await request(app)
      .put(`/api/services/${id}`)
      .set(withToken("token-freelancer"))
      .send({ price: 2600 })
      .expect(200);
    expect(state.services.get(id).price).toBe(2600);

    deleteService.mockResolvedValueOnce(false);
    await request(app)
      .delete(`/api/services/${id}`)
      .set(withToken("token-freelancer"))
      .expect(404);
  });

  it("validates price ranges and sorts prices in both directions", async () => {
    for (const price of [900, 2500, 1200]) {
      await request(app)
        .post("/api/services")
        .set(withToken("token-freelancer"))
        .send(validService({ price }))
        .expect(201);
    }
    await request(app)
      .get("/api/services?minPrice=500&maxPrice=100")
      .expect(400);

    const ascending = await request(app)
      .get("/api/services?sort=price_asc")
      .expect(200);
    const descending = await request(app)
      .get("/api/services?sort=price_desc")
      .expect(200);
    expect(ascending.body.data.map(({ price }) => price)).toEqual([
      900, 1200, 2500,
    ]);
    expect(descending.body.data.map(({ price }) => price)).toEqual([
      2500, 1200, 900,
    ]);
  });

  it("filters services by every canonical category without label mismatches", async () => {
    for (const category of serviceCategories) {
      await request(app)
        .post("/api/services")
        .set(withToken("token-freelancer"))
        .send(validService({ category: category.slug }))
        .expect(201);
    }
    for (const category of serviceCategories) {
      const response = await request(app)
        .get(`/api/services?category=${category.slug}`)
        .expect(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].category).toBe(category.slug);
      expect(response.body.data[0].categoryLabel).toBe(category.label);
    }
  });

  it("normalizes the legacy Tech And Development category idempotently", () => {
    expect(normalizeServiceCategory("Tech And Development")).toBe(
      "tech-development",
    );
    expect(normalizeServiceCategory("tech-development")).toBe(
      "tech-development",
    );
    expect(normalizeServiceCategory("unknown-category")).toBeNull();
  });

  it("rejects malformed list queries and cursors", async () => {
    await request(app).get("/api/services?category=unknown").expect(400);
    await request(app).get("/api/services?limit=51").expect(400);
    await request(app).get("/api/services?sort=cheapest").expect(400);
    await request(app).get("/api/services?extra=true").expect(400);
  });
});
