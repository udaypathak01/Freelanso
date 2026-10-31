import { asyncHandler } from "../../utils/asyncHandler.js";
import { created, ok, paginated } from "../../utils/response.js";
import { DEFAULT_PAGE_SIZE } from "../../utils/pagination.js";
import { toBattleDto } from "./battles.mapper.js";
import {
  castBattleVote,
  createNewBattle,
  getBattle,
  getMyBattleVote,
  listBattles,
} from "./battles.service.js";

export const getBattles = asyncHandler(async (req, res) => {
  const filters = req.validated.query;
  const page = await listBattles(filters);
  return paginated(
    res,
    page.items.map((battle) => toBattleDto(battle.id, battle)),
    page.nextCursor,
    { limit: filters.limit ?? DEFAULT_PAGE_SIZE },
  );
});

export const getBattleById = asyncHandler(async (req, res) => {
  const { battle, userVote } = await getBattle(
    req.validated.params.id,
    req.user ?? null,
  );
  return ok(res, toBattleDto(battle.id, battle, userVote));
});

export const getBattleVote = asyncHandler(async (req, res) => {
  const optionId = await getMyBattleVote(req.user, req.validated.params.id);
  return ok(res, { voted: optionId !== null, side: optionId });
});

export const postBattle = asyncHandler(async (req, res) => {
  const battle = await createNewBattle(req.user, req.validated.body);
  return created(res, toBattleDto(battle.id, battle));
});

export const postBattleVote = asyncHandler(async (req, res) => {
  const { battle, userVote } = await castBattleVote(
    req.user,
    req.validated.params.id,
    req.validated.body.optionId,
  );
  return ok(res, toBattleDto(battle.id, battle, userVote));
});
