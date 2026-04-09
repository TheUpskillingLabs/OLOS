export default function DashboardLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-teal" />
        <p className="text-sm text-muted">Loading...</p>
      </div>
    </div>
  );
}
