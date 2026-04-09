type CycleConfig = {
  phase_2_start: string | null;
  phase_3_start: string | null;
  problem_statement_open: string | null;
  problem_statement_close: string | null;
  voting_open: string | null;
  voting_close: string | null;
  pod_registration_open: string | null;
  pod_registration_close: string | null;
  solution_proposal_open: string | null;
  solution_proposal_close: string | null;
  solution_voting_open: string | null;
  solution_voting_close: string | null;
  project_registration_open: string | null;
  project_registration_close: string | null;
};

type Cycle = {
  name: string;
  start_date: string;
  end_date: string;
};

const OPERATIONAL_WINDOWS = [
  { label: "Problem Statements", field: "problem_statement" },
  { label: "Voting", field: "voting" },
  { label: "Pod Registration", field: "pod_registration" },
  { label: "Solution Proposals", field: "solution_proposal" },
  { label: "Solution Voting", field: "solution_voting" },
  { label: "Project Registration", field: "project_registration" },
] as const;

type WindowField = (typeof OPERATIONAL_WINDOWS)[number]["field"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getCurrentPhase(
  now: Date,
  startDate: Date,
  phase2Start: Date,
  phase3Start: Date,
  endDate: Date
): number {
  if (now < startDate) return 0; // before cycle
  if (now < phase2Start) return 1;
  if (now < phase3Start) return 2;
  if (now <= endDate) return 3;
  return 4; // after cycle
}

function getActiveWindows(
  config: CycleConfig,
  now: Date
): { label: string; closesAt: string }[] {
  const active: { label: string; closesAt: string }[] = [];
  for (const w of OPERATIONAL_WINDOWS) {
    const openKey = `${w.field}_open` as keyof CycleConfig;
    const closeKey = `${w.field}_close` as keyof CycleConfig;
    const openVal = config[openKey];
    const closeVal = config[closeKey];
    if (openVal && closeVal) {
      const openDate = new Date(openVal);
      const closeDate = new Date(closeVal);
      if (now >= openDate && now <= closeDate) {
        active.push({ label: w.label, closesAt: closeVal });
      }
    }
  }
  return active;
}

function getUpcomingWindow(
  config: CycleConfig,
  now: Date
): { label: string; opensAt: string } | null {
  for (const w of OPERATIONAL_WINDOWS) {
    const openKey = `${w.field}_open` as keyof CycleConfig;
    const openVal = config[openKey];
    if (openVal && new Date(openVal) > now) {
      return { label: w.label, opensAt: openVal };
    }
  }
  return null;
}

const PHASES = [
  { number: 1, name: "Phase 1", milestone: "Meet The Pods" },
  { number: 2, name: "Phase 2", milestone: "Meet The Projects" },
  { number: 3, name: "Phase 3", milestone: "Demo Day" },
];

export default function CyclePhaseIndicator({
  cycle,
  config,
}: {
  cycle: Cycle;
  config: CycleConfig;
}) {
  if (!config.phase_2_start || !config.phase_3_start) {
    return null;
  }

  const now = new Date();
  const startDate = new Date(cycle.start_date);
  const phase2Start = new Date(config.phase_2_start);
  const phase3Start = new Date(config.phase_3_start);
  const endDate = new Date(cycle.end_date);

  const currentPhase = getCurrentPhase(
    now,
    startDate,
    phase2Start,
    phase3Start,
    endDate
  );

  // Progress within the full cycle (0–100)
  const totalDuration = endDate.getTime() - startDate.getTime();
  const elapsed = Math.max(0, Math.min(now.getTime() - startDate.getTime(), totalDuration));
  const overallProgress = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;

  // Phase boundary positions as percentages of the full bar
  const phase2Pct =
    totalDuration > 0
      ? ((phase2Start.getTime() - startDate.getTime()) / totalDuration) * 100
      : 33;
  const phase3Pct =
    totalDuration > 0
      ? ((phase3Start.getTime() - startDate.getTime()) / totalDuration) * 100
      : 66;

  const activeWindows = getActiveWindows(config, now);
  const upcomingWindow =
    activeWindows.length === 0 ? getUpcomingWindow(config, now) : null;

  return (
    <div className="mb-8 rounded-lg border border-whisper bg-white/[0.02] p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{cycle.name}</h2>
        {currentPhase >= 1 && currentPhase <= 3 && (
          <span className="rounded-full bg-teal/20 px-3 py-1 text-xs font-medium text-aqua">
            {PHASES[currentPhase - 1].name}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative mb-2 h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        {/* Filled progress */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-teal to-aqua transition-all"
          style={{ width: `${overallProgress}%` }}
        />
        {/* Phase boundary markers */}
        <div
          className="absolute inset-y-0 w-px bg-white/30"
          style={{ left: `${phase2Pct}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-white/30"
          style={{ left: `${phase3Pct}%` }}
        />
      </div>

      {/* Phase labels row */}
      <div className="relative mb-4 flex text-xs">
        {/* Phase 1 */}
        <div style={{ width: `${phase2Pct}%` }} className="pr-2">
          <span
            className={
              currentPhase === 1
                ? "font-semibold text-aqua"
                : currentPhase > 1
                  ? "text-cloud/40"
                  : "text-cloud/60"
            }
          >
            Phase 1
          </span>
          <div className="text-cloud/40">{formatDate(cycle.start_date)}</div>
        </div>
        {/* Phase 2 */}
        <div
          style={{ width: `${phase3Pct - phase2Pct}%` }}
          className="border-l border-white/10 pl-2 pr-2"
        >
          <span
            className={
              currentPhase === 2
                ? "font-semibold text-aqua"
                : currentPhase > 2
                  ? "text-cloud/40"
                  : "text-cloud/60"
            }
          >
            Phase 2
          </span>
          <div className="text-cloud/40">
            {formatDate(config.phase_2_start)}
          </div>
          <div className="text-cloud/30">Meet The Pods</div>
        </div>
        {/* Phase 3 */}
        <div
          style={{ width: `${100 - phase3Pct}%` }}
          className="border-l border-white/10 pl-2"
        >
          <span
            className={
              currentPhase === 3
                ? "font-semibold text-aqua"
                : currentPhase > 3
                  ? "text-cloud/40"
                  : "text-cloud/60"
            }
          >
            Phase 3
          </span>
          <div className="text-cloud/40">
            {formatDate(config.phase_3_start)}
          </div>
          <div className="text-cloud/30">Meet The Projects</div>
        </div>
      </div>

      {/* End date / Demo Day */}
      <div className="mb-4 flex justify-end text-xs text-cloud/40">
        Demo Day &middot; {formatDate(cycle.end_date)}
      </div>

      {/* Active operational windows */}
      {activeWindows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeWindows.map((w) => (
            <span
              key={w.label}
              className="inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1 text-xs font-medium text-aqua"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-aqua" />
              {w.label} &middot; closes {formatDate(w.closesAt)}
            </span>
          ))}
        </div>
      )}

      {/* Upcoming window (when nothing is active) */}
      {upcomingWindow && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1 text-xs text-cloud/50">
            Up next: {upcomingWindow.label} &middot; opens{" "}
            {formatDate(upcomingWindow.opensAt)}
          </span>
        </div>
      )}
    </div>
  );
}
