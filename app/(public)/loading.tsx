// Loading skeleton for the DB-backed public content pages (force-dynamic), so a
// slow read shows a branded spinner instead of a blank frame.
export default function PublicLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24" aria-busy="true">
      <span
        role="status"
        aria-label="Loading"
        className="h-8 w-8 animate-spin rounded-full border-2 border-ink/10 border-t-teal"
      />
    </div>
  );
}
