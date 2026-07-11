"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import type { LabelDocument } from "@/lib/document/schema";
import {
  runPreflight,
  preflightSummary,
  type PreflightIssue,
} from "@/lib/preflight/rules";
import { useEditorUiStore } from "@/stores/editor-ui-store";
import { cn } from "@/lib/utils";

const SEVERITY_META = {
  error: { icon: OctagonAlert, className: "text-destructive", label: "Error" },
  warning: { icon: AlertTriangle, className: "text-warning-foreground", label: "Warning" },
  info: { icon: Info, className: "text-primary", label: "Note" },
} as const;

interface PreflightPanelProps {
  doc: LabelDocument;
  /** Called after click-to-jump so containers (dialogs) can close. */
  onJump?: () => void;
}

export function PreflightPanel({ doc, onJump }: PreflightPanelProps) {
  const issues = React.useMemo(() => runPreflight(doc), [doc]);
  const summary = preflightSummary(issues);
  const setSelection = useEditorUiStore((s) => s.setSelection);
  const setSidebarTab = useEditorUiStore((s) => s.setSidebarTab);

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
        <CheckCircle2 className="size-4 text-success" aria-hidden />
        Print check passed — no issues found.
      </div>
    );
  }

  const jumpTo = (issue: PreflightIssue) => {
    if (!issue.objectId) return;
    setSelection([issue.objectId]);
    setSidebarTab("properties");
    onJump?.();
  };

  return (
    <div className="space-y-2">
      <p className="text-sm">
        Print check:{" "}
        <span className={summary.errors > 0 ? "font-medium text-destructive" : "hidden"}>
          {summary.errors} error{summary.errors === 1 ? "" : "s"}
        </span>
        {summary.errors > 0 && (summary.warnings > 0 || summary.infos > 0) && " · "}
        {summary.warnings > 0 && (
          <span className="font-medium text-warning-foreground">
            {summary.warnings} warning{summary.warnings === 1 ? "" : "s"}
          </span>
        )}
        {summary.warnings > 0 && summary.infos > 0 && " · "}
        {summary.infos > 0 && (
          <span className="text-muted-foreground">
            {summary.infos} note{summary.infos === 1 ? "" : "s"}
          </span>
        )}
      </p>
      <ul className="max-h-56 space-y-1 overflow-y-auto pr-1" aria-label="Print check issues">
        {issues.map((issue, index) => {
          const meta = SEVERITY_META[issue.severity];
          const clickable = Boolean(issue.objectId);
          return (
            <li key={`${issue.ruleId}-${issue.objectId ?? index}`}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => jumpTo(issue)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md border border-border bg-surface p-2 text-left text-xs",
                  clickable && "cursor-pointer transition-colors hover:border-primary/50",
                )}
              >
                <meta.icon
                  className={cn("mt-0.5 size-3.5 shrink-0", meta.className)}
                  aria-label={meta.label}
                />
                <span className="flex-1">{issue.message}</span>
                {clickable && (
                  <span className="shrink-0 text-[10px] text-primary underline-offset-2">
                    Show
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
