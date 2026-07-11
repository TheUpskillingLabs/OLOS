import { describe, it, expect } from "vitest";
import { planWaitlistLab, type LabRow } from "./membership";

const metros: LabRow[] = [
  { id: 1, slug: "dc", name: "Washington, DC", st: "DC", status: "active" },
  { id: 2, slug: "baltimore", name: "Baltimore", st: "MD", status: "waitlist" },
  { id: 3, slug: "philadelphia", name: "Philadelphia", st: "PA", status: "waitlist" },
];

describe("planWaitlistLab", () => {
  it("dedupes to an existing lab case-insensitively on name + st", () => {
    const p = planWaitlistLab(metros, { city: "baltimore", st: "md" });
    expect("existing" in p && p.existing.id).toBe(2);
  });

  it("dedupes to an existing ACTIVE lab (routes a typed-in active city to it)", () => {
    const p = planWaitlistLab(metros, { city: "Washington, DC", st: "DC" });
    expect("existing" in p && p.existing.id).toBe(1);
  });

  it("treats a different state as a different lab", () => {
    const p = planWaitlistLab(metros, { city: "Baltimore", st: "OH" });
    expect("create" in p).toBe(true);
    if ("create" in p) {
      expect(p.create.name).toBe("Baltimore");
      expect(p.create.st).toBe("OH");
      expect(p.create.slug).toBe("baltimore-oh");
    }
  });

  it("creates a slug from name+st and normalizes state to uppercase", () => {
    const p = planWaitlistLab(metros, { city: "Austin", st: "tx" });
    expect("create" in p && p.create.slug).toBe("austin-tx");
    expect("create" in p && p.create.st).toBe("TX");
  });

  it("suffixes the slug on collision with an existing lab", () => {
    const withCollision: LabRow[] = [
      ...metros,
      { id: 9, slug: "austin-tx", name: "Austin East", st: "TX", status: "waitlist" },
    ];
    const p = planWaitlistLab(withCollision, { city: "Austin", st: "TX" });
    // name differs from "Austin East" so it's a create; slug must not collide.
    expect("create" in p && p.create.slug).toBe("austin-tx-2");
  });

  it("handles a bare city with no state", () => {
    const p = planWaitlistLab(metros, { city: "Denver" });
    expect("create" in p && p.create.slug).toBe("denver");
    expect("create" in p && p.create.st).toBe(null);
  });
});
