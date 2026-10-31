import { AppError } from "../../utils/AppError.js";
import { checkFirestoreConnection } from "./health.repository.js";

export async function checkReadiness() {
  try {
    await checkFirestoreConnection();
  } catch {
    throw new AppError(503, "SERVICE_UNAVAILABLE", "Firestore is not ready");
  }
}
