"use client";

/* What stays on the ambassador's own device, by design (docs/ambassadors/
   CLAUDE.md): their story draft, the names of people they mean to ask (third
   parties who agreed to nothing), and their own first name for "say {me}
   sent you". Same keys as the prototype. Every access is wrapped — storage
   can be unavailable (private mode, blocked site data) and the page must
   still work for this view. */

const KEYS = {
  story: "ag.story.v1",
  profile: "ag.profile.v1",
  asks: "ag.asks.v1",
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: lasts for this page view only */
  }
}

export type Story = { answers: Record<string, string>; draft: string; savedAt?: number };
export const storyStore = {
  get: (): Story => read<Story>(KEYS.story, { answers: {}, draft: "" }),
  save: (s: Story) => write(KEYS.story, { ...s, savedAt: Date.now() }),
};

export const profileStore = {
  get: (): { me?: string } => read<{ me?: string }>(KEYS.profile, {}),
  set: (p: { me?: string }) => write(KEYS.profile, { ...profileStore.get(), ...p }),
};

export type Ask = { name: string; sent?: number };
export const askStore = {
  get: (): Ask[] => read<Ask[]>(KEYS.asks, []),
  set: (list: Ask[]) => write(KEYS.asks, list),
  /** Put a name at the front, marked sent; keep the others. */
  remember(name: string) {
    write(KEYS.asks, [{ name, sent: Date.now() }, ...askStore.get().filter((a) => a.name !== name)]);
  },
};

/** "Start over": forget what this device saved for the guide. */
export function resetDevice(): void {
  try {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("ag.practice.v1");
  } catch {
    /* ignore */
  }
}

/** Share text through the phone's share sheet, else its messaging app.
 *  Resolves false if the person cancelled. */
export async function shareText(text: string, smsFallback: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ text });
    } else {
      window.location.href = smsFallback;
    }
    return true;
  } catch {
    return false;
  }
}
