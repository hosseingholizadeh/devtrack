const messages = {
  created: "Project created.",
  updated: "Project updated.",
  deleted: "Project deleted.",
} as const;

/** Success banner driven by the `?notice=` query param set by the Server Actions' redirects. */
export function ProjectNotice({ notice }: { notice: string | string[] | undefined }) {
  if (typeof notice !== "string" || !Object.hasOwn(messages, notice)) return null;
  return (
    <p
      role="status"
      className="mb-4 rounded-md bg-green-100 px-4 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-300"
    >
      {messages[notice as keyof typeof messages]}
    </p>
  );
}
