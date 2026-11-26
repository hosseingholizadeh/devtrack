import { describe, expect, test, vi } from "vitest";

const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));

import Home from "@/app/page";

describe("Home", () => {
  test("redirects to the projects list", () => {
    expect(() => Home()).toThrow("NEXT_REDIRECT:/projects");
    expect(redirect).toHaveBeenCalledWith("/projects");
  });
});
