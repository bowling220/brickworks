import {
  SavedBrickData,
  SavedWorld,
  WorldMetadata,
  WorldType,
  WorldSize,
  WorldSettings,
  ChunkTerrainMod,
  TerrainMaterialType,
  Waypoint,
  WorldStorageService,
  getWorldStorageService,
  getAllBricksFromWorld,
  countWorldBricks,
  groupBricksIntoChunks,
} from "./WorldStorage";

export type {
  SavedBrickData,
  WorldType,
  WorldSize,
  WorldSettings,
  WorldMetadata,
  WorldStorageService,
  ChunkTerrainMod,
  TerrainMaterialType,
  Waypoint,
};

// Aliases for legacy compatibility
export type SavedBuild = SavedWorld;
export type BuildMetadata = WorldMetadata;
export type SavedBuildSettings = WorldSettings;

export interface BuildStorageService {
  listBuilds(): Promise<BuildMetadata[]>;
  loadBuild(id: string): Promise<SavedBuild | null>;
  saveBuild(build: SavedBuild): Promise<void>;
  deleteBuild(id: string): Promise<void>;
  createNewBuild(name?: string, settings?: Partial<SavedBuildSettings>): Promise<SavedBuild>;
  renameBuild(id: string, newName: string): Promise<void>;
  duplicateBuild(id: string, newName?: string): Promise<SavedBuild>;
  getRecentBuildId(): Promise<string | null>;
  setRecentBuildId(id: string | null): Promise<void>;
}

class BuildStorageAdapter implements BuildStorageService {
  private worldStorage = getWorldStorageService();

  async listBuilds(): Promise<BuildMetadata[]> {
    return this.worldStorage.listWorlds();
  }

  async loadBuild(id: string): Promise<SavedBuild | null> {
    const world = await this.worldStorage.loadWorld(id);
    if (!world) return null;
    if (!world.bricks || world.bricks.length === 0) {
      world.bricks = getAllBricksFromWorld(world);
    }
    return world;
  }

  async saveBuild(build: SavedBuild): Promise<void> {
    if (!build.chunks || Object.keys(build.chunks).length === 0) {
      if (build.bricks && build.bricks.length > 0) {
        build.chunks = groupBricksIntoChunks(build.bricks);
      }
    }
    return this.worldStorage.saveWorld(build);
  }

  async deleteBuild(id: string): Promise<void> {
    return this.worldStorage.deleteWorld(id);
  }

  async createNewBuild(name = "Untitled Build"): Promise<SavedBuild> {
    return this.worldStorage.createNewWorld(name, "island", "small");
  }

  async renameBuild(id: string, newName: string): Promise<void> {
    return this.worldStorage.renameWorld(id, newName);
  }

  async duplicateBuild(id: string, newName?: string): Promise<SavedBuild> {
    return this.worldStorage.duplicateWorld(id, newName);
  }

  async getRecentBuildId(): Promise<string | null> {
    return this.worldStorage.getRecentWorldId();
  }

  async setRecentBuildId(id: string | null): Promise<void> {
    return this.worldStorage.setRecentWorldId(id);
  }
}

let buildStorageInstance: BuildStorageService | null = null;

export function getStorageService(): BuildStorageService {
  if (!buildStorageInstance) {
    buildStorageInstance = new BuildStorageAdapter();
  }
  return buildStorageInstance;
}

export { getAllBricksFromWorld, countWorldBricks, groupBricksIntoChunks };
