"use client";

import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField, Input } from "@/app/components/ui/form";

const inviteFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  role_preset: z.string().optional(),
  cycle_id: z.string().optional(),
  pod_id: z.string().optional(),
});

type InviteFormData = z.infer<typeof inviteFormSchema>;

type Invitation = {
  id: number;
  email: string;
  token: string;
  permissions: string[];
  role_preset: string | null;
  cycle_id: number | null;
  cycle_name: string | null;
  pod_id: number | null;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  email_sent_at: string | null;
};

const inputClass =
  "mt-1 block rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal";

export default function InvitationsTable({
  invitations: initialInvitations,
  cycles,
  pods,
  canManageRoles,
}: {
  invitations: Invitation[];
  cycles: { id: number; name: string }[];
  pods: { id: number; name: string; cycle_name: string }[];
  canManageRoles: boolean;
}) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serverError, setServerError] = useState<string | null>(null);
  const [sending, setSending] = useState<number | null>(null);
  const [sendError, setSendError] = useState<{ id: number; message: string } | null>(null);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { email: "", role_preset: "", cycle_id: "", pod_id: "" },
  });
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = form;

  const rolePreset = watch("role_preset");

  const filtered = invitations.filter(
    (i) => statusFilter === "all" || i.status === statusFilter
  );

  async function onSubmit(data: InviteFormData) {
    setServerError(null);

    const body: Record<string, unknown> = { email: data.email };
    if (data.role_preset) body.role_preset = data.role_preset;
    if (data.cycle_id) body.cycle_id = parseInt(data.cycle_id);
    if (data.pod_id) body.pod_id = parseInt(data.pod_id);

    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const json = await res.json();
      setServerError(json.error ?? "Failed to create invitation");
      return;
    }

    const json = await res.json();

    const sendRes = await fetch(`/api/invitations/${json.id}/send`, { method: "POST" });
    const sendData = await sendRes.json();

    const cycleName = data.cycle_id
      ? cycles.find((c) => c.id === parseInt(data.cycle_id!))?.name ?? null
      : null;

    setInvitations((prev) => [
      {
        ...json,
        permissions: json.permissions ?? [],
        cycle_name: cycleName,
        email_sent_at: sendRes.ok ? sendData.email_sent_at : null,
      },
      ...prev,
    ]);

    reset();

    if (!sendRes.ok) {
      setServerError(sendData.error ?? "Invitation created but email failed to send");
    }
  }

  async function revokeInvitation(id: number) {
    const res = await fetch(`/api/invitations/${id}`, { method: "PATCH" });
    if (res.ok) {
      setInvitations((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "revoked" } : i))
      );
    }
  }

  async function sendEmail(id: number) {
    setSending(id);
    setSendError(null);

    const res = await fetch(`/api/invitations/${id}/send`, { method: "POST" });
    const data = await res.json();

    setSending(null);

    if (res.ok) {
      setInvitations((prev) =>
        prev.map((i) => (i.id === id ? { ...i, email_sent_at: data.email_sent_at } : i))
      );
    } else {
      setSendError({ id, message: data.error ?? "Failed to send email" });
    }
  }

  const availablePresets = canManageRoles
    ? ["", "observer", "moderator", "admin", "developer", "owner"]
    : ["", "observer", "moderator"];

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="rounded-md border border-whisper bg-white/[0.02] p-4">
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-white">
          Create invitation
        </h3>
        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-[200px]">
              <FormField name="email" label="Email" required>
                <Input
                  {...register("email")}
                  type="email"
                  placeholder="name@example.com"
                  invalid={!!errors.email}
                  className="mt-1"
                />
              </FormField>
            </div>
            <div>
              <label className="text-xs font-medium text-cloud/80">Role Preset</label>
              <select {...register("role_preset")} className={inputClass}>
                <option value="">No preset</option>
                {availablePresets
                  .filter((p) => p !== "")
                  .map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-cloud/80">Cycle</label>
              <select {...register("cycle_id")} className={inputClass}>
                <option value="">None</option>
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {rolePreset === "moderator" && (
              <div>
                <label className="text-xs font-medium text-cloud/80">Pod</label>
                <select {...register("pod_id")} className={inputClass}>
                  <option value="">Select pod...</option>
                  {pods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.cycle_name})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="pt-5">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-teal px-4 py-2 text-sm font-semibold tracking-tight text-white shadow-[0_1px_4px_rgba(0,148,160,0.2)] transition-all duration-150 ease-spring hover:bg-teal/80 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
              >
                {isSubmitting ? "Sending..." : "Send invite"}
              </button>
            </div>
          </form>
        </FormProvider>
        {serverError && (
          <p role="alert" className="mt-2 text-sm text-red-300">
            {serverError}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Status filter"
          className="rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>
        <span className="text-sm text-cloud/60 tabular-nums">
          {filtered.length} invitation{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border border-whisper">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Preset
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Cycle
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Created
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-cloud/60" />
            </tr>
          </thead>
          <tbody className="divide-y divide-whisper">
            {filtered.map((inv) => {
              const isExpired =
                inv.status === "pending" && new Date(inv.expires_at) < new Date();

              return (
                <tr
                  key={inv.id}
                  className="transition-colors duration-150 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 font-medium text-cloud">{inv.email}</td>
                  <td className="px-4 py-3">
                    {inv.role_preset ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          inv.role_preset === "owner"
                            ? "bg-yellow-500/15 text-yellow-300"
                            : inv.role_preset === "admin"
                              ? "bg-teal/15 text-aqua"
                              : inv.role_preset === "developer"
                                ? "bg-purple-500/15 text-purple-300"
                                : inv.role_preset === "moderator"
                                  ? "bg-blue-500/15 text-blue-300"
                                  : "bg-white/10 text-cloud/60"
                        }`}
                      >
                        {inv.role_preset}
                      </span>
                    ) : (
                      <span className="text-xs text-cloud/60 tabular-nums">
                        {inv.permissions.length} perm
                        {inv.permissions.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-cloud/60">{inv.cycle_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        inv.status === "accepted"
                          ? "bg-teal/20 text-aqua"
                          : inv.status === "pending" && !isExpired
                            ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-white/10 text-cloud/60"
                      }`}
                    >
                      {isExpired ? "expired" : inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cloud/60 tabular-nums">
                    {new Date(inv.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-2">
                        {inv.status === "pending" && !isExpired && (
                          <button
                            onClick={() => sendEmail(inv.id)}
                            disabled={sending === inv.id}
                            title={
                              inv.email_sent_at
                                ? `Last sent ${new Date(inv.email_sent_at).toLocaleDateString()}`
                                : "Resend magic link"
                            }
                            className="rounded bg-white/[0.06] px-3 py-1 text-xs font-semibold tracking-tight text-cloud/80 transition-all duration-150 hover:bg-white/[0.10] hover:text-white active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                          >
                            {sending === inv.id ? "Sending…" : "Resend"}
                          </button>
                        )}
                        {(inv.status === "pending" || inv.status === "accepted") &&
                          !isExpired && (
                            <button
                              onClick={() => revokeInvitation(inv.id)}
                              className="rounded ring-1 ring-whisper px-3 py-1 text-xs font-semibold tracking-tight text-cloud/80 transition-all duration-150 ease-spring hover:bg-red/10 hover:text-red-300 hover:ring-red/30 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                            >
                              Revoke
                            </button>
                          )}
                      </div>
                      {sendError?.id === inv.id && (
                        <p className="text-xs text-red-300">{sendError.message}</p>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-cloud/60">
                  No invitations match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
