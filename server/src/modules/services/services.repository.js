import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { firestore } from "../../config/firebase.js";
import {
  paginateFilteredQuery,
  paginateQuery,
} from "../../utils/pagination.js";
import {
  applyMarketplaceFilters,
  countMatching,
  filterBySkills,
  searchProvider,
} from "../search/searchProvider.js";
import {
  legacyServiceCategories,
  normalizeServiceCategory,
} from "./serviceCategories.js";

const services = () => firestore.collection("services");
const serviceRef = (id) => services().doc(id);

export async function createService(ownerId, input, searchKeywords) {
  const ref = services().doc();
  const now = FieldValue.serverTimestamp();
  await ref.create({
    ...input,
    ownerId,
    status: "published",
    ratingAvg: 0,
    ratingCount: 0,
    searchKeywords,
    createdAt: now,
    updatedAt: now,
  });
  const snapshot = await ref.get();
  return { id: ref.id, ...snapshot.data() };
}

export async function findService(id) {
  const snapshot = await serviceRef(id).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function findServices(filters) {
  const {
    query,
    countQuery,
    orderByFields,
    searchTerms,
    noSearchMatches,
    deferPrice,
    deferSkills,
  } = applyMarketplaceFilters(
    services().where("status", "==", "published"),
    filters,
    { popularityFields: ["ratingAvg", "ratingCount"] },
  );
  if (noSearchMatches) {
    return { items: [], nextCursor: null, total: 0 };
  }
  const matcher = (doc) => {
    const service = doc.data();
    const priceMatches =
      !deferPrice ||
      ((filters.minPrice === undefined || service.price >= filters.minPrice) &&
        (filters.maxPrice === undefined || service.price <= filters.maxPrice));
    const skillsMatch =
      !deferSkills ||
      (service.skills ?? []).some((skill) =>
        filters.skills.some(
          (requested) => requested.toLowerCase() === skill.toLowerCase(),
        ),
      );
    return priceMatches && skillsMatch;
  };
  const [page, total] = await Promise.all([
    deferPrice || deferSkills
      ? paginateFilteredQuery(query, {
          limit: filters.limit,
          cursor: filters.cursor,
          orderByFields,
          matches: matcher,
        })
      : paginateQuery(query, {
          limit: filters.limit,
          cursor: filters.cursor,
          orderByFields,
        }),
    deferPrice || deferSkills
      ? Promise.resolve(undefined)
      : countMatching(countQuery),
  ]);
  let items = page.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  if (!deferSkills) items = filterBySkills(items, filters.skills);
  items = searchProvider.rank(items, searchTerms);
  return {
    items,
    nextCursor: page.nextCursor,
    total,
  };
}

export async function findServiceOwners(servicePage) {
  const ownerIds = [
    ...new Set(servicePage.map(({ ownerId }) => ownerId).filter(Boolean)),
  ];
  if (!ownerIds.length) return new Map();
  const snapshots = await firestore.getAll(
    ...ownerIds.map((uid) => firestore.collection("users").doc(uid)),
  );
  return new Map(
    snapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => [snapshot.id, snapshot.data()]),
  );
}

export async function updateService(id, updates, searchKeywords) {
  const ref = serviceRef(id);
  const updated = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return false;
    const patch = {
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (searchKeywords) patch.searchKeywords = searchKeywords;
    transaction.update(ref, patch);
    return true;
  });
  return updated ? findService(id) : null;
}

export async function deleteService(id) {
  const ref = serviceRef(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return false;
  await ref.delete();
  return true;
}

export async function migrateLegacyServiceCategories({ dryRun = false } = {}) {
  let migrated = 0;
  for (const legacy of legacyServiceCategories) {
    let lastId;
    while (true) {
      let query = services()
        .where("category", "==", legacy)
        .orderBy(FieldPath.documentId())
        .limit(400);
      if (lastId) query = query.startAfter(lastId);
      const snapshot = await query.get();
      if (snapshot.empty) break;
      const batch = firestore.batch();
      for (const document of snapshot.docs) {
        const category = normalizeServiceCategory(document.get("category"));
        if (!category) continue;
        if (!dryRun) batch.update(document.ref, { category });
        migrated += 1;
      }
      if (!dryRun && snapshot.size) await batch.commit();
      lastId = snapshot.docs.at(-1).id;
      if (snapshot.size < 400) break;
    }
  }
  return migrated;
}
