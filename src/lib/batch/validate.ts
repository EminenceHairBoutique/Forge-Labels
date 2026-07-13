import type { LabelDocument, LabelObject } from "@/lib/document/schema";
import { createQrMatrix } from "@/lib/codes/qr";
import { validateBarcodeValue } from "@/lib/codes/validate";
import { substituteTokens, type TokenRef } from "./tokens";

/**
 * Per-row validation for batch export: substitute the row, then check that
 * every tokenized object still produces valid output (QR encodable, barcode
 * check digits, non-empty text).
 */

export interface RowIssue {
  /** 0-based data-row index. */
  rowIndex: number;
  objectId: string;
  objectName: string;
  severity: "error" | "warning";
  message: string;
}

export function recordForRow(
  headers: string[],
  row: string[],
): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((header, index) => {
    record[header] = row[index] ?? "";
  });
  return record;
}

export function validateRow(
  doc: LabelDocument,
  refs: TokenRef[],
  record: Record<string, string>,
  rowIndex: number,
): RowIssue[] {
  const issues: RowIssue[] = [];
  const substituted = substituteTokens(doc, record);
  const tokenizedIds = new Set(refs.map((r) => r.objectId));

  const visit = (objects: readonly LabelObject[]) => {
    for (const obj of objects) {
      if (obj.type === "group") {
        visit(obj.children);
        continue;
      }
      if (!tokenizedIds.has(obj.id)) continue;
      const name = obj.name || obj.type;

      if (obj.type === "text" && obj.text.trim() === "") {
        issues.push({
          rowIndex,
          objectId: obj.id,
          objectName: name,
          severity: "warning",
          message: "resolves to empty text",
        });
      } else if (obj.type === "qrcode") {
        if (obj.value.trim() === "") {
          issues.push({
            rowIndex,
            objectId: obj.id,
            objectName: name,
            severity: "error",
            message: "QR value resolves to empty",
          });
        } else {
          try {
            createQrMatrix(obj.value, obj.ecLevel);
          } catch (err) {
            issues.push({
              rowIndex,
              objectId: obj.id,
              objectName: name,
              severity: "error",
              message: err instanceof Error ? err.message : "QR value cannot be encoded",
            });
          }
        }
      } else if (obj.type === "barcode") {
        const validation = validateBarcodeValue(obj.symbology, obj.value);
        if (!validation.ok) {
          issues.push({
            rowIndex,
            objectId: obj.id,
            objectName: name,
            severity: "error",
            message: validation.message ?? "invalid barcode value",
          });
        }
      }
    }
  };
  visit(substituted.objects);
  return issues;
}
