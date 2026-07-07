import { describe, it, expect } from "vitest";
import { matchScore, rankByQuery, statusRank } from "./rank";

describe("matchScore", () => {
  it("scores a primary prefix highest", () => {
    expect(matchScore("mar", "Maria Lopez")).toBe(4);
  });
  it("scores a word prefix next", () => {
    expect(matchScore("lop", "Maria Lopez")).toBe(3);
  });
  it("scores a primary substring next", () => {
    expect(matchScore("ari", "Maria Lopez")).toBe(2);
  });
  it("scores a secondary substring lowest", () => {
    expect(matchScore("design", "Maria Lopez", ["Product designer"])).toBe(1);
  });
  it("returns 0 for no match and for empty queries", () => {
    expect(matchScore("zzz", "Maria Lopez", ["Product designer"])).toBe(0);
    expect(matchScore("   ", "Maria Lopez")).toBe(0);
  });
  it("ignores case and surrounding whitespace", () => {
    expect(matchScore("  MAR ", "maria lopez")).toBe(4);
  });
  it("skips null secondary fields", () => {
    expect(matchScore("dc", "Maria Lopez", [null, undefined, "Washington, DC"])).toBe(1);
  });
});

describe("rankByQuery", () => {
  const people = [
    { name: "Alex Marsh", headline: "Data analyst" },
    { name: "Maria Lopez", headline: "Product designer" },
    { name: "Sam Reed", headline: "Marketing lead" },
  ];
  const rank = (q: string) =>
    rankByQuery(people, q, (p) => p.name, (p) => [p.headline]).map((p) => p.name);

  it("orders prefix > word-prefix > substring > secondary", () => {
    // "mar": Maria (prefix 4), Marsh (word-prefix 3), Sam's "Marketing" (secondary 1)
    expect(rank("mar")).toEqual(["Maria Lopez", "Alex Marsh", "Sam Reed"]);
  });
  it("drops non-matching rows", () => {
    expect(rank("lopez")).toEqual(["Maria Lopez"]);
  });
  it("keeps the incoming order for ties and empty queries", () => {
    expect(rank("")).toEqual(["Alex Marsh", "Maria Lopez", "Sam Reed"]);
    // "a" word-prefix-matches Alex and "Analyst"… use a tie: both surnames
    const tied = rankByQuery(
      [{ name: "Pat Lee" }, { name: "Kim Lee" }],
      "lee",
      (p) => p.name,
      () => []
    ).map((p) => p.name);
    expect(tied).toEqual(["Pat Lee", "Kim Lee"]);
  });
});

describe("statusRank", () => {
  it("orders active > forming > retired, with legacy closed as retired", () => {
    expect(statusRank("active")).toBe(0);
    expect(statusRank("forming")).toBe(1);
    expect(statusRank("inactive")).toBe(2);
    expect(statusRank("closed")).toBe(2);
  });
});
