/* The Ambassador role's words — every string the ambassador surfaces render.
   Ported from the `ambassadors` repo (content/site/*.json, content/roles/
   ambassador.json, content/faq, content/scenarios, content/steps). Edit the
   JSON (or steps.ts) next to this file; components never hard-code copy.

   Entries flagged `placeholder: true` are seed copy awaiting real Labs copy:
   the pages show a "[PLACEHOLDER] draft copy" marker while the flag is set.

   Pure module: no Supabase, importable from client components — EXCEPT the
   quiz answers, which only lib/ambassador/quiz.ts reads (server side), so the
   client never ships them. Use publicQuiz() on the client. */

import apply from "./content/apply.json";
import deck from "./content/deck.json";
import faq from "./content/faq.json";
import help from "./content/help.json";
import invite from "./content/invite.json";
import ladder from "./content/ladder.json";
import program from "./content/program.json";
import scenarios from "./content/scenarios.json";
import story from "./content/story.json";
import ui from "./content/ui.json";
import { STEPS, type GuideStep } from "./content/steps";

export { apply, deck, faq, help, invite, ladder, program, scenarios, story, ui, STEPS };
export type { GuideStep };

/** Fill "{name}" slots. Unknown keys are left as written so a typo shows. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

/** The agreement version the flow presents now. Bump it in apply.json when
 *  the text changes; acceptances of older versions no longer count. */
export const AMBASSADOR_AGREEMENT_VERSION: string = apply.agreement.version;

/** Where the ambassador surfaces live in OLOS. */
export const AMBASSADOR_HOME = "/ambassador";
export const AMBASSADOR_APPLY = "/ambassador/apply";
export const AMBASSADOR_PRESENT = "/ambassador/present";
export const AMBASSADOR_NOMINATE = "/ambassador/nominate";
export const AMBASSADOR_COORDINATOR = "/ambassador/coordinator";
/** The public front door every "Become an ambassador" button points at. */
export const AMBASSADOR_START = "/ambassador/start";
/** The public program page (draft, unlisted until the board approves the role). */
export const AMBASSADOR_PROGRAM_PAGE = "/get-involved/ambassador";

export function stepHref(id: string): string {
  return `/ambassador/guide/${id}`;
}

export function getStep(id: string): GuideStep | undefined {
  return STEPS.find((s) => s.id === id);
}

export const STEP_IDS: string[] = STEPS.map((s) => s.id);

/** The quiz as the browser sees it: no answers, no explanations. */
export interface PublicQuizQuestion {
  q: string;
  options: string[];
  hint: string;
}

export function publicQuiz(): { pass: number; questions: PublicQuizQuestion[] } {
  return {
    pass: apply.quiz.pass,
    questions: apply.quiz.questions.map((x) => ({ q: x.q, options: x.options, hint: x.hint })),
  };
}

/** The coordinator contact from help.json, or null while it's still the
 *  placeholder (so the UI never offers coordinator@example.org). */
export function coordinatorContact(): { name: string; email: string; phone: string; note: string } | null {
  const c = help.coordinator;
  if (help.placeholder || /example\.org$/i.test(c.email)) return null;
  return { name: c.name, email: c.email, phone: c.phone, note: c.note };
}
