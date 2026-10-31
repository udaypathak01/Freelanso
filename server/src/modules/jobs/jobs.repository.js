import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { firestore } from "../../config/firebase.js";
import {
  paginateFilteredQuery,
  paginateQuery,
} from "../../utils/pagination.js";
import { countMatching, searchProvider } from "../search/searchProvider.js";

const jobs = () => firestore.collection("jobs");
const jobRef = (id) => jobs().doc(id);

const orderFields = {
  newest: [
    ["createdAt", "desc"],
    ["__name__", "desc"],
  ],
  oldest: [
    ["createdAt", "asc"],
    ["__name__", "asc"],
  ],
  price_asc: [
    ["budgetMin", "asc"],
    ["createdAt", "desc"],
    ["__name__", "desc"],
  ],
  price_desc: [
    ["budgetMin", "desc"],
    ["createdAt", "desc"],
    ["__name__", "desc"],
  ],
  popular: [
    ["applicationsCount", "desc"],
    ["createdAt", "desc"],
    ["__name__", "desc"],
  ],
};

function ordered(query, sort) {
  const fields = orderFields[sort] ?? orderFields.newest;
  for (const [field, direction] of fields) {
    query = query.orderBy(
      field === "__name__" ? FieldPath.documentId() : field,
      direction,
    );
  }
  return { query, fields: fields.map(([field]) => field) };
}

function matchesFilters(job, filters, searchTerms) {
  const inPriceRange =
    (filters.minPrice === undefined || job.budgetMax >= filters.minPrice) &&
    (filters.maxPrice === undefined || job.budgetMin <= filters.maxPrice);
  const hasSkills =
    !filters.skills?.length ||
    filters.skills.some((requested) =>
      (job.skills ?? []).some(
        (skill) => skill.toLowerCase() === requested.toLowerCase(),
      ),
    );
  const locationMatches =
    !filters.location ||
    (job.location ?? "").toLowerCase().includes(filters.location.toLowerCase());
  const jobTypeMatches = !filters.jobType || job.jobType === filters.jobType;
  const hasSearchTerms =
    !searchTerms.length ||
    searchTerms.some((term) => (job.searchKeywords ?? []).includes(term));
  return (
    inPriceRange &&
    hasSkills &&
    locationMatches &&
    jobTypeMatches &&
    hasSearchTerms
  );
}

export async function createJob(postedBy, input, searchKeywords) {
  const ref = jobs().doc();
  const now = FieldValue.serverTimestamp();
  await ref.create({
    ...input,
    location: input.location ?? null,
    postedBy,
    status: "open",
    applicationsCount: 0,
    searchKeywords,
    createdAt: now,
    updatedAt: now,
  });
  const snapshot = await ref.get();
  return { id: ref.id, ...snapshot.data() };
}

export async function findJob(id) {
  const snapshot = await jobRef(id).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function findJobs(filters) {
  let baseQuery = jobs().where("status", "==", "open");
  if (filters.category) {
    baseQuery = baseQuery.where("category", "==", filters.category);
  }
  const search = searchProvider.prepare(baseQuery, filters.q);
  if (search.empty) return { items: [], nextCursor: null, total: 0 };
  const countQuery = search.query;
  const { query, fields } = ordered(search.query, filters.sort);
  const hasDeferredFilters = Boolean(
    filters.minPrice !== undefined ||
      filters.maxPrice !== undefined ||
      filters.skills?.length ||
      filters.location ||
      filters.jobType,
  );
  const matches = (document) =>
    matchesFilters(document.data(), filters, search.terms);
  const [page, total] = await Promise.all([
    hasDeferredFilters
      ? paginateFilteredQuery(query, {
          limit: filters.limit,
          cursor: filters.cursor,
          orderByFields: fields,
          matches,
        })
      : paginateQuery(query, {
          limit: filters.limit,
          cursor: filters.cursor,
          orderByFields: fields,
        }),
    hasDeferredFilters ? Promise.resolve(undefined) : countMatching(countQuery),
  ]);
  return {
    items: page.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
    nextCursor: page.nextCursor,
    total,
  };
}

export async function findJobsByOwner(ownerId, { limit, cursor }) {
  const query = jobs()
    .where("postedBy", "==", ownerId)
    .where("status", "!=", "deleted")
    .orderBy("status", "asc")
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc");
  const page = await paginateQuery(query, {
    limit,
    cursor,
    orderByFields: ["status", "createdAt", "__name__"],
  });
  return {
    items: page.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
    nextCursor: page.nextCursor,
  };
}

export async function findJobOwners(items) {
  const ownerIds = [...new Set(items.map(({ postedBy }) => postedBy))];
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

export async function updateJob(id, updates, searchKeywords) {
  const ref = jobRef(id);
  const didUpdate = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get("status") === "deleted") return false;
    transaction.update(ref, {
      ...updates,
      ...(searchKeywords ? { searchKeywords } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
  return didUpdate ? findJob(id) : null;
}

export async function softDeleteJob(id) {
  const ref = jobRef(id);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get("status") === "deleted") return false;
    transaction.update(ref, {
      status: "deleted",
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}
