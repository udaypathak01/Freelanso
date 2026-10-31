import { asyncHandler } from "../../utils/asyncHandler.js";
import { created, ok, paginated } from "../../utils/response.js";
import { DEFAULT_PAGE_SIZE } from "../../utils/pagination.js";
import { env } from "../../config/env.js";
import {
  toWalletDto,
  toWithdrawalDto,
} from "./withdrawals.mapper.js";
import {
  getUserWithdrawals,
  getWallet,
  requestWithdrawal,
  updateWithdrawalDecision,
} from "./withdrawals.service.js";

export const getWalletHandler = asyncHandler(async (req, res) => {
  const wallet = await getWallet(req.user.uid);
  return ok(res, toWalletDto(wallet, req.user.uid), {
    minimumWithdrawalMinor: env.withdrawalMinMinor,
    maximumWithdrawalMinor: env.withdrawalMaxMinor,
  });
});

export const postWithdrawal = asyncHandler(async (req, res) => {
  const withdrawal = await requestWithdrawal(
    req.user,
    req.validated.body.amount,
    req.get("Idempotency-Key"),
  );
  return created(res, toWithdrawalDto(withdrawal));
});

export const getMyWithdrawals = asyncHandler(async (req, res) => {
  const page = await getUserWithdrawals(req.user.uid, req.validated.query);
  return paginated(
    res,
    page.items.map(toWithdrawalDto),
    page.nextCursor,
    { limit: req.validated.query.limit ?? DEFAULT_PAGE_SIZE },
  );
});

export const patchWithdrawalStatus = asyncHandler(async (req, res) =>
  ok(
    res,
    toWithdrawalDto(
      await updateWithdrawalDecision(
        req.validated.params.id,
        req.validated.body.status,
        req.user.uid,
      ),
    ),
  ),
);
