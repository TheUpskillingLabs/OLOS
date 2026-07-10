"use client";

import { useState } from "react";
import {
  PERMISSION_GROUPS,
  ROLE_PRESETS,
  permissionLabel,
  activePresets,
  type Permission,
} from "@/lib/auth/permissions";

const PRESET_COLORS: Record<string, string> = {
  owner: "bg-ink/10 text-ink ring-ink/30",
  admin: "bg-teal/10 text-teal-deep ring-teal/30",
  developer: "bg-forest/10 text-forest ring-forest/30",
  labs_lead: "bg-teal/10 text-teal-deep ring-teal/30",
  moderator: "bg-navy/10 text-navy ring-navy/30",
  observer: "bg-ink/[0.04] text-meta ring-ink/10",
};

export default function PermissionsEditor({
  participantId,
  initialPermissions,
  canManageRoles,
  podAssignments,
}: {
  participantId: number;
  initialPermissions: Permission[];
  canManageRoles: boolean;
  podAssignments: { pod_id: number; pod_name: string; cycle_name: string }[];
}) {
  const [permissions, setPermissions] = useState<Set<Permission>>(
    new Set(initialPermissions)
  );
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [presetLoading, setPresetLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentPresets = activePresets([...permissions]);

  async function togglePermission(permission: Permission) {
    const action = permissions.has(permission) ? "revoke" : "grant";
    setLoading((prev) => new Set(prev).add(permission));
    setError(null);

    const res = await fetch("/api/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: participantId,
        permissions: [permission],
        action,
      }),
    });

    setLoading((prev) => {
      const next = new Set(prev);
      next.delete(permission);
      return next;
    });

    if (res.ok) {
      const data = await res.json();
      setPermissions(new Set(data.permissions as Permission[]));
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to update permission");
    }
  }

  async function applyPreset(preset: string) {
    setPresetLoading(preset);
    setError(null);

    const res = await fetch("/api/permissions/preset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: participantId,
        preset,
      }),
    });

    setPresetLoading(null);

    if (res.ok) {
      const data = await res.json();
      setPermissions(new Set(data.permissions as Permission[]));
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to apply preset");
    }
  }

  const restrictedPerms = canManageRoles ? [] : ["roles:write", "roles:read"];

  return (
    <div className="space-y-8">
      {/* Role Presets */}
      <section>
        <h2 className="lbl mb-3">
          Quick Assign — Role Presets
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.keys(ROLE_PRESETS).map((preset) => {
            const isActive = currentPresets.includes(preset);
            const isRestricted =
              !canManageRoles && (preset === "owner" || preset === "admin" || preset === "developer");

            return (
              <button
                key={preset}
                onClick={() => applyPreset(preset)}
                disabled={
                  presetLoading !== null || isRestricted
                }
                className={`rounded-card px-4 py-2 text-sm font-semibold tracking-tight ring-1 transition-all duration-150 ease-spring active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                  isActive
                    ? PRESET_COLORS[preset]
                    : "text-charcoal ring-ink/10 hover:bg-ink/[0.04] hover:text-ink hover:ring-ink/20"
                }`}
              >
                {presetLoading === preset
                  ? "Applying..."
                  : `${preset.charAt(0).toUpperCase() + preset.slice(1)}${isActive ? " \u2713" : ""}`}
              </button>
            );
          })}
        </div>
        {currentPresets.length > 0 && (
          <p className="mt-2 text-xs text-meta">
            Active presets: {currentPresets.join(", ")}
          </p>
        )}
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-card border border-red/20 bg-red/10 p-3 text-sm text-red"
        >
          {error}
        </div>
      )}

      {/* Individual Permissions */}
      <section>
        <h2 className="lbl mb-3">
          Individual Permissions
        </h2>
        <div className="space-y-6">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="mb-2 text-sm font-semibold tracking-tight text-ink">
                {group.label}
              </h3>
              <div className="space-y-1">
                {group.permissions.map((perm) => {
                  const enabled = permissions.has(perm);
                  const isLoading = loading.has(perm);
                  const isRestricted = restrictedPerms.includes(perm);

                  return (
                    <div
                      key={perm}
                      className="flex items-center justify-between rounded-card px-3 py-2 transition-colors duration-150 hover:bg-ink/[0.02]"
                    >
                      <div>
                        <span className="text-sm text-charcoal">
                          {permissionLabel(perm)}
                        </span>
                        <span className="ml-2 font-mono text-xs text-meta">
                          {perm}
                        </span>
                      </div>
                      <button
                        onClick={() => togglePermission(perm)}
                        disabled={isLoading || isRestricted}
                        role="switch"
                        aria-checked={enabled}
                        aria-label={permissionLabel(perm)}
                        className={`relative h-6 w-11 rounded-full transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                          enabled ? "bg-teal" : "bg-ink/15"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 ease-spring ${
                            enabled ? "translate-x-[1.375rem]" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pod Assignments (informational) */}
      {podAssignments.length > 0 && (
        <section>
          <h2 className="lbl mb-3">
            Moderator Pod Assignments
          </h2>
          <div className="flex flex-wrap gap-2">
            {podAssignments.map((pa) => (
              <span
                key={pa.pod_id}
                className="inline-flex items-center rounded-sm bg-navy/10 px-3 py-1 text-xs font-medium text-navy"
              >
                {pa.pod_name}
                {pa.cycle_name && (
                  <span className="ml-1 text-navy/60">
                    ({pa.cycle_name})
                  </span>
                )}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-meta">
            Pod assignments are managed from the cycle admin page.
          </p>
        </section>
      )}
    </div>
  );
}
