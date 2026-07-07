import { redirect } from "next/navigation";

// Invitations now live as a tab under People & Access. Kept as a redirect so
// existing links/bookmarks to /admin/invitations still land.
export default function AdminInvitationsRedirect() {
  redirect("/admin/people?tab=invitations");
}
