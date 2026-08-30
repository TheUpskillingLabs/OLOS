/* Learning Log insights bundle — the Learning Log successor to the pulse
   AI-assisted summary (the pulse page's data source dried up when the July
   Learning Log pivot replaced pulse checks for new cycles).

   OLOS deliberately runs no LLM here: this module renders recent log entries
   into a PARTIALLY ANONYMIZED plain-text bundle behind a meta-prompt, and the
   poderator pastes it into their own AI tool (the copy-prompt/BYO-LLM stance).

   Anonymization contract: the bundle leaves our systems when pasted into a
   third-party chat service, so it carries NO names or emails. Members get
   stable per-bundle pseudonyms ("Member A", "Member B", …) assigned by
   participant_id order — stable so the AI can follow one member's thread
   across weeks and the poderator can act on "Member C" via the roster, but
   meaningless outside the pod. Week, kind, ratings, and the blocked flag ride
   along because they're what make the free text interpretable.

   Pure module: no Supabase imports; unit-tested in log-insights.test.ts. The
   server section (moderator logs page) does the fetching. */

export interface LogInsightRow {
  participant_id: number;
  created_at: string;
  kind: string; // weekly | baseline | milestone_7 | milestone_13
  is_blocked: boolean | null;
  // v2 weekly instrument
  progress_rating: number | null;
  energy_rating: number | null;
  work_summary: string | null;
  work_progress: string | null;
  work_blockers: string | null;
  stuck_tried: string | null;
  learned: string | null;
  contribution: string | null;
  recognition: string | null;
  // v1 instrument (older rows in the same cycle)
  clarity: number | null;
  alignment: number | null;
  accomplished: string | null;
  exploring: string | null;
  next_focus: string | null;
  blocker_context: string | null;
}

/** One rendered entry plus the fields the UI preview shows. */
export interface LogInsightEntry {
  key: string;
  /** e.g. "Member B · Aug 22 · weekly · progress 4/5 · energy 2/5 · BLOCKED" */
  label: string;
  /** The labeled free-text lines, newline-joined. */
  text: string;
}

/* The meta-prompt. Written for a paste-into-anything chat context: it fixes
   the role, the privacy ground rules, and — most importantly — the FOUR
   outputs a poderator actually needs to drive the cycle forward, in the order
   they'll act on them. Kept as a versioned code constant (reviewable in PRs);
   a cycle_config override column is a noted follow-up if per-cycle tuning is
   ever wanted. */
export const LOG_INSIGHTS_PROMPT = `You are helping a volunteer pod moderator ("Poderator") at The Upskilling Labs, a workforce-development nonprofit. Members of a build cycle team up on civic projects and file a short weekly Learning Log reflection. The entries below are those reflections, partially anonymized: stable pseudonyms (Member A, Member B, …) keep each person's thread traceable across weeks without revealing identity. Ratings are self-reported on 1–5 scales; BLOCKED means the member flagged themselves stuck that week.

Read every entry, then answer in exactly these four sections, in this order:

1. WORKING / NOT WORKING — the clearest signals of momentum and of friction. Back each with a short quoted phrase and its [pseudonym · week] tag.
2. IMPROVEMENTS — concrete, feasible changes to how the cycle runs (pacing, process, tooling, support) that these entries justify. Note roughly how many members each would help.
3. TARGETED OUTREACH — one line per member who looks blocked, discouraged, fading, or quietly excelling: pseudonym → what the moderator should say or do this week. Warm, specific, never shaming; a member doing great work deserves outreach too.
4. ESCALATIONS — anything a pod moderator cannot fix alone: recurring asks, risks, or themes that should go to the board or another workstream, and why.

Rules: use only what is in the entries; quote rather than paraphrase when it matters; if the evidence for a section is thin, say so instead of inventing; never speculate about who a pseudonym is; keep the whole answer under 500 words so it fits a stand-up.`;

const RATING_LABELS: [keyof LogInsightRow, string][] = [
  ["progress_rating", "progress"],
  ["energy_rating", "energy"],
  ["clarity", "clarity"],
  ["alignment", "alignment"],
];

const TEXT_FIELDS: [keyof LogInsightRow, string][] = [
  ["work_summary", "This week"],
  ["work_progress", "Progress"],
  ["work_blockers", "Blockers"],
  ["stuck_tried", "Tried so far"],
  ["learned", "Learned"],
  ["contribution", "Contribution"],
  ["recognition", "Recognition"],
  // v1 instrument
  ["accomplished", "Accomplished"],
  ["exploring", "Exploring"],
  ["next_focus", "Next focus"],
  ["blocker_context", "Blocker context"],
];

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Stable pseudonyms: participant_id ascending → Member A, B, … AA, AB after
    26 (a pod that large is hypothetical, but don't break on it). */
export function assignPseudonyms(
  participantIds: number[]
): Map<number, string> {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const label = (i: number): string =>
    i < 26 ? letters[i] : label(Math.floor(i / 26) - 1) + letters[i % 26];
  const out = new Map<number, string>();
  [...new Set(participantIds)]
    .sort((a, b) => a - b)
    .forEach((id, i) => out.set(id, `Member ${label(i)}`));
  return out;
}

export function buildLogEntries(rows: LogInsightRow[]): LogInsightEntry[] {
  const pseudonyms = assignPseudonyms(rows.map((r) => r.participant_id));
  return rows.map((r, idx) => {
    const who = pseudonyms.get(r.participant_id) as string;
    const ratings = RATING_LABELS.filter(([f]) => r[f] != null)
      .map(([f, label]) => `${label} ${r[f]}/5`)
      .join(" · ");
    const label = [
      who,
      fmtDay(r.created_at),
      r.kind,
      ratings || null,
      r.is_blocked ? "BLOCKED" : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const text = TEXT_FIELDS.filter(([f]) => {
      const v = r[f];
      return typeof v === "string" && v.trim().length > 0;
    })
      .map(([f, fieldLabel]) => `${fieldLabel}: ${(r[f] as string).trim()}`)
      .join("\n");
    return { key: `${r.participant_id}:${r.created_at}:${idx}`, label, text };
  });
}

export function buildLogInsightsBundle(entries: LogInsightEntry[]): string {
  const body = entries
    .map((e) => `[${e.label}]\n${e.text || "(ratings only — no written reflection)"}`)
    .join("\n\n");
  return `${LOG_INSIGHTS_PROMPT}\n\n---\n\n${body}\n`;
}
