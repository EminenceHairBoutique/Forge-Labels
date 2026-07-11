"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createDocument } from "@/lib/document/defaults";
import type { LabelStyle } from "@/lib/geometry/label-calculator";
import { getStorageAdapter } from "@/lib/storage";
import { applyTemplate } from "@/lib/templates/apply";
import { getTemplate } from "@/lib/templates/registry";
import { getVialPreset } from "@/lib/vials/presets";

const VALID_STYLES: LabelStyle[] = [
  "full-wrap",
  "partial-wrap",
  "front-only",
  "front-back",
  "neck-band",
  "cap-circle",
];

/**
 * Creates a project from query params (used by the calculator's
 * "Design this label" hand-off) and forwards to the editor.
 */
function NewProjectWorker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startedRef = React.useRef(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const template = getTemplate(searchParams.get("template") ?? "");
        const presetId =
          searchParams.get("preset") ?? template?.presetId ?? "10ml-serum";
        const styleParam = searchParams.get("style") as LabelStyle | null;
        const d = Number(searchParams.get("d"));
        const h = Number(searchParams.get("h"));

        const preset = getVialPreset(presetId) ?? getVialPreset("custom")!;
        let doc = createDocument({
          preset,
          style:
            styleParam && VALID_STYLES.includes(styleParam)
              ? styleParam
              : preset.defaultLabelStyle,
          diameterMm: Number.isFinite(d) && d > 0 ? d : undefined,
          straightWallHeightMm: Number.isFinite(h) && h > 0 ? h : undefined,
        });
        if (template) {
          doc = applyTemplate(doc, template.doc);
        }
        const project = await getStorageAdapter().createProject({
          name: template ? `${template.name} — ${preset.name}` : `${preset.name} label`,
          doc,
        });
        router.replace(`/editor/${project.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't create the project.");
      }
    })();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          className="text-sm text-primary underline underline-offset-2"
          onClick={() => router.push("/dashboard")}
        >
          Back to projects
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Setting up your label canvas…
    </div>
  );
}

export default function NewProjectPage() {
  return (
    <React.Suspense fallback={null}>
      <NewProjectWorker />
    </React.Suspense>
  );
}
