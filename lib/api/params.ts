import { NextResponse } from "next/server";

/**
 * Safely parses a route parameter as an integer.
 * Returns the number on success, or a 400 NextResponse on failure.
 */
export function parseIntParam(
  value: string,
  name: string
): number | NextResponse {
  // Strict: reject trailing garbage like "12abc" (parseInt would silently
  // return 12 and route the request to id 12).
  if (!/^\d+$/.test(value)) {
    return NextResponse.json(
      { error: `Invalid ${name}: must be a number` },
      { status: 400 }
    );
  }
  return parseInt(value, 10);
}
