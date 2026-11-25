import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeleteProjectButton } from "./delete-project-button";

describe("DeleteProjectButton", () => {
  test("asks for confirmation before deleting and can be cancelled", () => {
    const action = vi.fn(async () => ({}));
    render(<DeleteProjectButton projectName="Website" action={action} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/Delete .Website.\? This cannot be undone\./)).toBeTruthy();
    expect(action).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
  });

  test("calls the action on confirm", async () => {
    const action = vi.fn(async () => ({}));
    render(<DeleteProjectButton projectName="Website" action={action} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });

  test("shows the error returned by the action", async () => {
    const action = vi.fn(async () => ({ message: "Could not delete the project. Please try again." }));
    render(<DeleteProjectButton projectName="Website" action={action} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Could not delete the project. Please try again.");
  });
});
