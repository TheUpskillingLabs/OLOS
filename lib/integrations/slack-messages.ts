import type { LearningLogInput } from "@/lib/validations/learning-logs";
import type { RecentLog } from "@/lib/learning-logs/logs";

/* Slack-facing copy and Block Kit builders for the Learning Log (issue #189).
   Kept separate from the email templates (lib/email/*) because the medium and
   markup differ, but the voice is the same: plain, firm, never shaming. */

/** The weekly-reminder DM body (mrkdwn). Mirrors the email reminder's wording
    (lib/email/learning-log-reminder-template.ts) and adds the in-Slack path. */
export function logReminderSlackText(dashboardUrl: string): string {
  return [
    "*Your weekly Learning Log is due* 📝",
    "Two sliders, three quick prompts — five minutes, tops. Until you save one, your Labs account is parked on the dashboard. Save it and you're back in, instantly.",
    "",
    `Save it on the dashboard: ${dashboardUrl}  —  or just run \`/learninglog\` right here in Slack.`,
    "",
    'Stuck on something? Say so in the log — the "I\'m blocked" note goes straight to your Poderator. That\'s always okay.',
  ].join("\n");
}

/* ── Slash-command modal ─────────────────────────────────────────────────── */

/** block_id / action_id pairs, shared by the modal builder and the parser so
    they can't drift. */
const FIELD = {
  clarity: { block: "clarity_block", action: "clarity" },
  alignment: { block: "alignment_block", action: "alignment" },
  is_blocked: { block: "blocked_block", action: "is_blocked", value: "blocked" },
  blocker_context: { block: "blocker_block", action: "blocker_context" },
  accomplished: { block: "accomplished_block", action: "accomplished" },
  exploring: { block: "exploring_block", action: "exploring" },
  next_focus: { block: "next_focus_block", action: "next_focus" },
  share_publicly: { block: "share_block", action: "share_publicly", value: "share" },
} as const;

/** The block_id the interactivity handler attaches a submission-level error to
    (must be an input block that is always present). */
export const MODAL_ERROR_BLOCK = FIELD.clarity.block;

/** The Block Kit modal view opened by `/learninglog`. callback_id is matched by
    the interactivity route before it writes anything. */
export function learningLogModalView(): Record<string, unknown> {
  const scaleOptions = [1, 2, 3, 4, 5].map((n) => ({
    text: { type: "plain_text", text: String(n) },
    value: String(n),
  }));

  const textInput = (
    block: string,
    action: string,
    label: string,
    placeholder: string
  ) => ({
    type: "input",
    optional: true,
    block_id: block,
    label: { type: "plain_text", text: label },
    element: {
      type: "plain_text_input",
      action_id: action,
      multiline: true,
      max_length: 2000,
      placeholder: { type: "plain_text", text: placeholder },
    },
  });

  return {
    type: "modal",
    callback_id: "learning_log_submit",
    title: { type: "plain_text", text: "Learning Log" },
    submit: { type: "plain_text", text: "Save" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: FIELD.clarity.block,
        label: { type: "plain_text", text: "Clarity — how clear are you on what to do? (1–5)" },
        element: { type: "static_select", action_id: FIELD.clarity.action, options: scaleOptions },
      },
      {
        type: "input",
        block_id: FIELD.alignment.block,
        label: { type: "plain_text", text: "Alignment — how aligned does it feel with your goals? (1–5)" },
        element: { type: "static_select", action_id: FIELD.alignment.action, options: scaleOptions },
      },
      {
        type: "input",
        optional: true,
        block_id: FIELD.is_blocked.block,
        label: { type: "plain_text", text: "Blocked?" },
        element: {
          type: "checkboxes",
          action_id: FIELD.is_blocked.action,
          options: [
            {
              text: { type: "plain_text", text: "I'm blocked on something" },
              value: FIELD.is_blocked.value,
            },
          ],
        },
      },
      textInput(
        FIELD.blocker_context.block,
        FIELD.blocker_context.action,
        "What's blocking you?",
        "Only your Poderator and admins see this."
      ),
      textInput(
        FIELD.accomplished.block,
        FIELD.accomplished.action,
        "What did you accomplish this week?",
        "…"
      ),
      textInput(
        FIELD.exploring.block,
        FIELD.exploring.action,
        "What are you exploring?",
        "…"
      ),
      textInput(
        FIELD.next_focus.block,
        FIELD.next_focus.action,
        "What's your focus next week?",
        "…"
      ),
      {
        type: "input",
        optional: true,
        block_id: FIELD.share_publicly.block,
        label: { type: "plain_text", text: "Share with the community?" },
        element: {
          type: "checkboxes",
          action_id: FIELD.share_publicly.action,
          options: [
            {
              text: {
                type: "plain_text",
                text: "Share my reflection (not the health check) to the members feed",
              },
              value: FIELD.share_publicly.value,
            },
          ],
        },
      },
    ],
  };
}

/* The shape of a Block Kit element's state in a view_submission payload. */
interface SlackElementState {
  value?: string;
  selected_option?: { value?: string } | null;
  selected_options?: { value?: string }[];
}
type ModalStateValues = Record<string, Record<string, SlackElementState>>;

/** Turn a modal's `view.state.values` into the raw shape learningLogSchema
    validates. Numbers/booleans are coerced; empty text becomes null. The caller
    runs learningLogSchema.safeParse on the result. */
export function parseLearningLogModalState(
  values: ModalStateValues
): Record<string, unknown> {
  const select = (block: string, action: string): number | undefined => {
    const v = values?.[block]?.[action]?.selected_option?.value;
    if (v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const text = (block: string, action: string): string | null => {
    const v = values?.[block]?.[action]?.value;
    return v && v.trim() ? v : null;
  };
  const checked = (block: string, action: string, value: string): boolean =>
    (values?.[block]?.[action]?.selected_options ?? []).some(
      (o) => o?.value === value
    );

  return {
    clarity: select(FIELD.clarity.block, FIELD.clarity.action),
    alignment: select(FIELD.alignment.block, FIELD.alignment.action),
    is_blocked: checked(
      FIELD.is_blocked.block,
      FIELD.is_blocked.action,
      FIELD.is_blocked.value
    ),
    blocker_context: text(
      FIELD.blocker_context.block,
      FIELD.blocker_context.action
    ),
    accomplished: text(FIELD.accomplished.block, FIELD.accomplished.action),
    exploring: text(FIELD.exploring.block, FIELD.exploring.action),
    next_focus: text(FIELD.next_focus.block, FIELD.next_focus.action),
    share_publicly: checked(
      FIELD.share_publicly.block,
      FIELD.share_publicly.action,
      FIELD.share_publicly.value
    ),
  } satisfies Record<keyof LearningLogInput, unknown>;
}

/* ── /learninglog view ───────────────────────────────────────────────────── */

/** Ephemeral blocks listing a member's recent logs (or a prompt to start). */
export function recentLogsBlocks(
  logs: RecentLog[],
  dashboardUrl: string
): Record<string, unknown>[] {
  if (logs.length === 0) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "You haven't saved a Learning Log yet. Run `/learninglog` to add your first one.",
        },
      },
    ];
  }

  const blocks: Record<string, unknown>[] = [
    { type: "section", text: { type: "mrkdwn", text: "*Your recent Learning Logs*" } },
    { type: "divider" },
  ];

  for (const log of logs) {
    const date = new Date(log.created_at).toISOString().slice(0, 10);
    const meta = `clarity ${log.clarity}/5 · alignment ${log.alignment}/5${
      log.is_blocked ? " · 🚧 blocked" : ""
    }`;
    const bits: string[] = [];
    if (log.accomplished) bits.push(`*Accomplished:* ${log.accomplished}`);
    if (log.exploring) bits.push(`*Exploring:* ${log.exploring}`);
    if (log.next_focus) bits.push(`*Next:* ${log.next_focus}`);
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${date}* — ${meta}${bits.length ? "\n" + bits.join("\n") : ""}`,
      },
    });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `<${dashboardUrl}|Open your dashboard →>` }],
  });
  return blocks;
}
