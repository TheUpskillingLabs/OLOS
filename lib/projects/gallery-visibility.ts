/* Pure visibility rules for the member-facing project (solution) gallery.
   Kept free of Supabase imports so the matrix is unit-testable without mocks
   (lib/projects/gallery-visibility.test.ts); the gallery page feeds it.

   Product rules (2026-08):
   - The gallery is visible from when submissions open through the close of
     voting ("available through voting"). Outside that window it is hidden.
   - The four qualitative answers (the "expanded" view) are revealed only when
     the member has ALREADY submitted their own pitch — so nobody is influenced
     by others' answers before writing their own — OR once the official voting
     period is open (at which point everyone, including non-submitters who may
     still register later, can read them). Otherwise members get the
     "abbreviated" view: project name + one-line summary only.
   - The member gallery is always anonymized (no submitter identity, no
     submission time). That is enforced at the data layer, not here. */

export type GalleryView = "hidden" | "abbreviated" | "expanded";

export interface GalleryVisibilityInput {
  /** `now` is within [solution_proposal_open, solution_voting_close]. */
  galleryOpen: boolean;
  /** the viewer has submitted their own pitch this cycle. */
  hasSubmittedOwn: boolean;
  /** the official voting window is currently open. */
  votingOpen: boolean;
}

export function resolveGalleryView(input: GalleryVisibilityInput): GalleryView {
  if (!input.galleryOpen) return "hidden";
  if (input.hasSubmittedOwn || input.votingOpen) return "expanded";
  return "abbreviated";
}
