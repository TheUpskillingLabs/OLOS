import { NextResponse, NextRequest } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { isAdmin, isModerator } from "@/lib/auth/roles";
import { parseBody } from "@/lib/api/request";
import { uiStatePutSchema, type UiStatePutInput } from "@/lib/validations/moderator";

/**
 * /api/moderator/ui-state — per-poderator dashboard state.
 *
 * GET  — returns the caller's row, or a default empty state if no row yet.
 * PUT  — partial upsert. Fields not present in the body are left unchanged
 *        on existing rows. On first PUT (no row exists), the row is created
 *        with the provided fields and defaults from the migration.
 *
 * Allowed callers: moderators (any assignment) + admins/owners. PRD §10
 * explicitly states admins receive ui_state rows like poderators.
 */

const FORBIDDEN = () =>
  NextResponse.json({ error: "Forbidden" }, { status: 403 });

type Row = {
  last_view: string | null;
  roster_filters: Record<string, unknown> | null;
  roster_sort: string | null;
  tooltip_seen: string[] | null;
  last_pod_tab: string | null;
};

const EMPTY_STATE: Row = {
  last_view: null,
  roster_filters: {},
  roster_sort: null,
  tooltip_seen: [],
  last_pod_tab: null,
};

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest) => {
    if (!isModerator(auth.user) && !isAdmin(auth.user)) return FORBIDDEN();

    const participantId = auth.user.participantId;
    if (!participantId) {
      // Should not happen for an authenticated moderator/admin, but
      // protect against null participantId rather than throwing.
      return NextResponse.json(EMPTY_STATE);
    }

    const { data, error } = await auth.supabase
      .from("moderator_ui_state")
      .select("last_view, roster_filters, roster_sort, tooltip_seen, last_pod_tab")
      .eq("participant_id", participantId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to load UI state" },
        { status: 500 }
      );
    }

    return NextResponse.json((data ?? EMPTY_STATE) satisfies Row);
  }
);

export const PUT = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    if (!isModerator(auth.user) && !isAdmin(auth.user)) return FORBIDDEN();

    const participantId = auth.user.participantId;
    if (!participantId) return FORBIDDEN();

    const parsed = await parseBody<UiStatePutInput>(request, uiStatePutSchema);
    if (parsed instanceof NextResponse) return parsed;

    // Build the upsert payload, including only fields the caller sent.
    // This lets a switcher change avoid clobbering tooltip_seen, etc.
    const patch: Record<string, unknown> = {
      participant_id: participantId,
    };
    if (parsed.last_view !== undefined) patch.last_view = parsed.last_view;
    if (parsed.roster_filters !== undefined)
      patch.roster_filters = parsed.roster_filters;
    if (parsed.roster_sort !== undefined) patch.roster_sort = parsed.roster_sort;
    if (parsed.tooltip_seen !== undefined)
      patch.tooltip_seen = parsed.tooltip_seen;
    if (parsed.last_pod_tab !== undefined)
      patch.last_pod_tab = parsed.last_pod_tab;

    const { data, error } = await auth.supabase
      .from("moderator_ui_state")
      .upsert(patch, { onConflict: "participant_id" })
      .select("last_view, roster_filters, roster_sort, tooltip_seen, last_pod_tab")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to persist UI state" },
        { status: 500 }
      );
    }

    return NextResponse.json(data satisfies Row);
  }
);
