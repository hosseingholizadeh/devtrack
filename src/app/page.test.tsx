import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

// Smoke test: proves Vitest, jsdom, React Testing Library and the `@/` alias work.
test("Home renders a top-level heading", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
});
