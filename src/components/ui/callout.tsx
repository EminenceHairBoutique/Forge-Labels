import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const calloutVariants = cva(
  "flex gap-3 rounded-lg border p-3.5 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        info: "border-primary/25 bg-primary-subtle/60 text-foreground [&>svg]:text-primary",
        warning:
          "border-warning/40 bg-warning/10 text-foreground [&>svg]:text-warning-foreground",
        destructive:
          "border-destructive/30 bg-destructive/8 text-foreground [&>svg]:text-destructive",
        success:
          "border-success/30 bg-success/10 text-foreground [&>svg]:text-success",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const ICONS = {
  info: Info,
  warning: AlertTriangle,
  destructive: OctagonAlert,
  success: CheckCircle2,
} as const;

export interface CalloutProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof calloutVariants> {
  title?: string;
}

function Callout({ className, variant = "info", title, children, ...props }: CalloutProps) {
  const Icon = ICONS[variant ?? "info"];
  return (
    <div role="note" className={cn(calloutVariants({ variant }), className)} {...props}>
      <Icon aria-hidden />
      <div className="space-y-1">
        {title && <p className="font-medium leading-tight">{title}</p>}
        <div className="text-muted-foreground [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline">
          {children}
        </div>
      </div>
    </div>
  );
}

export { Callout };
