import { env } from "../../config/env.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../utils/AppError.js";
import {
  createWithdrawal,
  decideWithdrawal,
  findWallet,
  findWithdrawalsForUser,
} from "./withdrawals.repository.js";

export async function getWallet(uid) {
  return findWallet(uid);
}

export async function requestWithdrawal(actor, amount, idempotencyKey) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new ValidationError([], "Withdrawal amount must be a positive integer in minor currency units");
  }
  if (amount < env.withdrawalMinMinor || amount > env.withdrawalMaxMinor) {
    throw new ValidationError([], "Withdrawal amount is outside the allowed range");
  }
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length < 1 ||
    idempotencyKey.length > 200
  ) {
    throw new ValidationError([], "A valid Idempotency-Key header is required");
  }
  const result = await createWithdrawal(actor.uid, amount, idempotencyKey);
  if (result.reason === "insufficient_funds") {
    throw new ConflictError("Insufficient available wallet balance");
  }
  if (result.reason === "idempotency_conflict") {
    throw new ConflictError("Idempotency-Key was already used for a different request");
  }
  return result.withdrawal;
}

export async function getUserWithdrawals(uid, pagination) {
  return findWithdrawalsForUser(uid, pagination);
}

export async function updateWithdrawalDecision(id, status, adminUid) {
  const result = await decideWithdrawal(id, status, adminUid);
  if (result.reason === "not_found") throw new NotFoundError("Withdrawal not found");
  if (result.reason === "invalid_transition") {
    throw new ConflictError("Withdrawal has already been processed");
  }
  return result.withdrawal;
}
