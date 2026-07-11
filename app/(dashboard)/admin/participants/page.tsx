import { redirect } from "next/navigation";

// The global participants list folded into the consolidated People & Access
// surface. Kept as a redirect so existing links/bookmarks to /admin/participants
// still land. (The per-participant deep link
// /admin/participants/[id]/permissions stays as a full-page fallback.)
export default function AdminParticipantsRedirect() {
  redirect("/admin/people");
}
