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
  // (Version 0 never shipped; anything below 1 is treated as v1.)
  if (version < 2) {
    // v2 added the optional semantic `slot` marker on objects and the
    // optional `easy` block on the document — pure additions, so v1
    // documents need only the version stamp.
    data.schemaVersion = 2;
  }
  if (version < 3) {
    // v3 added optional easy-meta fields (pairingId, placement, logoAspect)
    // — pure additions again; stamp only.
    data.schemaVersion = 3;
  }
  if (version < 4) {
    // v4 added research-label easy-meta fields (industry, densityMode,
    // noticeId, noticeReviewedAt, complianceAck) and 14 research slots —
    // all optional additions; stamp only.
    data.schemaVersion = 4;
  }
  if (version < 5) {
    // v5 added optional easy-meta qrStyle and customPalette (logo-derived
    // colors) — pure additions; stamp only.
    data.schemaVersion = 5;
  }

  return parseLabelDocument(data);
}
