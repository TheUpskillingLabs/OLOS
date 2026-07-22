import { describe, it, expect } from "vitest";
import {
  encodeCursor,
  decodeCursor,
  byCreatedDesc,
  assemblePage,
} from "./feed";

const row = (id: number, createdAt: string) => ({ id, createdAt });

describe("cursor codec", () => {
  it("round-trips a raw Postgres timestamp", () => {
    const c = { createdAt: "2026-07-01T12:00:00.123456+00:00", id: 42 };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it("round-trips a space-separated timestamp", () => {
    const c = { createdAt: "2026-07-01 12:00:00.123+00", id: 7 };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it("rejects garbage", () => {
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("no-separator")).toBeNull();
    expect(decodeCursor("2026-07-01T00:00:00Z_")).toBeNull();
    expect(decodeCursor("_42")).toBeNull();
    expect(decodeCursor("not-a-date_42")).toBeNull();
    expect(decodeCursor("2026-07-01T00:00:00Z_4.2")).toBeNull();
    expect(decodeCursor("2026-07-01T00:00:00Z_-1")).toBeNull();
    expect(decodeCursor("2026-07-01T00:00:00Z_NaN")).toBeNull();
  });

  it("rejects PostgREST filter injection in the timestamp", () => {
    expect(decodeCursor('2026-07-01",id.gt.0)_1')).toBeNull();
    expect(decodeCursor("2026-07-01,or(_1")).toBeNull();
  });
});

describe("byCreatedDesc", () => {
  it("sorts newest first, id descending as tiebreak", () => {
    const rows = [
      row(1, "2026-07-01T10:00:00Z"),
      row(3, "2026-07-01T11:00:00Z"),
      row(2, "2026-07-01T11:00:00Z"),
    ];
    expect([...rows].sort(byCreatedDesc).map((r) => r.id)).toEqual([3, 2, 1]);
  });
});

describe("assemblePage", () => {
  it("dedups by id, sorts, slices, and returns the next cursor on a full page", () => {
    const rows = [
      row(1, "2026-07-01T10:00:00Z"),
      row(2, "2026-07-01T12:00:00Z"),
      row(2, "2026-07-01T12:00:00Z"), // followed AND admined page — must not double
      row(3, "2026-07-01T11:00:00Z"),
    ];
    const { items, nextCursor } = assemblePage(rows, 2);
    expect(items.map((r) => r.id)).toEqual([2, 3]);
    expect(nextCursor).toBe(encodeCursor({ createdAt: "2026-07-01T11:00:00Z", id: 3 }));
  });

  it("returns a null cursor on a short page (end of feed)", () => {
    const { items, nextCursor } = assemblePage(
      [row(1, "2026-07-01T10:00:00Z")],
      30
    );
    expect(items).toHaveLength(1);
    expect(nextCursor).toBeNull();
  });

  it("handles an empty page", () => {
    const { items, nextCursor } = assemblePage([], 30);
    expect(items).toEqual([]);
    expect(nextCursor).toBeNull();
  });
});
