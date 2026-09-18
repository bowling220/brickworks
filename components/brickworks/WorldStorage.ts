import { BrickTypeId } from "./BrickCatalog";
import { BrickRotation } from "./GridSystem";
import { WorldEnvironmentState, getDefaultWorldEnvironment } from "./WorldEnvironment";

export type WorldType = "island" | "flat" | "natural";
export type WorldSize = "small" | "medium" | "large" | "huge" | "massive" | "expanding";

export interface SavedBrickData {
  id: string;
  type: BrickTypeId;
  color: string;
  gridX: number;
  gridY: number;
  gridZ: number;
  rotation: BrickRotation;
}

export type TerrainMaterialType = "grass" | "soil" | "dirt" | "rock" | "stone" | "sand";

export interface ChunkTerrainMod {
  // Sparse map of vertex index (iz * 9 + ix) to custom world height
  heights: Record<number, number>;
  // Sparse map of vertex index to surface material
  materials?: Record<number, TerrainMaterialType>;
}

export interface Waypoint {
  id: string;
  name: string;
  worldX: number;
  worldY: number;
  worldZ: number;
  createdAt?: string;
  isHome?: boolean;
  color?: string;
}

export interface WorldChunkData {
  bricks: SavedBrickData[];
  terrainMod?: ChunkTerrainMod;
}

export interface WorldSettings {
  viewDistance: "low" | "medium" | "high";
  baseplateSize?: number;
  seed?: number;
}

export interface SavedWorld {
  id: string;
  name: string;
  version: number; // 2 for modern chunk-based worlds
  worldType: WorldType;
  worldSize: WorldSize;
  seed: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  playerSpawn: [number, number, number];
  lastPlayerPosition?: [number, number, number];
  lastPlayerYaw?: number;
  lastSafePosition?: [number, number, number];
  homeSpawnId?: string;
  waypoints?: Waypoint[];
  exploredChunks?: string[];
  chunks: Record<string, WorldChunkData>;
  settings: WorldSettings;
  environment?: WorldEnvironmentState;
  // Backward compatibility alias for total brick listing
  bricks?: SavedBrickData[];
}

export interface WorldMetadata {
  id: string;
  name: string;
  version: number;
  worldType: WorldType;
  worldSize: WorldSize;
  seed: number;
  createdAt: string;
  updatedAt: string;
  brickCount: number;
}

export interface WorldStorageService {
  listWorlds(): Promise<WorldMetadata[]>;
  loadWorld(id: string): Promise<SavedWorld | null>;
  saveWorld(world: SavedWorld): Promise<void>;
  saveDirtyChunk(worldId: string, chunkKey: string, chunkData: WorldChunkData): Promise<void>;
  deleteWorld(id: string): Promise<void>;
  createNewWorld(
    name?: string,
    worldType?: WorldType,
    worldSize?: WorldSize,
    seed?: number
  ): Promise<SavedWorld>;
  renameWorld(id: string, newName: string): Promise<void>;
  duplicateWorld(id: string, newName?: string): Promise<SavedWorld>;
  getRecentWorldId(): Promise<string | null>;
  setRecentWorldId(id: string | null): Promise<void>;
}

const DB_NAME = "brickworks_db";
const DB_VERSION = 3;
const WORLDS_STORE = "worlds";
const LEGACY_BUILDS_STORE = "builds";
const META_STORE = "meta";
const BLUEPRINTS_STORE = "blueprints";
const RECENT_WORLD_KEY = "recent_world_id";

/**
 * Calculates total brick count across all chunks
 */
export function countWorldBricks(world: SavedWorld): number {
  if (!world.chunks) return 0;
  let total = 0;
  for (const chunkKey of Object.keys(world.chunks)) {
    const chunk = world.chunks[chunkKey];
    if (chunk && Array.isArray(chunk.bricks)) {
      total += chunk.bricks.length;
    }
  }
  return total;
}

/**
 * Flattens all bricks from all chunks into a single array (for legacy compat)
 */
export function getAllBricksFromWorld(world: SavedWorld): SavedBrickData[] {
  if (!world.chunks) return [];
  const list: SavedBrickData[] = [];
  for (const chunkKey of Object.keys(world.chunks)) {
    const chunk = world.chunks[chunkKey];
    if (chunk && Array.isArray(chunk.bricks)) {
      list.push(...chunk.bricks);
    }
  }
  return list;
}

/**
 * Converts a flat array of bricks into a chunk-keyed dictionary
 */
export function groupBricksIntoChunks(
  bricks: SavedBrickData[],
  chunkSize = 16
): Record<string, WorldChunkData> {
  const chunks: Record<string, WorldChunkData> = {};

  for (const brick of bricks) {
    const chunkX = Math.floor(brick.gridX / chunkSize);
    const chunkZ = Math.floor(brick.gridY / chunkSize);
    const key = `${chunkX},${chunkZ}`;

    if (!chunks[key]) {
      chunks[key] = { bricks: [] };
    }
    chunks[key].bricks.push(brick);
  }

  return chunks;
}

/**
 * Migrates a legacy v1 SavedBuild object into a modern v2 SavedWorld
 */
export function migrateLegacyBuild(legacy: Record<string, unknown>): SavedWorld {
  const rawBricks = Array.isArray(legacy.bricks) ? (legacy.bricks as SavedBrickData[]) : [];
  
  // Shift legacy bricks if they were in 0..31 baseplate space to center around 0
  const adjustedBricks = rawBricks.map((b) => ({
    ...b,
    gridX: typeof b.gridX === "number" && b.gridX >= 0 && b.gridX < 32 ? b.gridX - 16 : b.gridX,
    gridY: typeof b.gridY === "number" && b.gridY >= 0 && b.gridY < 32 ? b.gridY - 16 : b.gridY,
  }));

  const chunks = groupBricksIntoChunks(adjustedBricks, 16);

  const now = String(legacy.createdAt || new Date().toISOString());
  const spawnWaypoint: Waypoint = {
    id: "spawn_waypoint",
    name: "World Spawn",
    worldX: 0,
    worldY: 0.5,
    worldZ: 0,
    createdAt: now,
    isHome: true,
    color: "#facc15",
  };

  return {
    id: String(legacy.id || `world_${Date.now()}`),
    name: String(legacy.name || "My Legacy Build"),
    version: 2,
    worldType: (legacy.worldType as WorldType) || "island",
    worldSize: (legacy.worldSize as WorldSize) || "small",
    seed: typeof legacy.seed === "number" ? legacy.seed : Math.floor(Math.random() * 1000000),
    createdAt: now,
    updatedAt: String(legacy.updatedAt || new Date().toISOString()),
    playerSpawn: [0, 0, 11.2],
    lastPlayerPosition: [0, 0, 11.2],
    lastPlayerYaw: Math.PI,
    lastSafePosition: [0, 0, 11.2],
    homeSpawnId: "spawn_waypoint",
    waypoints: [spawnWaypoint],
    exploredChunks: ["0,0", "0,-1", "-1,0", "-1,-1", "0,1", "1,0", "1,1", "-1,1", "1,-1"],
    chunks,
    settings: {
      viewDistance: "medium",
      baseplateSize: typeof legacy.settings === "object" && legacy.settings && "baseplateSize" in legacy.settings
        ? (legacy.settings as { baseplateSize?: number }).baseplateSize
        : 32,
    },
  };
}

/**
 * Native IndexedDB implementation with version migration and chunk persistence
 */
export class IndexedDBWorldStorage implements WorldStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (typeof window === "undefined" || !window.indexedDB) {
      return Promise.reject(new Error("IndexedDB is not available in this environment"));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(WORLDS_STORE)) {
            db.createObjectStore(WORLDS_STORE, { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains(LEGACY_BUILDS_STORE)) {
            db.createObjectStore(LEGACY_BUILDS_STORE, { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE);
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

  async listWorlds(): Promise<WorldMetadata[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([WORLDS_STORE, LEGACY_BUILDS_STORE], "readwrite");
      const worldsStore = tx.objectStore(WORLDS_STORE);
      const legacyStore = tx.objectStore(LEGACY_BUILDS_STORE);

      const worldsReq = worldsStore.getAll();
      const legacyReq = legacyStore.getAll();

      tx.oncomplete = () => {
        const worlds: SavedWorld[] = worldsReq.result || [];
        const legacy: Record<string, unknown>[] = legacyReq.result || [];

        // Migrate any un-migrated legacy builds
        for (const item of legacy) {
          if (!worlds.some((w) => w.id === item.id)) {
            const migrated = migrateLegacyBuild(item);
            worlds.push(migrated);
            // Save migrated into worlds store
            const saveTx = db.transaction(WORLDS_STORE, "readwrite");
            saveTx.objectStore(WORLDS_STORE).put(migrated);
          }
        }

        const meta: WorldMetadata[] = worlds.map((w) => ({
          id: w.id,
          name: w.name,
          version: w.version || 2,
          worldType: w.worldType || "island",
          worldSize: w.worldSize || "small",
          seed: w.seed || 12345,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
          brickCount: countWorldBricks(w),
        }));

        meta.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(meta);
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  async loadWorld(id: string): Promise<SavedWorld | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([WORLDS_STORE, LEGACY_BUILDS_STORE], "readonly");
      const worldsStore = tx.objectStore(WORLDS_STORE);
      const req = worldsStore.get(id);

      req.onsuccess = () => {
        if (req.result) {
          const world = req.result as SavedWorld;
          if (!world.chunks) {
            world.chunks = groupBricksIntoChunks(world.bricks || []);
          }
          if (!world.bricks) {
            world.bricks = getAllBricksFromWorld(world);
          }
          if (!world.environment) {
            world.environment = getDefaultWorldEnvironment();
          }
          resolve(world);
        } else {
          // Check legacy store
          const legacyStore = tx.objectStore(LEGACY_BUILDS_STORE);
          const legReq = legacyStore.get(id);
          legReq.onsuccess = () => {
            if (legReq.result) {
              const migrated = migrateLegacyBuild(legReq.result as Record<string, unknown>);
              resolve(migrated);
            } else {
              resolve(null);
            }
          };
          legReq.onerror = () => resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async saveWorld(world: SavedWorld): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([WORLDS_STORE, META_STORE], "readwrite");
      const store = tx.objectStore(WORLDS_STORE);
      const metaStore = tx.objectStore(META_STORE);

      // Strip redundant root bricks array when chunks is present to eliminate duplicate serialization bloat
      const toSave: SavedWorld = { ...world };
      delete toSave.bricks;

      const putReq = store.put(toSave);
      putReq.onsuccess = () => {
        metaStore.put(world.id, RECENT_WORLD_KEY);
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveDirtyChunk(worldId: string, chunkKey: string, chunkData: WorldChunkData): Promise<void> {
    const current = await this.loadWorld(worldId);
    if (!current) return;

    if (!current.chunks) current.chunks = {};
    current.chunks[chunkKey] = chunkData;
    current.updatedAt = new Date().toISOString();

    await this.saveWorld(current);
  }

  async deleteWorld(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([WORLDS_STORE, LEGACY_BUILDS_STORE, META_STORE], "readwrite");
      tx.objectStore(WORLDS_STORE).delete(id);
      tx.objectStore(LEGACY_BUILDS_STORE).delete(id);

      const metaStore = tx.objectStore(META_STORE);
      const recentReq = metaStore.get(RECENT_WORLD_KEY);
      recentReq.onsuccess = () => {
        if (recentReq.result === id) {
          metaStore.delete(RECENT_WORLD_KEY);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async createNewWorld(
    name = "My World",
    worldType: WorldType = "island",
    worldSize: WorldSize = "small",
    seed = Math.floor(Math.random() * 1000000000)
  ): Promise<SavedWorld> {
    const now = new Date().toISOString();
    const id = `world_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const spawnWaypoint: Waypoint = {
      id: "spawn_waypoint",
      name: "World Spawn",
      worldX: 0,
      worldY: 0.5,
      worldZ: 0,
      createdAt: now,
      isHome: true,
      color: "#facc15",
    };

    const newWorld: SavedWorld = {
      id,
      name,
      version: 2,
      worldType,
      worldSize,
      seed,
      createdAt: now,
      updatedAt: now,
      playerSpawn: [0, 0, 11.2],
      lastPlayerPosition: [0, 0, 11.2],
      lastPlayerYaw: Math.PI,
      lastSafePosition: [0, 0, 11.2],
      homeSpawnId: "spawn_waypoint",
      waypoints: [spawnWaypoint],
      exploredChunks: ["0,0", "0,-1", "-1,0", "-1,-1", "0,1", "1,0", "1,1", "-1,1", "1,-1"],
      chunks: {},
      settings: {
        viewDistance: "medium",
        baseplateSize: 64,
      },
    };

    await this.saveWorld(newWorld);
    return newWorld;
  }

  async renameWorld(id: string, newName: string): Promise<void> {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error("World name cannot be empty");
    if (trimmed.length > 80) throw new Error("World name must be 80 characters or fewer");

    const existing = await this.loadWorld(id);
    if (!existing) throw new Error(`World ${id} not found`);

    existing.name = trimmed;
    existing.updatedAt = new Date().toISOString();
    await this.saveWorld(existing);
  }

  async duplicateWorld(id: string, newName?: string): Promise<SavedWorld> {
    const original = await this.loadWorld(id);
    if (!original) throw new Error(`World ${id} not found`);

    const now = new Date().toISOString();
    const newId = `world_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const name = newName || `${original.name} Copy`;

    const clonedChunks: Record<string, WorldChunkData> = {};
    for (const [key, chunk] of Object.entries(original.chunks || {})) {
      clonedChunks[key] = {
        bricks: (chunk.bricks || []).map((b, i) => ({
          ...b,
          id: `brick_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
        })),
      };
    }

    const duplicate: SavedWorld = {
      ...original,
      id: newId,
      name,
      createdAt: now,
      updatedAt: now,
      chunks: clonedChunks,
    };

    await this.saveWorld(duplicate);
    return duplicate;
  }

  async getRecentWorldId(): Promise<string | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readonly");
      const store = tx.objectStore(META_STORE);
      const req = store.get(RECENT_WORLD_KEY);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async setRecentWorldId(id: string | null): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readwrite");
      const store = tx.objectStore(META_STORE);
      if (id) {
        store.put(id, RECENT_WORLD_KEY);
      } else {
        store.delete(RECENT_WORLD_KEY);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

/**
 * Fallback LocalStorage implementation
 */
export class LocalStorageWorldStorage implements WorldStorageService {
  private readonly STORAGE_PREFIX = "bw_world_";
  private readonly META_INDEX = "bw_worlds_index";
  private readonly RECENT_KEY = "bw_recent_world_id";

  private getIndex(): string[] {
    try {
      const raw = localStorage.getItem(this.META_INDEX);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveIndex(ids: string[]) {
    localStorage.setItem(this.META_INDEX, JSON.stringify(ids));
  }

  async listWorlds(): Promise<WorldMetadata[]> {
    const ids = this.getIndex();
    const metaList: WorldMetadata[] = [];

    for (const id of ids) {
      try {
        const raw = localStorage.getItem(`${this.STORAGE_PREFIX}${id}`);
        if (raw) {
          const w: SavedWorld = JSON.parse(raw);
          metaList.push({
            id: w.id,
            name: w.name,
            version: w.version || 2,
            worldType: w.worldType || "island",
            worldSize: w.worldSize || "small",
            seed: w.seed || 12345,
            createdAt: w.createdAt,
            updatedAt: w.updatedAt,
            brickCount: countWorldBricks(w),
          });
        }
      } catch {
        // Skip corrupted
      }
    }

    metaList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return metaList;
  }

  async loadWorld(id: string): Promise<SavedWorld | null> {
    try {
      const raw = localStorage.getItem(`${this.STORAGE_PREFIX}${id}`);
      if (!raw) return null;
      const w: SavedWorld = JSON.parse(raw);
      if (!w.chunks) {
        w.chunks = groupBricksIntoChunks(w.bricks || []);
      }
      if (!w.bricks) {
        w.bricks = getAllBricksFromWorld(w);
      }
      if (!w.environment) {
        w.environment = getDefaultWorldEnvironment();
      }
      return w;
    } catch {
      return null;
    }
  }

  async saveWorld(world: SavedWorld): Promise<void> {
    try {
      // Strip redundant root bricks array when chunks is present to eliminate duplicate serialization bloat
      const toSave: SavedWorld = { ...world };
      delete toSave.bricks;
      localStorage.setItem(`${this.STORAGE_PREFIX}${world.id}`, JSON.stringify(toSave));
      const ids = this.getIndex();
      if (!ids.includes(world.id)) {
        ids.push(world.id);
        this.saveIndex(ids);
      }
      localStorage.setItem(this.RECENT_KEY, world.id);
    } catch (err) {
      throw new Error(`LocalStorage save failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async saveDirtyChunk(worldId: string, chunkKey: string, chunkData: WorldChunkData): Promise<void> {
    const current = await this.loadWorld(worldId);
    if (!current) return;
    if (!current.chunks) current.chunks = {};
    current.chunks[chunkKey] = chunkData;
    current.updatedAt = new Date().toISOString();
    await this.saveWorld(current);
  }

  async deleteWorld(id: string): Promise<void> {
    localStorage.removeItem(`${this.STORAGE_PREFIX}${id}`);
    const ids = this.getIndex().filter((x) => x !== id);
    this.saveIndex(ids);
    if (localStorage.getItem(this.RECENT_KEY) === id) {
      localStorage.removeItem(this.RECENT_KEY);
    }
  }

  async createNewWorld(
    name = "My World",
    worldType: WorldType = "island",
    worldSize: WorldSize = "small",
    seed = Math.floor(Math.random() * 1000000000)
  ): Promise<SavedWorld> {
    const now = new Date().toISOString();
    const id = `world_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const spawnWaypoint: Waypoint = {
      id: "spawn_waypoint",
      name: "World Spawn",
      worldX: 0,
      worldY: 0.5,
      worldZ: 0,
      createdAt: now,
      isHome: true,
      color: "#facc15",
    };

    const newWorld: SavedWorld = {
      id,
      name,
      version: 2,
      worldType,
      worldSize,
      seed,
      createdAt: now,
      updatedAt: now,
      playerSpawn: [0, 0, 11.2],
      lastPlayerPosition: [0, 0, 11.2],
      lastPlayerYaw: Math.PI,
      lastSafePosition: [0, 0, 11.2],
      homeSpawnId: "spawn_waypoint",
      waypoints: [spawnWaypoint],
      exploredChunks: ["0,0", "0,-1", "-1,0", "-1,-1", "0,1", "1,0", "1,1", "-1,1", "1,-1"],
      chunks: {},
      settings: {
        viewDistance: "medium",
        baseplateSize: 64,
      },
    };
    await this.saveWorld(newWorld);
    return newWorld;
  }

  async renameWorld(id: string, newName: string): Promise<void> {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error("World name cannot be empty");
    const existing = await this.loadWorld(id);
    if (!existing) throw new Error(`World ${id} not found`);
    existing.name = trimmed;
    existing.updatedAt = new Date().toISOString();
    await this.saveWorld(existing);
  }

  async duplicateWorld(id: string, newName?: string): Promise<SavedWorld> {
    const original = await this.loadWorld(id);
    if (!original) throw new Error(`World ${id} not found`);
    const now = new Date().toISOString();
    const newId = `world_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const duplicate: SavedWorld = {
      ...original,
      id: newId,
      name: newName || `${original.name} Copy`,
      createdAt: now,
      updatedAt: now,
    };
    await this.saveWorld(duplicate);
    return duplicate;
  }

  async getRecentWorldId(): Promise<string | null> {
    try {
      return localStorage.getItem(this.RECENT_KEY);
    } catch {
      return null;
    }
  }

  async setRecentWorldId(id: string | null): Promise<void> {
    try {
      if (id) {
        localStorage.setItem(this.RECENT_KEY, id);
      } else {
        localStorage.removeItem(this.RECENT_KEY);
      }
    } catch {
      // Ignore
    }
  }
}

let worldStorageInstance: WorldStorageService | null = null;

export function getWorldStorageService(): WorldStorageService {
  if (worldStorageInstance) return worldStorageInstance;

  if (typeof window !== "undefined" && window.indexedDB) {
    worldStorageInstance = new IndexedDBWorldStorage();
  } else {
    worldStorageInstance = new LocalStorageWorldStorage();
  }

  return worldStorageInstance;
}
