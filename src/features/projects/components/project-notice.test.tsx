import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectNotice } from "./project-notice";

describe("ProjectNotice", () => {
  test.each([
    ["created", "Project created."],
    ["updated", "Changes saved."],
    ["deleted", "Project deleted."],
  ])("shows a message for %s", (notice, text) => {
    render(<ProjectNotice notice={notice} />);
    expect(screen.getByRole("status").textContent).toBe(text);
  });

  test.each([undefined, "", "bogus", "toString", ["created"]])("renders nothing for %j", (notice) => {
    const { container } = render(<ProjectNotice notice={notice} />);
    expect(container.textContent).toBe("");
  });
});
