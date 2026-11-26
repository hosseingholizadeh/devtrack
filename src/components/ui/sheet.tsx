"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "../icons";
import { buttonClass } from "./button";

type Props = {
  title: string;
  description?: string;
  /** "sheet" slides in from the right (forms); "modal" is a small centred dialog (confirmations). */
  variant?: "sheet" | "modal";
  onClose: () => void;
  /** Content can close the dialog by unmounting it (the owner's `open` state), e.g. from a Cancel button. */
  children: ReactNode;
};

/**
 * Accessible dialog on the native <dialog> element: focus trap, Escape to close and a backdrop for free.
 * Mount it only while open; closing (Escape, backdrop, X, Cancel) calls `onClose`.
 */
export function Sheet({ title, description, variant = "sheet", onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }, []);

  function close() {
    const dialog = ref.current;
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else {
      dialog.removeAttribute("open");
      onClose();
    }
  }

  const isSheet = variant === "sheet";
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) close(); // click on the backdrop
      }}
      aria-labelledby="sheet-title"
      className={
        isSheet
          ? "animate-sheet m-0 ml-auto h-dvh max-h-none w-full max-w-lg border-l border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
          : "animate-pop m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
      }
    >
      <div className={isSheet ? "flex h-full flex-col" : "flex flex-col"}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h2 id="sheet-title" className="text-base font-semibold">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className={`${buttonClass("ghost")} -mr-2 size-8 !px-0`}
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
