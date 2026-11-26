"use client";

import { useActionState, useState } from "react";
import { AlertIcon, TrashIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { initialDeleteState, type DeleteProjectState } from "../action-state";

type Props = {
  projectName: string;
  action: (prev: DeleteProjectState, formData: FormData) => Promise<DeleteProjectState>;
};

export function DeleteProjectButton({ projectName, action }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialDeleteState);

  return (
    <>
      <button type="button" onClick={() => setConfirming(true)} className={buttonClass("dangerOutline")}>
        <TrashIcon />
        Delete
      </button>
      {confirming ? (
        <Sheet title="Delete project?" variant="modal" onClose={() => setConfirming(false)}>
          <form action={formAction}>
            <div className="flex gap-3 px-6 py-5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
                <AlertIcon />
              </div>
              <p className="text-sm leading-relaxed text-muted">
                <span className="font-medium text-ink">&ldquo;{projectName}&rdquo;</span> will be permanently
                deleted. This cannot be undone.
              </p>
            </div>
            {state.message ? (
              <p role="alert" className="mx-6 mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
                {state.message}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirming(false)}
                className={buttonClass("secondary", "lg")}
              >
                Cancel
              </button>
              <button type="submit" disabled={pending} className={buttonClass("danger", "lg")}>
                {pending ? "Deleting…" : "Delete project"}
              </button>
            </div>
          </form>
        </Sheet>
      ) : null}
    </>
  );
}
