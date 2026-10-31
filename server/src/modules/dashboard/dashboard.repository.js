import { AggregateField } from "firebase-admin/firestore";
import { firestore } from "../../config/firebase.js";
import { paginateQuery } from "../../utils/pagination.js";

const statuses = ["published", "draft", "archived", "deleted"];

function collection(name) {
  return firestore.collection(name);
}

async function findOwnedListings(name, ownerId, limit, cursor) {
  if (cursor === "__done__") {
    return { items: [], nextCursor: null };
  }
  const query = collection(name)
    .where("ownerId", "==", ownerId)
    .orderBy("createdAt", "desc")
    .orderBy("__name__", "desc");
  const page = await paginateQuery(query, {
    limit,
    cursor,
    orderByFields: ["createdAt", "__name__"],
  });
  return {
    items: page.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
    nextCursor: page.nextCursor,
  };
}

async function countOwnedByStatus(name, ownerId) {
  const ownerQuery = collection(name).where("ownerId", "==", ownerId);
  const [totalSnapshot, ...statusSnapshots] = await Promise.all([
    ownerQuery.count().get(),
    ...statuses.map((status) =>
      ownerQuery.where("status", "==", status).count().get(),
    ),
  ]);
  const total = totalSnapshot.data().count;
  const byStatus = Object.fromEntries(
    statuses.map((status, index) => [
      status,
      statusSnapshots[index].data().count,
    ]),
  );
  byStatus.other = Math.max(
    0,
    total - Object.values(byStatus).reduce((sum, count) => sum + count, 0),
  );
  return { total, byStatus };
}

async function sumProjectEngagement(ownerId) {
  const snapshot = await collection("projects")
    .where("ownerId", "==", ownerId)
    .aggregate({
      likes: AggregateField.sum("likesCount"),
      comments: AggregateField.sum("commentsCount"),
      views: AggregateField.sum("viewsCount"),
    })
    .get();
  const totals = snapshot.data();
  return {
    likes: totals.likes ?? 0,
    comments: totals.comments ?? 0,
    views: totals.views ?? 0,
  };
}

async function countApplications(uid) {
  const [sent, received] = await Promise.all([
    collection("applications").where("applicantId", "==", uid).count().get(),
    collection("applications").where("jobOwnerId", "==", uid).count().get(),
  ]);
  return {
    sent: sent.data().count,
    received: received.data().count,
  };
}

async function findUserStats(uid) {
  const snapshot = await collection("users").doc(uid).get();
  return snapshot.exists ? (snapshot.get("stats") ?? {}) : {};
}

export async function getDashboardRepositoryData(
  uid,
  { limit, projectCursor, serviceCursor },
) {
  const [
    projects,
    services,
    projectCounts,
    serviceCounts,
    engagement,
    applications,
    stats,
  ] = await Promise.all([
    findOwnedListings("projects", uid, limit, projectCursor),
    findOwnedListings("services", uid, limit, serviceCursor),
    countOwnedByStatus("projects", uid),
    countOwnedByStatus("services", uid),
    sumProjectEngagement(uid),
    countApplications(uid),
    findUserStats(uid),
  ]);

  return {
    projects,
    services,
    projectCounts,
    serviceCounts,
    engagement,
    applications,
    stats,
  };
}
