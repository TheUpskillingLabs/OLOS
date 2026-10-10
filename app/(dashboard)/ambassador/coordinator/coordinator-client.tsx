"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fill, invite as copy, AMBASSADOR_START } from "@/lib/ambassador/content";
import type { AmbassadorInvite } from "@/lib/ambassador/data";
import type { AmbassadorDecision } from "@/lib/validations/ambassador";
import { formatDate } from "@/lib/format/date";

async function call(url: string, method: string, body?: unknown): Promise<{ ok: boolean; json: Record<string, unknown> | null }> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  const json = res ? ((await res.json().catch(() => null)) as Record<string, unknown> | null) : null;
  return { ok: Boolean(res?.ok), json };
}

const LABELS: Record<Exclude<AmbassadorDecision, "review">, string> = {
  approve: "Reinstate",
  reopen: "Reopen for review",
  button_given: "Button given",
  step_back: "Step back",
};

const ASKS_NOTE: Partial<Record<AmbassadorDecision, string>> = {
  step_back: "Why they're stepping back (optional). They'll see it.",
};

export function DecisionButtons({ id, actions }: { id: number; actions: Exclude<AmbassadorDecision, "review">[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (action: Exclude<AmbassadorDecision, "review">) => {
    let note: string | undefined;
    if (ASKS_NOTE[action]) {
      const n = window.prompt(ASKS_NOTE[action]);
      if (n === null) return; // cancelled
      note = n.trim() || undefined;
    }
    setBusy(true);
    setError(null);
    const { ok, json } = await call(`/api/ambassadors/applications/${id}`, "PATCH", { action, note });
    setBusy(false);
    if (!ok) return setError((json?.error as string) ?? "Couldn't save that.");
    router.refresh();
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {actions.map((a) => (
        <button
          key={a}
          type="button"
          className={`btn btn-sm ${a === "approve" || a === "button_given" ? "btn-teal" : "btn-ghost"}`}
          disabled={busy}
          onClick={() => act(a)}
        >
          {LABELS[a]}
        </button>
      ))}
      {error && <p className="amb-error" role="alert">{error}</p>}
    </div>
  );
}

export function NominationActions({
  id,
  status,
  nomineeName,
  labId,
}: {
  id: number;
  status: "open" | "invited" | "declined";
  nomineeName: string;
  labId: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (status === "invited") return null;

  const decide = async (action: "decline" | "reopen") => {
    setBusy(true);
    await call(`/api/ambassadors/nominations/${id}`, "PATCH", { action });
    setBusy(false);
    router.refresh();
  };

  const toInvite = () => {
    // Hand the nominee to the invite form below.
    window.dispatchEvent(new CustomEvent("amb:invite-nominee", { detail: { id, name: nomineeName, labId } }));
    document.getElementById("amb-invite")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {status === "open" && (
        <>
          <button type="button" className="btn btn-sm btn-teal" onClick={toInvite}>Invite</button>
          <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => decide("decline")}>Not now</button>
        </>
      )}
      {status === "declined" && (
        <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => decide("reopen")}>Reopen</button>
      )}
    </div>
  );
}

const IC = copy.invite;
const BY_KEY = "ag.inviteBy.v1";

export function InviteForm({ labs, requireLab }: { labs: { id: number; name: string }[]; requireLab: boolean }) {
  const router = useRouter();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [by, setBy] = useState("");
  const [note, setNote] = useState("");
  const [lab, setLab] = useState<number | "">(labs.length === 1 ? labs[0].id : "");
  const [nominationId, setNominationId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ link: string; first: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // "Invited by" is remembered on this device; read after mount.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBy(localStorage.getItem(BY_KEY) ?? "");
    } catch {
      /* storage unavailable */
    }
    // A nomination's "Invite" fills this form.
    const onNominee = (e: Event) => {
      const d = (e as CustomEvent<{ id: number; name: string; labId: number | null }>).detail;
      const [f, ...rest] = d.name.split(/\s+/);
      setFirst(f ?? "");
      setLast(rest.join(" "));
      setNominationId(d.id);
      if (d.labId) setLab(d.labId);
      setMade(null);
    };
    window.addEventListener("amb:invite-nominee", onNominee);
    return () => window.removeEventListener("amb:invite-nominee", onNominee);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!first.trim()) return setError(IC.errors.first);
    if (!by.trim()) return setError(IC.errors.by);
    if (requireLab && lab === "") return setError("Pick the Lab they'll be an ambassador for.");
    setBusy(true);
    setError(null);
    try {
      localStorage.setItem(BY_KEY, by.trim());
    } catch {
      /* ignore */
    }
    const { ok, json } = await call("/api/ambassadors/invites", "POST", {
      first_name: first.trim(),
      last_name: last.trim() || undefined,
      email: email.trim() || undefined,
      note: note.trim() || undefined,
      inviter_name: by.trim(),
      lab_id: lab === "" ? null : lab,
      nomination_id: nominationId ?? undefined,
    });
    setBusy(false);
    if (!ok || !json) return setError((json?.error as string) ?? "Couldn't make the invite.");
    setMade({ link: json.link as string, first: first.trim(), email: email.trim() });
    setFirst("");
    setLast("");
    setEmail("");
    setNote("");
    setNominationId(null);
    router.refresh();
  };

  const message = made ? fill(IC.message, { first: made.first, by: by.trim(), link: made.link }) : "";

  return (
    <div id="amb-invite" className="amb-panel" style={{ marginTop: 14 }}>
      <form className="field-grid" onSubmit={onSubmit} noValidate>
        <div className="field half">
          <label htmlFor="iv-first">{IC.first}</label>
          <input id="iv-first" maxLength={100} value={first} onChange={(e) => setFirst(e.target.value)} />
        </div>
        <div className="field half">
          <label htmlFor="iv-last">{IC.last}</label>
          <input id="iv-last" maxLength={100} value={last} onChange={(e) => setLast(e.target.value)} />
        </div>
        <div className="field half">
          <label htmlFor="iv-email">{IC.email}</label>
          <input id="iv-email" type="email" maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby="iv-email-hint" />
          <p className="t-small" id="iv-email-hint">If you add it, only that Google account can use the invite.</p>
        </div>
        <div className="field half">
          <label htmlFor="iv-by">{IC.by}</label>
          <input id="iv-by" maxLength={100} value={by} onChange={(e) => setBy(e.target.value)} aria-describedby="iv-by-hint" />
          <p className="t-small" id="iv-by-hint">{IC.byHint}</p>
        </div>
        {labs.length > 1 || !requireLab ? (
          <div className="field half">
            <label htmlFor="iv-lab">Lab</label>
            <select id="iv-lab" value={lab} onChange={(e) => setLab(e.target.value ? Number(e.target.value) : "")}>
              {!requireLab && <option value="">HQ (no Lab)</option>}
              {requireLab && <option value="">Pick a Lab</option>}
              {labs.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="iv-note">{IC.note}</label>
          <input id="iv-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby="iv-note-hint" />
          <p className="t-small" id="iv-note-hint">{IC.noteHint}</p>
        </div>
        {nominationId && <p className="amb-note" style={{ flexBasis: "100%" }}>From a nomination. Making the invite marks it invited.</p>}
        {error && <p className="amb-error" role="alert" style={{ flexBasis: "100%" }}>{error}</p>}
        <div style={{ flexBasis: "100%" }}>
          <button type="submit" className="btn btn-teal" disabled={busy}>{IC.make}</button>
        </div>
      </form>

      {made && (
        <div style={{ marginTop: 18 }}>
          <p className="lbl">{IC.linkLabel}</p>
          <div className="amb-copy" style={{ marginTop: 6 }}>
            <input readOnly value={made.link} aria-label={IC.linkLabel} onFocus={(e) => e.currentTarget.select()} />
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(made.link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* blocked */
                }
              }}
            >
              {copied ? IC.copied : IC.copy}
            </button>
          </div>
          <div className="amb-row-actions">
            <a className="btn btn-sm btn-teal" href={`sms:?&body=${encodeURIComponent(message)}`}>{IC.text}</a>
            <a
              className="btn btn-sm btn-ghost"
              href={`mailto:${made.email}?subject=${encodeURIComponent(IC.subject)}&body=${encodeURIComponent(message)}`}
            >
              {IC.emailIt}
            </a>
          </div>
        </div>
      )}

      <details style={{ marginTop: 20 }}>
        <summary className="amb-linkbtn">{IC.textsTitle}</summary>
        <p className="t-small" style={{ marginTop: 6 }}>{IC.textsLede}</p>
        {IC.texts.map((t) => (
          <div key={t.label} style={{ marginTop: 10 }}>
            <p className="lbl">{t.label}</p>
            <p className="t-body">{fill(t.body, { by: by.trim() || "…" })}</p>
          </div>
        ))}
      </details>
    </div>
  );
}

export function InviteRow({ invite, nowMs, viewerId }: { invite: AmbassadorInvite; nowMs: number; viewerId: number | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const now = nowMs;
  const status = invite.accepted_at
    ? `Used ${formatDate(invite.accepted_at)}`
    : invite.revoked_at
      ? "Withdrawn"
      : new Date(invite.expires_at).getTime() <= now
        ? "Expired"
        : invite.approved_at
          ? `Open until ${formatDate(invite.expires_at)}`
          : "Waiting for a second coordinator to approve";
  const canApprove = !invite.approved_at && invite.invited_by !== viewerId;
  const open = !invite.accepted_at && !invite.revoked_at && new Date(invite.expires_at).getTime() > now;

  return (
    <tr>
      <td>
        <b>{invite.first_name} {invite.last_name ?? ""}</b>
        {invite.email && <><br /><span className="t-small">{invite.email}</span></>}
      </td>
      <td>{invite.inviter_name}</td>
      <td>{formatDate(invite.created_at)}</td>
      <td>{status}</td>
      <td>
        {open && (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {canApprove && (
              <button
                type="button"
                className="btn btn-sm btn-teal"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await call(`/api/ambassadors/invites/${invite.id}`, "PATCH");
                  setBusy(false);
                  router.refresh();
                }}
              >
                Approve
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(`${window.location.origin}${AMBASSADOR_START}?invite=${invite.token}`)
                  .catch(() => undefined)
              }
            >
              {IC.copy}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm("Withdraw this invite? Its link stops working.")) return;
                setBusy(true);
                await call(`/api/ambassadors/invites/${invite.id}`, "DELETE");
                setBusy(false);
                router.refresh();
              }}
            >
              Withdraw
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
