"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
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
  /** Cancel as a link (full-page forms)... */
  cancelHref?: string;
  /** ...or as a button (forms inside a dialog). */
  onCancel?: () => void;
};

const emptyValues: ProjectFormValues = {
  name: "",
  description: "",
  status: "active",
  startDate: "",
  dueDate: "",
};

const control =
  "w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink shadow-sm transition-colors placeholder:text-muted/70 hover:border-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20";

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-0.5 text-danger">
              *
            </span>
          ) : null}
        </label>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

export function ProjectForm({ action, initialValues = emptyValues, submitLabel, cancelHref, onCancel }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const values = state.values ?? initialValues;
  const errors = state.fieldErrors ?? {};

  // Live (client-side) feedback; the server remains the source of truth.
  const [descriptionLength, setDescriptionLength] = useState(values.description.length);
  const [startDate, setStartDate] = useState(values.startDate);
  const [dueDate, setDueDate] = useState(values.dueDate);
  const liveDueError =
    startDate && dueDate && dueDate < startDate ? "Due date must be on or after the start date" : undefined;

  function props(name: ProjectFieldName, error = errors[name]?.[0]) {
    return {
      id: name,
      name,
      defaultValue: values[name],
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${name}-error` : undefined,
    } as const;
  }

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
        {state.message ? (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
            {state.message}
          </p>
        ) : null}

        <Section title="Details">
          <Field id="name" label="Name" required error={errors.name?.[0]}>
            <input
              type="text"
              required
              maxLength={NAME_MAX}
              placeholder="e.g. Website redesign"
              autoComplete="off"
              className={`${control} h-10`}
              {...props("name")}
            />
          </Field>
          <Field
            id="description"
            label="Description"
            hint={`${descriptionLength}/${DESCRIPTION_MAX}`}
            error={errors.description?.[0]}
          >
            <textarea
              rows={4}
              maxLength={DESCRIPTION_MAX}
              placeholder="What is this project about? (optional)"
              className={`${control} resize-y py-2.5 leading-relaxed`}
              onInput={(event) => setDescriptionLength(event.currentTarget.value.length)}
              {...props("description")}
            />
          </Field>
        </Section>

        <Section title="Status & schedule">
          <Field id="status" label="Status" error={errors.status?.[0]}>
            <div className="relative">
              <select className={`${control} h-10 appearance-none pr-9`} {...props("status")}>
                {projectStatuses.map((value) => (
                  <option key={value} value={value}>
                    {statusLabels[value]}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="startDate" label="Start date" hint="Optional" error={errors.startDate?.[0]}>
              <input
                type="date"
                className={`${control} h-10`}
                onChange={(event) => setStartDate(event.currentTarget.value)}
                {...props("startDate")}
              />
            </Field>
            <Field id="dueDate" label="Due date" hint="Optional" error={liveDueError ?? errors.dueDate?.[0]}>
              <input
                type="date"
                className={`${control} h-10`}
                onChange={(event) => setDueDate(event.currentTarget.value)}
                {...props("dueDate", liveDueError ?? errors.dueDate?.[0])}
              />
            </Field>
          </div>
        </Section>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line bg-surface px-6 py-4">
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonClass("secondary", "lg")}>
            Cancel
          </button>
        ) : cancelHref ? (
          <Link href={cancelHref} className={buttonClass("secondary", "lg")}>
            Cancel
          </Link>
        ) : null}
        <button type="submit" disabled={pending} className={buttonClass("primary", "lg")}>
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
