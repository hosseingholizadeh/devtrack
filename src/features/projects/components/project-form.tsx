"use client";

import Link from "next/link";
import { useActionState } from "react";
import { initialFormState, type ProjectFormState } from "../action-state";
import { statusLabels } from "../format";
import { projectStatuses } from "../schema";
import {
  DESCRIPTION_MAX,
  NAME_MAX,
  type ProjectFieldName,
  type ProjectFormValues,
} from "../validation";

type Props = {
  action: (prev: ProjectFormState, formData: FormData) => Promise<ProjectFormState>;
  initialValues?: ProjectFormValues;
  submitLabel: string;
  cancelHref: string;
};

const emptyValues: ProjectFormValues = {
  name: "",
  description: "",
  status: "active",
  startDate: "",
  dueDate: "",
};

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

export function ProjectForm({ action, initialValues = emptyValues, submitLabel, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const values = state.values ?? initialValues;
  const errors = state.fieldErrors ?? {};

  // Shared props for one field, plus its inline error message.
  function field(name: ProjectFieldName) {
    const message = errors[name]?.[0];
    return {
      props: {
        id: name,
        name,
        defaultValue: values[name],
        "aria-invalid": message ? true : undefined,
        "aria-describedby": message ? `${name}-error` : undefined,
      },
      error: message ? (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-700 dark:text-red-400">
          {message}
        </p>
      ) : null,
    };
  }

  const name = field("name");
  const description = field("description");
  const status = field("status");
  const startDate = field("startDate");
  const dueDate = field("dueDate");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.message ? (
        <p
          role="alert"
          className="rounded-md bg-red-100 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300"
        >
          {state.message}
        </p>
      ) : null}

      <div>
        <label htmlFor="name" className="text-sm font-medium">
          Name <span aria-hidden="true">*</span>
        </label>
        <input type="text" required maxLength={NAME_MAX} className={inputClass} {...name.props} />
        {name.error}
      </div>

      <div>
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <textarea rows={4} maxLength={DESCRIPTION_MAX} className={inputClass} {...description.props} />
        {description.error}
      </div>

      <div>
        <label htmlFor="status" className="text-sm font-medium">
          Status
        </label>
        <select className={inputClass} {...status.props}>
          {projectStatuses.map((value) => (
            <option key={value} value={value}>
              {statusLabels[value]}
            </option>
          ))}
        </select>
        {status.error}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="startDate" className="text-sm font-medium">
            Start date
          </label>
          <input type="date" className={inputClass} {...startDate.props} />
          {startDate.error}
        </div>
        <div>
          <label htmlFor="dueDate" className="text-sm font-medium">
            Due date
          </label>
          <input type="date" className={inputClass} {...dueDate.props} />
          {dueDate.error}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
