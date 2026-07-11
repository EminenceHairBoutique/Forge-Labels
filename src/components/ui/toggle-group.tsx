"use client";

import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const ToggleGroup = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn(
      "inline-flex items-center gap-0.5 rounded-lg bg-muted p-1",
      className,
    )}
    {...props}
  />
));
ToggleGroup.displayName = "ToggleGroup";

const ToggleGroupItem = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      "inline-flex min-w-8 items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium text-muted-foreground cursor-pointer transition-colors",
      "hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=on]:bg-surface data-[state=on]:text-foreground data-[state=on]:shadow-xs",
      "[&_svg]:size-4 [&_svg]:shrink-0",
      className,
    )}
    {...props}
  >
    {children}
  </ToggleGroupPrimitive.Item>
));
ToggleGroupItem.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem };
