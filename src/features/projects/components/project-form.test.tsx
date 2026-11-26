import { describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ProjectFormState } from "../action-state";
import { ProjectForm } from "./project-form";

type Action = (prev: ProjectFormState, data: FormData) => Promise<ProjectFormState>;
// The name input is natively `required`, so fill it in (jsdom, like a browser, blocks an invalid submit).
const submit = () => {
  const name = screen.getByLabelText(/Name/) as HTMLInputElement;
  if (!name.value) fireEvent.change(name, { target: { value: "Website" } });
  return act(async () => void fireEvent.click(screen.getByRole("button", { name: "Create project" })));
};
const renderForm = (action: Action) =>
  render(<ProjectForm action={action} submitLabel="Create project" cancelHref="/projects" />);

describe("ProjectForm", () => {
  test("renders every field, defaulting status to Active", () => {
    renderForm(vi.fn(async () => ({})));
    expect(screen.getByLabelText(/Name/)).toBeTruthy();
    expect(screen.getByLabelText("Description")).toBeTruthy();
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("active");
    expect(screen.getByLabelText("Start date")).toBeTruthy();
    expect(screen.getByLabelText("Due date")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/projects");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Active", "Completed", "Archived"]);
  });

  test("submits the entered values to the action", async () => {
    const action = vi.fn<Action>(async () => ({}));
    renderForm(action);
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Website" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "completed" } });
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-04-01" } });
    await submit();

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const data = action.mock.calls[0][1] as FormData;
    expect(Object.fromEntries(["name", "status", "dueDate"].map((k) => [k, data.get(k)]))).toEqual({
      name: "Website",
      status: "completed",
      dueDate: "2026-04-01",
    });
  });

  test("shows field errors and keeps the submitted values", async () => {
    const action = vi.fn(async (): Promise<ProjectFormState> => ({
      fieldErrors: { dueDate: ["Due date must be on or after the start date"] },
      values: { name: "Website", description: "kept", status: "active", startDate: "2026-02-01", dueDate: "2026-01-01" },
    }));
    renderForm(action);
    await submit();

    const error = await screen.findByText("Due date must be on or after the start date");
    const due = screen.getByLabelText("Due date");
    expect(due.getAttribute("aria-invalid")).toBe("true");
    expect(due.getAttribute("aria-describedby")).toBe(error.id);
    expect((screen.getByLabelText("Description") as HTMLTextAreaElement).defaultValue).toBe("kept");
  });

  test("shows a form-level error", async () => {
    renderForm(vi.fn(async () => ({ message: "Could not save the project. Please try again." })));
    await submit();
    expect((await screen.findByRole("alert")).textContent).toBe("Could not save the project. Please try again.");
  });

  test("disables the submit button and shows progress while saving", async () => {
    let finish!: () => void;
    const action = vi.fn(() => new Promise<ProjectFormState>((resolve) => (finish = () => resolve({}))));
    renderForm(action);
    await submit();

    const saving = (await screen.findByRole("button", { name: "Saving…" })) as HTMLButtonElement;
    expect(saving.disabled).toBe(true);
    finish();
    await waitFor(() => expect(screen.getByRole("button", { name: "Create project" })).toBeTruthy());
  });

  test("prefills initial values when editing", () => {
    render(
      <ProjectForm
        action={vi.fn(async () => ({}))}
        submitLabel="Save changes"
        cancelHref="/projects/1"
        initialValues={{ name: "Old", description: "desc", status: "archived", startDate: "2026-01-01", dueDate: "" }}
      />,
    );
    expect((screen.getByLabelText(/Name/) as HTMLInputElement).value).toBe("Old");
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("archived");
    expect((screen.getByLabelText("Start date") as HTMLInputElement).value).toBe("2026-01-01");
  });
});
