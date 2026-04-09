import { NextResponse } from "next/server";

/**
 * Returns a sanitized 500 error response, logging the real error server-side.
 * Prevents leaking internal database details (table names, constraints, etc.)
 * to API consumers.
 */
export function dbError(error: unknown, context?: string): NextResponse {
  const message =
    error instanceof Error ? error.message : String(error);
  console.error(`[DB_ERROR]${context ? ` ${context}:` : ""}`, message);
  return NextResponse.json(
    { error: "An internal error occurred. Please try again later." },
    { status: 500 }
  );
}
