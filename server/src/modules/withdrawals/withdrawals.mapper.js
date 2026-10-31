function toIsoString(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

export function toWalletDto(wallet, uid) {
  return {
    uid,
    available: wallet.available,
    pending: wallet.pending,
    currency: wallet.currency,
    updatedAt: toIsoString(wallet.updatedAt),
  };
}

export function toWithdrawalDto(withdrawal) {
  return {
    id: withdrawal.id,
    amount: withdrawal.amount,
    currency: withdrawal.currency,
    status: withdrawal.status,
    createdAt: toIsoString(withdrawal.createdAt),
    updatedAt: toIsoString(withdrawal.updatedAt),
    processedAt: toIsoString(withdrawal.processedAt),
    rejectionReason: withdrawal.rejectionReason ?? null,
  };
}
