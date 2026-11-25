import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

// Smoke tests: prove Vitest, jsdom, React Testing Library, the `@/` alias and per-test cleanup work.
// Replace with real page tests once the placeholder home page is replaced.
describe("Home", () => {
  test("renders exactly one top-level heading with content", () => {
    render(<Home />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent?.trim().length).toBeGreaterThan(0);
  });

  test("starts from a clean DOM (cleanup ran after the previous test)", () => {
    expect(screen.queryAllByRole("heading")).toHaveLength(0);
    render(<Home />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
