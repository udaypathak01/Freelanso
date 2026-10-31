import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
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

const projects = () => firestore.collection("projects");
const projectRef = (id) => projects().doc(id);
const deletionQueue = () => firestore.collection("cloudinaryDeletionQueue");
const projectLikeQueues = new Map();

async function serializeProjectLikeToggle(projectId, operation) {
  const previous = projectLikeQueues.get(projectId) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  projectLikeQueues.set(projectId, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (projectLikeQueues.get(projectId) === current) {
      projectLikeQueues.delete(projectId);
    }
  }
}

export async function createProject(ownerId, project, searchKeywords) {
  const ref = projects().doc();
  const timestamp = FieldValue.serverTimestamp();
  const data = {
    ...project,
    ownerId,
    status: "published",
    likesCount: 0,
    commentsCount: 0,
    viewsCount: 0,
    searchKeywords,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await ref.create(data);
  const snapshot = await ref.get();
  return { id: ref.id, ...snapshot.data() };
}

export async function findProject(id) {
  const snapshot = await projectRef(id).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function hasProjectLike(id, uid) {
  const snapshot = await projectRef(id).collection("likes").doc(uid).get();
  return snapshot.exists;
}

export async function findProjects(queryFilters, { limit, cursor }) {
  const {
    query,
    countQuery,
    orderByFields,
    searchTerms,
    noSearchMatches,
    deferPrice,
    deferSkills,
  } = applyMarketplaceFilters(
    projects().where("status", "==", "published"),
    queryFilters,
  );
  if (noSearchMatches) {
    return { items: [], nextCursor: null, total: 0 };
  }
  const matcher = (doc) => {
    const project = doc.data();
    const priceMatches =
      !deferPrice ||
      ((queryFilters.minPrice === undefined ||
        project.price >= queryFilters.minPrice) &&
        (queryFilters.maxPrice === undefined ||
          project.price <= queryFilters.maxPrice));
    const skillsMatch =
      !deferSkills ||
      (project.skills ?? []).some((skill) =>
        queryFilters.skills.some(
          (requested) => requested.toLowerCase() === skill.toLowerCase(),
        ),
      );
    return priceMatches && skillsMatch;
  };
  const [page, total] = await Promise.all([
    deferPrice || deferSkills
      ? paginateFilteredQuery(query, {
          limit,
          cursor,
          orderByFields,
          matches: matcher,
        })
      : paginateQuery(query, {
          limit,
          cursor,
          orderByFields,
        }),
    deferPrice || deferSkills
      ? Promise.resolve(undefined)
      : countMatching(countQuery),
  ]);
  let items = page.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  if (!deferSkills) items = filterBySkills(items, queryFilters.skills);
  items = searchProvider.rank(items, searchTerms);
  return {
    nextCursor: page.nextCursor,
    items,
    total,
  };
}

export async function findProjectsByOwner(ownerId, { limit = 50, cursor }) {
  const query = projects()
    .where("ownerId", "==", ownerId)
    .orderBy("createdAt", "desc")
    .orderBy("__name__", "desc");
  const page = await paginateQuery(query, {
    limit,
    cursor,
    orderByFields: ["createdAt", "__name__"],
  });
  return {
    ...page,
    items: page.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
}

async function fetchUsers(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return new Map();
  const snapshots = await firestore.getAll(
    ...uniqueIds.map((uid) => firestore.collection("users").doc(uid)),
  );
  return new Map(
    snapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => [snapshot.id, snapshot.data()]),
  );
}

export async function findProjectOwners(projectsPage) {
  return fetchUsers(projectsPage.map((project) => project.ownerId));
}

export async function updateProject(id, updates, searchKeywords) {
  const ref = projectRef(id);
  const updated = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return false;
    const patch = { ...updates, updatedAt: FieldValue.serverTimestamp() };
    if (searchKeywords) patch.searchKeywords = searchKeywords;
    transaction.update(ref, patch);
    return true;
  });
  if (!updated) return null;
  return findProject(id);
}

export async function deleteProjectTree(id) {
  const ref = projectRef(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return false;
  await firestore.recursiveDelete(ref);
  return true;
}

export async function toggleProjectLike(id, uid) {
  return serializeProjectLikeToggle(id, async () => {
    const project = projectRef(id);
    const like = project.collection("likes").doc(uid);
    return firestore.runTransaction(async (transaction) => {
      const [projectSnapshot, likeSnapshot] = await Promise.all([
        transaction.get(project),
        transaction.get(like),
      ]);
      if (
        !projectSnapshot.exists ||
        projectSnapshot.get("status") !== "published"
      ) {
        return null;
      }
      const liked = !likeSnapshot.exists;
      if (liked) {
        transaction.create(like, {
          uid,
          createdAt: FieldValue.serverTimestamp(),
        });
        transaction.update(project, {
          likesCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        transaction.delete(like);
        transaction.update(project, {
          likesCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return {
        liked,
        count: Math.max(
          0,
          (projectSnapshot.get("likesCount") ?? 0) + (liked ? 1 : -1),
        ),
      };
    });
  });
}

export async function addProjectView(id, viewerKey, windowStart) {
  const ref = projectRef(id);
  const viewRef = ref.collection("views").doc(viewerKey);
  return firestore.runTransaction(async (transaction) => {
    const [projectSnapshot, viewSnapshot] = await Promise.all([
      transaction.get(ref),
      transaction.get(viewRef),
    ]);
    if (
      !projectSnapshot.exists ||
      projectSnapshot.get("status") !== "published"
    ) {
      return null;
    }
    if (viewSnapshot.exists) return false;
    transaction.create(viewRef, {
      createdAt: FieldValue.serverTimestamp(),
      windowStart: Timestamp.fromDate(windowStart),
    });
    transaction.update(ref, {
      viewsCount: FieldValue.increment(1),
    });
    return true;
  });
}

export async function createProjectComment(id, authorId, text) {
  const project = projectRef(id);
  const comment = project.collection("comments").doc();
  const result = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(project);
    if (!snapshot.exists || snapshot.get("status") !== "published")
      return false;
    transaction.create(comment, {
      projectId: id,
      authorId,
      text,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.update(project, {
      commentsCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
  if (!result) return null;
  const snapshot = await comment.get();
  return { id: comment.id, ...snapshot.data() };
}

export async function findProjectComments(id, { limit, cursor }) {
  const query = projectRef(id)
    .collection("comments")
    .orderBy("createdAt", "desc")
    .orderBy("__name__", "desc");
  const page = await paginateQuery(query, {
    limit,
    cursor,
    orderByFields: ["createdAt", "__name__"],
  });
  const comments = page.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const authors = await fetchUsers(comments.map((comment) => comment.authorId));
  return {
    nextCursor: page.nextCursor,
    items: comments.map((comment) => ({
      ...comment,
      author: authors.get(comment.authorId) ?? {},
    })),
  };
}

export async function findProjectComment(id, commentId) {
  const snapshot = await projectRef(id)
    .collection("comments")
    .doc(commentId)
    .get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function deleteProjectComment(id, commentId) {
  const project = projectRef(id);
  const comment = project.collection("comments").doc(commentId);
  return firestore.runTransaction(async (transaction) => {
    const [projectSnapshot, commentSnapshot] = await Promise.all([
      transaction.get(project),
      transaction.get(comment),
    ]);
    if (!projectSnapshot.exists || !commentSnapshot.exists) return false;
    transaction.delete(comment);
    transaction.update(project, {
      commentsCount: FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

export async function queueCloudinaryDeletions(projectId, assets) {
  const batch = firestore.batch();
  const jobs = [];
  for (const asset of assets) {
    const id = createHash("sha256")
      .update(`${projectId}:${asset.resourceType}:${asset.publicId}`)
      .digest("hex");
    const ref = deletionQueue().doc(id);
    jobs.push({
      id,
      ref,
      projectId,
      publicId: asset.publicId,
      resourceType: asset.resourceType,
    });
    batch.set(
      ref,
      {
        projectId,
        publicId: asset.publicId,
        resourceType: asset.resourceType,
        status: "pending",
        attemptCount: 0,
        nextAttemptAt: Timestamp.fromMillis(Date.now() + 60_000),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  if (jobs.length) await batch.commit();
  return jobs;
}

export async function removeCloudinaryDeletionJob(jobId) {
  await deletionQueue().doc(jobId).delete();
}

export async function rescheduleCloudinaryDeletion(jobId, attemptCount) {
  const delayMs = Math.min(
    60_000 * 2 ** Math.min(attemptCount, 10),
    86_400_000,
  );
  await deletionQueue()
    .doc(jobId)
    .update({
      attemptCount,
      nextAttemptAt: Timestamp.fromMillis(Date.now() + delayMs),
    });
}

export async function findPendingCloudinaryDeletions(limit = 10) {
  const snapshot = await deletionQueue()
    .where("status", "==", "pending")
    .where("nextAttemptAt", "<=", Timestamp.now())
    .orderBy("nextAttemptAt", "asc")
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function rollbackCloudinaryDeletions(jobs) {
  if (!jobs.length) return;
  const batch = firestore.batch();
  for (const job of jobs) batch.delete(job.ref);
  await batch.commit();
}
