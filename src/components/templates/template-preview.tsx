"use client";

import * as React from "react";
import type { LabelDocument } from "@/lib/document/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Renders a template document to an image through the real render pipeline
 * (same pixels the editor produces). The Konva-based renderer is imported
 * lazily so marketing pages don't ship the canvas engine up front; results
 * are cached per template id.
 */
const previewCache = new Map<string, Promise<string>>();

function renderPreview(id: string, doc: LabelDocument): Promise<string> {
  let cached = previewCache.get(id);
  if (!cached) {
    cached = import("@/lib/export/raster").then(({ renderThumbnail }) =>
      renderThumbnail(doc, 640),
    );
    previewCache.set(id, cached);
    cached.catch(() => previewCache.delete(id));
  }
  return cached;
}

interface TemplatePreviewProps {
  templateId: string;
  doc: LabelDocument;
  alt: string;
  className?: string;
}

export function TemplatePreview({ templateId, doc, alt, className }: TemplatePreviewProps) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    renderPreview(templateId, doc)
      .then((dataUrl) => {
        if (!cancelled) setUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [templateId, doc]);

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-xs text-muted-foreground",
          className,
        )}
      >
        Preview unavailable
      </div>
    );
  }

  if (!url) return <Skeleton className={className} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- generated data URL
    <img src={url} alt={alt} className={cn("object-contain", className)} />
  );
}
