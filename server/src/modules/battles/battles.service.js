import { env } from "../../config/env.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../utils/AppError.js";
import {
  closeBattleIfExpired,
  closeExpiredBattles,
  createBattle,
  findBattle,
  findBattles,
  findVote,
  voteForBattle,
} from "./battles.repository.js";

const MAX_BATTLE_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

function validateEndTime(endsAt, now = Date.now()) {
  const endTime = new Date(endsAt).getTime();
  if (
    !Number.isFinite(endTime) ||
    endTime <= now ||
    endTime > now + MAX_BATTLE_DURATION_MS
  ) {
    throw new ValidationError([
      {
        path: ["body", "endsAt"],
        message: "endsAt must be in the future and within 90 days",
      },
    ]);
  }
}

function belongsToCloudinary(urlValue) {
  try {
    const url = new URL(urlValue);
    const parts = url.pathname.split("/").filter(Boolean);
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      parts[0] === env.cloudinaryCloudName &&
      parts[1] === "image" &&
      parts[2] === "upload" &&
      parts.slice(3).some((part) => /\.[A-Za-z0-9]+$/.test(part))
    );
  } catch {
    return false;
  }
}

function validateOptionImages(options) {
  if (options.some(({ imageUrl }) => !belongsToCloudinary(imageUrl))) {
    throw new ValidationError([
      {
        path: ["body", "options"],
        message: "Battle images must belong to this Cloudinary cloud",
      },
    ]);
  }
}

export async function createNewBattle(actor, input) {
  if (!actor?.uid) throw new ForbiddenError();
  validateEndTime(input.endsAt);
  validateOptionImages(input.options);
  return createBattle(actor.uid, input);
}

export async function listBattles(filters) {
  await closeExpiredBattles();
  const status =
    filters.filter === "live"
      ? "open"
      : filters.filter === "ended"
        ? "closed"
        : undefined;
  return findBattles({ ...filters, status });
}

export async function getBattle(id, actor = null) {
  const battle = await closeBattleIfExpired(id);
  if (!battle) throw new NotFoundError("Battle not found");
  const vote = actor?.uid ? await findVote(id, actor.uid) : null;
  return { battle, userVote: vote?.optionId ?? null };
}

export async function getMyBattleVote(actor, id) {
  if (!actor?.uid) throw new ForbiddenError();
  const [battle, vote] = await Promise.all([
    closeBattleIfExpired(id),
    findVote(id, actor.uid),
  ]);
  if (!battle) throw new NotFoundError("Battle not found");
  return vote?.optionId ?? null;
}

export async function castBattleVote(actor, id, optionId) {
  if (!actor?.uid) throw new ForbiddenError();
  const result = await voteForBattle(id, actor.uid, optionId);
  switch (result.reason) {
    case "not_found":
      throw new NotFoundError("Battle not found");
    case "closed":
    case "expired":
      throw new ConflictError("This battle is no longer accepting votes");
    case "invalid_option":
      throw new ValidationError([
        {
          path: ["body", "optionId"],
          message: "optionId does not belong to this battle",
        },
      ]);
    case "already_voted":
      throw new ConflictError("You have already voted in this battle");
    default:
      break;
  }

  const [battle, userVote] = await Promise.all([
    findBattle(id),
    Promise.resolve(result.optionId),
  ]);
  if (!battle) throw new NotFoundError("Battle not found");
  return { battle, userVote };
}
