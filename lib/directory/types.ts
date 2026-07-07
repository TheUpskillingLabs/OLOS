/**
 * Shared types for the community directory (/directory) — the RSC fetch
 * (lib/directory/data.ts) produces these; the client island
 * (directory-search.tsx) and row components consume them. Everything here is
 * serializable (crosses the RSC → client boundary) and PII-free by
 * construction: only display-allowlist columns ever reach these shapes.
 */

export interface DirectoryPerson {
  id: number;
  handle: string | null;
  displayName: string;
  firstInitial: string;
  lastInitial: string;
  headline: string | null;
  primary_expertise: string | null;
  role_intents: string[];
  profile_image_url: string | null;
  metroSlug: string | null;
  metroName: string | null;
  /** Cycles this member is (or was) enrolled in — powers the cycle filter. */
  cycleIds: number[];
  createdAt: string;
}

/** A slim member reference for pod/project avatar stacks. */
export interface MemberAvatar {
  id: number;
  name: string;
  imageUrl: string | null;
  initials: string;
}

export interface DirectoryPod {
  id: number;
  name: string | null;
  status: string;
  cycleId: number | null;
  cycleName: string | null;
  /** The seeding problem statement, truncated for the row subtitle. */
  statement: string | null;
  moderatorNames: string[];
  memberCount: number;
  avatars: MemberAvatar[];
  createdAt: string;
}

export interface DirectoryProject {
  id: number;
  name: string | null;
  status: string;
  cycleId: number | null;
  cycleName: string | null;
  podId: number | null;
  podName: string | null;
  /** Solution-proposal name (fallback: summary snippet) for the subtitle. */
  summary: string | null;
  memberCount: number;
  avatars: MemberAvatar[];
  createdAt: string;
}

export interface DirectoryFilterOptions {
  /** Only metros that appear on at least one visible member. */
  metros: { slug: string; label: string }[];
  /** All cycles, newest first. */
  cycles: { id: number; name: string }[];
}

export interface DirectoryData {
  people: DirectoryPerson[];
  pods: DirectoryPod[];
  projects: DirectoryProject[];
  filterOptions: DirectoryFilterOptions;
}
