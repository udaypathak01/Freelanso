import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { auth } from "../src/config/firebase.js";
import {
  assignAdminRole,
  getPublicProfile,
  onboardUserRole,
  updateProfile,
} from "../src/modules/users/users.service.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from "../src/utils/AppError.js";
import {
  assignProfileRoleOnce,
  updateUserProfile,
} from "../src/modules/users/users.repository.js";

const state = vi.hoisted(() => ({ profiles: new Map() }));

vi.mock("../src/modules/users/users.repository.js", () => ({
  ensureUserProfile: vi.fn(async (identity) => {
    await Promise.resolve();
    if (!state.profiles.has(identity.uid)) {
      state.profiles.set(identity.uid, {
        displayName: identity.displayName || "",
        email: identity.email || null,
        photoURL: identity.photoURL || null,
        role: identity.role || null,
        headline: "",
        bio: "",
        handle: "",
        bannerURL: null,
        phone: "",
        location: {},
        privateAddress: {},
        skills: [],
        hourlyRate: null,
        languages: [],
        socialLinks: {},
        stats: { projectsCount: 0, ratingAvg: 0, ratingCount: 0 },
        experience: [],
        education: [],
        certifications: [],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });
    }
    return state.profiles.get(identity.uid);
  }),
  findUserProfile: vi.fn(async (uid) => state.profiles.get(uid) || null),
  updateUserProfile: vi.fn(async (uid, updates) => {
    const profile = state.profiles.get(uid);
    if (!profile) return null;
    Object.assign(profile, updates, { updatedAt: new Date() });
    return profile;
  }),
  assignProfileRoleOnce: vi.fn(async (uid, role) => {
    const profile = state.profiles.get(uid);
    if (profile.role) return profile.role;
    profile.role = role;
    return role;
  }),
  setProfileRole: vi.fn(async (uid, role) => {
    state.profiles.get(uid).role = role;
  }),
}));

const identity = (uid, role = null) => ({
  uid,
  email: `${uid}@example.test`,
  name: `Name ${uid}`,
  email_verified: true,
  role,
});

function asUser(uid = "user-a", role = null) {
  vi.spyOn(auth, "verifyIdToken").mockResolvedValue(identity(uid, role));
  return {
    get: (path) =>
      request(app).get(path).set("Authorization", "Bearer test-token"),
    post: (path) =>
      request(app).post(path).set("Authorization", "Bearer test-token"),
    put: (path) =>
      request(app).put(path).set("Authorization", "Bearer test-token"),
  };
}

beforeEach(() => {
  state.profiles.clear();
  vi.spyOn(auth, "verifyIdToken").mockResolvedValue(identity("user-a"));
  vi.spyOn(auth, "getUser").mockImplementation(async (uid) => ({
    uid,
    email: `${uid}@example.test`,
    photoURL: null,
    customClaims: {},
  }));
  vi.spyOn(auth, "setCustomUserClaims").mockResolvedValue();
});

afterEach(() => vi.restoreAllMocks());

describe("users endpoints", () => {
  it("requires authentication for private profile, update, onboarding, and upload routes", async () => {
    await request(app).get("/api/users/me").expect(401);
    await request(app)
      .put("/api/users/user-a")
      .send({ bio: "hello" })
      .expect(401);
    await request(app)
      .post("/api/users/onboarding")
      .send({ role: "client" })
      .expect(401);
    await request(app).post("/api/uploads/sign").send({}).expect(401);
  });

  it("lazily creates one profile for concurrent first requests", async () => {
    const api = asUser();
    const responses = await Promise.all([
      api.get("/api/users/me"),
      api.get("/api/users/me"),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    expect(state.profiles.size).toBe(1);
    expect(responses[0].body.data.email).toBe("user-a@example.test");
  });

  it("returns public profile fields without email, phone, or private address", async () => {
    state.profiles.set("user-b", {
      ...awaitProfile("user-b"),
      email: "private@example.test",
      phone: "+1 555 0100",
      privateAddress: { line1: "Private Street", postalCode: "12345" },
      headline: "Designer",
    });
    const response = await request(app).get("/api/users/user-b").expect(200);
    expect(response.body.data).toMatchObject({
      id: "user-b",
      headline: "Designer",
    });
    expect(response.body.data).not.toHaveProperty("email");
    expect(response.body.data).not.toHaveProperty("phone");
    expect(response.body.data).not.toHaveProperty("privateAddress");
    expect(JSON.stringify(response.body)).not.toContain("private@example.test");
  });

  it("prevents a user from updating another user's profile", async () => {
    state.profiles.set("user-b", awaitProfile("user-b"));
    await asUser("user-a")
      .put("/api/users/user-b")
      .send({ bio: "Attempted edit" })
      .expect(403);
    expect(state.profiles.get("user-b").bio).toBe("");
  });

  it("allows an admin claim to update another user's profile", async () => {
    state.profiles.set("user-b", awaitProfile("user-b"));
    const response = await asUser("admin-user", "admin")
      .put("/api/users/user-b")
      .send({ headline: "Verified headline" })
      .expect(200);
    expect(response.body.data.headline).toBe("Verified headline");
    expect(state.profiles.get("user-b").headline).toBe("Verified headline");
  });

  it("allows owners to update approved profile photos and curated banners", async () => {
    const profile = await updateProfile(identity("user-a"), "user-a", {
      photoURL:
        "https://res.cloudinary.com/test-cloud/image/upload/v1/profile.png",
      bannerURL: "https://images.unsplash.com/photo-example",
    });
    expect(profile.photoURL).toContain("res.cloudinary.com/test-cloud");
    expect(profile.bannerURL).toContain("images.unsplash.com");
  });

  it("allows the exact Firebase auth photo URL", async () => {
    auth.getUser.mockResolvedValue({
      uid: "user-a",
      photoURL: "https://provider.example/auth-photo",
      customClaims: {},
    });
    const profile = await updateProfile(identity("user-a"), "user-a", {
      photoURL: "https://provider.example/auth-photo",
    });
    expect(profile.photoURL).toBe("https://provider.example/auth-photo");
  });

  it.each([
    { role: "admin" },
    { uid: "other-user" },
    { stats: { ratingAvg: 5 } },
    { createdAt: "2026-01-01T00:00:00.000Z" },
    { unlistedField: "mass assignment" },
  ])("rejects protected or unknown profile field: %j", async (body) => {
    const response = await asUser()
      .put("/api/users/user-a")
      .send(body)
      .expect(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(state.profiles.has("user-a")).toBe(false);
  });

  it("rejects roles outside freelancer/client in onboarding", async () => {
    const response = await asUser()
      .post("/api/users/onboarding")
      .send({ role: "admin" })
      .expect(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("sets an allowed onboarding role once and rejects a later change", async () => {
    const user = asUser();
    const first = await user
      .post("/api/users/onboarding")
      .send({ role: "client" })
      .expect(201);
    expect(first.body.data.role).toBe("client");
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith("user-a", {
      role: "client",
    });

    auth.getUser.mockResolvedValue({
      uid: "user-a",
      customClaims: { role: "client" },
    });
    await asUser()
      .post("/api/users/onboarding")
      .send({ role: "freelancer" })
      .expect(409);
    expect(auth.setCustomUserClaims).toHaveBeenCalledTimes(1);
  });

  it("preserves additional Firebase custom claims when assigning the initial role", async () => {
    auth.getUser.mockResolvedValue({
      uid: "user-a",
      customClaims: { department: "design" },
    });
    await onboardUserRole(identity("user-a"), "client");
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith("user-a", {
      department: "design",
      role: "client",
    });
  });

  it("rejects non-Cloudinary and non-Firebase profile photos", async () => {
    auth.getUser.mockResolvedValue({
      uid: "user-a",
      photoURL: "https://accounts.google.com/photo",
      customClaims: {},
    });
    const response = await asUser()
      .put("/api/users/user-a")
      .send({ photoURL: "https://attacker.example/photo.png" })
      .expect(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("returns a restricted Cloudinary upload signature", async () => {
    const response = await asUser()
      .post("/api/uploads/sign")
      .send({})
      .expect(200);
    expect(response.body.data).toMatchObject({
      cloudName: "test-cloud",
      apiKey: "test-api-key",
      assetFolder: "users/user-a/profile",
      uploadPreset: "test-signed-profile",
      allowedFormats: "gif,jpg,png,webp",
      maxFileSize: 5 * 1024 * 1024,
    });
    expect(response.body.data).not.toHaveProperty("apiSecret");
    expect(response.body.data.signature).toMatch(/^[a-f0-9]{40}$/);
  });
});

function awaitProfile(uid) {
  return {
    displayName: uid,
    email: `${uid}@example.test`,
    photoURL: null,
    role: "freelancer",
    headline: "",
    bio: "",
    handle: "",
    bannerURL: null,
    phone: "",
    location: {},
    privateAddress: {},
    skills: [],
    hourlyRate: null,
    languages: [],
    socialLinks: {},
    stats: { projectsCount: 0, ratingAvg: 0, ratingCount: 0 },
    experience: [],
    education: [],
    certifications: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

describe("user service authorization", () => {
  it("returns 404 for an absent public profile", async () => {
    await expect(getPublicProfile("missing-user")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("enforces owner/admin access inside the service", async () => {
    await expect(
      updateProfile(identity("user-a", "client"), "user-b", { bio: "x" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects conflicting one-time roles", async () => {
    state.profiles.set("user-a", awaitProfile("user-a"));
    state.profiles.get("user-a").role = "client";
    auth.getUser.mockResolvedValue({
      uid: "user-a",
      customClaims: { role: "client" },
    });
    await expect(
      onboardUserRole(identity("user-a", "client"), "freelancer"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects an onboarding role that lost the transactional race", async () => {
    state.profiles.set("user-a", awaitProfile("user-a"));
    state.profiles.get("user-a").role = "freelancer";
    await expect(
      onboardUserRole(identity("user-a"), "client"),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(assignProfileRoleOnce).toHaveBeenCalledWith("user-a", "client");
  });

  it("does not rewrite claims when the requested role is already assigned", async () => {
    state.profiles.set("user-a", awaitProfile("user-a"));
    state.profiles.get("user-a").role = "client";
    auth.getUser.mockResolvedValue({
      uid: "user-a",
      customClaims: { role: "client" },
    });
    await expect(
      onboardUserRole(identity("user-a", "client"), "client"),
    ).resolves.toEqual({ role: "client" });
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("surfaces custom-claim write failures as service unavailable", async () => {
    auth.setCustomUserClaims.mockRejectedValue(new Error("auth unavailable"));
    await expect(
      onboardUserRole(identity("user-a"), "client"),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it("returns not found when an admin targets a missing profile", async () => {
    await expect(
      updateProfile(identity("admin-user", "admin"), "missing", {
        bio: "Not persisted",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("assigns admin-managed roles while preserving existing custom claims", async () => {
    auth.getUser.mockResolvedValue({
      uid: "managed-user",
      email: "managed@example.test",
      displayName: "Managed",
      photoURL: null,
      customClaims: { department: "operations", role: "client" },
    });
    await assignAdminRole("managed-user", "admin");
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith("managed-user", {
      department: "operations",
      role: "admin",
    });
    expect(state.profiles.get("managed-user").role).toBe("admin");
  });

  it("maps a service-side missing profile to not found", async () => {
    state.profiles.set("user-a", awaitProfile("user-a"));
    updateUserProfile.mockResolvedValueOnce(null);
    await expect(
      updateProfile(identity("user-a"), "user-a", { bio: "missing" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
