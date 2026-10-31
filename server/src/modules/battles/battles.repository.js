import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { firestore } from "../../config/firebase.js";
import { paginateQuery } from "../../utils/pagination.js";

const battles = () => firestore.collection("battles");
const battleRef = (id) => battles().doc(id);
const MAX_EXPIRATIONS_PER_PASS = 100;
const voteQueues = new Map();

async function serializeVoteForBattle(id, operation) {
  const previous = voteQueues.get(id) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  voteQueues.set(id, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (voteQueues.get(id) === current) voteQueues.delete(id);
  }
}

function computeWinner(options, voteCounts) {
  const ranked = options
    .map((option) => [option.id, voteCounts?.[option.id] ?? 0])
    .sort(
      ([leftId, leftCount], [rightId, rightCount]) =>
        rightCount - leftCount || leftId.localeCompare(rightId),
    );
  if (!ranked.length || ranked[0][1] === 0) return null;
  return ranked[0][1] > (ranked[1]?.[1] ?? 0) ? ranked[0][0] : null;
}

function isExpired(battle, now = Date.now()) {
  const endsAt =
    typeof battle.endsAt?.toDate === "function"
      ? battle.endsAt.toDate().getTime()
      : new Date(battle.endsAt).getTime();
  return Number.isFinite(endsAt) && endsAt <= now;
}

export async function createBattle(creatorId, input) {
  const ref = battles().doc();
  const endsAt = Timestamp.fromDate(new Date(input.endsAt));
  const now = FieldValue.serverTimestamp();
  const options = input.options.map((option, index) => ({
    id: String.fromCharCode(65 + index),
    label: option.title,
    description: option.description,
    imageUrl: option.imageUrl,
    author: option.author?.trim() || "Anonymous",
    projectId: null,
  }));
  const voteCounts = Object.fromEntries(options.map(({ id }) => [id, 0]));
  await ref.create({
    creatorId,
    title: input.title,
    description: input.description ?? "",
    category: input.category,
    options,
    votesTotal: 0,
    voteCounts,
    status: "open",
    startsAt: Timestamp.now(),
    endsAt,
    createdAt: now,
    updatedAt: now,
    winnerOptionId: null,
  });
  const snapshot = await ref.get();
  return { id: ref.id, ...snapshot.data() };
}

export async function findBattle(id) {
  const snapshot = await battleRef(id).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function findVote(id, uid) {
  const snapshot = await battleRef(id).collection("votes").doc(uid).get();
  return snapshot.exists ? snapshot.data() : null;
}

export async function voteForBattle(id, uid, optionId, now = Date.now()) {
  const ref = battleRef(id);
  const voteRef = ref.collection("votes").doc(uid);
  return serializeVoteForBattle(id, () =>
    firestore.runTransaction(
      async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) return { reason: "not_found" };
        const battle = snapshot.data();
        if (battle.status === "closed") return { reason: "closed" };
        if (isExpired(battle, now)) {
          transaction.update(ref, {
            status: "closed",
            winnerOptionId: computeWinner(battle.options, battle.voteCounts),
            closedAt: Timestamp.fromMillis(now),
            updatedAt: FieldValue.serverTimestamp(),
          });
          return { reason: "expired" };
        }
        const optionExists = battle.options.some(
          (option) => option.id === optionId,
        );
        if (!optionExists) return { reason: "invalid_option" };
        const existingVote = await transaction.get(voteRef);
        if (existingVote.exists) return { reason: "already_voted" };

        transaction.create(voteRef, {
          optionId,
          createdAt: FieldValue.serverTimestamp(),
        });
        transaction.update(ref, {
          [`voteCounts.${optionId}`]: FieldValue.increment(1),
          votesTotal: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { reason: "voted", optionId };
      },
      { maxAttempts: 100 },
    ),
  );
}

export async function closeBattleIfExpired(id, now = Date.now()) {
  const ref = battleRef(id);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const battle = snapshot.data();
    if (battle.status !== "open" || !isExpired(battle, now)) {
      return { id: snapshot.id, ...battle };
    }
    const winnerOptionId = computeWinner(battle.options, battle.voteCounts);
    transaction.update(ref, {
      status: "closed",
      winnerOptionId,
      closedAt: Timestamp.fromMillis(now),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      id: snapshot.id,
      ...battle,
      status: "closed",
      winnerOptionId,
      closedAt: Timestamp.fromMillis(now),
    };
  });
}

export async function closeExpiredBattles(now = Date.now()) {
  const due = await battles()
    .where("status", "==", "open")
    .where("endsAt", "<=", Timestamp.fromMillis(now))
    .orderBy("endsAt", "asc")
    .limit(MAX_EXPIRATIONS_PER_PASS)
    .get();
  if (due.empty) return 0;
  const batch = firestore.batch();
  for (const document of due.docs) {
    const battle = document.data();
    batch.update(document.ref, {
      status: "closed",
      winnerOptionId: computeWinner(battle.options, battle.voteCounts),
      closedAt: Timestamp.fromMillis(now),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  return due.size;
}

export async function findBattles(filters) {
  let query = battles();
  if (filters.status) query = query.where("status", "==", filters.status);
  if (filters.category) query = query.where("category", "==", filters.category);
  query = query
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc");
  const page = await paginateQuery(query, {
    limit: filters.limit,
    cursor: filters.cursor,
    orderByFields: ["createdAt", "__name__"],
  });
  let items = page.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
  if (!filters.status) {
    items = items.filter((battle) =>
      ["open", "closed"].includes(battle.status),
    );
  }
  return { items, nextCursor: page.nextCursor };
}
