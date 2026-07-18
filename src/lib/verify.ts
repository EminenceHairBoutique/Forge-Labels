import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import {
  parseFieldRows,
  sanitizeFieldRows,
  sha256Hex,
  type BatchFieldRow,
  type BatchRecord,
} from "./verify-core";

/**
 * Batch verification records (cloud mode only): tokened public pages a
 * label's QR code can point at. Rows live in `batch_records` under
 * owner-scoped RLS; anonymous visitors resolve tokens exclusively through
 * the `get_batch_record` security-definer RPC. COA files go to the public
 * `coa` bucket, fingerprinted client-side with SHA-256 before upload.
 */

const COLUMNS =
  "id,token,product_name,batch_code,fields,notice,coa_path,coa_sha256,published,created_at,updated_at";

interface BatchRow {
  id: string;
  token: string;
  product_name: string;
  batch_code: string;
  fields: unknown;
  notice: string | null;
  coa_path: string | null;
  coa_sha256: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

function toRecord(row: BatchRow): BatchRecord {
  return {
    id: row.id,
    token: row.token,
    productName: row.product_name,
    batchCode: row.batch_code,
    fields: parseFieldRows(row.fields),
    notice: row.notice,
    coaPath: row.coa_path,
    coaSha256: row.coa_sha256,
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function verifyUrl(token: string): string {
  return `${location.origin}/verify/${token}`;
}

export async function listBatchRecords(): Promise<BatchRecord[]> {
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error("Verification pages require cloud mode.");
  const { data, error } = await supabase
    .from("batch_records")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Couldn't load verification pages: ${error.message}`);
  return (data as BatchRow[]).map(toRecord);
}

export async function createBatchRecord(input: {
  productName: string;
  batchCode: string;
  fields: BatchFieldRow[];
  notice?: string;
}): Promise<BatchRecord> {
  const supabase = getSupabaseBrowser();
  const userId = useAuthStore.getState().user?.id;
  if (!supabase || !userId) throw new Error("Sign in to publish verification pages.");
  const { data, error } = await supabase
    .from("batch_records")
    .insert({
      owner_id: userId,
      product_name: input.productName.trim().slice(0, 200),
      batch_code: input.batchCode.trim().slice(0, 120),
      fields: sanitizeFieldRows(input.fields),
      notice: input.notice?.trim() ? input.notice.trim().slice(0, 600) : null,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`Couldn't publish the page: ${error.message}`);
  return toRecord(data as BatchRow);
}

export async function setBatchPublished(id: string, published: boolean): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error("Verification pages require cloud mode.");
  const { error } = await supabase
    .from("batch_records")
    .update({ published, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Couldn't update the page: ${error.message}`);
}

export async function deleteBatchRecord(record: BatchRecord): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error("Verification pages require cloud mode.");
  if (record.coaPath) {
    // Best effort — an orphaned file can't resolve without its record.
    await supabase.storage.from("coa").remove([record.coaPath]);
  }
  const { error } = await supabase.from("batch_records").delete().eq("id", record.id);
  if (error) throw new Error(`Couldn't delete the page: ${error.message}`);
}

/**
 * Upload a COA PDF for a record: hash first (the page shows the SHA-256
 * so recipients can check what they downloaded), then store at the
 * owner-namespaced path and stamp the record.
 */
export async function attachCoa(record: BatchRecord, file: File): Promise<BatchRecord> {
  const supabase = getSupabaseBrowser();
  const userId = useAuthStore.getState().user?.id;
  if (!supabase || !userId) throw new Error("Sign in to attach a COA.");
  if (file.type !== "application/pdf") {
    throw new Error("COA files must be PDFs.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("COA files are capped at 10 MB.");
  }
  const bytes = await file.arrayBuffer();
  const sha = await sha256Hex(bytes);
  const path = `${userId}/${record.id}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("coa")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error(`COA upload failed: ${uploadError.message}`);
  const { data, error } = await supabase
    .from("batch_records")
    .update({ coa_path: path, coa_sha256: sha, updated_at: new Date().toISOString() })
    .eq("id", record.id)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`Couldn't attach the COA: ${error.message}`);
  return toRecord(data as BatchRow);
}
