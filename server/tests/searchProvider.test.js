import { describe, expect, it } from "vitest";
import {
  FirestoreSearchProvider,
  normalizeSearchTokens,
  SearchProvider,
} from "../src/modules/search/searchProvider.js";

describe("FirestoreSearchProvider", () => {
  const provider = new FirestoreSearchProvider();

  it("implements the replaceable SearchProvider contract", () => {
    expect(provider).toBeInstanceOf(SearchProvider);
  });

  it("normalizes case, punctuation, unicode, and caps terms at 30", () => {
    expect(normalizeSearchTokens(`"React" $API (UI/UX) 🔥`)).toEqual([
      "react",
      "api",
      "ui",
      "ux",
    ]);
    expect(
      normalizeSearchTokens(
        Array.from({ length: 40 }, (_, i) => `term${i}`).join(" "),
      ),
    ).toHaveLength(30);
  });

  it("ranks candidates by the number of matching tokens and keeps ties stable", () => {
    const candidates = [
      { id: "partial", searchKeywords: ["react"] },
      { id: "all", searchKeywords: ["react", "api"] },
      { id: "tie", searchKeywords: ["api"] },
    ];
    expect(
      provider.rank(candidates, ["react", "api"]).map(({ id }) => id),
    ).toEqual(["all", "partial", "tie"]);
  });

  it("returns no terms for special-character-only input", () => {
    expect(normalizeSearchTokens(`'"$.*🔥`)).toEqual([]);
  });
});
