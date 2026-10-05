import { describe, expect, it } from "vitest";
import {
  buildReadinessRows,
  readinessProgress,
  READINESS_RESOURCE_SLUGS,
  type ReadinessInputs,
} from "./readiness";
import { prepareSkipKey, prepareTaskKey, setupTaskKey } from "./keys";

const base = (o: Partial<ReadinessInputs> = {}): ReadinessInputs => ({
  upcomingCycle: null,
  preRegistered: false,
  labActive: true,
  waitlistCity: null,
  githubUsername: null,
  directoryCardDone: false,
  publishedSlugs: new Set<string>(),
  ...o,
});
const steps = (rows: { defId: string }[]) => rows.map((r) => r.defId.replace("prepare:", ""));
const none = new Set<string>();
const upcoming = { id: 16, name: "Spring 2027", slug: "spring-2027" };

describe("buildReadinessRows — which steps show", () => {
  it("S0 (no cycle announced, nothing published): lab, Slack, GitHub, directory card", () => {
    const rows = buildReadinessRows(base(), none);
    expect(steps(rows).sort()).toEqual(["card", "github", "lab", "slack"]);
  });

  it("the guide-backed steps appear only once their resources are published", () => {
    const rows = buildReadinessRows(
      base({
        publishedSlugs: new Set([READINESS_RESOURCE_SLUGS.assistant, READINESS_RESOURCE_SLUGS.videos]),
      }),
      none
    );
    expect(steps(rows)).toEqual(expect.arrayContaining(["assistant", "videos"]));
    expect(rows).toHaveLength(6);
  });

  it("announcing a cycle adds pre-register and dates; the primer needs its resource", () => {
    const without = buildReadinessRows(base({ upcomingCycle: upcoming }), none);
    expect(steps(without)).toEqual(expect.arrayContaining(["register", "dates"]));
    expect(steps(without)).not.toContain("primer");
    const withPrimer = buildReadinessRows(
      base({ upcomingCycle: upcoming, publishedSlugs: new Set(["primer-spring-2027"]) }),
      none
    );
    expect(steps(withPrimer)).toContain("primer");
  });
});

describe("buildReadinessRows — done, skipped, routing", () => {
  it("verified rows flip on the record, not on a click", () => {
    const rows = buildReadinessRows(
      base({ githubUsername: "octo", directoryCardDone: true }),
      new Set([prepareTaskKey("github")]) // a stray tick on a verified step is inert
    );
    const byStep = Object.fromEntries(rows.map((r) => [r.defId, r]));
    expect(byStep["prepare:github"].done).toBe(true);
    expect(byStep["prepare:card"].done).toBe(true);
    expect(byStep["prepare:github"].verified).toBe(true);
    const noUser = buildReadinessRows(base(), new Set([prepareTaskKey("github")]));
    expect(noUser.find((r) => r.defId === "prepare:github")!.done).toBe(false);
  });

  it("manual rows are done when ticked, skippable, and a skip is reversible", () => {
    const ticked = buildReadinessRows(base(), new Set([prepareTaskKey("slack")]));
    expect(ticked.find((r) => r.defId === "prepare:slack")!.done).toBe(true);
    const skipped = buildReadinessRows(base(), new Set([prepareSkipKey("slack")]));
    const slack = skipped.find((r) => r.defId === "prepare:slack")!;
    expect(slack.done).toBe(false);
    expect(slack.skipped).toBe(true);
    expect(slack.skipKey).toBe("prepare:slack:skip");
    expect(slack.skippable).toBe(true);
  });

  it("the account checklist's Slack click counts as the readiness Slack step", () => {
    const rows = buildReadinessRows(base(), new Set([setupTaskKey("slack")]));
    expect(rows.find((r) => r.defId === "prepare:slack")!.done).toBe(true);
  });

  it("a waitlisted member has the lab step done, titled with their city", () => {
    const rows = buildReadinessRows(base({ labActive: false, waitlistCity: "Baltimore" }), none);
    const lab = rows.find((r) => r.defId === "prepare:lab")!;
    expect(lab.done).toBe(true);
    expect(lab.title).toBe("You're on the Baltimore list");
  });

  it("a lab-less member's pre-register step routes to Local Labs, not the join page", () => {
    const rows = buildReadinessRows(base({ labActive: false, upcomingCycle: upcoming }), none);
    expect(rows.find((r) => r.defId === "prepare:register")!.href).toBe("/local-labs");
    const withLab = buildReadinessRows(base({ upcomingCycle: upcoming }), none);
    expect(withLab.find((r) => r.defId === "prepare:register")!.href).toBe("/cycles/16/join");
  });

  it("cycle-scoped ticks are keyed to the cycle", () => {
    const rows = buildReadinessRows(
      base({ upcomingCycle: upcoming }),
      new Set([prepareTaskKey("dates", 15)]) // last cycle's tick
    );
    expect(rows.find((r) => r.defId === "prepare:dates")!.done).toBe(false);
  });

  it("puts done and skipped rows first, ladder order within each group", () => {
    const rows = buildReadinessRows(
      base({ labActive: false, directoryCardDone: true }),
      new Set([prepareSkipKey("slack")])
    );
    expect(steps(rows)).toEqual(["slack", "card", "lab", "github"]);
  });
});

describe("readinessProgress", () => {
  it("counts done and skipped rows over the rows shown", () => {
    const rows = buildReadinessRows(
      base({ labActive: false, directoryCardDone: true }),
      new Set([prepareSkipKey("slack")])
    );
    expect(readinessProgress(rows)).toEqual({ done: 2, shown: 4 });
  });
});
