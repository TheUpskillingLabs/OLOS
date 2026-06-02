// Re-export from the shared location so both per-pod and cross-pod
// surfaces use the same component. Originally built here; moved to
// app/(dashboard)/moderator/ when chunk 9 (cross-pod insights)
// needed to render it too.
export { AISummaryBlock } from "../../ai-summary-block";
