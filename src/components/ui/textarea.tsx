"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-16 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-xs transition-colors",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-0 focus-visible:border-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
