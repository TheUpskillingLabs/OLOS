import { NextResponse } from "next/server";

/**
 * Safely parses a route parameter as an integer.
 * Returns the number on success, or a 400 NextResponse on failure.
 */
export function parseIntParam(
  value: string,
  name: string
): number | NextResponse {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return NextResponse.json(
      { error: `Invalid ${name}: must be a number` },
      { status: 400 }
    );
  }
  return parsed;
}
