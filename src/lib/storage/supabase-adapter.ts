"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { migrateDocument } from "@/lib/document/migrate";
import { newEntityId } from "@/lib/document/ids";
import type { LabelDocument } from "@/lib/document/schema";
import type {
  AssetRecord,
  BrandKitRecord,
  CreateProjectInput,
  ExportRecord,
  ProjectRecord,
  ProjectSummary,
  ProjectVersion,
  StorageAdapter,
  StorageCapabilities,
} from "./types";

/**
 * Cloud adapter: all reads/writes go directly from the browser to Supabase
 * under Row Level Security (owner-scoped policies). Binary assets live in
 * the private `user-assets` bucket keyed `{uid}/{assetId}`; reads use
 * short-lived signed URLs.
 */

interface ProjectRow {
  id: string;
  name: string;
  tags: string[];
  doc: unknown;
  thumbnail: string | null;
  label_width_mm: number;
  label_height_mm: number;
  vial_preset_id: string | null;
  created_at: string;
  updated_at: string;
}

function toSummary(row: ProjectRow): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    tags: row.tags ?? [],
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
    thumbnail: row.thumbnail,
    labelSizeMm: { width: Number(row.label_width_mm), height: Number(row.label_height_mm) },
    vialName: row.vial_preset_id,
  };
}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

export class SupabaseAdapter implements StorageAdapter {
  readonly capabilities: StorageCapabilities;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly userId: string,
  ) {
    this.capabilities = {
      mode: "cloud",
      auth: true,
      cloudSync: true,
      billing: Boolean(process.env.NEXT_PUBLIC_STRIPE_ENABLED === "1"),
      sharing: false, // share-link UI ships in a later phase
    };
  }

  // --- Projects ------------------------------------------------------------

  async listProjects(): Promise<ProjectSummary[]> {
    const { data, error } = await this.supabase
      .from("projects")
      .select(
        "id,name,tags,thumbnail,label_width_mm,label_height_mm,vial_preset_id,created_at,updated_at,doc",
      )
      .order("updated_at", { ascending: false });
    if (error) fail("Couldn't load projects", error);
    return (data as ProjectRow[]).map(toSummary);
  }

  async getProject(id: string): Promise<ProjectRecord | null> {
    const { data, error } = await this.supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) fail("Couldn't load the project", error);
    if (!data) return null;
    const row = data as ProjectRow;
    const doc = migrateDocument(row.doc);
    return { ...toSummary(row), doc };
  }

  async createProject(input: CreateProjectInput): Promise<ProjectRecord> {
    const { data, error } = await this.supabase
      .from("projects")
      .insert({
        owner_id: this.userId,
        name: input.name,
        tags: input.tags ?? [],
        doc: input.doc,
        label_width_mm: input.doc.label.widthMm,
        label_height_mm: input.doc.label.heightMm,
        vial_preset_id: input.doc.vial.presetId,
      })
      .select("*")
      .single();
    if (error) fail("Couldn't create the project", error);
    const row = data as ProjectRow;
    return { ...toSummary(row), doc: input.doc };
  }

  async saveProjectDoc(
    id: string,
    doc: LabelDocument,
    thumbnail?: string | null,
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      doc,
      label_width_mm: doc.label.widthMm,
      label_height_mm: doc.label.heightMm,
      vial_preset_id: doc.vial.presetId,
    };
    if (thumbnail !== undefined) patch.thumbnail = thumbnail;
    const { error } = await this.supabase.from("projects").update(patch).eq("id", id);
    if (error) fail("Couldn't save the project", error);
  }

  async updateProjectMeta(
    id: string,
    patch: Partial<Pick<ProjectRecord, "name" | "tags">>,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("projects")
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      })
      .eq("id", id);
    if (error) fail("Couldn't update the project", error);
  }

  async duplicateProject(id: string): Promise<ProjectRecord> {
    const source = await this.getProject(id);
    if (!source) throw new Error("Project not found");
    return this.createProject({
      name: `${source.name} copy`,
      doc: source.doc,
      tags: source.tags,
    });
  }

  async deleteProject(id: string): Promise<void> {
    const { error } = await this.supabase.from("projects").delete().eq("id", id);
    if (error) fail("Couldn't delete the project", error);
  }

  // --- Versions --------------------------------------------------------------

  async saveVersion(projectId: string, reason: string): Promise<ProjectVersion> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error("Project not found");
    const { data, error } = await this.supabase
      .from("project_versions")
      .insert({
        project_id: projectId,
        owner_id: this.userId,
        reason,
        doc: project.doc,
      })
      .select("id,created_at")
      .single();
    if (error) fail("Couldn't save the version", error);
    return {
      id: data.id as string,
      projectId,
      createdAt: Date.parse(data.created_at as string),
      reason,
      doc: project.doc,
    };
  }

  async listVersions(projectId: string): Promise<Omit<ProjectVersion, "doc">[]> {
    const { data, error } = await this.supabase
      .from("project_versions")
      .select("id,reason,created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) fail("Couldn't load versions", error);
    return data.map((row) => ({
      id: row.id as string,
      projectId,
      createdAt: Date.parse(row.created_at as string),
      reason: row.reason as string,
    }));
  }

  async getVersion(projectId: string, versionId: string): Promise<ProjectVersion | null> {
    const { data, error } = await this.supabase
      .from("project_versions")
      .select("*")
      .eq("id", versionId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) fail("Couldn't load the version", error);
    if (!data) return null;
    return {
      id: data.id as string,
      projectId,
      createdAt: Date.parse(data.created_at as string),
      reason: data.reason as string,
      doc: migrateDocument(data.doc),
    };
  }

  // --- Assets ------------------------------------------------------------------

  private assetPath(assetId: string): string {
    return `${this.userId}/${assetId}`;
  }

  async putAsset(blob: Blob, meta: { name: string }): Promise<AssetRecord> {
    const assetId = newEntityId();
    let width: number | null = null;
    let height: number | null = null;
    if (blob.type.startsWith("image/") && typeof createImageBitmap === "function") {
      try {
        const bmp = await createImageBitmap(blob);
        width = bmp.width;
        height = bmp.height;
        bmp.close();
      } catch {
        // Non-decodable image; dimensions stay unknown.
      }
    }

    const { error: uploadError } = await this.supabase.storage
      .from("user-assets")
      .upload(this.assetPath(assetId), blob, { contentType: blob.type });
    if (uploadError) fail("Couldn't upload the image", uploadError);

    const { data, error } = await this.supabase
      .from("assets")
      .insert({
        id: assetId,
        owner_id: this.userId,
        name: meta.name,
        mime_type: blob.type,
        byte_size: blob.size,
        width,
        height,
        storage_path: this.assetPath(assetId),
      })
      .select("created_at")
      .single();
    if (error) fail("Couldn't record the asset", error);

    return {
      id: assetId,
      name: meta.name,
      mimeType: blob.type,
      byteSize: blob.size,
      width,
      height,
      createdAt: Date.parse(data.created_at as string),
    };
  }

  async getAssetBlob(id: string): Promise<Blob | null> {
    const { data, error } = await this.supabase.storage
      .from("user-assets")
      .download(this.assetPath(id));
    if (error) return null;
    return data;
  }

  async listAssets(): Promise<AssetRecord[]> {
    const { data, error } = await this.supabase
      .from("assets")
      .select("id,name,mime_type,byte_size,width,height,created_at")
      .order("created_at", { ascending: false });
    if (error) fail("Couldn't load assets", error);
    return data.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      mimeType: row.mime_type as string,
      byteSize: row.byte_size as number,
      width: row.width as number | null,
      height: row.height as number | null,
      createdAt: Date.parse(row.created_at as string),
    }));
  }

  async deleteAsset(id: string): Promise<void> {
    await this.supabase.storage.from("user-assets").remove([this.assetPath(id)]);
    const { error } = await this.supabase.from("assets").delete().eq("id", id);
    if (error) fail("Couldn't delete the asset", error);
  }

  // --- Brand kits -----------------------------------------------------------------

  async listBrandKits(): Promise<BrandKitRecord[]> {
    const { data, error } = await this.supabase
      .from("brand_kits")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) fail("Couldn't load brand kits", error);
    return data.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      colors: (row.colors ?? []) as string[],
      fontFamilyIds: (row.font_family_ids ?? []) as string[],
      logoAssetIds: (row.logo_asset_ids ?? []) as string[],
      contact: (row.contact ?? {}) as BrandKitRecord["contact"],
      standardWarnings: (row.standard_warnings ?? []) as string[],
      createdAt: Date.parse(row.created_at as string),
      updatedAt: Date.parse(row.updated_at as string),
    }));
  }

  async saveBrandKit(
    kit: Omit<BrandKitRecord, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ): Promise<BrandKitRecord> {
    const row = {
      owner_id: this.userId,
      name: kit.name,
      colors: kit.colors,
      font_family_ids: kit.fontFamilyIds,
      logo_asset_ids: kit.logoAssetIds,
      contact: kit.contact,
      standard_warnings: kit.standardWarnings,
      ...(kit.id ? { id: kit.id } : {}),
    };
    const { data, error } = await this.supabase
      .from("brand_kits")
      .upsert(row)
      .select("id,created_at,updated_at")
      .single();
    if (error) fail("Couldn't save the brand kit", error);
    return {
      ...kit,
      id: data.id as string,
      createdAt: Date.parse(data.created_at as string),
      updatedAt: Date.parse(data.updated_at as string),
    };
  }

  async deleteBrandKit(id: string): Promise<void> {
    const { error } = await this.supabase.from("brand_kits").delete().eq("id", id);
    if (error) fail("Couldn't delete the brand kit", error);
  }

  // --- Export history ---------------------------------------------------------------

  async recordExport(entry: Omit<ExportRecord, "id" | "createdAt">): Promise<void> {
    // History is best-effort; never block a download on it.
    await this.supabase.from("export_jobs").insert({
      owner_id: this.userId,
      project_id: entry.projectId,
      project_name: entry.projectName,
      kind: entry.kind,
      file_name: entry.fileName,
      byte_size: entry.byteSize,
      dpi: entry.dpi,
    });
  }

  async listExports(): Promise<ExportRecord[]> {
    const { data, error } = await this.supabase
      .from("export_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) fail("Couldn't load export history", error);
    return data.map((row) => ({
      id: row.id as string,
      projectId: row.project_id as string | null,
      projectName: row.project_name as string,
      kind: row.kind as ExportRecord["kind"],
      fileName: row.file_name as string,
      byteSize: row.byte_size as number,
      dpi: row.dpi as number | null,
      createdAt: Date.parse(row.created_at as string),
    }));
  }
}
