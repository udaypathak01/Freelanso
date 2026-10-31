import { FieldValue } from "firebase-admin/firestore";
import { firestore } from "../../config/firebase.js";
import { AppError } from "../../utils/AppError.js";

const DAILY_SEARCH_QUOTA = 20;

export async function consumeDailySearchQuota(uid, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const ref = firestore.collection("aiSearchQuotas").doc(`${uid}_${day}`);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const used = snapshot.exists ? snapshot.get("count") ?? 0 : 0;
    if (used >= DAILY_SEARCH_QUOTA) {
      throw new AppError(
        429,
        "AI_DAILY_QUOTA_EXCEEDED",
        "Daily smart-search quota exceeded",
      );
    }
    transaction.set(
      ref,
      {
        uid,
        day,
        count: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { day, remaining: DAILY_SEARCH_QUOTA - used - 1 };
  });
}
