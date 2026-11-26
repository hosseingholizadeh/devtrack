"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FolderIcon, LogoMark, MenuIcon } from "../icons";

const navItems = [{ href: "/projects", label: "Projects", icon: FolderIcon }];

function Brand() {
  return (
    <Link href="/projects" className="flex items-center gap-2.5 rounded-lg px-1 py-1">
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">DevTrack</span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {navItems.map(({ href, label, icon: ItemIcon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors ${
              active ? "bg-accent-soft text-accent" : "text-muted hover:bg-subtle hover:text-ink"
            }`}
          >
            <ItemIcon className={active ? "" : "opacity-80 group-hover:opacity-100"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Persistent sidebar on desktop; top bar + slide-in drawer on mobile. */
export function Sidebar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface px-3 py-4 md:flex">
        <Brand />
        <NavLinks />
      </aside>

      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur md:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-ink"
        >
          <MenuIcon />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="animate-drawer absolute inset-y-0 left-0 flex w-64 flex-col gap-6 border-r border-line bg-surface px-3 py-4 shadow-2xl">
            <Brand />
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
