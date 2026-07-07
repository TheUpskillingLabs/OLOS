"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Field, Input, Textarea, Select, ToggleSwitch } from "@/app/components/ui";
import {
  LINK_PLATFORMS,
  type LinkPlatform,
} from "@/lib/validations/showcase";
import { PlatformIcon, PLATFORM_LABELS } from "./platform-icon";
import { resizeImage } from "./resize-image";

/**
 * Curator editor for a pod/project showcase page. Page text (tagline,
 * description, directory listing) saves on submit via PATCH …/page; logo/cover
 * and social links save immediately (each its own request), mirroring the
 * avatar pattern in profile-edit-form.tsx. Every write goes through a
 * curator-gated API route, then router.refresh() re-reads the server page.
 */

type EntityType = "pod" | "project";
type LinkRow = { platform: LinkPlatform; url: string; label: string | null };

interface Props {
  entityType: EntityType;
  entityId: number;
  name: string;
  backHref: string;
  initial: {
    tagline: string;
    description: string;
    directory_visible: boolean;
    logoUrl: string | null;
    coverUrl: string | null;
    initials: string;
  };
  initialLinks: LinkRow[];
}

export default function ShowcaseEditForm({
  entityType,
  entityId,
  name,
  backHref,
  initial,
  initialLinks,
}: Props) {
  const router = useRouter();
  const apiBase = `/api/${entityType}s/${entityId}`;

  // ── Page text ──
  const [tagline, setTagline] = useState(initial.tagline);
  const [description, setDescription] = useState(initial.description);
  const [directoryVisible, setDirectoryVisible] = useState(
    initial.directory_visible
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  async function savePage(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      const res = await fetch(`${apiBase}/page`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagline: tagline.trim() || null,
          description: description.trim() || null,
          directory_visible: directoryVisible,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(
          typeof data?.error === "string" ? data.error : `Request failed (${res.status})`
        );
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setSaveError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Images (logo + cover) ──
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-deep transition-colors duration-150 hover:text-ink"
        >
          <span aria-hidden>←</span> Back to {name}
        </Link>
      </div>

      <h1 className="t-h1 text-ink">Edit page</h1>
      <p className="mt-1 t-small">
        Curate how {name} appears in the directory and to members.
      </p>

      {/* Images save immediately */}
      <div className="mt-6 space-y-6 border-t border-ink/10 pt-6">
        <ImageControl
          kind="cover"
          apiBase={apiBase}
          label="Cover image"
          helper="A wide banner (about 1600×500). JPEG, PNG, or WebP — we resize it."
          maxPx={1600}
          current={coverUrl}
          initials={initial.initials}
          onChange={(u) => {
            setCoverUrl(u);
            router.refresh();
          }}
        />
        <ImageControl
          kind="logo"
          apiBase={apiBase}
          label="Logo"
          helper="A square mark shown on the page and in directory cards."
          maxPx={512}
          current={logoUrl}
          initials={initial.initials}
          onChange={(u) => {
            setLogoUrl(u);
            router.refresh();
          }}
        />
      </div>

      {/* Page text saves on submit */}
      <form onSubmit={savePage} className="mt-6 space-y-5 border-t border-ink/10 pt-6">
        <Field
          label="Tagline"
          helper="One line under the name."
          htmlFor="tagline"
          charCount={`${tagline.length}/200`}
        >
          <Input
            id="tagline"
            type="text"
            maxLength={200}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
        </Field>

        <Field
          label="About"
          helper="Describe the mission, the problem, and what you're building."
          htmlFor="description"
          charCount={`${description.length}/4000`}
        >
          <Textarea
            id="description"
            rows={6}
            maxLength={4000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="flex items-start justify-between gap-4 rounded-card border border-ink/10 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-ink">List in the directory</p>
            <p className="mt-0.5 text-xs text-meta">
              Show this {entityType} in the members&apos; directory so people can find and follow it.
            </p>
          </div>
          <ToggleSwitch
            checked={directoryVisible}
            onChange={() => setDirectoryVisible((v) => !v)}
            label="List in the directory"
          />
        </div>

        {saveError && (
          <p className="rounded-card border border-red/30 bg-red/10 px-3 py-2 text-sm text-red">
            {saveError}
          </p>
        )}
        {saved && (
          <p className="rounded-card border border-teal/30 bg-teal/10 px-3 py-2 text-sm text-teal-deep">
            Saved.{" "}
            <Link href={backHref} className="underline">
              View the page
            </Link>
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <Link
            href={backHref}
            className="text-sm text-slate underline-offset-2 hover:text-ink hover:underline"
          >
            Done
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-teal ml-auto px-4 py-2 text-sm"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      {/* Links save immediately */}
      <LinksEditor
        entityType={entityType}
        entityId={entityId}
        initialLinks={initialLinks}
      />
    </div>
  );
}

// ── Image control (upload / replace / remove) ──────────────────────────────

function ImageControl({
  kind,
  apiBase,
  label,
  helper,
  maxPx,
  current,
  initials,
  onChange,
}: {
  kind: "logo" | "cover";
  apiBase: string;
  label: string;
  helper: string;
  maxPx: number;
  current: string | null;
  initials: string;
  onChange: (url: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const blob = await resizeImage(file, maxPx);
      const fd = new FormData();
      fd.append("file", blob, `${kind}.jpg`);
      const res = await fetch(`${apiBase}/image?kind=${kind}`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Upload failed. Try again.");
        return;
      }
      onChange(data.url ?? null);
    } catch {
      setError("Could not process that image.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/image?kind=${kind}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Could not remove the image.");
        return;
      }
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  const isCover = kind === "cover";

  return (
    <div>
      <p className="lbl mb-2">{label}</p>
      <div className="flex items-center gap-4">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current}
            alt=""
            className={
              isCover
                ? "h-16 w-28 rounded-card object-cover ring-1 ring-ink/10"
                : "h-16 w-16 rounded-card object-cover ring-1 ring-ink/10"
            }
          />
        ) : (
          <div
            className={`flex items-center justify-center rounded-card text-white ${
              isCover
                ? "h-16 w-28 bg-gradient-to-br from-teal-deep to-navy"
                : "h-16 w-16 bg-teal-deep text-lg font-bold"
            }`}
          >
            {isCover ? "" : initials}
          </div>
        )}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPick}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="btn btn-ghost px-3 py-1.5 text-sm"
            >
              {busy ? "Uploading…" : current ? "Change" : "Upload"}
            </button>
            {current && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="text-sm text-slate underline-offset-2 hover:text-red hover:underline"
              >
                Remove
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-meta">{helper}</p>
          {error && <p className="mt-1 text-xs text-red">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Links editor (one row per platform) ────────────────────────────────────

function LinksEditor({
  entityType,
  entityId,
  initialLinks,
}: {
  entityType: EntityType;
  entityId: number;
  initialLinks: LinkRow[];
}) {
  const router = useRouter();
  const [links, setLinks] = useState<LinkRow[]>(initialLinks);
  const [platform, setPlatform] = useState<LinkPlatform>("github");
  const [url, setUrl] = useState("");
  const [labelText, setLabelText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const used = new Set(links.map((l) => l.platform));
  const available = LINK_PLATFORMS.filter((p) => !used.has(p));

  // The submitted platform must always be one that's actually rendered as an
  // <option>. `platform` state can go stale (e.g. it starts on "github" but a
  // github link already exists), and a controlled <select> whose value matches
  // no option would still submit that stale value — silently overwriting the
  // existing link via the (owner, platform) upsert. Derive the effective value
  // so it can never drift out of `available`.
  const selectedPlatform: LinkPlatform = available.includes(platform)
    ? platform
    : (available[0] ?? "other");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/entity-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_type: entityType,
          owner_id: entityId,
          platform: selectedPlatform,
          url: url.trim(),
          label: labelText.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not add link.");
        return;
      }
      setLinks((prev) => [
        ...prev.filter((l) => l.platform !== selectedPlatform),
        { platform: selectedPlatform, url: url.trim(), label: labelText.trim() || null },
      ]);
      setUrl("");
      setLabelText("");
      router.refresh();
    } catch {
      setError("Could not add link. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: LinkPlatform) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/entity-links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_type: entityType,
          owner_id: entityId,
          platform: p,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Could not remove link.");
        return;
      }
      setLinks((prev) => prev.filter((l) => l.platform !== p));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4 border-t border-ink/10 pt-6">
      <div>
        <p className="lbl">Links</p>
        <p className="mt-1 text-xs text-meta">
          GitHub, social, and other links shown on the page. One per platform.
        </p>
      </div>

      {links.length > 0 && (
        <ul className="space-y-2">
          {links.map((l) => (
            <li
              key={l.platform}
              className="flex items-center gap-3 rounded-card border border-ink/10 bg-white px-3 py-2"
            >
              <span className="text-charcoal">
                <PlatformIcon platform={l.platform} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">
                  {l.label || PLATFORM_LABELS[l.platform]}
                </span>
                <span className="block truncate text-xs text-meta">{l.url}</span>
              </span>
              <button
                type="button"
                onClick={() => remove(l.platform)}
                disabled={busy}
                className="text-xs text-slate underline-offset-2 hover:text-red hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 ? (
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <div className="w-32">
            <Field label="Platform" htmlFor="link-platform">
              <Select
                id="link-platform"
                value={selectedPlatform}
                onChange={(e) => setPlatform(e.target.value as LinkPlatform)}
              >
                {available.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="min-w-[12rem] flex-1">
            <Field label="URL" htmlFor="link-url">
              <Input
                id="link-url"
                type="url"
                inputMode="url"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </Field>
          </div>
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="btn btn-ghost px-3 py-2.5 text-sm"
          >
            {busy ? "Adding…" : "Add"}
          </button>
        </form>
      ) : (
        <p className="text-xs text-meta">All platforms added.</p>
      )}

      {error && <p className="text-xs text-red">{error}</p>}
    </div>
  );
}
