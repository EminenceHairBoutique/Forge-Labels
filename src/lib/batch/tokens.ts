import type { LabelDocument, LabelObject } from "@/lib/document/schema";

/**
 * Dynamic-field tokens: `{{column}}` placeholders inside text content, QR
 * values, and barcode values. Tokens are plain string content — no schema
 * change — rendered literally in the editor and substituted per CSV row at
 * batch-export time. Unknown tokens stay literal (visible beats silent).
 */

export const TOKEN_RE = /\{\{\s*([A-Za-z0-9_][A-Za-z0-9_ .\-]*?)\s*\}\}/g;

export type TokenField = "text" | "qr-value" | "barcode-value";

export interface TokenRef {
  objectId: string;
  objectName: string;
  field: TokenField;
  token: string;
}

function tokensIn(value: string): string[] {
  const re = new RegExp(TOKEN_RE.source, "g");
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) found.push(m[1]!);
  return found;
}

export function hasTokens(value: string): boolean {
  return new RegExp(TOKEN_RE.source).test(value);
}

/** Every token reference in the document, in z-order (groups walked). */
export function extractTokens(doc: LabelDocument): TokenRef[] {
  const refs: TokenRef[] = [];
  const walk = (objects: readonly LabelObject[]) => {
    for (const obj of objects) {
      const name = obj.name || obj.type;
      if (obj.type === "text") {
        for (const token of tokensIn(obj.text)) {
          refs.push({ objectId: obj.id, objectName: name, field: "text", token });
        }
      } else if (obj.type === "qrcode") {
        for (const token of tokensIn(obj.value)) {
          refs.push({ objectId: obj.id, objectName: name, field: "qr-value", token });
        }
      } else if (obj.type === "barcode") {
        for (const token of tokensIn(obj.value)) {
          refs.push({
            objectId: obj.id,
            objectName: name,
            field: "barcode-value",
            token,
          });
        }
      } else if (obj.type === "group") {
        walk(obj.children);
      }
    }
  };
  walk(doc.objects);
  return refs;
}

export function uniqueTokens(refs: TokenRef[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ref of refs) {
    const key = ref.token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref.token);
  }
  return out;
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

function substituteString(value: string, record: Record<string, string>): string {
  const lookup = new Map<string, string>();
  for (const [key, v] of Object.entries(record)) lookup.set(normalizeKey(key), v);
  return value.replace(new RegExp(TOKEN_RE.source, "g"), (whole, token: string) => {
    const replacement = lookup.get(normalizeKey(token));
    return replacement !== undefined ? replacement : whole;
  });
}

/**
 * Pure substitution: returns a new document with every token replaced from
 * the record (case- and whitespace-insensitive key match); untouched objects
 * keep their references (structural sharing).
 */
export function substituteTokens(
  doc: LabelDocument,
  record: Record<string, string>,
): LabelDocument {
  const mapObjects = (objects: readonly LabelObject[]): LabelObject[] => {
    let changed = false;
    const next = objects.map((obj): LabelObject => {
      if (obj.type === "text" && hasTokens(obj.text)) {
        changed = true;
        return { ...obj, text: substituteString(obj.text, record) };
      }
      if ((obj.type === "qrcode" || obj.type === "barcode") && hasTokens(obj.value)) {
        changed = true;
        return { ...obj, value: substituteString(obj.value, record) };
      }
      if (obj.type === "group") {
        const children = mapObjects(obj.children);
        if (children !== obj.children) {
          changed = true;
          return { ...obj, children };
        }
      }
      return obj;
    });
    return changed ? next : (objects as LabelObject[]);
  };

  const objects = mapObjects(doc.objects);
  return objects === doc.objects ? doc : { ...doc, objects };
}
