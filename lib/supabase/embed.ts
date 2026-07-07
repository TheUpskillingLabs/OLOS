/** Supabase foreign-table embeds come back as object-or-array depending on
    the relationship cardinality the client infers; normalize to one-or-null.
    Promoted from lib/directory/data.ts so every join call site handles both
    shapes the same way instead of hand-rolling casts. */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
