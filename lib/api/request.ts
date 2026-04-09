import { NextRequest, NextResponse } from "next/server";
import { ZodSchema } from "zod";

/**
 * Safely parses the JSON body of a request and validates it against a Zod schema.
 * Returns the validated data on success, or a 400 NextResponse on failure.
 */
export async function parseBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<T | NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const issues = result.error.issues.map((i) => i.message).join("; ");
    return NextResponse.json({ error: issues }, { status: 400 });
  }

  return result.data;
}

/** Type guard: checks if parseBody returned an error response */
export function isErrorResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
