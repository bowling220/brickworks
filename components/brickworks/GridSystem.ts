import { BRICK_CATALOG, BrickTypeId } from "./BrickCatalog";

export const STUD_PITCH = 0.8;
export const VERTICAL_UNIT_HEIGHT = 0.32; // 3 vertical units = 0.96 (1 full brick), 1 unit = 0.32 (1 plate/tile)
export const BRICK_HEIGHT = VERTICAL_UNIT_HEIGHT * 3; // 0.96
export const CHUNK_SIZE = 16; // 16x16 studs per chunk (12.8m x 12.8m)
export const CHUNK_WIDTH_WORLD = CHUNK_SIZE * STUD_PITCH; // 12.8 world units

// Legacy constants
export const BASEPLATE_STUDS = 32;
export const BASEPLATE_HALF_WIDTH = (BASEPLATE_STUDS * STUD_PITCH) / 2; // 12.8

export type BrickRotation = 0 | 90 | 180 | 270;

export interface BrickData {
  id: string;
  type: BrickTypeId;
  color: string;
  gridX: number; // Integer stud X
  gridY: number; // Integer stud Y (maps to Three.js Z)
  gridZ: number; // Integer vertical layer unit (maps to Three.js Y)
  rotation: BrickRotation; // 0, 90, 180, 270 degrees
}

export interface BrickFootprint {
  widthStuds: number; // studs along gridX
  lengthStuds: number; // studs along gridY
  heightUnits: number; // vertical layer units (3 for bricks, 1 for plates)
}

export interface GridCell {
  x: number;
  y: number;
  z: number;
}

export interface ValidationResult {
  isValid: boolean;
  reason?: "out_of_bounds" | "collision" | "unsupported" | "impossible_height";
}

/**
 * Returns footprint dimensions for a brick type and rotation
 */
export function getBrickFootprint(type: BrickTypeId, rotation: BrickRotation | number): BrickFootprint {
  const def = BRICK_CATALOG[type] || BRICK_CATALOG.brick_2x4;
  const isRotated = rotation === 90 || rotation === 270;

  return {
    widthStuds: isRotated ? def.lengthStuds : def.widthStuds,
    lengthStuds: isRotated ? def.widthStuds : def.lengthStuds,
    heightUnits: def.heightUnits,
  };
}

/**
 * Returns all discrete (x, y, z) 1x1 stud 3D cells occupied by a brick
 */
export function getOccupiedCells(
  brick: Pick<BrickData, "type" | "gridX" | "gridY" | "gridZ" | "rotation">
): GridCell[] {
  const { widthStuds, lengthStuds, heightUnits } = getBrickFootprint(brick.type, brick.rotation);
  const cells: GridCell[] = [];

  for (let dx = 0; dx < widthStuds; dx++) {
    for (let dy = 0; dy < lengthStuds; dy++) {
      for (let dz = 0; dz < heightUnits; dz++) {
        cells.push({
          x: brick.gridX + dx,
          y: brick.gridY + dy,
          z: brick.gridZ + dz,
        });
      }
    }
  }
  return cells;
}

/**
 * Chunk coordinate utilities for global integer coordinates
 */
export function getChunkCoords(gridX: number, gridY: number): {
  chunkX: number;
  chunkZ: number;
  localX: number;
  localZ: number;
} {
  const chunkX = Math.floor(gridX / CHUNK_SIZE);
  const chunkZ = Math.floor(gridY / CHUNK_SIZE);
  const localX = gridX - chunkX * CHUNK_SIZE;
  const localZ = gridY - chunkZ * CHUNK_SIZE;
  return { chunkX, chunkZ, localX, localZ };
}

export function getChunkKey(gridX: number, gridY: number): string {
  const chunkX = Math.floor(gridX / CHUNK_SIZE);
  const chunkZ = Math.floor(gridY / CHUNK_SIZE);
  return `${chunkX},${chunkZ}`;
}

/**
 * Converts discrete global grid coordinates and rotation into 3D world coordinates [x, y, z]
 */
export function getWorldPositionFromGrid(
  gridX: number,
  gridY: number,
  gridZ: number,
  rotation: BrickRotation | number,
  type: BrickTypeId = "brick_2x4"
): [number, number, number] {
  const { widthStuds, lengthStuds, heightUnits } = getBrickFootprint(type, rotation);

  const worldX = (gridX + widthStuds / 2) * STUD_PITCH;
  const worldZ = (gridY + lengthStuds / 2) * STUD_PITCH;
  const worldY = (gridZ + heightUnits / 2) * VERTICAL_UNIT_HEIGHT;

  return [worldX, worldY, worldZ];
}

// Backward-compatible alias
export const gridToWorld = getWorldPositionFromGrid;

/**
 * Maps a continuous raycast hit point to discrete (gridX, gridY) on the global stud grid
 */
export function snapRayToGrid(
  hitWorld: [number, number, number],
  rotation: BrickRotation | number,
  type: BrickTypeId = "brick_2x4"
): { gridX: number; gridY: number } {
  const { widthStuds, lengthStuds } = getBrickFootprint(type, rotation);

  const gridX = Math.round(hitWorld[0] / STUD_PITCH - widthStuds / 2);
  const gridY = Math.round(hitWorld[2] / STUD_PITCH - lengthStuds / 2);

  return { gridX, gridY };
}

/**
 * High-performance 3D spatial occupancy index for fast O(1) collision & support lookups
 */
export class OccupancyMap {
  private map = new Map<string, string>(); // "x,y,z" -> brickId
  private columnMaxZ = new Map<string, number>(); // "x,y" -> highest occupied vertical unit Z
  private columnZs = new Map<string, Set<number>>(); // "x,y" -> Set of occupied Zs

  constructor(bricks: BrickData[] = []) {
    this.rebuild(bricks);
  }

  rebuild(bricks: BrickData[]) {
    this.map.clear();
    this.columnMaxZ.clear();
    this.columnZs.clear();

    for (const b of bricks) {
      const cells = getOccupiedCells(b);
      for (const c of cells) {
        this.map.set(`${c.x},${c.y},${c.z}`, b.id);

        const colKey = `${c.x},${c.y}`;
        let zSet = this.columnZs.get(colKey);
        if (!zSet) {
          zSet = new Set<number>();
          this.columnZs.set(colKey, zSet);
        }
        zSet.add(c.z);

        const curMax = this.columnMaxZ.get(colKey);
        if (curMax === undefined || c.z > curMax) {
          this.columnMaxZ.set(colKey, c.z);
        }
      }
    }
  }

  addBrick(brick: BrickData) {
    this.addBricks([brick]);
  }

  addBricks(bricks: BrickData[]) {
    for (const b of bricks) {
      const cells = getOccupiedCells(b);
      for (const c of cells) {
        this.map.set(`${c.x},${c.y},${c.z}`, b.id);

        const colKey = `${c.x},${c.y}`;
        let zSet = this.columnZs.get(colKey);
        if (!zSet) {
          zSet = new Set<number>();
          this.columnZs.set(colKey, zSet);
        }
        zSet.add(c.z);

        const curMax = this.columnMaxZ.get(colKey);
        if (curMax === undefined || c.z > curMax) {
          this.columnMaxZ.set(colKey, c.z);
        }
      }
    }
  }

  removeBricks(bricks: BrickData[]) {
    for (const b of bricks) {
      const cells = getOccupiedCells(b);
      for (const c of cells) {
        this.map.delete(`${c.x},${c.y},${c.z}`);

        const colKey = `${c.x},${c.y}`;
        const zSet = this.columnZs.get(colKey);
        if (zSet) {
          zSet.delete(c.z);
          if (zSet.size === 0) {
            this.columnZs.delete(colKey);
            this.columnMaxZ.delete(colKey);
          } else if (this.columnMaxZ.get(colKey) === c.z) {
            let newMax = -Infinity;
            for (const z of zSet) {
              if (z > newMax) newMax = z;
            }
            this.columnMaxZ.set(colKey, newMax);
          }
        }
      }
    }
  }

  isCellOccupied(x: number, y: number, z: number): boolean {
    return this.map.has(`${x},${y},${z}`);
  }

  getBrickAt(x: number, y: number, z: number): string | undefined {
    return this.map.get(`${x},${y},${z}`);
  }

  getHighestOccupiedZ(x: number, y: number): number | undefined {
    return this.columnMaxZ.get(`${x},${y}`);
  }

  size(): number {
    return this.map.size;
  }
}

/**
 * Automatically determines the highest supporting vertical unit beneath a candidate footprint.
 * Resolves against both existing placed bricks AND procedural terrain height!
 */
export function resolveStackHeight(
  occupancy: OccupancyMap,
  gridX: number,
  gridY: number,
  rotation: BrickRotation | number,
  type: BrickTypeId = "brick_2x4",
  terrainHeightProvider?: (gx: number, gy: number) => number
): number {
  const { widthStuds, lengthStuds } = getBrickFootprint(type, rotation);
  let maxSupportingZ = -Infinity;

  for (let dx = 0; dx < widthStuds; dx++) {
    for (let dy = 0; dy < lengthStuds; dy++) {
      const colZ = occupancy.getHighestOccupiedZ(gridX + dx, gridY + dy);
      if (colZ !== undefined && colZ > maxSupportingZ) {
        maxSupportingZ = colZ;
      }
    }
  }

  // If a brick exists underneath, stack directly on top of it
  if (maxSupportingZ !== -Infinity) {
    return maxSupportingZ + 1;
  }

  // Otherwise, calculate ground foundation height on terrain
  if (terrainHeightProvider) {
    let maxTerrainZ = -Infinity;
    for (let dx = 0; dx < widthStuds; dx++) {
      for (let dy = 0; dy < lengthStuds; dy++) {
        const tz = terrainHeightProvider(gridX + dx, gridY + dy);
        if (tz > maxTerrainZ) {
          maxTerrainZ = tz;
        }
      }
    }
    return maxTerrainZ !== -Infinity ? maxTerrainZ : 0;
  }

  return 0; // Default flat ground
}

/**
 * Checks whether a candidate brick placement is valid:
 * 1. Does not collide with existing placed bricks across its heightUnits
 * 2. Has support underneath (terrain foundation or existing brick)
 * 3. Does not slice into terrain cliffs
 */
export function validatePlacement(
  occupancy: OccupancyMap,
  candidate: Pick<BrickData, "type" | "gridX" | "gridY" | "gridZ" | "rotation"> & {
    color?: string;
    id?: string;
  },
  terrainHeightProvider?: (gx: number, gy: number) => number
): ValidationResult {
  const { widthStuds, lengthStuds } = getBrickFootprint(candidate.type, candidate.rotation);

  // 1. Collision check across all vertical units against existing bricks
  const cells = getOccupiedCells(candidate);
  for (const c of cells) {
    if (occupancy.isCellOccupied(c.x, c.y, c.z)) {
      return { isValid: false, reason: "collision" };
    }
  }

  // Check if brick is supported by an existing placed brick underneath
  let hasBrickSupport = false;
  for (let dx = 0; dx < widthStuds; dx++) {
    for (let dy = 0; dy < lengthStuds; dy++) {
      if (occupancy.isCellOccupied(candidate.gridX + dx, candidate.gridY + dy, candidate.gridZ - 1)) {
        hasBrickSupport = true;
        break;
      }
    }
    if (hasBrickSupport) break;
  }

  // 2. Terrain foundation check
  if (terrainHeightProvider) {
    let maxTerrainZ = -Infinity;
    let minTerrainZ = Infinity;
    let hasVoid = false;

    for (let dx = 0; dx < widthStuds; dx++) {
      for (let dy = 0; dy < lengthStuds; dy++) {
        const tz = terrainHeightProvider(candidate.gridX + dx, candidate.gridY + dy);
        if (tz <= -900) {
          hasVoid = true;
        }
        if (tz > maxTerrainZ) maxTerrainZ = tz;
        if (tz < minTerrainZ) minTerrainZ = tz;
      }
    }

    // Void placement rejection: When foundation is over void (height <= -900), reject placement
    if (hasVoid && !hasBrickSupport) {
      return { isValid: false, reason: "out_of_bounds" };
    }

    // Brick cannot slice under rising terrain
    if (maxTerrainZ > -900 && candidate.gridZ < maxTerrainZ) {
      return { isValid: false, reason: "collision" };
    }

    // If resting on ground without brick support underneath, slope under the footprint must not exceed 2 vertical units
    if (!hasBrickSupport && candidate.gridZ === maxTerrainZ && maxTerrainZ - minTerrainZ > 2) {
      return { isValid: false, reason: "unsupported" };
    }

    // Sits directly on valid terrain foundation
    if (maxTerrainZ > -900 && candidate.gridZ === maxTerrainZ) {
      return { isValid: true };
    }
  } else {
    // Default flat ground (gridZ === 0)
    if (candidate.gridZ === 0) {
      return { isValid: true };
    }
  }

  // 3. Support check for elevated layers
  if (!hasBrickSupport) {
    return { isValid: false, reason: "unsupported" };
  }

  return { isValid: true };
}

// Backward-compatible alias
export function canPlaceBrick(
  placedBricks: BrickData[],
  candidate: Pick<BrickData, "type" | "gridX" | "gridY" | "gridZ" | "rotation">
): boolean {
  const occupancy = new OccupancyMap(placedBricks);
  return validatePlacement(occupancy, candidate).isValid;
}

/**
 * Returns bounds (min/max in discrete grid coordinates) of a collection of bricks
 */
export function getBricksBounds(bricks: BrickData[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
} | null {
  if (bricks.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const b of bricks) {
    const { widthStuds, lengthStuds, heightUnits } = getBrickFootprint(b.type, b.rotation);
    if (b.gridX < minX) minX = b.gridX;
    if (b.gridX + widthStuds > maxX) maxX = b.gridX + widthStuds;
    if (b.gridY < minY) minY = b.gridY;
    if (b.gridY + lengthStuds > maxY) maxY = b.gridY + lengthStuds;
    if (b.gridZ < minZ) minZ = b.gridZ;
    if (b.gridZ + heightUnits > maxZ) maxZ = b.gridZ + heightUnits;
  }

  return { minX, maxX, minY, maxY, minZ, maxZ };
}
