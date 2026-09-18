import * as THREE from "three";
import { CHUNK_SIZE, STUD_PITCH, VERTICAL_UNIT_HEIGHT, BrickData, getBrickFootprint } from "./GridSystem";
import { WorldType, WorldSize, ChunkTerrainMod, TerrainMaterialType } from "./WorldStorage";
import { sampleTerrain } from "./TerrainGenerator";

export type TerrainTool = "raise" | "lower" | "flatten" | "smooth" | "paint";
export type TerrainToolType = TerrainTool;
export type BrushSizePreset = "small" | "medium" | "large";
export type BrushStrengthPreset = "low" | "medium" | "high";

export const BRUSH_SIZE_CONFIG: Record<BrushSizePreset, { radius: number; label: string }> = {
  small: { radius: 2.0, label: "Small (2.5 studs)" },
  medium: { radius: 3.8, label: "Medium (4.8 studs)" },
  large: { radius: 6.4, label: "Large (8.0 studs)" },
};

export const BRUSH_STRENGTH_CONFIG: Record<BrushStrengthPreset, { factor: number; label: string }> = {
  low: { factor: 0.35, label: "Gentle" },
  medium: { factor: 0.7, label: "Normal" },
  high: { factor: 1.2, label: "Strong" },
};

export const TERRAIN_CHUNK_RES = 8; // 8x8 quads per 16-stud chunk
export const TERRAIN_CHUNK_STEP = (CHUNK_SIZE * STUD_PITCH) / TERRAIN_CHUNK_RES; // 1.6m

export interface TerrainBrushConfig {
  tool: TerrainTool;
  sizePreset?: BrushSizePreset;
  strengthPreset?: BrushStrengthPreset;
  size?: number;
  strength?: number;
  paintMaterial?: TerrainMaterialType;
  material?: TerrainMaterialType;
  flattenTargetHeight?: number | null;
}

export interface BrushApplyContext {
  centerPoint: THREE.Vector3;
  config: TerrainBrushConfig;
  worldType: WorldType;
  worldSize: WorldSize;
  seed: number;
  existingChunks: Record<string, { terrainMod?: ChunkTerrainMod }>;
  placedBricks: BrickData[];
  dt: number; // Delta time in seconds for continuous brush hold
}

export interface TerrainModificationResult {
  modifiedChunks: Record<string, ChunkTerrainMod>;
  affectedChunkKeys: string[];
}

/**
 * Gets base procedural height for a vertex before any modifications
 */
export function getBaseVertexHeight(
  worldType: WorldType,
  worldSize: WorldSize,
  seed: number,
  wx: number,
  wz: number
): number {
  const sample = sampleTerrain(worldType, worldSize, seed, wx, wz);
  return sample.isVoid ? -999 : sample.heightWorld;
}

/**
 * Checks if a vertex is directly beneath or immediately adjacent to any player-built brick
 */
function getBrickHeightConstraint(
  wx: number,
  wz: number,
  placedBricks: BrickData[]
): { hasBrick: boolean; minBrickY: number; maxBrickY: number } {
  let hasBrick = false;
  let minBrickY = Infinity;
  let maxBrickY = -Infinity;

  for (const b of placedBricks) {
    const footprint = getBrickFootprint(b.type, b.rotation);
    const bMinX = b.gridX * STUD_PITCH - 0.2;
    const bMaxX = (b.gridX + footprint.widthStuds) * STUD_PITCH + 0.2;
    const bMinZ = b.gridY * STUD_PITCH - 0.2;
    const bMaxZ = (b.gridY + footprint.lengthStuds) * STUD_PITCH + 0.2;

    if (wx >= bMinX && wx <= bMaxX && wz >= bMinZ && wz <= bMaxZ) {
      hasBrick = true;
      const bY = b.gridZ * VERTICAL_UNIT_HEIGHT;
      if (bY < minBrickY) minBrickY = bY;
      if (bY > maxBrickY) maxBrickY = bY;
    }
  }

  return { hasBrick, minBrickY, maxBrickY };
}

/**
 * Executes a terrain brush application across all chunks intersecting the brush radius
 */
export function applyTerrainBrush(ctx: BrushApplyContext): TerrainModificationResult {
  const {
    centerPoint,
    config,
    worldType,
    worldSize,
    seed,
    existingChunks,
    placedBricks,
    dt,
  } = ctx;

  const radius = typeof config.size === "number" ? config.size : BRUSH_SIZE_CONFIG[config.sizePreset || "medium"].radius;
  const strength = typeof config.strength === "number" ? config.strength : BRUSH_STRENGTH_CONFIG[config.strengthPreset || "medium"].factor;
  const targetMaterial = config.material || config.paintMaterial || "grass";
  const centerWx = centerPoint.x;
  const centerWz = centerPoint.z;

  const minWx = centerWx - radius;
  const maxWx = centerWx + radius;
  const minWz = centerWz - radius;
  const maxWz = centerWz + radius;

  const chunkSpan = CHUNK_SIZE * STUD_PITCH;
  const minChunkX = Math.floor(minWx / chunkSpan);
  const maxChunkX = Math.floor(maxWx / chunkSpan);
  const minChunkZ = Math.floor(minWz / chunkSpan);
  const maxChunkZ = Math.floor(maxWz / chunkSpan);

  const modifiedChunks: Record<string, ChunkTerrainMod> = {};
  const affectedChunkKeys: string[] = [];

  // 1. Gather all vertices within the brush radius to support operations like Smooth
  const affectedVertices: Array<{
    chunkKey: string;
    chunkX: number;
    chunkZ: number;
    vertIndex: number;
    wx: number;
    wz: number;
    currentHeight: number;
    dist: number;
    falloff: number;
  }> = [];

  let sumHeight = 0;
  let countVerts = 0;

  for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      const chunkKey = `${cx},${cz}`;
      const chunkOriginX = cx * chunkSpan;
      const chunkOriginZ = cz * chunkSpan;

      const existingMod = existingChunks[chunkKey]?.terrainMod;

      for (let iz = 0; iz <= TERRAIN_CHUNK_RES; iz++) {
        for (let ix = 0; ix <= TERRAIN_CHUNK_RES; ix++) {
          const vertIndex = iz * (TERRAIN_CHUNK_RES + 1) + ix;
          const wx = chunkOriginX + ix * TERRAIN_CHUNK_STEP;
          const wz = chunkOriginZ + iz * TERRAIN_CHUNK_STEP;

          const dist = Math.hypot(wx - centerWx, wz - centerWz);
          if (dist > radius) continue;

          // Compute smoothstep falloff: 1 at center, 0 at boundary
          const t = 1 - dist / radius;
          const falloff = t * t * (3 - 2 * t);

          let currentHeight = existingMod?.heights?.[vertIndex];
          if (currentHeight === undefined) {
            currentHeight = getBaseVertexHeight(worldType, worldSize, seed, wx, wz);
          }

          // Skip void vertices (e.g. outside floating island)
          if (currentHeight <= -500) continue;

          affectedVertices.push({
            chunkKey,
            chunkX: cx,
            chunkZ: cz,
            vertIndex,
            wx,
            wz,
            currentHeight,
            dist,
            falloff,
          });

          sumHeight += currentHeight;
          countVerts++;
        }
      }
    }
  }

  if (affectedVertices.length === 0) {
    return { modifiedChunks: {}, affectedChunkKeys: [] };
  }

  const avgHeight = countVerts > 0 ? sumHeight / countVerts : centerPoint.y;
  const targetFlatten = typeof config.flattenTargetHeight === "number" ? config.flattenTargetHeight : centerPoint.y;

  // 2. Apply deformation / painting to all affected vertices
  for (const v of affectedVertices) {
    if (!modifiedChunks[v.chunkKey]) {
      const existing = existingChunks[v.chunkKey]?.terrainMod;
      modifiedChunks[v.chunkKey] = {
        heights: { ...(existing?.heights || {}) },
        materials: { ...(existing?.materials || {}) },
      };
      affectedChunkKeys.push(v.chunkKey);
    }

    const mod = modifiedChunks[v.chunkKey];
    const brickCheck = getBrickHeightConstraint(v.wx, v.wz, placedBricks);

    if (config.tool === "raise") {
      const delta = 1.4 * strength * v.falloff * Math.min(dt, 0.1);
      let newH = v.currentHeight + delta;

      // Brick safety constraint: do not push terrain through brick floor
      if (brickCheck.hasBrick && newH >= brickCheck.minBrickY) {
        newH = Math.min(newH, brickCheck.minBrickY - 0.05);
      }
      mod.heights![v.vertIndex] = Number(newH.toFixed(3));
    } else if (config.tool === "lower") {
      const delta = 1.4 * strength * v.falloff * Math.min(dt, 0.1);
      let newH = Math.max(-4.5, v.currentHeight - delta);

      // Brick safety constraint: prevent carving away ground under bricks
      if (brickCheck.hasBrick && v.currentHeight <= brickCheck.minBrickY + 0.1) {
        newH = Math.max(newH, v.currentHeight);
      }
      mod.heights![v.vertIndex] = Number(newH.toFixed(3));
    } else if (config.tool === "flatten") {
      const lerpSpeed = Math.min(1, 3.5 * strength * v.falloff * Math.min(dt, 0.1));
      let newH = v.currentHeight + (targetFlatten - v.currentHeight) * lerpSpeed;

      if (brickCheck.hasBrick && newH >= brickCheck.minBrickY) {
        newH = Math.min(newH, brickCheck.minBrickY - 0.05);
      }
      mod.heights![v.vertIndex] = Number(newH.toFixed(3));
    } else if (config.tool === "smooth") {
      const lerpSpeed = Math.min(1, 2.5 * strength * v.falloff * Math.min(dt, 0.1));
      let newH = v.currentHeight + (avgHeight - v.currentHeight) * lerpSpeed;

      if (brickCheck.hasBrick && newH >= brickCheck.minBrickY) {
        newH = Math.min(newH, brickCheck.minBrickY - 0.05);
      }
      mod.heights![v.vertIndex] = Number(newH.toFixed(3));
    } else if (config.tool === "paint") {
      if (v.falloff > 0.15) {
        mod.materials![v.vertIndex] = targetMaterial;
      }
    }
  }

  return {
    modifiedChunks,
    affectedChunkKeys,
  };
}
