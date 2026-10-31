import { FieldPath } from "firebase-admin/firestore";
import { firestore } from "../../config/firebase.js";

const MATCH_CANDIDATE_LIMIT = 100;

export async function findMatchTargetProject(projectId) {
  const snapshot = await firestore.collection("projects").doc(projectId).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function findFreelancerMatchCandidates() {
  const snapshot = await firestore
    .collection("users")
    .where("role", "==", "freelancer")
    .orderBy(FieldPath.documentId(), "asc")
    .limit(MATCH_CANDIDATE_LIMIT)
    .get();
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}
