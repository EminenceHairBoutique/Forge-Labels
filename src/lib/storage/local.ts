import { openDB, type DBSchema, type IDBPDatabase } from "idb";
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
 * IndexedDB-backed adapter for local demo mode. Everything stays in the
 * user's browser; the UI shows a persistent "local mode" banner.
 */

const MAX_VERSIONS_PER_PROJECT = 25;

interface StoredProject {
  id: string;
  name: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  thumbnail: string | null;
  doc: unknown;
}

interface ForgeDb extends DBSchema {
  projects: { key: string; value: StoredProject; indexes: { updatedAt: number } };
  versions: {
    key: string;
    value: {
      id: string;
      projectId: string;
      createdAt: number;
      reason: string;
      doc: unknown;
    };
    indexes: { projectId: string };
  };
  assets: {
    key: string;
    value: AssetRecord & { blob: Blob };
  };
  brandKits: { key: string; value: BrandKitRecord };
  exports: { key: string; value: ExportRecord; indexes: { createdAt: number } };
}

function summarize(p: StoredProject, doc: LabelDocument | null): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    tags: p.tags,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    thumbnail: p.thumbnail,
    labelSizeMm: doc
      ? { width: doc.label.widthMm, height: doc.label.heightMm }
      : { width: 0, height: 0 },
    vialName: doc?.vial.presetId ?? null,
    orgId: null,
  };
}

export class LocalAdapter implements StorageAdapter {
  readonly capabilities: StorageCapabilities = {
    mode: "local",
    auth: false,
    cloudSync: false,
    billing: false,
    sharing: false,
  };

  private dbPromise: Promise<IDBPDatabase<ForgeDb>> | null = null;

  private db(): Promise<IDBPDatabase<ForgeDb>> {
    this.dbPromise ??= openDB<ForgeDb>("forge-labels", 1, {
      upgrade(db) {
        const projects = db.createObjectStore("projects", { keyPath: "id" });
        projects.createIndex("updatedAt", "updatedAt");
        const versions = db.createObjectStore("versions", { keyPath: "id" });
        versions.createIndex("projectId", "projectId");
        db.createObjectStore("assets", { keyPath: "id" });
        db.createObjectStore("brandKits", { keyPath: "id" });
        const exports = db.createObjectStore("exports", { keyPath: "id" });
        exports.createIndex("createdAt", "createdAt");
      },
    });
    return this.dbPromise;
  }

  private parseDoc(raw: unknown): LabelDocument | null {
    try {
      return migrateDocument(raw);
    } catch {
      return null;
    }
  }

  // --- Projects ----------------------------------------------------------

  async listProjects(): Promise<ProjectSummary[]> {
    const db = await this.db();
    const all = await db.getAll("projects");
    return all
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((p) => summarize(p, this.parseDoc(p.doc)));
  }

  async getProject(id: string): Promise<ProjectRecord | null> {
    const db = await this.db();
    const stored = await db.get("projects", id);
    if (!stored) return null;
    const doc = this.parseDoc(stored.doc);
    if (!doc) throw new Error("This project is corrupted and cannot be opened.");
    return { ...summarize(stored, doc), doc };
  }

  async createProject(input: CreateProjectInput): Promise<ProjectRecord> {
    const db = await this.db();
    const now = Date.now();
    const stored: StoredProject = {
      id: newEntityId(),
      name: input.name,
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
      thumbnail: null,
      doc: input.doc,
    };
    await db.put("projects", stored);
    return { ...summarize(stored, input.doc), doc: input.doc };
  }

  async saveProjectDoc(
    id: string,
    doc: LabelDocument,
    thumbnail?: string | null,
  ): Promise<void> {
    const db = await this.db();
    const stored = await db.get("projects", id);
    if (!stored) throw new Error("Project not found");
    stored.doc = doc;
    stored.updatedAt = Date.now();
    if (thumbnail !== undefined) stored.thumbnail = thumbnail;
    await db.put("projects", stored);
  }

  async updateProjectMeta(
    id: string,
    patch: Partial<Pick<ProjectRecord, "name" | "tags">>,
  ): Promise<void> {
    const db = await this.db();
    const stored = await db.get("projects", id);
    if (!stored) throw new Error("Project not found");
    if (patch.name !== undefined) stored.name = patch.name;
    if (patch.tags !== undefined) stored.tags = patch.tags;
    stored.updatedAt = Date.now();
    await db.put("projects", stored);
  }

  async duplicateProject(id: string): Promise<ProjectRecord> {
    const db = await this.db();
    const stored = await db.get("projects", id);
    if (!stored) throw new Error("Project not found");
    const doc = this.parseDoc(stored.doc);
    if (!doc) throw new Error("This project is corrupted and cannot be duplicated.");
    const now = Date.now();
    const copy: StoredProject = {
      ...stored,
      id: newEntityId(),
      name: `${stored.name} copy`,
      createdAt: now,
      updatedAt: now,
    };
    await db.put("projects", copy);
    return { ...summarize(copy, doc), doc };
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.db();
    await db.delete("projects", id);
    const tx = db.transaction("versions", "readwrite");
    for (const v of await tx.store.index("projectId").getAllKeys(id)) {
      await tx.store.delete(v);
    }
    await tx.done;
  }

  // --- Versions ----------------------------------------------------------

  async saveVersion(projectId: string, reason: string): Promise<ProjectVersion> {
    const db = await this.db();
    const stored = await db.get("projects", projectId);
    if (!stored) throw new Error("Project not found");
    const doc = this.parseDoc(stored.doc);
    if (!doc) throw new Error("Cannot snapshot a corrupted project.");
    const version = {
      id: newEntityId(),
      projectId,
      createdAt: Date.now(),
      reason,
      doc: stored.doc,
    };
    await db.put("versions", version);

    // Cap history to the newest MAX_VERSIONS_PER_PROJECT entries.
    const all = (await db.getAllFromIndex("versions", "projectId", projectId)).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
    for (const stale of all.slice(MAX_VERSIONS_PER_PROJECT)) {
      await db.delete("versions", stale.id);
    }
    return { ...version, doc };
  }

  async listVersions(projectId: string): Promise<Omit<ProjectVersion, "doc">[]> {
    const db = await this.db();
    const all = await db.getAllFromIndex("versions", "projectId", projectId);
    return all
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ id, createdAt, reason }) => ({ id, projectId, createdAt, reason }));
  }

  async getVersion(
    projectId: string,
    versionId: string,
  ): Promise<ProjectVersion | null> {
    const db = await this.db();
    const stored = await db.get("versions", versionId);
    if (!stored || stored.projectId !== projectId) return null;
    const doc = this.parseDoc(stored.doc);
    if (!doc) return null;
    return { ...stored, doc };
  }

  // --- Assets ------------------------------------------------------------

  async putAsset(blob: Blob, meta: { name: string }): Promise<AssetRecord> {
    const db = await this.db();
    let width: number | null = null;
    let height: number | null = null;
    if (blob.type.startsWith("image/") && typeof createImageBitmap === "function") {
      try {
        const bmp = await createImageBitmap(blob);
        width = bmp.width;
        height = bmp.height;
        bmp.close();
      } catch {
        // Non-decodable image (e.g. some SVGs without intrinsic size).
      }
    }
    const record: AssetRecord & { blob: Blob } = {
      id: newEntityId(),
      name: meta.name,
      mimeType: blob.type,
      byteSize: blob.size,
      width,
      height,
      createdAt: Date.now(),
      blob,
    };
    await db.put("assets", record);
    const { blob: _omit, ...rest } = record;
    void _omit;
    return rest;
  }

  async getAssetBlob(id: string): Promise<Blob | null> {
    const db = await this.db();
    const record = await db.get("assets", id);
    return record?.blob ?? null;
  }

  async listAssets(): Promise<AssetRecord[]> {
    const db = await this.db();
    const all = await db.getAll("assets");
    return all
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ blob: _omit, ...rest }) => {
        void _omit;
        return rest;
      });
  }

  async deleteAsset(id: string): Promise<void> {
    const db = await this.db();
    await db.delete("assets", id);
  }

  // --- Brand kits ----------------------------------------------------------

  async listBrandKits(): Promise<BrandKitRecord[]> {
    const db = await this.db();
    const all = await db.getAll("brandKits");
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async saveBrandKit(
    kit: Omit<BrandKitRecord, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ): Promise<BrandKitRecord> {
    const db = await this.db();
    const now = Date.now();
    const existing = kit.id ? await db.get("brandKits", kit.id) : undefined;
    const record: BrandKitRecord = {
      ...kit,
      id: kit.id ?? newEntityId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await db.put("brandKits", record);
    return record;
  }

  async deleteBrandKit(id: string): Promise<void> {
    const db = await this.db();
    await db.delete("brandKits", id);
  }

  // --- Exports -------------------------------------------------------------

  async recordExport(entry: Omit<ExportRecord, "id" | "createdAt">): Promise<void> {
    const db = await this.db();
    await db.put("exports", {
      ...entry,
      id: newEntityId(),
      createdAt: Date.now(),
    });
  }

  async listExports(): Promise<ExportRecord[]> {
    const db = await this.db();
    const all = await db.getAll("exports");
    return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, 200);
  }
}
