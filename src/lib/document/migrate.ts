import {
  DOCUMENT_SCHEMA_VERSION,
  parseLabelDocument,
  type LabelDocument,
} from "./schema";

/**
 * Migrates a stored document of any prior schemaVersion to the current one,
 * then validates it. Saved projects must never break on upgrade: when the
 * schema changes, bump DOCUMENT_SCHEMA_VERSION and add a step here.
 */
export function migrateDocument(raw: unknown): LabelDocument {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Not a label document");
  }
  const data = { ...(raw as Record<string, unknown>) };
  const version = typeof data.schemaVersion === "number" ? data.schemaVersion : 0;

  if (version > DOCUMENT_SCHEMA_VERSION) {
    throw new Error(
      `This project was saved by a newer version of Forge Labels (schema ${version}). Update the app to open it.`,
    );
  }

  // Migration chain: each step upgrades exactly one version.
  // e.g. if (version < 2) { …reshape…; data.schemaVersion = 2; }
  if (version < DOCUMENT_SCHEMA_VERSION) {
    // Version 0 never shipped; treat anything below 1 as v1 with defaults.
    data.schemaVersion = DOCUMENT_SCHEMA_VERSION;
  }

  return parseLabelDocument(data);
}
