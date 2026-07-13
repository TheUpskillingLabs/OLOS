import { describe, expect, it } from "vitest";
import { MIN_QUERY_LENGTH, sanitizeQuery } from "./sanitize";

describe("sanitizeQuery", () => {
  it("passes clean queries through", () => {
    expect(sanitizeQuery("climate pod")).toBe("climate pod");
  });

  it("strips PostgREST .or() syntax characters", () => {
    expect(sanitizeQuery("a,b(c)d")).toBe("a b c d");
  });

  it("strips ilike wildcards and backslashes", () => {
    expect(sanitizeQuery("50%_off\\now")).toBe("50 off now");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeQuery("  maria   lopez  ")).toBe("maria lopez");
  });

  it("can reduce a hostile query below the minimum length", () => {
    expect(sanitizeQuery("%_").length).toBeLessThan(MIN_QUERY_LENGTH);
  });
});
