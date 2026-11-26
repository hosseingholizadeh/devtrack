const base =
  "inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60";

const variants = {
  primary: "bg-accent text-accent-fg shadow-sm hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-ink shadow-sm hover:bg-subtle",
  ghost: "text-muted hover:bg-subtle hover:text-ink",
  danger: "bg-danger text-white shadow-sm hover:opacity-90",
  dangerOutline: "border border-danger/30 bg-surface text-danger hover:bg-danger-soft",
} as const;

const sizes = { md: "h-9 px-3.5", lg: "h-10 px-4" } as const;

export function buttonClass(variant: keyof typeof variants = "primary", size: keyof typeof sizes = "md") {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}
