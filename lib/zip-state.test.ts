import { describe, expect, it } from "vitest";
import { stateFromZip } from "./zip-state";

describe("stateFromZip", () => {
  it("maps DC prefixes, residential and federal", () => {
    expect(stateFromZip("20001")).toBe("DC");
    expect(stateFromZip("20500")).toBe("DC"); // White House — 205
  });

  it("maps 201 to VA despite sitting inside the 200s block", () => {
    expect(stateFromZip("20166")).toBe("VA"); // Dulles
  });

  it("maps MD and VA ranges", () => {
    expect(stateFromZip("20601")).toBe("MD");
    expect(stateFromZip("21201")).toBe("MD"); // Baltimore
    expect(stateFromZip("22201")).toBe("VA"); // Arlington
    expect(stateFromZip("24601")).toBe("VA");
  });

  it("falls back to Other outside the DC metro and on bad input", () => {
    expect(stateFromZip("10001")).toBe("Other"); // NYC
    expect(stateFromZip("90210")).toBe("Other");
    expect(stateFromZip("2000")).toBe("Other");
    expect(stateFromZip("")).toBe("Other");
    expect(stateFromZip("abcde")).toBe("Other");
  });
});
