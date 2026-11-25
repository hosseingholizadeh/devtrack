import { describe, expect, test } from "vitest";
import { formatDate, formatTimestamp } from "./format";

describe("formatDate", () => {
  test("formats a calendar date without shifting the day", () => {
    expect(formatDate("2026-03-09")).toBe("Mar 9, 2026");
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
  });

  test("shows a dash when there is no date", () => {
    expect(formatDate(null)).toBe("—");
  });
});

describe("formatTimestamp", () => {
  test("formats in UTC", () => {
    expect(formatTimestamp(new Date("2026-03-09T14:05:00Z"))).toBe("Mar 9, 2026, 02:05 PM UTC");
  });
});
