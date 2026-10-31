import { firestore } from "../../config/firebase.js";

export async function checkFirestoreConnection() {
  await firestore.listCollections();
}
