export function normalizeSearchTokens(value) {
  return [
    ...new Set(
      value
        .normalize("NFKC")
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu) ?? [],
    ),
  ].slice(0, 30);
}

export class SearchProvider {
  prepare() {
    throw new Error("SearchProvider.prepare must be implemented");
  }

  rank() {
    throw new Error("SearchProvider.rank must be implemented");
  }
}

export class FirestoreSearchProvider extends SearchProvider {
  prepare(query, value, field = "searchKeywords") {
    if (!value) return { query, terms: [], empty: false };
    const terms = normalizeSearchTokens(value);
    if (terms.length === 0) return { query, terms, empty: true };
    return {
      query: query.where(field, "array-contains-any", terms),
      terms,
      empty: false,
    };
  }

  rank(items, terms) {
    if (terms.length === 0) return items;
    return items
      .map((item, index) => {
        const keywords = normalizeSearchTokens(
          (item.searchKeywords ?? []).join(" "),
        );
        const score = terms.reduce(
          (total, term) => total + Number(keywords.includes(term)),
          0,
        );
        return { item, index, score };
      })
      .sort(
        (left, right) => right.score - left.score || left.index - right.index,
      )
      .map(({ item }) => item);
  }
}

export const searchProvider = new FirestoreSearchProvider();

export function applyMarketplaceFilters(
  query,
  filters,
  {
    popularityFields = ["likesCount", "viewsCount"],
    deferNonPriceSortFilters = true,
  } = {},
) {
  if (filters.category) query = query.where("category", "==", filters.category);

  const search = searchProvider.prepare(query, filters.q);
  query = search.query;
  if (filters.skills?.length && !search.terms.length) {
    query = query.where("skills", "array-contains-any", filters.skills);
  }
  const sort = filters.sort ?? "newest";
  const deferPrice =
    deferNonPriceSortFilters &&
    sort !== "price_asc" &&
    sort !== "price_desc" &&
    (filters.minPrice !== undefined || filters.maxPrice !== undefined);
  if (!deferPrice && filters.minPrice !== undefined) {
    query = query.where("price", ">=", filters.minPrice);
  }
  if (!deferPrice && filters.maxPrice !== undefined) {
    query = query.where("price", "<=", filters.maxPrice);
  }
  const countQuery = query;
  const orders = {
    newest: [
      ["createdAt", "desc"],
      ["__name__", "desc"],
    ],
    oldest: [
      ["createdAt", "asc"],
      ["__name__", "asc"],
    ],
    price_asc: [
      ["price", "asc"],
      ["createdAt", "desc"],
      ["__name__", "desc"],
    ],
    price_desc: [
      ["price", "desc"],
      ["createdAt", "desc"],
      ["__name__", "desc"],
    ],
  };
  orders.popular = [
    ...popularityFields.map((field) => [field, "desc"]),
    ["createdAt", "desc"],
    ["__name__", "desc"],
  ];
  for (const [field, direction] of orders[sort] ?? orders.newest) {
    query = query.orderBy(field, direction);
  }

  return {
    query,
    countQuery,
    searchTerms: search.terms,
    noSearchMatches: search.empty,
    deferPrice,
    deferSkills: Boolean(filters.skills?.length && search.terms.length),
    orderByFields: (orders[sort] ?? orders.newest).map(([field]) => field),
  };
}

export async function countMatching(query) {
  const snapshot = await query.count().get();
  return snapshot.data().count;
}

export function filterBySkills(items, skills) {
  if (!skills?.length) return items;
  const requested = new Set(skills.map((skill) => skill.toLowerCase()));
  return items.filter((item) =>
    (item.skills ?? []).some((skill) => requested.has(skill.toLowerCase())),
  );
}
