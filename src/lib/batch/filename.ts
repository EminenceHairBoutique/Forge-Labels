/**
 * Batch file naming: sanitized project base + row number by default, or a
 * chosen CSV column (sanitized, collision-suffixed) when one is selected.
 */

export function sanitizeFileName(name: string): string {
  return (
    name
      .trim()
      .replaceAll(/[^\w\- ]+/g, "")
      .replaceAll(/\s+/g, "-")
      .slice(0, 60) || "label"
  );
}

export function rowFileName(
  baseName: string,
  rowIndex: number,
  filenameValue: string | undefined,
  used: Set<string>,
): string {
  let stem: string;
  if (filenameValue !== undefined && filenameValue.trim() !== "") {
    stem = `${baseName}-${sanitizeFileName(filenameValue)}`;
  } else {
    stem = `${baseName}-row-${String(rowIndex + 1).padStart(3, "0")}`;
  }
  let candidate = `${stem}.png`;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${stem}-${suffix}.png`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}
