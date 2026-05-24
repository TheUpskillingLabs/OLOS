import { NextResponse } from "next/server";

/**
 * Returns a sanitized 500 error response, logging the real error server-side.
 * Prevents leaking internal database details (table names, constraints, etc.)
 * to API consumers.
 */
export function dbError(error: unknown, context?: string): NextResponse {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
      ? String((error as Record<string, unknown>).message)
      : String(error);
  const detail =
    typeof error === "object" && error !== null && "details" in error
      ? (error as Record<string, unknown>).details
      : undefined;
  console.error(`[DB_ERROR]${context ? ` ${context}:` : ""}`, message, detail ?? "");
  return NextResponse.json(
    { error: "An internal error occurred. Please try again later." },
    { status: 500 }
  );
}
