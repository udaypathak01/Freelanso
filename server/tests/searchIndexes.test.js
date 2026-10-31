import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  applicationIndexPlans,
  battleIndexPlans,
  dashboardJobIndexPlans,
  dashboardIndexPlans,
  jobIndexPlans,
  indexKey,
  marketplaceIndexPlans,
} from "../src/modules/search/queryIndexRequirements.js";

describe("marketplace composite indexes", () => {
  it("declares every generated project and service query index", async () => {
    const config = JSON.parse(
      await readFile(new URL("../firestore.indexes.json", import.meta.url)),
    );
    const declared = new Set(config.indexes.map(indexKey));
    const missing = marketplaceIndexPlans.filter(
      (requirement) => !declared.has(indexKey(requirement)),
    );
    expect(missing).toEqual([]);
  });

  it("declares every generated jobs query index", async () => {
    const config = JSON.parse(
      await readFile(new URL("../firestore.indexes.json", import.meta.url)),
    );
    const declared = new Set(config.indexes.map(indexKey));
    const missing = jobIndexPlans.filter(
      (requirement) => !declared.has(indexKey(requirement)),
    );
    expect(missing).toEqual([]);
  });

  it("declares every jobs and applications cursor index", async () => {
    const config = JSON.parse(
      await readFile(new URL("../firestore.indexes.json", import.meta.url)),
    );
    const declared = new Set(config.indexes.map(indexKey));
    const missing = applicationIndexPlans.filter(
      (requirement) => !declared.has(indexKey(requirement)),
    );
    expect(missing).toEqual([]);
  });

  it("declares every dashboard aggregate index", async () => {
    const config = JSON.parse(
      await readFile(new URL("../firestore.indexes.json", import.meta.url)),
    );
    const declared = new Set(config.indexes.map(indexKey));
    const missing = dashboardIndexPlans.filter(
      (requirement) => !declared.has(indexKey(requirement)),
    );
    expect(missing).toEqual([]);
  });

  it("declares the client dashboard job-list index", async () => {
    const config = JSON.parse(
      await readFile(new URL("../firestore.indexes.json", import.meta.url)),
    );
    const declared = new Set(config.indexes.map(indexKey));
    const missing = dashboardJobIndexPlans.filter(
      (requirement) => !declared.has(indexKey(requirement)),
    );
    expect(missing).toEqual([]);
  });

  it("declares every battle list and expiration index", async () => {
    const config = JSON.parse(
      await readFile(new URL("../firestore.indexes.json", import.meta.url)),
    );
    const declared = new Set(config.indexes.map(indexKey));
    const missing = battleIndexPlans.filter(
      (requirement) => !declared.has(indexKey(requirement)),
    );
    expect(missing).toEqual([]);
  });
});
