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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
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
  if (now < startDate) return 0;
  if (now < phase2Start) return 1;
  if (now < phase3Start) return 2;
  if (now <= endDate) return 3;
  return 4;
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
      if (now >= new Date(openVal) && now <= new Date(closeVal)) {
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

function daysUntil(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
}

function pct(date: Date, start: Date, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, ((date.getTime() - start.getTime()) / total) * 100));
}

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
  const totalMs = endDate.getTime() - startDate.getTime();

  const currentPhase = getCurrentPhase(now, startDate, phase2Start, phase3Start, endDate);
  const daysToShowcase = daysUntil(now, endDate);
  const progressPct = pct(now, startDate, totalMs);
  const phase2Pct = pct(phase2Start, startDate, totalMs);
  const phase3Pct = pct(phase3Start, startDate, totalMs);

  const activeWindows = getActiveWindows(config, now);
  const upcomingWindow = activeWindows.length === 0 ? getUpcomingWindow(config, now) : null;

  // Milestones for the timeline track
  const milestones = [
    {
      label: "Kickoff",
      date: cycle.start_date,
      leftPct: 0,
      passed: now >= startDate,
      current: currentPhase === 1,
    },
    {
      label: "Meet The Pods",
      date: config.phase_2_start,
      leftPct: phase2Pct,
      passed: now >= phase2Start,
      current: currentPhase === 2,
    },
    {
      label: "Meet The Projects",
      date: config.phase_3_start,
      leftPct: phase3Pct,
      passed: now >= phase3Start,
      current: currentPhase === 3,
    },
    {
      label: "Showcase",
      date: cycle.end_date,
      leftPct: 100,
      passed: now > endDate,
      current: false,
    },
  ];

  const phaseLabels = ["Phase 1", "Phase 2", "Phase 3"];

  return (
    <div className="mb-10">
      {/* Countdown hero */}
      <div className="mb-6 flex flex-col items-center gap-1 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-cloud/40">
            {cycle.name}
          </p>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            {currentPhase >= 1 && currentPhase <= 3 ? (
              <>
                <span className="text-aqua">{daysToShowcase}</span>{" "}
                day{daysToShowcase !== 1 ? "s" : ""} to Showcase
              </>
            ) : currentPhase === 0 ? (
              <>Cycle starts {formatDateLong(cycle.start_date)}</>
            ) : (
              <>Cycle complete</>
            )}
          </h2>
        </div>
        {currentPhase >= 1 && currentPhase <= 3 && (
          <span className="rounded-full bg-teal/20 px-4 py-1.5 text-sm font-semibold text-aqua">
            {phaseLabels[currentPhase - 1]}
          </span>
        )}
      </div>

      {/* Timeline track */}
      <div className="relative rounded-xl border border-whisper bg-white/[0.02] px-4 py-8 sm:px-8">
        {/* Rail */}
        <div className="relative mx-auto h-1.5 rounded-full bg-white/[0.06]">
          {/* Filled portion */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-teal to-aqua"
            style={{ width: `${progressPct}%` }}
          />

          {/* Phase segment backgrounds (subtle) */}
          <div
            className="absolute inset-y-0 left-0 rounded-l-full border-r border-white/10"
            style={{ width: `${phase2Pct}%` }}
          />
          <div
            className="absolute inset-y-0 border-r border-white/10"
            style={{ left: `${phase2Pct}%`, width: `${phase3Pct - phase2Pct}%` }}
          />
        </div>

        {/* Milestone nodes + labels */}
        <div className="relative mt-0">
          {milestones.map((m, i) => {
            // Determine if this is the "active" milestone (the next one coming up)
            const isNext =
              !m.passed && (i === 0 || milestones[i - 1].passed);

            return (
              <div
                key={m.label}
                className="absolute"
                style={{
                  left: `${m.leftPct}%`,
                  transform: "translateX(-50%)",
                  top: "-22px",
                }}
              >
                {/* Node dot */}
                <div
                  className={`mx-auto h-4 w-4 rounded-full border-2 ${
                    m.passed
                      ? "border-aqua bg-teal"
                      : isNext
                        ? "border-aqua bg-midnight"
                        : "border-white/20 bg-midnight"
                  }`}
                />
                {/* Label */}
                <div className="mt-2 whitespace-nowrap text-center">
                  <div
                    className={`text-xs font-semibold ${
                      m.passed
                        ? "text-cloud/50"
                        : isNext
                          ? "text-aqua"
                          : "text-cloud/40"
                    }`}
                  >
                    {m.label}
                  </div>
                  <div className="text-[11px] text-cloud/30">
                    {formatDate(m.date)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Phase labels centered in each segment */}
        <div className="relative mt-14 flex">
          <div style={{ width: `${phase2Pct}%` }} className="text-center">
            <span
              className={`text-xs font-medium ${
                currentPhase === 1 ? "text-aqua" : "text-cloud/25"
              }`}
            >
              Phase 1
            </span>
          </div>
          <div
            style={{ width: `${phase3Pct - phase2Pct}%` }}
            className="text-center"
          >
            <span
              className={`text-xs font-medium ${
                currentPhase === 2 ? "text-aqua" : "text-cloud/25"
              }`}
            >
              Phase 2
            </span>
          </div>
          <div style={{ width: `${100 - phase3Pct}%` }} className="text-center">
            <span
              className={`text-xs font-medium ${
                currentPhase === 3 ? "text-aqua" : "text-cloud/25"
              }`}
            >
              Phase 3
            </span>
          </div>
        </div>
      </div>

      {/* Active / upcoming windows */}
      {(activeWindows.length > 0 || upcomingWindow) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {activeWindows.map((w) => (
            <span
              key={w.label}
              className="inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1 text-xs font-medium text-aqua"
            >
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-aqua" />
              {w.label} &middot; closes {formatDate(w.closesAt)}
            </span>
          ))}
          {upcomingWindow && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1 text-xs text-cloud/50">
              Up next: {upcomingWindow.label} &middot; opens{" "}
              {formatDate(upcomingWindow.opensAt)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
