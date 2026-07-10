"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { METROS } from "@/lib/metros";

/**
 * Admin control to assign a participant to a local lab / metro region.
 *
 * The region is load-bearing for the labs_lead role: cycle access for a labs
 * lead is scoped to their own metro (lib/auth/cycle-access.ts → canManageCycle
 * compares cycle.metro_slug against the lead's participants.metro_slug). Until
 * a region is set here, a labs lead's metroSlug resolves to null and they can
 * manage no cycles.
 *
 * Writes via PATCH /api/participants/[id] (auth = isSelf || isAdmin), the same
 * endpoint the name edit uses; metro_slug was whitelisted in
 * lib/validations/participants-update.ts.
 */
export default function AdminMetroEditForm({
  participantId,
  initialMetroSlug,
}: {
  participantId: number;
  initialMetroSlug: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialMetroSlug);
  const [saved, setSaved] = useState(initialMetroSlug);
  const [serverError, setServerError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = value !== saved;

  async function onSave() {
    setServerError("");
    setSavedFlash(false);
    setSaving(true);

    const res = await fetch(`/api/participants/${participantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metro_slug: value === "" ? null : value }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setServerError(
        typeof data?.error === "string"
          ? data.error
          : `Request failed (${res.status})`
      );
      return;
    }

    setSaved(value);
    setSavedFlash(true);
    router.refresh();
  }

  return (
    <section className="mt-8 rounded-card border border-ink/10 bg-white p-6 shadow-card">
      <h2 className="text-base font-semibold text-ink">Region (local lab)</h2>
      <p className="mt-1 text-sm text-slate">
        Assigns this participant to a metro. Scopes a{" "}
        <span className="font-medium">Labs Lead</span>&rsquo;s cycle management
        to their own region; leave unassigned for participants who are not a
        labs lead.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="lbl">Metro</span>
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Metro"
            className="rounded-card border border-ink/10 bg-white px-3 py-2 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          >
            <option value="">Unassigned</option>
            {Object.values(METROS).map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
                {m.status === "waitlist" ? " (waitlist)" : ""}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onSave}
          disabled={saving || !dirty}
          className="btn btn-teal inline-flex items-center justify-center px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>

        <div className="flex-1 min-w-[120px]">
          {serverError && (
            <p className="rounded-card border border-red/30 bg-red/10 px-3 py-2 text-sm text-red">
              {serverError}
            </p>
          )}
          {savedFlash && !serverError && !dirty && (
            <p className="text-sm text-teal-deep">Saved.</p>
          )}
        </div>
      </div>
    </section>
  );
}
