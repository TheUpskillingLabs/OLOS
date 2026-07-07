import { describe, it, expect } from "vitest";
import { toCsv, formatCsvValue, escapeCsvCell, type CsvColumn } from "./csv";

const cols: CsvColumn[] = [
  { key: "a", header: "A" },
  { key: "b", header: "B" },
];

describe("formatCsvValue", () => {
  it("renders null/undefined as empty", () => {
    expect(formatCsvValue(null)).toBe("");
    expect(formatCsvValue(undefined)).toBe("");
  });
  it("joins arrays with '; '", () => {
    expect(formatCsvValue(["x", "y", "z"])).toBe("x; y; z");
  });
  it("maps booleans to yes/no", () => {
    expect(formatCsvValue(true)).toBe("yes");
    expect(formatCsvValue(false)).toBe("no");
  });
  it("stringifies numbers", () => {
    expect(formatCsvValue(42)).toBe("42");
  });
});

describe("escapeCsvCell", () => {
  it("leaves plain text untouched", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
  });
  it("quotes cells containing a comma", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
  });
  it("doubles embedded quotes and wraps", () => {
    expect(escapeCsvCell('she said "hi"')).toBe('"she said ""hi"""');
  });
  it("quotes cells with newlines", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });
  it("neutralizes spreadsheet-injection prefixes", () => {
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCsvCell("+1")).toBe("'+1");
    expect(escapeCsvCell("-1")).toBe("'-1");
    expect(escapeCsvCell("@x")).toBe("'@x");
  });
  it("guards AND quotes when an injection cell also has a comma", () => {
    expect(escapeCsvCell("=A,B")).toBe(`"'=A,B"`);
  });
});

describe("toCsv", () => {
  it("emits a header row and CRLF-joined body", () => {
    const csv = toCsv([{ a: "1", b: "2" }], cols);
    expect(csv).toBe("A,B\r\n1,2");
  });
  it("handles multiple rows and missing keys", () => {
    const csv = toCsv([{ a: "1" }, { a: "3", b: "4" }], cols);
    expect(csv).toBe("A,B\r\n1,\r\n3,4");
  });
  it("formats and escapes values end to end", () => {
    const csv = toCsv(
      [{ a: ["p", "q"], b: 'x,"y"' }],
      cols
    );
    expect(csv).toBe('A,B\r\np; q,"x,""y"""');
  });
});
