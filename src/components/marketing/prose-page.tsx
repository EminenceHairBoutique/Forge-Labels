import { cn } from "@/lib/utils";

interface ProsePageProps {
  title: string;
  lead?: string;
  updated?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Shared long-form layout for legal pages and guides: consistent heading,
 * optional "last updated" line, and typographic prose styles.
 */
export function ProsePage({ title, lead, updated, children, className }: ProsePageProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {updated && (
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
      )}
      {lead && <p className="mt-4 text-lg text-muted-foreground">{lead}</p>}
      <div
        className={cn(
          "prose prose-neutral mt-8 max-w-none dark:prose-invert",
          "prose-headings:font-display prose-headings:tracking-tight",
          "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
          "prose-li:marker:text-muted-foreground",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
