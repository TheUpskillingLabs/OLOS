// A plain download anchor for the group contact-export routes. Server component
// — no client JS needed: the export routes send Content-Disposition: attachment,
// so the browser downloads the CSV in place without navigating away. Render it
// only where the viewer is authorized (admin/owner, the pod's poderator, or the
// lab's lead); the route re-checks that same authorization server-side.
export function ContactsDownloadButton({
  href,
  label = "Download contacts CSV",
}: {
  href: string;
  label?: string;
}) {
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-1.5 rounded-card bg-teal-deep px-4 py-2 text-sm font-semibold tracking-tight text-white transition-colors duration-150 hover:bg-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
    >
      {label}
    </a>
  );
}
