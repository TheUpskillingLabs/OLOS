import { redirect } from "next/navigation";

// Spotlights now live under the consolidated Content surface. Kept as a
// redirect so existing links/bookmarks to /admin/stories still land.
export default function AdminStoriesRedirect() {
  redirect("/admin/content");
}
