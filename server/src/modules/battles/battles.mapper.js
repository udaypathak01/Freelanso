function toIsoString(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

function optionDto(option) {
  return {
    id: option.id,
    title: option.label,
    label: option.label,
    description: option.description,
    image: option.imageUrl,
    image_url: option.imageUrl,
    author: option.author || "Anonymous",
    authorAvatar: option.authorAvatar ?? null,
    projectId: option.projectId ?? null,
  };
}

export function toBattleDto(id, battle, userVote = null) {
  const options = (battle.options ?? []).map(optionDto);
  const voteCounts = Object.fromEntries(
    (battle.options ?? []).map((option) => [
      option.id,
      Number.isInteger(battle.voteCounts?.[option.id])
        ? battle.voteCounts[option.id]
        : 0,
    ]),
  );
  const ended =
    battle.status === "closed" ||
    (battle.endsAt &&
      new Date(toIsoString(battle.endsAt)).getTime() <= Date.now());
  const entryA = options[0] ?? null;
  const entryB = options[1] ?? null;
  const votesA = entryA ? voteCounts[entryA.id] : 0;
  const votesB = entryB ? voteCounts[entryB.id] : 0;
  const winnerOptionId =
    battle.winnerOptionId ??
    (ended && battle.votesTotal > 0
      ? (() => {
          const sorted = Object.entries(voteCounts).sort(
            ([leftId, leftCount], [rightId, rightCount]) =>
              rightCount - leftCount || leftId.localeCompare(rightId),
          );
          return sorted[0]?.[1] > sorted[1]?.[1] ? sorted[0][0] : null;
        })()
      : null);

  return {
    id,
    title: battle.title,
    description: battle.description ?? "",
    category: battle.category,
    options,
    votesTotal: Number.isInteger(battle.votesTotal) ? battle.votesTotal : 0,
    voteCounts,
    status: ended ? "ended" : "live",
    startsAt: toIsoString(battle.startsAt),
    endsAt: toIsoString(battle.endsAt),
    createdAt: toIsoString(battle.createdAt),
    updatedAt: toIsoString(battle.updatedAt),
    winnerOptionId,
    winner: winnerOptionId
      ? (options.find((option) => option.id === winnerOptionId) ?? null)
      : null,
    userVote,
    entry_A: entryA,
    entry_B: entryB,
    votes_A: votesA,
    votes_B: votesB,
  };
}
