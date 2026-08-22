/* Read-only renderer for a solution proposal's four pitch answers
   (solution_proposals.proposal_data). Shared by the member gallery (expanded
   view) and the poderator submissions view. Presentational only — no hooks, no
   client state, and no PII of its own. Mirrors the DetailBlock idiom in
   app/components/proposal-details.tsx but for the flat four-key solution shape;
   legacy rows fall back to the retired keys where a sensible mapping exists. */

const FIELDS: { keys: string[]; label: string }[] = [
  { keys: ["refined_problem_statement"], label: "Refined problem statement" },
  { keys: ["project_hypothesis", "description"], label: "Project hypothesis" },
  { keys: ["target_users"], label: "Target users" },
  { keys: ["the_value"], label: "The value" },
];

function pick(data: Record<string, string> | null, keys: string[]): string {
  if (!data) return "";
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

/** True when at least one of the four answers is present. */
export function hasSolutionDetails(
  data: Record<string, string> | null
): boolean {
  return FIELDS.some((f) => pick(data, f.keys) !== "");
}

export function SolutionProposalDetails({
  data,
}: {
  data: Record<string, string> | null;
}) {
  if (!hasSolutionDetails(data)) return null;

  return (
    <div className="mt-3 space-y-3 border-t border-ink/10 pt-3">
      {FIELDS.map((f) => {
        const text = pick(data, f.keys);
        if (!text) return null;
        return (
          <div key={f.label}>
            <p className="lbl">{f.label}</p>
            <p className="mt-0.5 whitespace-pre-line text-sm text-charcoal">
              {text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
