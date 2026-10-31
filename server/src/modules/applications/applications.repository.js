import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { firestore } from "../../config/firebase.js";
import { paginateQuery } from "../../utils/pagination.js";

const applications = () => firestore.collection("applications");
const applicationRef = (id) => applications().doc(id);
const jobRef = (id) => firestore.collection("jobs").doc(id);

function applicationId(jobId, applicantId) {
  return `${jobId}_${applicantId}`;
}

async function findApplicationDocument(id) {
  const snapshot = await applicationRef(id).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function createApplication(jobId, applicantId, input) {
  const id = applicationId(jobId, applicantId);
  const appRef = applicationRef(id);
  const parentJobRef = jobRef(jobId);
  const result = await firestore.runTransaction(async (transaction) => {
    const jobSnapshot = await transaction.get(parentJobRef);
    if (!jobSnapshot.exists || jobSnapshot.get("status") === "deleted") {
      return { reason: "job_not_found" };
    }
    if (jobSnapshot.get("postedBy") === applicantId) {
      return { reason: "own_job" };
    }
    if (jobSnapshot.get("status") !== "open") {
      return { reason: "job_not_open" };
    }
    const appSnapshot = await transaction.get(appRef);
    if (appSnapshot.exists) return { reason: "duplicate" };

    const now = FieldValue.serverTimestamp();
    transaction.create(appRef, {
      jobId,
      applicantId,
      jobOwnerId: jobSnapshot.get("postedBy"),
      coverLetter: input.coverLetter,
      proposedRate: input.proposedRate,
      status: "submitted",
      createdAt: now,
      updatedAt: now,
    });
    transaction.update(parentJobRef, {
      applicationsCount: FieldValue.increment(1),
      updatedAt: now,
    });
    return { reason: "created" };
  });
  if (result.reason !== "created") return result;
  return { reason: "created", application: await findApplicationDocument(id) };
}

export async function findApplication(id) {
  return findApplicationDocument(id);
}

async function findApplicationsBy(field, value, { limit, cursor }) {
  const query = applications()
    .where(field, "==", value)
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc");
  const [page, countSnapshot] = await Promise.all([
    paginateQuery(query, {
      limit,
      cursor,
      orderByFields: ["createdAt", "__name__"],
    }),
    applications().where(field, "==", value).count().get(),
  ]);
  return {
    items: page.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
    nextCursor: page.nextCursor,
    total: countSnapshot.data().count,
  };
}

export async function findApplicationsForApplicant(applicantId, pagination) {
  return findApplicationsBy("applicantId", applicantId, pagination);
}

export async function findApplicationsForJob(jobId, pagination) {
  return findApplicationsBy("jobId", jobId, pagination);
}

export async function findApplicationJobs(items) {
  const ids = [...new Set(items.map(({ jobId }) => jobId))];
  if (!ids.length) return new Map();
  const snapshots = await firestore.getAll(...ids.map((id) => jobRef(id)));
  return new Map(
    snapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => [
        snapshot.id,
        { id: snapshot.id, ...snapshot.data() },
      ]),
  );
}

export async function findApplicants(items) {
  const ids = [...new Set(items.map(({ applicantId }) => applicantId))];
  if (!ids.length) return new Map();
  const snapshots = await firestore.getAll(
    ...ids.map((uid) => firestore.collection("users").doc(uid)),
  );
  return new Map(
    snapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => [snapshot.id, snapshot.data()]),
  );
}

export async function updateApplicationStatus(id, expectedStatus, status) {
  const ref = applicationRef(id);
  const updated = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get("status") !== expectedStatus) {
      return false;
    }
    transaction.update(ref, {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
  return updated ? findApplicationDocument(id) : null;
}
