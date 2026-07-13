/**
 * Small RFC-4180-ish CSV parser for batch imports. Handles quoted fields
 * with `""` escapes, embedded commas/newlines, BOM, CRLF/CR/LF endings,
 * semicolon-delimited exports (sniffed from the header line), ragged rows,
 * and duplicate headers — leniently, reporting problems instead of throwing.
 * No dependency: the format's dark corners are few and a state machine keeps
 * them testable.
 */

export interface CsvError {
  /** 1-based data-row number (0 = header). */
  row: number;
  message: string;
}

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
  errors: CsvError[];
  truncated: boolean;
}

export const MAX_BATCH_ROWS = 300;

function sniffDelimiter(text: string): "," | ";" {
  const firstLine = text.slice(0, text.search(/\r|\n|$/));
  // Semicolon exports (common from EU spreadsheets) contain ; and no ,.
  return firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
}

export function parseCsv(
  text: string,
  options: { maxRows?: number } = {},
): CsvParseResult {
  const maxRows = options.maxRows ?? MAX_BATCH_ROWS;
  const errors: CsvError[] = [];

  let input = text;
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1); // strip BOM
  const delimiter = sniffDelimiter(input);

  // State machine over characters.
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    record.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    records.push(record);
    record = [];
  };

  while (i < input.length) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      if (field.length === 0) {
        inQuotes = true;
      } else {
        // Stray quote mid-field: take it literally, note it once per row.
        field += ch;
        errors.push({
          row: records.length,
          message: "Unexpected quote inside an unquoted field; taken literally.",
        });
      }
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      endField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      endRecord();
      i += input[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    if (ch === "\n") {
      endRecord();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (inQuotes) {
    errors.push({ row: records.length, message: "Unterminated quoted field." });
  }
  if (field.length > 0 || record.length > 0) endRecord();

  // Drop a fully-empty trailing record (file ended with a newline).
  if (records.length > 0 && records[records.length - 1]!.every((f) => f === "")) {
    records.pop();
  }

  if (records.length === 0) {
    return { headers: [], rows: [], errors: [{ row: 0, message: "The file is empty." }], truncated: false };
  }

  // Headers: trim, fill blanks, dedupe as name_2, name_3…
  const seen = new Map<string, number>();
  const headers = records[0]!.map((raw, index) => {
    let name = raw.trim() || `column_${index + 1}`;
    const count = seen.get(name.toLowerCase()) ?? 0;
    seen.set(name.toLowerCase(), count + 1);
    if (count > 0) {
      errors.push({
        row: 0,
        message: `Duplicate header "${name}" renamed to "${name}_${count + 1}".`,
      });
      name = `${name}_${count + 1}`;
    }
    return name;
  });

  let truncated = false;
  const rows: string[][] = [];
  for (let r = 1; r < records.length; r++) {
    if (rows.length >= maxRows) {
      truncated = true;
      errors.push({
        row: r,
        message: `Row limit reached — only the first ${maxRows} rows are used.`,
      });
      break;
    }
    const rec = records[r]!;
    if (rec.every((f) => f === "")) continue; // skip blank lines
    if (rec.length !== headers.length) {
      errors.push({
        row: r,
        message: `Row has ${rec.length} field${rec.length === 1 ? "" : "s"}, expected ${headers.length}; ${rec.length < headers.length ? "padded" : "extra fields dropped"}.`,
      });
    }
    const normalized = headers.map((_, c) => rec[c] ?? "");
    rows.push(normalized);
  }

  return { headers, rows, errors, truncated };
}
