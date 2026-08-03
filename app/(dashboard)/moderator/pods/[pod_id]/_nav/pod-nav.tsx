"use client";

// Left nav for the pod surface (design doc §3): pod filter dropdown on top
// (only the pods the caller can see), then the sub-pages in HQ's settled
// order. Active state from the pathname; badge counts are server-computed
// and always reflect the CURRENT week regardless of the range filter — the
// "do I need to look now?" signal.
//
// UI copy never says "moderator" (docs/poderator-dashboard/CLAUDE.md); the
// route paths are internal and stay under /moderator/.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export type PodNavPod = { id: number; name: string };

export interface PodNavBadges {
  /** At-risk + trending — red. */
  attention: number;
  /** "logged/total" for the current window — neutral. */
  logs: string | null;
  /** Unread (status=new) feedback — red. */
  feedback: number;
  /** Active member count — neutral. */
  roster: number;
  /** True → Pulse Insights shows a muted dash (no pulse data in range). */
  pulsesEmpty: boolean;
}

interface Item {
  label: string;
  /** Path suffix under /moderator/pods/[id]; "" = Overview. */
  suffix: string;
  badge?: { text: string; tone: "red" | "soft" | "dim" } | null;
}

export function PodNav({
  podId,
  podName,
  cycleLine,
  pods,
  badges,
  showExplorer,
  showPulseInsights,
}: {
  podId: number;
  podName: string;
  cycleLine: string;
  pods: PodNavPod[];
  badges: PodNavBadges;
  showExplorer: boolean;
  /** False for org-mode runs (no pulse instrument at all). */
  showPulseInsights: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/moderator/pods/${podId}`;

  const items: Item[] = [
    {
      label: "Overview",
      suffix: "",
      badge:
        badges.attention > 0
          ? { text: String(badges.attention), tone: "red" }
          : null,
    },
    {
      label: "Learning & Milestone Logs",
      suffix: "/logs",
      badge: badges.logs ? { text: badges.logs, tone: "soft" } : null,
    },
    ...(showPulseInsights
      ? [
          {
            label: "Pulse Insights",
            suffix: "/pulse-insights",
            badge: badges.pulsesEmpty ? { text: "—", tone: "dim" as const } : null,
          },
        ]
      : []),
    {
      label: "Pod Feedback",
      suffix: "/feedback",
      badge:
        badges.feedback > 0
          ? { text: String(badges.feedback), tone: "red" }
          : null,
    },
    {
      label: "Roster",
      suffix: "/roster",
      badge: { text: String(badges.roster), tone: "soft" },
    },
  ];

  const isActive = (suffix: string) =>
    suffix === "" ? pathname === base : pathname.startsWith(base + suffix);

  return (
    <nav className="w-60 flex-shrink-0" aria-label="Pod sections">
      <div className="mb-4 rounded-card border border-ink/10 bg-white p-3.5 shadow-card">
        <label htmlFor="pod-nav-filter" className="lbl lbl-teal">
          Pod
        </label>
        {pods.length > 1 ? (
          <select
            id="pod-nav-filter"
            value={podId}
            onChange={(e) => {
              // Land on the same sub-page for the newly chosen pod.
              const suffix = pathname.startsWith(base) ? pathname.slice(base.length) : "";
              router.push(`/moderator/pods/${e.target.value}${suffix}`);
            }}
            className="mt-1.5 w-full rounded-card border border-ink/10 bg-white px-2.5 py-1.5 text-sm font-semibold text-ink focus:border-teal focus:outline-none"
          >
            {pods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="mt-1 text-sm font-semibold text-ink">{podName}</div>
        )}
        <div className="mt-1.5 text-xs text-meta">{cycleLine}</div>
      </div>

      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.suffix}>
            <Link
              href={base + item.suffix}
              className={`flex items-center gap-2 rounded-card px-3 py-2 text-sm transition-colors ${
                isActive(item.suffix)
                  ? "bg-teal/10 font-semibold text-teal-deep"
                  : "font-medium text-slate hover:bg-teal/5 hover:text-ink"
              }`}
            >
              {item.label}
              {item.badge && (
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                    item.badge.tone === "red"
                      ? "bg-red text-white"
                      : item.badge.tone === "soft"
                        ? "bg-teal/15 text-teal-deep"
                        : "bg-ink/[0.06] text-meta"
                  }`}
                >
                  {item.badge.text}
                </span>
              )}
            </Link>
          </li>
        ))}
        {showExplorer && (
          <>
            <li aria-hidden className="mx-3 my-2 border-t border-ink/10" />
            <li>
              <Link
                href={`${base}/explore`}
                className={`flex items-center gap-2 rounded-card px-3 py-2 text-sm transition-colors ${
                  pathname.startsWith(`${base}/explore`)
                    ? "bg-teal/10 font-semibold text-teal-deep"
                    : "font-medium text-slate hover:bg-teal/5 hover:text-ink"
                }`}
              >
                Entity Explorer
              </Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}
