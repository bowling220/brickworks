import { BrickData, BrickRotation } from "./GridSystem";
import { BrickTypeId, BRICK_CATALOG } from "./BrickCatalog";
import {
  toRelativeBrickPositions,
  calculateStructureBounds,
  calculateStructurePivot,
} from "./BlueprintMath";

// ──────────────────────────────────────────────
// Blueprint Data Types
// ──────────────────────────────────────────────

export interface BlueprintBrick {
  type: BrickTypeId;
  color: string;
  relX: number; // Integer relative stud offset
  relY: number; // Integer relative stud offset
  relZ: number; // Integer relative vertical unit offset
  rotation: BrickRotation;
}

export interface BlueprintData {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  brickCount: number;
  widthStuds: number;
  lengthStuds: number;
  heightUnits: number;
  pivot: [number, number, number];
  bricks: BlueprintBrick[];
  isFavorite?: boolean;
  // Future metadata (not required now)
  category?: string;
  creator?: string;
  description?: string;
  thumbnailDataUrl?: string;
}

// ──────────────────────────────────────────────
// Blueprint Creation
// ──────────────────────────────────────────────

const MAX_BLUEPRINT_BRICKS = 10000;

/**
 * Creates a BlueprintData from a set of world-positioned bricks.
 * Converts all positions to relative integer grid coordinates.
 * The original bricks are NOT modified.
 */
export function createBlueprintFromSelection(
  selectedBricks: BrickData[],
  name: string
): BlueprintData {
  if (selectedBricks.length === 0) {
    throw new Error("Cannot create Blueprint from empty selection");
  }
  if (selectedBricks.length > MAX_BLUEPRINT_BRICKS) {
    throw new Error(`Blueprint exceeds maximum of ${MAX_BLUEPRINT_BRICKS} bricks`);
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Blueprint name cannot be blank");
  }
  if (trimmedName.length > 80) {
    throw new Error("Blueprint name must be 80 characters or fewer");
  }

  // Convert to relative coordinates using existing BlueprintMath
  const { items } = toRelativeBrickPositions(selectedBricks);

  // Calculate bounds from relative positions
  const relativeBricksForBounds = items.map((item) => ({
    type: item.type,
    gridX: item.relX,
    gridY: item.relY,
    gridZ: item.relZ,
    rotation: item.rotation,
  }));
  const bounds = calculateStructureBounds(relativeBricksForBounds);
  const pivot = calculateStructurePivot(relativeBricksForBounds);

  // Convert BlueprintRelativeItem[] to BlueprintBrick[] (strip IDs — they belong to the original)
  const blueprintBricks: BlueprintBrick[] = items.map((item) => ({
    type: item.type,
    color: item.color,
    relX: item.relX,
    relY: item.relY,
    relZ: item.relZ,
    rotation: item.rotation,
  }));

  const now = new Date().toISOString();
  const id = `bp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  return {
    id,
    name: trimmedName,
    version: 1,
    createdAt: now,
    updatedAt: now,
    brickCount: blueprintBricks.length,
    widthStuds: bounds.widthStuds,
    lengthStuds: bounds.lengthStuds,
    heightUnits: bounds.heightUnits,
    pivot,
    bricks: blueprintBricks,
  };
}

// ──────────────────────────────────────────────
// Blueprint Validation
// ──────────────────────────────────────────────

export interface BlueprintValidationResult {
  valid: boolean;
  data?: BlueprintData;
  warnings: string[];
}

/**
 * Defensively validates a raw Blueprint object loaded from storage.
 * Skips malformed individual bricks with warnings rather than rejecting the entire Blueprint.
 */
export function validateBlueprint(raw: unknown): BlueprintValidationResult {
  const warnings: string[] = [];

  if (!raw || typeof raw !== "object") {
    return { valid: false, warnings: ["Blueprint data must be a JSON object"] };
  }

  const obj = raw as Record<string, unknown>;

  // Required fields
  const id = typeof obj.id === "string" && obj.id.trim() ? obj.id : null;
  if (!id) return { valid: false, warnings: ["Missing or invalid Blueprint ID"] };

  const name = typeof obj.name === "string" && obj.name.trim()
    ? obj.name.slice(0, 80).trim()
    : "Untitled Blueprint";

  const version = typeof obj.version === "number" ? obj.version : 1;
  const createdAt = typeof obj.createdAt === "string" ? obj.createdAt : new Date().toISOString();
  const updatedAt = typeof obj.updatedAt === "string" ? obj.updatedAt : new Date().toISOString();

  // Validate bricks array
  const rawBricks = Array.isArray(obj.bricks) ? obj.bricks : [];
  if (rawBricks.length === 0) {
    return { valid: false, warnings: ["Blueprint contains no bricks"] };
  }
  if (rawBricks.length > MAX_BLUEPRINT_BRICKS) {
    return { valid: false, warnings: [`Blueprint exceeds maximum of ${MAX_BLUEPRINT_BRICKS} bricks`] };
  }

  const validBricks: BlueprintBrick[] = [];

  for (let i = 0; i < rawBricks.length; i++) {
    const item = rawBricks[i];
    if (!item || typeof item !== "object") {
      warnings.push(`Skipping brick #${i}: malformed object`);
      continue;
    }

    const b = item as Record<string, unknown>;

    // Validate type
    const typeKey = String(b.type || "");
    if (!typeKey || !(typeKey in BRICK_CATALOG)) {
      warnings.push(`Skipping brick #${i}: unrecognized type "${typeKey}"`);
      continue;
    }

    // Validate rotation
    const rotNum = Number(b.rotation);
    const rotation = (rotNum === 90 ? 90 : 0) as 0 | 90;

    // Validate relative coordinates (must be finite integers)
    const relX = Number(b.relX);
    const relY = Number(b.relY);
    const relZ = Number(b.relZ);

    if (!Number.isFinite(relX) || !Number.isFinite(relY) || !Number.isFinite(relZ)) {
      warnings.push(`Skipping brick #${i}: coordinates not finite`);
      continue;
    }

    // Validate color
    const color = typeof b.color === "string" && b.color.trim() ? b.color.trim() : "#e62b32";

    validBricks.push({
      type: typeKey as BrickTypeId,
      color,
      relX: Math.round(relX),
      relY: Math.round(relY),
      relZ: Math.round(relZ),
      rotation,
    });
  }

  if (validBricks.length === 0) {
    return { valid: false, warnings: [...warnings, "No valid bricks after validation"] };
  }

  // Recompute bounds from validated bricks
  const forBounds = validBricks.map((b) => ({
    type: b.type,
    gridX: b.relX,
    gridY: b.relY,
    gridZ: b.relZ,
    rotation: b.rotation,
  }));
  const bounds = calculateStructureBounds(forBounds);
  const pivot = calculateStructurePivot(forBounds);

  const data: BlueprintData = {
    id,
    name,
    version,
    createdAt,
    updatedAt,
    brickCount: validBricks.length,
    widthStuds: bounds.widthStuds,
    lengthStuds: bounds.lengthStuds,
    heightUnits: bounds.heightUnits,
    pivot,
    bricks: validBricks,
    isFavorite: typeof obj.isFavorite === "boolean" ? obj.isFavorite : false,
    category: typeof obj.category === "string" ? obj.category : undefined,
    creator: typeof obj.creator === "string" ? obj.creator : undefined,
    description: typeof obj.description === "string" ? obj.description : undefined,
  };

  return { valid: true, data, warnings };
}

// ──────────────────────────────────────────────
// Blueprint Storage Service Interface
// ──────────────────────────────────────────────

export interface BlueprintStorageService {
  saveBlueprint(blueprint: BlueprintData): Promise<void>;
  loadBlueprint(id: string): Promise<BlueprintData | null>;
  listBlueprints(): Promise<BlueprintData[]>;
  renameBlueprint(id: string, newName: string): Promise<void>;
  deleteBlueprint(id: string): Promise<void>;
  duplicateBlueprint(id: string, newName?: string): Promise<BlueprintData>;
  toggleFavorite(id: string): Promise<void>;
}

// ──────────────────────────────────────────────
// IndexedDB Implementation
// ──────────────────────────────────────────────

const BP_DB_NAME = "brickworks_db";
const BP_DB_VERSION = 3;
const BLUEPRINTS_STORE = "blueprints";

export class IndexedDBBlueprintStorage implements BlueprintStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (typeof window === "undefined" || !window.indexedDB) {
      return Promise.reject(new Error("IndexedDB is not available"));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = window.indexedDB.open(BP_DB_NAME, BP_DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          // Create all stores that may not exist yet
          if (!db.objectStoreNames.contains("worlds")) {
            db.createObjectStore("worlds", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("builds")) {
            db.createObjectStore("builds", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("meta")) {
            db.createObjectStore("meta");
          }
          if (!db.objectStoreNames.contains(BLUEPRINTS_STORE)) {
            db.createObjectStore(BLUEPRINTS_STORE, { keyPath: "id" });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
      });
    }

    return this.dbPromise;
  }

  async saveBlueprint(blueprint: BlueprintData): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BLUEPRINTS_STORE, "readwrite");
      tx.objectStore(BLUEPRINTS_STORE).put(blueprint);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadBlueprint(id: string): Promise<BlueprintData | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BLUEPRINTS_STORE, "readonly");
      const req = tx.objectStore(BLUEPRINTS_STORE).get(id);
      req.onsuccess = () => {
        if (!req.result) {
          resolve(null);
          return;
        }
        const { valid, data, warnings } = validateBlueprint(req.result);
        if (warnings.length > 0) {
          console.warn(`[BRICKWORKS Blueprint] Loaded "${id}" with ${warnings.length} warnings:`, warnings);
        }
        resolve(valid ? data! : null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async listBlueprints(): Promise<BlueprintData[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BLUEPRINTS_STORE, "readonly");
      const req = tx.objectStore(BLUEPRINTS_STORE).getAll();

      req.onsuccess = () => {
        const rawList: unknown[] = req.result || [];
        const validBlueprints: BlueprintData[] = [];

        for (const raw of rawList) {
          const { valid, data } = validateBlueprint(raw);
          if (valid && data) {
            validBlueprints.push(data);
          }
        }

        // Sort by most recently updated
        validBlueprints.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        resolve(validBlueprints);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async renameBlueprint(id: string, newName: string): Promise<void> {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error("Blueprint name cannot be empty");
    if (trimmed.length > 80) throw new Error("Blueprint name must be 80 characters or fewer");

    const existing = await this.loadBlueprint(id);
    if (!existing) throw new Error(`Blueprint "${id}" not found`);

    existing.name = trimmed;
    existing.updatedAt = new Date().toISOString();
    await this.saveBlueprint(existing);
  }

  async deleteBlueprint(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BLUEPRINTS_STORE, "readwrite");
      tx.objectStore(BLUEPRINTS_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async duplicateBlueprint(id: string, newName?: string): Promise<BlueprintData> {
    const original = await this.loadBlueprint(id);
    if (!original) throw new Error(`Blueprint "${id}" not found`);

    const now = new Date().toISOString();
    const newId = `bp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const duplicate: BlueprintData = {
      ...original,
      id: newId,
      name: newName || `${original.name} Copy`,
      createdAt: now,
      updatedAt: now,
    };

    await this.saveBlueprint(duplicate);
    return duplicate;
  }

  async toggleFavorite(id: string): Promise<void> {
    const existing = await this.loadBlueprint(id);
    if (!existing) throw new Error(`Blueprint "${id}" not found`);

    existing.isFavorite = !existing.isFavorite;
    existing.updatedAt = new Date().toISOString();
    await this.saveBlueprint(existing);
  }
}

// ──────────────────────────────────────────────
// LocalStorage Fallback Implementation
// ──────────────────────────────────────────────

export class LocalStorageBlueprintStorage implements BlueprintStorageService {
  private readonly PREFIX = "bw_blueprint_";
  private readonly INDEX_KEY = "bw_blueprints_index";

  private getIndex(): string[] {
    try {
      const raw = localStorage.getItem(this.INDEX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveIndex(ids: string[]) {
    localStorage.setItem(this.INDEX_KEY, JSON.stringify(ids));
  }

  async saveBlueprint(blueprint: BlueprintData): Promise<void> {
    try {
      localStorage.setItem(`${this.PREFIX}${blueprint.id}`, JSON.stringify(blueprint));
      const ids = this.getIndex();
      if (!ids.includes(blueprint.id)) {
        ids.push(blueprint.id);
        this.saveIndex(ids);
      }
    } catch (err) {
      throw new Error(`Blueprint save failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async loadBlueprint(id: string): Promise<BlueprintData | null> {
    try {
      const raw = localStorage.getItem(`${this.PREFIX}${id}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const { valid, data } = validateBlueprint(parsed);
      return valid ? data! : null;
    } catch {
      return null;
    }
  }

  async listBlueprints(): Promise<BlueprintData[]> {
    const ids = this.getIndex();
    const results: BlueprintData[] = [];

    for (const id of ids) {
      try {
        const raw = localStorage.getItem(`${this.PREFIX}${id}`);
        if (raw) {
          const { valid, data } = validateBlueprint(JSON.parse(raw));
          if (valid && data) {
            results.push(data);
          }
        }
      } catch {
        // Skip corrupted entries
      }
    }

    results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return results;
  }

  async renameBlueprint(id: string, newName: string): Promise<void> {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error("Blueprint name cannot be empty");

    const existing = await this.loadBlueprint(id);
    if (!existing) throw new Error(`Blueprint "${id}" not found`);

    existing.name = trimmed;
    existing.updatedAt = new Date().toISOString();
    await this.saveBlueprint(existing);
  }

  async deleteBlueprint(id: string): Promise<void> {
    localStorage.removeItem(`${this.PREFIX}${id}`);
    const ids = this.getIndex().filter((x) => x !== id);
    this.saveIndex(ids);
  }

  async duplicateBlueprint(id: string, newName?: string): Promise<BlueprintData> {
    const original = await this.loadBlueprint(id);
    if (!original) throw new Error(`Blueprint "${id}" not found`);

    const now = new Date().toISOString();
    const newId = `bp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const duplicate: BlueprintData = {
      ...original,
      id: newId,
      name: newName || `${original.name} Copy`,
      createdAt: now,
      updatedAt: now,
    };

    await this.saveBlueprint(duplicate);
    return duplicate;
  }

  async toggleFavorite(id: string): Promise<void> {
    const existing = await this.loadBlueprint(id);
    if (!existing) throw new Error(`Blueprint "${id}" not found`);

    existing.isFavorite = !existing.isFavorite;
    existing.updatedAt = new Date().toISOString();
    await this.saveBlueprint(existing);
  }
}

// ──────────────────────────────────────────────
// Singleton Access
// ──────────────────────────────────────────────

let blueprintStorageInstance: BlueprintStorageService | null = null;

export function getBlueprintStorageService(): BlueprintStorageService {
  if (blueprintStorageInstance) return blueprintStorageInstance;

  if (typeof window !== "undefined" && window.indexedDB) {
    blueprintStorageInstance = new IndexedDBBlueprintStorage();
  } else {
    blueprintStorageInstance = new LocalStorageBlueprintStorage();
  }

  return blueprintStorageInstance;
}
