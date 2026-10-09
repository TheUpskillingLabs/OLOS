/* The orientation quiz — the coordinator's ten questions, eight right to pass.
   Graded here, on the server, so the answers never ship to the browser
   (the prototype graded on the phone, which was fine while nothing counted).

   Pure module: reads the content JSON only. */

import { apply } from "./content";

/** Recorded with a pass. Bump when the questions change materially. */
export const QUIZ_VERSION = "ambassador-quiz-2026-09-v1";

export interface QuizQuestionResult {
  right: boolean;
  /** The hint for a wrong answer; the explanation once the quiz is passed. */
  note: string;
}

export interface QuizResult {
  score: number;
  total: number;
  passed: boolean;
  results: QuizQuestionResult[];
}

/**
 * Grade a set of answers (option indexes, in question order). A wrong answer
 * gets its hint back, never the right option — so a failed attempt can be
 * retried without being handed the key. A pass returns every explanation.
 * Returns null when the answers don't match the quiz's shape.
 */
export function gradeQuiz(answers: number[]): QuizResult | null {
  const questions = apply.quiz.questions;
  if (answers.length !== questions.length) return null;
  if (answers.some((a, i) => !Number.isInteger(a) || a < 0 || a >= questions[i].options.length)) {
    return null;
  }
  const score = answers.reduce((n, a, i) => n + (a === questions[i].answer ? 1 : 0), 0);
  const passed = score >= apply.quiz.pass;
  return {
    score,
    total: questions.length,
    passed,
    results: questions.map((q, i) => {
      const right = answers[i] === q.answer;
      return { right, note: passed ? q.why : right ? "" : q.hint };
    }),
  };
}
