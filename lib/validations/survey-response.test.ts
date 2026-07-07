import { describe, it, expect } from "vitest";
import { resolveSurveyResponse } from "./survey-response";
import type { SurveyQuestion, SurveyQuestionConfig } from "@/lib/content/surveys";

let idc = 0;
function mk(
  partial: Partial<SurveyQuestion> & {
    question_type: SurveyQuestion["question_type"];
  }
): SurveyQuestion {
  idc += 1;
  return {
    id: idc,
    field_survey_id: 1,
    position: idc,
    question_key: partial.question_key ?? `q${idc}`,
    prompt: partial.prompt ?? "Prompt",
    help: null,
    placeholder: null,
    required: partial.required ?? false,
    config: (partial.config ?? {}) as SurveyQuestionConfig,
    response_column: partial.response_column ?? null,
    is_system: partial.is_system ?? false,
    active: true,
    question_type: partial.question_type,
  };
}

const observation = mk({
  question_key: "observation",
  question_type: "long_text",
  prompt: "What are you seeing?",
  required: true,
  response_column: "observation",
});
const standpoint = mk({
  question_key: "experience",
  question_type: "multi_select",
  response_column: "standpoint",
  config: {
    options: [
      { v: "work_in_field", label: "I work in this field" },
      { v: "affected", label: "Affected" },
    ],
  },
});
const salience = mk({
  question_key: "salience",
  question_type: "scale",
  response_column: "salience",
});
const contact = mk({
  question_key: "contact",
  question_type: "contact",
  config: {
    fields: [
      { id: "name", label: "Name" },
      { id: "email", label: "Email" },
      { id: "phone", label: "Phone" },
    ],
  },
});
const consent = mk({
  question_key: "consent",
  question_type: "consent",
  required: true,
  response_column: "consent_participation",
});

const CIVICS = [observation, standpoint, salience, contact, consent];

describe("resolveSurveyResponse", () => {
  it("resolves a full valid civics submission into the envelope", () => {
    const { envelope, answerRows, error } = resolveSurveyResponse(CIVICS, {
      observation: "  Voter rolls are stale  ",
      experience: ["work_in_field"],
      salience: "4",
      name: "Priya",
      email: "PRIYA@EXAMPLE.COM",
      phone: "",
      consent: true,
    });
    expect(error).toBeNull();
    expect(answerRows).toEqual([]);
    expect(envelope.observation).toBe("Voter rolls are stale");
    expect(envelope.standpoint).toEqual(["work_in_field"]);
    expect(envelope.salience).toBe(4);
    expect(envelope.consent_participation).toBe(true);
    expect(envelope.contactable).toBe(true);
    expect(envelope.submitter_name).toBe("Priya");
    expect(envelope.submitter_email).toBe("priya@example.com");
    expect(envelope.submitter_phone).toBeNull();
  });

  it("requires the observation", () => {
    const { error } = resolveSurveyResponse(CIVICS, { consent: true });
    expect(error).toMatch(/seeing/i);
  });

  it("gates on required consent", () => {
    const { error } = resolveSurveyResponse(CIVICS, {
      observation: "x",
      consent: false,
    });
    expect(error).toMatch(/consent/i);
  });

  it("rejects an out-of-range scale value", () => {
    const { error } = resolveSurveyResponse(CIVICS, {
      observation: "x",
      salience: "9",
      consent: true,
    });
    expect(error).toMatch(/1 to 5/);
  });

  it("rejects a standpoint value outside the option set", () => {
    const { error } = resolveSurveyResponse(CIVICS, {
      observation: "x",
      experience: ["not_a_real_key"],
      consent: true,
    });
    expect(error).toBeTruthy();
  });

  it("rejects a malformed contact email", () => {
    const { error } = resolveSurveyResponse(CIVICS, {
      observation: "x",
      email: "not-an-email",
      consent: true,
    });
    expect(error).toMatch(/email/i);
  });

  it("routes a custom (non-system) question to answerRows", () => {
    const custom = mk({
      question_key: "role",
      question_type: "single_select",
      config: { options: [{ v: "a", label: "A" }, { v: "b", label: "B" }] },
    });
    const { answerRows, error } = resolveSurveyResponse(
      [observation, custom, consent],
      { observation: "x", role: "b", consent: true }
    );
    expect(error).toBeNull();
    expect(answerRows).toEqual([{ question_id: custom.id, value: "b" }]);
  });

  it("defaults consent_participation to false when unanswered on a survey without a consent question", () => {
    const { envelope, error } = resolveSurveyResponse([observation], {
      observation: "x",
    });
    expect(error).toBeNull();
    expect(envelope.consent_participation).toBe(false);
  });
});
