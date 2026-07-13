import { describe, expect, it } from "vitest";
import {
  assembleResults,
  cycleOrderKey,
  cycleStatusRank,
  eventOrderKey,
  isUpcomingEvent,
  labOrderKey,
  personOrderKey,
  podProjectOrderKey,
  rankGroup,
  toResult,
  SUGGEST_LIMITS,
} from "./order";
import { SEARCH_TYPE_ORDER, type SearchCorpus, type SearchDoc } from "./types";

const NOW = Date.UTC(2026, 6, 12); // 2026-07-12

function doc(overrides: Partial<SearchDoc>): SearchDoc {
  return {
    type: "pod",
    href: "/pods/1",
    label: "A pod",
    sublabel: null,
    imageUrl: null,
    initials: "",
    secondary: [],
    orderKey: 0,
    ...overrides,
  };
}

function emptyCorpus(): SearchCorpus {
  return { person: [], pod: [], project: [], event: [], lab: [], cycle: [] };
}

describe("isUpcomingEvent", () => {
  it("treats in-progress events as upcoming (end-time rule)", () => {
    expect(isUpcomingEvent(NOW + 1, NOW)).toBe(true);
    expect(isUpcomingEvent(NOW, NOW)).toBe(true);
    expect(isUpcomingEvent(NOW - 1, NOW)).toBe(false);
    expect(isUpcomingEvent(null, NOW)).toBe(false);
  });
});

describe("eventOrderKey", () => {
  const DAY = 86_400_000;
  it("orders upcoming soonest-first, then past newest-first", () => {
    const soon = eventOrderKey(NOW + DAY, null, NOW);
    const later = eventOrderKey(NOW + 30 * DAY, null, NOW);
    const recentPast = eventOrderKey(NOW - DAY, null, NOW);
    const distantPast = eventOrderKey(NOW - 30 * DAY, null, NOW);
    expect(soon).toBeLessThan(later);
    expect(later).toBeLessThan(recentPast);
    expect(recentPast).toBeLessThan(distantPast);
  });

  it("keeps an in-progress event (ended? no) in the upcoming bucket", () => {
    const inProgress = eventOrderKey(NOW - DAY, NOW + DAY, NOW);
    const past = eventOrderKey(NOW - DAY, NOW - 1, NOW);
    expect(inProgress).toBeLessThan(past);
  });
});

describe("cycle ordering", () => {
  it("ranks active < upcoming < closing < terminal", () => {
    const ranks = ["active", "upcoming", "closing", "closed", "archived"].map(
      cycleStatusRank
    );
    expect(ranks).toEqual([0, 1, 2, 3, 3]);
  });

  it("orders by status bucket, then newest start first", () => {
    const active = cycleOrderKey("active", NOW - 100);
    const newerArchived = cycleOrderKey("archived", NOW - 100);
    const olderArchived = cycleOrderKey("archived", NOW - 200);
    expect(active).toBeLessThan(newerArchived);
    expect(newerArchived).toBeLessThan(olderArchived);
  });
});

describe("pod/project + person + lab order keys", () => {
  it("active pods beat forming pods; newer beats older within a bucket", () => {
    expect(podProjectOrderKey("active", 100)).toBeLessThan(
      podProjectOrderKey("forming", 200)
    );
    expect(podProjectOrderKey("active", 200)).toBeLessThan(
      podProjectOrderKey("active", 100)
    );
  });

  it("people: newest first, null created_at last", () => {
    expect(personOrderKey(200)).toBeLessThan(personOrderKey(100));
    expect(personOrderKey(100)).toBeLessThan(personOrderKey(null));
  });

  it("labs: active before waitlist", () => {
    expect(labOrderKey("active")).toBeLessThan(labOrderKey("waitlist"));
  });
});

describe("rankGroup", () => {
  it("returns default order (orderKey asc) for an empty query", () => {
    const docs = [
      doc({ label: "B", orderKey: 2 }),
      doc({ label: "A", orderKey: 1 }),
    ];
    expect(rankGroup(docs, "").map((d) => d.label)).toEqual(["A", "B"]);
  });

  it("score dominates default order", () => {
    const docs = [
      doc({ label: "Something else", secondary: ["gardening"], orderKey: 1 }),
      doc({ label: "Garden pod", orderKey: 2 }),
    ];
    // "garden" is a prefix of the second label (score 4) but only a
    // secondary match on the first (score 1).
    expect(rankGroup(docs, "garden").map((d) => d.label)).toEqual([
      "Garden pod",
      "Something else",
    ]);
  });

  it("breaks score ties by default order — upcoming event beats past", () => {
    const docs = [
      doc({ type: "event", label: "Builder night", orderKey: 9 }), // past
      doc({ type: "event", label: "Builder night 2", orderKey: 1 }), // upcoming
    ];
    expect(rankGroup(docs, "builder").map((d) => d.label)).toEqual([
      "Builder night 2",
      "Builder night",
    ]);
  });

  it("drops non-matching docs when a query is set", () => {
    const docs = [doc({ label: "Garden pod" }), doc({ label: "Solar pod" })];
    expect(rankGroup(docs, "solar")).toHaveLength(1);
  });
});

describe("assembleResults", () => {
  it("emits groups in fixed order, type-contiguous", () => {
    const corpus = emptyCorpus();
    corpus.cycle = [doc({ type: "cycle", label: "Cycle 3" })];
    corpus.person = [doc({ type: "person", label: "Maria" })];
    corpus.event = [doc({ type: "event", label: "Summit" })];
    const types = assembleResults(corpus, "").map((d) => d.type);
    expect(types).toEqual(["person", "event", "cycle"]);
    // Contiguity: each type appears in exactly one run.
    const runs = types.filter((t, i) => i === 0 || types[i - 1] !== t);
    expect(new Set(runs).size).toBe(runs.length);
  });

  it("applies per-type limits", () => {
    const corpus = emptyCorpus();
    corpus.person = Array.from({ length: 9 }, (_, i) =>
      doc({ type: "person", label: `Person ${i}`, orderKey: i })
    );
    corpus.lab = Array.from({ length: 5 }, (_, i) =>
      doc({ type: "lab", label: `Lab ${i}`, orderKey: i })
    );
    const out = assembleResults(corpus, "", SUGGEST_LIMITS);
    expect(out.filter((d) => d.type === "person")).toHaveLength(5);
    expect(out.filter((d) => d.type === "lab")).toHaveLength(2);
  });

  it("covers every type in SEARCH_TYPE_ORDER", () => {
    const corpus = emptyCorpus();
    for (const t of SEARCH_TYPE_ORDER) {
      corpus[t] = [doc({ type: t, label: `x ${t}` })];
    }
    expect(assembleResults(corpus, "").map((d) => d.type)).toEqual([
      ...SEARCH_TYPE_ORDER,
    ]);
  });
});

describe("toResult", () => {
  it("strips ranking fields from the wire DTO", () => {
    const result = toResult(
      doc({ secondary: ["hidden"], orderKey: 42, label: "Pod" })
    );
    expect(result).toEqual({
      type: "pod",
      href: "/pods/1",
      label: "Pod",
      sublabel: null,
      imageUrl: null,
      initials: "",
    });
    expect("secondary" in result).toBe(false);
    expect("orderKey" in result).toBe(false);
  });
});
