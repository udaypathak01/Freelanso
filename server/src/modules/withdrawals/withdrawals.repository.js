import { createHash } from "node:crypto";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { firestore } from "../../config/firebase.js";
import { env } from "../../config/env.js";
import { paginateQuery } from "../../utils/pagination.js";
import { ServiceUnavailableError } from "../../utils/AppError.js";

const wallets = () => firestore.collection("wallets");
const withdrawals = () => firestore.collection("withdrawals");
const transactions = () => firestore.collection("transactions");
const walletRef = (uid) => wallets().doc(uid);

function withdrawalId(uid, idempotencyKey) {
  return `withdraw_${createHash("sha256")
    .update(`${uid}\n${idempotencyKey}`)
    .digest("hex")}`;
}

function requestFingerprint(amount) {
  return createHash("sha256").update(String(amount)).digest("hex");
}

function walletValues(data = {}) {
  const available = data.available ?? 0;
  const pending = data.pending ?? 0;
  if (
    !Number.isSafeInteger(available) ||
    available < 0 ||
    !Number.isSafeInteger(pending) ||
    pending < 0
  ) {
    throw new ServiceUnavailableError("Wallet balance data is invalid");
  }
  return {
    available,
    pending,
    currency: typeof data.currency === "string" ? data.currency : env.walletCurrency,
    ...(data.updatedAt ? { updatedAt: data.updatedAt } : {}),
  };
}

export async function findWallet(uid) {
  const snapshot = await walletRef(uid).get();
  return walletValues(snapshot.exists ? snapshot.data() : {});
}

export async function createWithdrawal(uid, amount, idempotencyKey) {
  const id = withdrawalId(uid, idempotencyKey);
  const withdrawalRef = withdrawals().doc(id);
  const balanceRef = walletRef(uid);
  const requestedLedgerRef = transactions().doc(`${id}_requested`);
  const fingerprint = requestFingerprint(amount);

  const result = await firestore.runTransaction(async (transaction) => {
    const [existing, walletSnapshot] = await Promise.all([
      transaction.get(withdrawalRef),
      transaction.get(balanceRef),
    ]);
    if (existing.exists) {
      return existing.get("requestFingerprint") === fingerprint
        ? { reason: "existing" }
        : { reason: "idempotency_conflict" };
    }

    const wallet = walletValues(walletSnapshot.exists ? walletSnapshot.data() : {});
    if (wallet.available < amount) return { reason: "insufficient_funds" };
    const now = FieldValue.serverTimestamp();
    transaction.set(
      balanceRef,
      {
        available: wallet.available - amount,
        pending: wallet.pending + amount,
        currency: wallet.currency,
        updatedAt: now,
      },
      { merge: true },
    );
    transaction.create(withdrawalRef, {
      uid,
      amount,
      currency: wallet.currency,
      status: "pending",
      requestFingerprint: fingerprint,
      createdAt: now,
      updatedAt: now,
    });
    transaction.create(requestedLedgerRef, {
      uid,
      withdrawalId: id,
      entryType: "withdrawal_requested",
      amount,
      availableDelta: -amount,
      pendingDelta: amount,
      currency: wallet.currency,
      createdAt: now,
    });
    return { reason: "created" };
  });

  if (result.reason === "insufficient_funds") return result;
  if (result.reason === "idempotency_conflict") return result;
  const snapshot = await withdrawalRef.get();
  return {
    reason: result.reason,
    withdrawal: { id: snapshot.id, ...snapshot.data() },
  };
}

export async function findWithdrawalsForUser(uid, { limit, cursor }) {
  const query = withdrawals()
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc");
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

export async function decideWithdrawal(id, status, adminUid) {
  const withdrawalRef = withdrawals().doc(id);
  const result = await firestore.runTransaction(async (transaction) => {
    const withdrawalSnapshot = await transaction.get(withdrawalRef);
    if (!withdrawalSnapshot.exists) return { reason: "not_found" };
    const withdrawal = withdrawalSnapshot.data();
    if (withdrawal.status === status) return { reason: "unchanged" };
    if (withdrawal.status !== "pending") return { reason: "invalid_transition" };

    const walletDocument = walletRef(withdrawal.uid);
    const ledgerRef = transactions().doc(`${id}_${status}`);
    const walletSnapshot =
      status === "rejected" ? await transaction.get(walletDocument) : null;
    const now = FieldValue.serverTimestamp();

    if (status === "rejected") {
      const wallet = walletValues(
        walletSnapshot?.exists ? walletSnapshot.data() : {},
      );
      if (wallet.pending < withdrawal.amount) {
        throw new ServiceUnavailableError("Pending wallet balance is inconsistent");
      }
      transaction.update(walletDocument, {
        available: wallet.available + withdrawal.amount,
        pending: wallet.pending - withdrawal.amount,
        updatedAt: now,
      });
      transaction.create(ledgerRef, {
        uid: withdrawal.uid,
        withdrawalId: id,
        entryType: "withdrawal_rejected",
        amount: withdrawal.amount,
        availableDelta: withdrawal.amount,
        pendingDelta: -withdrawal.amount,
        currency: withdrawal.currency,
        actorUid: adminUid,
        createdAt: now,
      });
    } else {
      transaction.create(ledgerRef, {
        uid: withdrawal.uid,
        withdrawalId: id,
        entryType: "withdrawal_approved",
        amount: withdrawal.amount,
        availableDelta: 0,
        pendingDelta: 0,
        currency: withdrawal.currency,
        actorUid: adminUid,
        createdAt: now,
      });
    }
    transaction.update(withdrawalRef, {
      status,
      updatedAt: now,
      processedAt: now,
      processedBy: adminUid,
    });
    return { reason: "updated" };
  });

  if (result.reason !== "updated" && result.reason !== "unchanged") {
    return result;
  }
  const snapshot = await withdrawalRef.get();
  return {
    reason: result.reason,
    withdrawal: { id: snapshot.id, ...snapshot.data() },
  };
}
