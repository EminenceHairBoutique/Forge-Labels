import type { LabelDocument } from "@/lib/document/schema";

/**
 * Persistence abstraction. Two implementations:
 * - LocalAdapter (IndexedDB): zero-config local demo mode.
 * - SupabaseAdapter: cloud mode with auth, RLS, and Storage buckets.
 *
 * UI must branch on `capabilities`, never on env vars, so features appear
 * only where they genuinely work.
 */

export interface StorageCapabilities {
  mode: "local" | "cloud";
  /** Real user accounts (sign in/up, sessions). */
  auth: boolean;
  /** Projects sync to the cloud and roam across devices. */
  cloudSync: boolean;
  /** Stripe billing is configured. */
  billing: boolean;
  /** Shareable links can be created. */
  sharing: boolean;
}

export interface ProjectSummary {
  id: string;
  name: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  thumbnail: string | null; // data URL
  labelSizeMm: { width: number; height: number };
  vialName: string | null;
}

export interface ProjectRecord extends ProjectSummary {
  doc: LabelDocument;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  createdAt: number;
  /** e.g. "Manual save", "Before template apply". */
  reason: string;
  doc: LabelDocument;
}

export interface AssetRecord {
  id: string;
  name: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  createdAt: number;
}

export interface BrandKitRecord {
  id: string;
  name: string;
  colors: string[];
  fontFamilyIds: string[];
  logoAssetIds: string[];
  contact: {
    company?: string;
    website?: string;
    email?: string;
    phone?: string;
  };
  standardWarnings: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ExportRecord {
  id: string;
  projectId: string | null;
  projectName: string;
  kind: "png" | "jpg" | "svg" | "pdf" | "sheet-pdf" | "zip" | "mockup";
  fileName: string;
  byteSize: number;
  dpi: number | null;
  createdAt: number;
}

export interface CreateProjectInput {
  name: string;
  doc: LabelDocument;
  tags?: string[];
}

export interface StorageAdapter {
  readonly capabilities: StorageCapabilities;

  // Projects
  listProjects(): Promise<ProjectSummary[]>;
  getProject(id: string): Promise<ProjectRecord | null>;
  createProject(input: CreateProjectInput): Promise<ProjectRecord>;
  /** Autosave path: replaces the document (and optionally the thumbnail). */
  saveProjectDoc(
    id: string,
    doc: LabelDocument,
    thumbnail?: string | null,
  ): Promise<void>;
  updateProjectMeta(
    id: string,
    patch: Partial<Pick<ProjectRecord, "name" | "tags">>,
  ): Promise<void>;
  duplicateProject(id: string): Promise<ProjectRecord>;
  deleteProject(id: string): Promise<void>;

  // Versions
  saveVersion(projectId: string, reason: string): Promise<ProjectVersion>;
  listVersions(projectId: string): Promise<Omit<ProjectVersion, "doc">[]>;
  getVersion(projectId: string, versionId: string): Promise<ProjectVersion | null>;

  // Binary assets (uploaded images, fonts)
  putAsset(blob: Blob, meta: { name: string }): Promise<AssetRecord>;
  getAssetBlob(id: string): Promise<Blob | null>;
  listAssets(): Promise<AssetRecord[]>;
  deleteAsset(id: string): Promise<void>;

  // Brand kits
  listBrandKits(): Promise<BrandKitRecord[]>;
  saveBrandKit(
    kit: Omit<BrandKitRecord, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ): Promise<BrandKitRecord>;
  deleteBrandKit(id: string): Promise<void>;

  // Export history
  recordExport(entry: Omit<ExportRecord, "id" | "createdAt">): Promise<void>;
  listExports(): Promise<ExportRecord[]>;
}
