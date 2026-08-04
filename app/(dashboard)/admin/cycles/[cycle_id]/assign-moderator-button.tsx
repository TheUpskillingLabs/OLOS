"use client";

import { useState } from "react";
import { moderatorNoun } from "@/lib/cycle/labels";

type Participant = {
  participant_id: number;
  name: string;
  email?: string;
  /** False when not enrolled in this cycle. Set only on participant-cycle
   * candidate lists; org lists leave it undefined (no grouping). */
  enrolled?: boolean;
};

type Moderator = {
  participant_id: number;
  name: string;
  assigned_at: string;
};

function initialsOf(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

/**
 * Assign-on-click poderator picker. One control: a search input over a
 * clickable candidate list — clicking a row assigns immediately and closes
 * the panel (a misclick is one Manage → Remove away). The zero-state shows
 * only this cycle's enrollees; the long everyone-else tail (a poderator
 * shepherds a pod they don't sit in, so any participant is assignable)
 * appears once the admin types, keeping the open state short even with
 * hundreds of participants. `enrolled` is only set on participant-cycle
 * candidate lists; org co-lead lists come pre-scoped and skip the tail rule.
 */
export default function AssignModeratorButton({
  podId,
  cycleId,
  participants,
  initialModerators,
  mode,
}: {
  podId: number;
  cycleId: number;
  participants: Participant[];
  initialModerators: Moderator[];
  mode?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [moderators, setModerators] = useState<Moderator[]>(initialModerators);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentModIds = new Set(moderators.map((m) => m.participant_id));
  const available = participants.filter((p) => !currentModIds.has(p.participant_id));

  const q = search.trim().toLowerCase();
  const matchesSearch = (p: Participant) =>
    !q ||
    p.name.toLowerCase().includes(q) ||
    (p.email ?? "").toLowerCase().includes(q);

  const enrolledAvailable = available.filter(
    (p) => p.enrolled !== false && matchesSearch(p)
  );
  // The not-enrolled tail stays hidden until the admin types — this is what
  // keeps the picker small on open.
  const unenrolledAvailable = q
    ? available.filter((p) => p.enrolled === false && matchesSearch(p))
    : [];
  const hiddenUnenrolledCount = available.filter(
    (p) => p.enrolled === false
  ).length;
  const anyAvailable =
    enrolledAvailable.length > 0 || unenrolledAvailable.length > 0;

  function close() {
    setOpen(false);
    setSearch("");
    setError(null);
  }

  async function assign(participantId: number) {
    setSavingId(participantId);
    setError(null);

    const res = await fetch(`/api/pods/${podId}/moderators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: participantId,
        cycle_id: cycleId,
      }),
    });

    setSavingId(null);

    if (res.ok) {
      const data = await res.json();
      const p = participants.find((p) => p.participant_id === participantId);
      setModerators((prev) => [
        ...prev,
        {
          participant_id: participantId,
          name: p?.name ?? "",
          assigned_at: data.assigned_at,
        },
      ]);
      // Done — collapse back to the names + Manage strip. Assigning a second
      // poderator is a reopen away, and closing keeps the table scannable.
      close();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to assign");
    }
  }

  async function remove(participantId: number) {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/pods/${podId}/moderators/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: participantId,
        cycle_id: cycleId,
      }),
    });

    setLoading(false);

    if (res.ok) {
      setModerators((prev) =>
        prev.filter((m) => m.participant_id !== participantId)
      );
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to remove");
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        {moderators.length > 0 && (
          <span className="text-xs text-slate">
            {moderators.map((m) => m.name).join(", ")}
          </span>
        )}
        <button
          onClick={() => setOpen(true)}
          className="btn btn-ghost px-2.5 py-1 text-xs"
        >
          {moderators.length > 0 ? "Manage" : `Assign ${moderatorNoun(mode).toLowerCase()}`}
        </button>
      </div>
    );
  }

  const candidateRow = (p: Participant) => (
    <button
      key={p.participant_id}
      type="button"
      onClick={() => assign(p.participant_id)}
      disabled={savingId !== null || loading}
      className="group flex w-full items-center gap-2.5 rounded-card px-2 py-1.5 text-left transition-colors duration-150 hover:bg-teal/10 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
    >
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-teal/15 text-[10px] font-bold text-teal-deep">
        {initialsOf(p.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">
          {p.name}
        </span>
        {p.email && (
          <span className="block truncate text-xs text-meta">{p.email}</span>
        )}
      </span>
      {p.enrolled === false && (
        <span className="flex-none rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-medium text-meta">
          Not enrolled
        </span>
      )}
      <span className="flex-none text-xs font-semibold text-teal-deep opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        {savingId === p.participant_id ? "…" : "+ Assign"}
      </span>
    </button>
  );

  return (
    <div className="space-y-3 rounded-card border border-ink/10 bg-white p-3 shadow-card">
      {moderators.length > 0 && (
        <div className="space-y-1">
          {moderators.map((m) => (
            <div
              key={m.participant_id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-charcoal">{m.name}</span>
              <button
                onClick={() => remove(m.participant_id)}
                disabled={loading || savingId !== null}
                className="text-xs font-medium text-red transition-colors duration-150 hover:text-red disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div className="space-y-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Add a ${moderatorNoun(mode).toLowerCase()} — type a name or email…`}
            aria-label="Search participants"
            autoFocus
            className="w-full rounded-card border border-ink/10 bg-white px-2 py-1 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />

          <div className="max-h-64 overflow-y-auto">
            {enrolledAvailable.length > 0 && (
              <>
                {unenrolledAvailable.length > 0 && (
                  <p className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-meta">
                    Enrolled in this cycle
                  </p>
                )}
                {enrolledAvailable.map(candidateRow)}
              </>
            )}
            {unenrolledAvailable.length > 0 && (
              <>
                <p className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-meta">
                  Not enrolled in this cycle
                </p>
                {unenrolledAvailable.map(candidateRow)}
              </>
            )}
            {!q && hiddenUnenrolledCount > 0 && (
              <p className="px-2 pt-1.5 text-xs text-meta">
                + {hiddenUnenrolledCount} more participant
                {hiddenUnenrolledCount === 1 ? "" : "s"} not enrolled in this
                cycle. Type to search them.
              </p>
            )}
            {q && !anyAvailable && (
              <p className="px-2 py-1.5 text-xs text-meta">
                No participants match that search.
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red">
          {error}
        </p>
      )}

      <button
        onClick={close}
        className="text-xs text-meta transition-colors duration-150 hover:text-charcoal"
      >
        Close
      </button>
    </div>
  );
}
