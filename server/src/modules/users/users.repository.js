import { FieldValue } from "firebase-admin/firestore";
import { firestore } from "../../config/firebase.js";

const users = () => firestore.collection("users");
const userRef = (uid) => users().doc(uid);

function initialUser(identity) {
  return {
    displayName: identity.displayName ?? "",
    email: identity.email ?? null,
    photoURL: identity.photoURL ?? null,
    role: identity.role ?? null,
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
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function legacyProfilePatch(existing, identity) {
  const patch = {};
  const oldRole =
    typeof existing.role === "string" &&
    !["freelancer", "client", "admin"].includes(existing.role)
      ? existing.role
      : "";
  const currentLocation =
    existing.location && typeof existing.location === "object"
      ? existing.location
      : {};
  const currentAddress =
    existing.privateAddress && typeof existing.privateAddress === "object"
      ? existing.privateAddress
      : {};
  const location = {
    ...currentLocation,
    ...(existing.country ? { country: existing.country } : {}),
    ...(existing.state ? { state: existing.state } : {}),
    ...(existing.city ? { city: existing.city } : {}),
  };
  const privateAddress = {
    ...currentAddress,
    ...(existing.address1 ? { line1: existing.address1 } : {}),
    ...(existing.address2 ? { line2: existing.address2 } : {}),
    ...(existing.pincode ? { postalCode: existing.pincode } : {}),
  };

  if (!existing.displayName && identity.displayName) {
    patch.displayName = identity.displayName;
  } else if (existing.displayName === undefined) {
    patch.displayName = existing.name ?? "";
  }
  if (existing.email !== (identity.email ?? null)) {
    patch.email = identity.email ?? null;
  }
  if (!existing.photoURL && identity.photoURL) {
    patch.photoURL = identity.photoURL;
  } else if (existing.photoURL === undefined) {
    patch.photoURL = null;
  }
  if (existing.headline === undefined) patch.headline = oldRole;
  if (existing.handle === undefined) patch.handle = "";
  if (existing.bannerURL === undefined) {
    patch.bannerURL = existing.banner ?? null;
  }
  if (existing.phone === undefined) patch.phone = "";
  if (
    existing.location === undefined ||
    existing.country ||
    existing.state ||
    existing.city
  ) {
    patch.location = location;
  }
  if (
    existing.privateAddress === undefined ||
    existing.address1 ||
    existing.address2 ||
    existing.pincode
  ) {
    patch.privateAddress = privateAddress;
  }
  const role = identity.role ?? null;
  if (existing.role !== role) patch.role = role;
  if (existing.skills === undefined) patch.skills = [];
  if (existing.hourlyRate === undefined) patch.hourlyRate = null;
  if (existing.languages === undefined) patch.languages = [];
  if (existing.socialLinks === undefined) patch.socialLinks = {};
  if (existing.stats === undefined) {
    patch.stats = { projectsCount: 0, ratingAvg: 0, ratingCount: 0 };
  }
  if (existing.experience === undefined) patch.experience = [];
  if (existing.education === undefined) patch.education = [];
  if (existing.certifications === undefined) patch.certifications = [];
  if (existing.createdAt === undefined) {
    patch.createdAt = FieldValue.serverTimestamp();
  }
  for (const legacyField of [
    "uid",
    "name",
    "avatar",
    "lastLogin",
    "country",
    "state",
    "city",
    "address1",
    "address2",
    "pincode",
  ]) {
    if (existing[legacyField] !== undefined) {
      patch[legacyField] = FieldValue.delete();
    }
  }
  if (oldRole) patch.role = role;
  if (Object.keys(patch).length) {
    patch.updatedAt = FieldValue.serverTimestamp();
  }
  return patch;
}

export async function ensureUserProfile(identity) {
  const ref = userRef(identity.uid);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      transaction.create(ref, initialUser(identity));
      return;
    }
    const patch = legacyProfilePatch(snapshot.data(), identity);
    if (Object.keys(patch).length) transaction.update(ref, patch);
  });
  const snapshot = await ref.get();
  return snapshot.data();
}

export async function findUserProfile(uid) {
  const snapshot = await userRef(uid).get();
  return snapshot.exists ? snapshot.data() : null;
}

export async function updateUserProfile(uid, updates) {
  const ref = userRef(uid);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;
    transaction.update(ref, {
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return findUserProfile(uid);
}

export async function assignProfileRoleOnce(uid, role) {
  const ref = userRef(uid);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("User profile was not bootstrapped");
    const existingRole = snapshot.get("role") ?? null;
    if (existingRole) return existingRole;
    transaction.update(ref, {
      role,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return role;
  });
}

export async function setProfileRole(uid, role) {
  const ref = userRef(uid);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("User profile does not exist");
    transaction.update(ref, {
      role,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}
