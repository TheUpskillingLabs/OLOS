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

/* ── The 13-week Build Cycle model ─────────────────────────────────── */

const WEEKS: {
  num: number;
  label: string;
  milestone: boolean;
  phase: 1 | 2 | 3;
}[] = [
  { num: 1, label: "Kickoff\n+ Summit", milestone: true, phase: 1 },
  { num: 2, label: "Problem\nProposals", milestone: false, phase: 1 },
  { num: 3, label: "Problem\nVoting", milestone: false, phase: 1 },
  { num: 4, label: "Pod\nCreation", milestone: false, phase: 1 },
  { num: 5, label: "Meet The\nPods", milestone: true, phase: 2 },
  { num: 6, label: "Experiments", milestone: false, phase: 2 },
  { num: 7, label: "Project\nPitches", milestone: false, phase: 2 },
  { num: 8, label: "Project\nVoting", milestone: false, phase: 2 },
  { num: 9, label: "Meet The\nProjects", milestone: true, phase: 3 },
  { num: 10, label: "Mentor\nIntensive", milestone: false, phase: 3 },
  { num: 11, label: "Mentor\nIntensive", milestone: false, phase: 3 },
  { num: 12, label: "Rehearsal", milestone: false, phase: 3 },
  { num: 13, label: "Showcase\n+ Summit", milestone: true, phase: 3 },
];

const PHASES = [
  { num: 1, title: "Problem Discovery & Definition", weeks: "1–4" },
  { num: 2, title: "Exploration & Experimentation", weeks: "5–8" },
  { num: 3, title: "Prototype Building & Iterating", weeks: "9–13" },
];

/* ── Helpers ───────────────────────────────────────────────────────── */

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

function daysUntil(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
}

function getCurrentWeek(now: Date, start: Date, end: Date): number {
  if (now < start) return 0;
  if (now > end) return 14;
  const totalMs = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  // 13 equal segments
  const week = Math.floor((elapsed / totalMs) * 13) + 1;
  return Math.min(week, 13);
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

/* ── Component ─────────────────────────────────────────────────────── */

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
  const endDate = new Date(cycle.end_date);

  const currentWeek = getCurrentWeek(now, startDate, endDate);
  const daysLeft = daysUntil(now, endDate);
  const cycleActive = now >= startDate && now <= endDate;
  const cycleComplete = now > endDate;

  const activeWindows = getActiveWindows(config, now);
  const upcomingWindow =
    activeWindows.length === 0 ? getUpcomingWindow(config, now) : null;

  // Which phase are we in?
  const currentPhaseNum =
    currentWeek <= 4 ? 1 : currentWeek <= 8 ? 2 : currentWeek <= 13 ? 3 : 0;

  return (
    <div className="mb-10">
      {/* ── Countdown headline ────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-cloud/40">
            The Build Cycle
          </p>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            {cycleActive ? (
              <>
                <span className="text-aqua">{daysLeft}</span>{" "}
                day{daysLeft !== 1 ? "s" : ""} to Showcase
              </>
            ) : cycleComplete ? (
              <>Cycle complete</>
            ) : (
              <>
                Cycle starts{" "}
                {formatDate(cycle.start_date)}
              </>
            )}
          </h2>
        </div>
        {cycleActive && (
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-teal/20 px-4 py-1.5 text-sm font-semibold text-aqua">
              Week {currentWeek}
            </span>
            {currentPhaseNum > 0 && (
              <span className="text-sm text-cloud/50">
                Month {currentPhaseNum}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Timeline card ─────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-whisper bg-white/[0.02] px-4 pb-4 pt-5 sm:px-6">
        {/* Month / phase headers */}
        <div className="mb-6 flex min-w-[700px]">
          {PHASES.map((p) => (
            <div
              key={p.num}
              className={`${p.num === 3 ? "flex-[5]" : "flex-[4]"} ${
                p.num > 1 ? "border-l border-white/10 pl-4" : ""
              }`}
            >
              <p
                className={`text-[11px] font-medium uppercase tracking-wider ${
                  currentPhaseNum === p.num ? "text-aqua" : "text-cloud/30"
                }`}
              >
                Month {p.num}
              </p>
              <p
                className={`text-sm font-semibold leading-tight ${
                  currentPhaseNum === p.num ? "text-white" : "text-cloud/50"
                }`}
              >
                {p.title}
              </p>
            </div>
          ))}
        </div>

        {/* Week timeline — staggered above/below rail */}
        <div className="relative min-w-[700px]">
          {/* ── Top labels (odd weeks: 1,3,5,7,9,11,13) ───────── */}
          <div className="mb-1 flex">
            {WEEKS.map((w) => (
              <div
                key={w.num}
                className="flex flex-1 flex-col items-center"
              >
                {w.num % 2 === 1 ? (
                  <>
                    <p
                      className={`mb-1 text-center text-[10px] font-semibold leading-tight ${
                        w.milestone ? "uppercase" : ""
                      } ${
                        w.num === currentWeek
                          ? "text-aqua"
                          : w.num < currentWeek
                            ? "text-cloud/40"
                            : "text-cloud/30"
                      }`}
                    >
                      Week {w.num}
                    </p>
                    <p
                      className={`text-center text-[10px] leading-tight whitespace-pre-line ${
                        w.milestone ? "font-bold" : "font-medium"
                      } ${
                        w.num === currentWeek
                          ? w.milestone
                            ? "text-white"
                            : "text-aqua"
                          : w.num < currentWeek
                            ? "text-cloud/35"
                            : "text-cloud/45"
                      }`}
                    >
                      {w.label}
                    </p>
                  </>
                ) : (
                  /* Spacer for even weeks */
                  <div className="h-8" />
                )}
              </div>
            ))}
          </div>

          {/* ── Rail + week nodes ──────────────────────────────── */}
          <div className="relative flex items-center">
            {/* Background rail line */}
            <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-gradient-to-r from-teal/30 via-teal/20 to-teal/10" />

            {/* Progress fill */}
            {cycleActive && (
              <div
                className="absolute top-1/2 left-0 h-[3px] -translate-y-1/2 rounded-full bg-gradient-to-r from-teal to-aqua"
                style={{
                  width: `${((currentWeek - 0.5) / 13) * 100}%`,
                }}
              />
            )}

            {/* Week number boxes */}
            {WEEKS.map((w) => {
              const isPast = w.num < currentWeek;
              const isCurrent = w.num === currentWeek;
              const isFuture = w.num > currentWeek;

              let boxClasses: string;
              if (isCurrent) {
                boxClasses =
                  "border-aqua bg-aqua text-midnight shadow-[0_0_12px_rgba(77,187,194,0.4)]";
              } else if (isPast) {
                boxClasses = "border-teal/60 bg-teal/80 text-white/90";
              } else {
                boxClasses =
                  "border-white/15 bg-midnight text-cloud/40";
              }

              return (
                <div key={w.num} className="relative z-10 flex flex-1 justify-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-md border-2 text-xs font-bold ${boxClasses}`}
                  >
                    {w.num}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Bottom labels (even weeks: 2,4,6,8,10,12) ─────── */}
          <div className="mt-1 flex">
            {WEEKS.map((w) => (
              <div
                key={w.num}
                className="flex flex-1 flex-col items-center"
              >
                {w.num % 2 === 0 ? (
                  <>
                    <p
                      className={`mt-1 text-center text-[10px] font-semibold leading-tight ${
                        w.num === currentWeek
                          ? "text-aqua"
                          : w.num < currentWeek
                            ? "text-cloud/40"
                            : "text-cloud/30"
                      }`}
                    >
                      Week {w.num}
                    </p>
                    <p
                      className={`text-center text-[10px] leading-tight whitespace-pre-line ${
                        w.milestone ? "font-bold" : "font-medium"
                      } ${
                        w.num === currentWeek
                          ? w.milestone
                            ? "text-white"
                            : "text-aqua"
                          : w.num < currentWeek
                            ? "text-cloud/35"
                            : "text-cloud/45"
                      }`}
                    >
                      {w.label}
                    </p>
                  </>
                ) : (
                  /* Spacer for odd weeks */
                  <div className="h-8" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Active / upcoming window chips ────────────────────────── */}
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
