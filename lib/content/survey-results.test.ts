import { describe, expect, it } from "vitest";
import { redactContactInfo } from "./survey-results";

// The participant aggregate never selects the envelope's contact columns, but
// respondents sometimes type contact details into the observation body itself.
// This pins the scrub that keeps them off the participant surface.
describe("redactContactInfo", () => {
  it("strips email addresses", () => {
    expect(redactContactInfo("reach me at jane.doe+tag@example.org please")).toBe(
      "reach me at [contact removed] please"
    );
  });

  it("strips phone numbers in common shapes", () => {
    expect(redactContactInfo("call 301-635-9754")).toBe("call [contact removed]");
    expect(redactContactInfo("call (502) 451-4564 or 5024190426")).toBe(
      "call [contact removed] or [contact removed]"
    );
    expect(redactContactInfo("at +1 914 826 7312 today")).toBe(
      "at [contact removed] today"
    );
  });

  it("leaves ordinary text, years, and counts alone", () => {
    const text =
      "In 2026, 40 participants met at the library; turnout rose 15% over 2024.";
    expect(redactContactInfo(text)).toBe(text);
  });
});
