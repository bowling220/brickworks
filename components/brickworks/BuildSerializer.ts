import { BRICK_CATALOG, BrickTypeId } from "./BrickCatalog";
import { BASEPLATE_STUDS } from "./GridSystem";
import { SavedBuild, SavedBrickData } from "./BuildStorage";
import { WorldType, WorldSize, WorldChunkData, groupBricksIntoChunks } from "./WorldStorage";

export interface ValidationReport {
  build: SavedBuild;
  warnings: string[];
}

/**
 * Defensive validator that inspects a loaded build object and drops invalid
 * or corrupt bricks with warnings rather than crashing the entire build.
 */
export function validateBuildData(raw: unknown): ValidationReport {
  const warnings: string[] = [];

  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid build data: payload must be a JSON object");
  }

  const obj = raw as Record<string, unknown>;

  // Basic envelope validation
  const id = typeof obj.id === "string" && obj.id.trim() ? obj.id : `build_${Date.now()}`;
  const name = typeof obj.name === "string" && obj.name.trim() ? obj.name.slice(0, 80) : "Untitled Build";
  const version = typeof obj.version === "number" ? obj.version : 1;
  const createdAt = typeof obj.createdAt === "string" ? obj.createdAt : new Date().toISOString();
  const updatedAt = typeof obj.updatedAt === "string" ? obj.updatedAt : new Date().toISOString();

  const rawSettings = (obj.settings && typeof obj.settings === "object") ? obj.settings as Record<string, unknown> : {};
  const baseplateSize = typeof rawSettings.baseplateSize === "number" && rawSettings.baseplateSize > 0
    ? rawSettings.baseplateSize
    : BASEPLATE_STUDS;

  const validBricks: SavedBrickData[] = [];
  const rawBricks = Array.isArray(obj.bricks) ? obj.bricks : [];

  for (let i = 0; i < rawBricks.length; i++) {
    const item = rawBricks[i];
    if (!item || typeof item !== "object") {
      warnings.push(`Skipping brick #${i}: malformed object`);
      continue;
    }

    const b = item as Record<string, unknown>;

    // Validate type in catalog
    const typeKey = String(b.type || "");
    if (!typeKey || !(typeKey in BRICK_CATALOG)) {
      warnings.push(`Skipping brick #${i}: unrecognized brick type "${typeKey}"`);
      continue;
    }

    // Validate rotation (must be 0 or 90)
    const rotNum = Number(b.rotation);
    const rotation = (rotNum === 90 ? 90 : 0) as 0 | 90;

    // Validate coordinates
    const gridX = Number(b.gridX);
    const gridY = Number(b.gridY);
    const gridZ = Number(b.gridZ);

    if (!Number.isFinite(gridX) || !Number.isFinite(gridY) || !Number.isFinite(gridZ)) {
      warnings.push(`Skipping brick #${i}: coordinates not finite or NaN`);
      continue;
    }

    // Validate color
    const color = typeof b.color === "string" && b.color.trim() ? b.color.trim() : "#e02626";
    const brickId = typeof b.id === "string" && b.id.trim() ? b.id : `brick_${Date.now()}_${i}`;

    validBricks.push({
      id: brickId,
      type: typeKey as BrickTypeId,
      color,
      gridX: Math.round(gridX),
      gridY: Math.round(gridY),
      gridZ: Math.round(gridZ),
      rotation,
    });
  }

  const worldType = (obj.worldType as WorldType) || "island";
  const worldSize = (obj.worldSize as WorldSize) || "small";
  const seed = typeof obj.seed === "number" ? obj.seed : (typeof rawSettings.seed === "number" ? rawSettings.seed : 42);
  const playerSpawn: [number, number, number] =
    Array.isArray(obj.playerSpawn) && obj.playerSpawn.length === 3
      ? [Number(obj.playerSpawn[0]), Number(obj.playerSpawn[1]), Number(obj.playerSpawn[2])]
      : [0, 0, 11.2];
  const chunks = (obj.chunks && typeof obj.chunks === "object")
    ? (obj.chunks as Record<string, WorldChunkData>)
    : groupBricksIntoChunks(validBricks);

  const viewDist = rawSettings.viewDistance;
  const viewDistance = (viewDist === "low" || viewDist === "medium" || viewDist === "high") ? viewDist : "medium";

  const build: SavedBuild = {
    id,
    name,
    version,
    worldType,
    worldSize,
    seed,
    createdAt,
    updatedAt,
    playerSpawn,
    chunks,
    settings: {
      viewDistance,
      baseplateSize,
      seed,
    },
    bricks: validBricks,
  };

  return { build, warnings };
}

/**
 * Migration harness for future build format schemas (e.g. v1 -> v2)
 */
export function migrateBuild(raw: unknown): SavedBuild {
  if (!raw || typeof raw !== "object") {
    throw new Error("Cannot migrate invalid build data");
  }

  const obj = raw as Record<string, unknown>;
  const version = typeof obj.version === "number" ? obj.version : 1;

  // Currently at version 1
  if (version === 1) {
    const { build, warnings } = validateBuildData(obj);
    if (warnings.length > 0) {
      console.warn(`[BRICKWORKS Build Migrator] Loaded build with ${warnings.length} warnings:`, warnings);
    }
    return build;
  }

  // Fallback for unversioned legacy or unknown formats
  const { build } = validateBuildData(obj);
  build.version = 1;
  return build;
}

/**
 * Serializes a SavedBuild object into formatted JSON
 */
export function serializeBuild(build: SavedBuild): string {
  return JSON.stringify(build, null, 2);
}

/**
 * Deserializes raw JSON string into a validated, migrated SavedBuild
 */
export function deserializeBuild(jsonString: string): SavedBuild {
  const parsed = JSON.parse(jsonString);
  return migrateBuild(parsed);
}
