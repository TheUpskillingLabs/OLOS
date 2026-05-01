export default function DashboardLoading() {
  return (
    <div
      className="flex flex-1 items-center justify-center py-16"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3">
        <span
          role="status"
          aria-label="Loading"
          className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-teal"
        />
        <p className="text-sm text-cloud/60">Loading...</p>
      </div>
    </div>
  );
}
