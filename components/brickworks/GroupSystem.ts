import { BrickData, BrickRotation, getBrickFootprint, OccupancyMap } from "./GridSystem";
import { GhostBrickItem } from "./GroupGhost";
import { mirrorRotation } from "./ToolMath";

export interface GroupRelativeItem {
  id: string;
  type: BrickData["type"];
  color: string;
  relX: number; // offset relative to anchor in studs
  relY: number;
  relZ: number; // offset relative to anchor in vertical units
  rotation: BrickRotation;
}

export interface GroupStructure {
  anchorId: string;
  items: GroupRelativeItem[];
}

/**
 * Calculates discrete bounding box of a group of bricks in grid coordinates
 */
export function getGroupBounds(bricks: BrickData[]) {
  if (bricks.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0, widthStuds: 0, lengthStuds: 0 };
  }

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

  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    widthStuds: maxX - minX,
    lengthStuds: maxY - minY,
  };
}

/**
 * Creates a normalized group structure relative to an anchor brick
 */
export function createGroupStructure(bricks: BrickData[]): GroupStructure {
  if (bricks.length === 0) {
    return { anchorId: "", items: [] };
  }

  // Anchor is the lowest, most bottom-left brick
  const sorted = [...bricks].sort((a, b) => {
    if (a.gridZ !== b.gridZ) return a.gridZ - b.gridZ;
    if (a.gridX !== b.gridX) return a.gridX - b.gridX;
    return a.gridY - b.gridY;
  });

  const anchor = sorted[0];

  const items: GroupRelativeItem[] = bricks.map((b) => ({
    id: b.id,
    type: b.type,
    color: b.color,
    relX: b.gridX - anchor.gridX,
    relY: b.gridY - anchor.gridY,
    relZ: b.gridZ - anchor.gridZ,
    rotation: b.rotation,
  }));

  return {
    anchorId: anchor.id,
    items,
  };
}

/**
 * Rotates relative offsets of a group by 90 degrees clockwise around group center using discrete integer math
 */
export function rotateGroupRelativeItems(items: GroupRelativeItem[]): GroupRelativeItem[] {
  if (items.length <= 1) {
    return items.map((item) => ({
      ...item,
      rotation: (((item.rotation + 90) % 360) as BrickRotation),
    }));
  }

  // Find 2D bounds of items footprint
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    const { widthStuds, lengthStuds } = getBrickFootprint(item.type, item.rotation);
    if (item.relX < minX) minX = item.relX;
    if (item.relX + widthStuds > maxX) maxX = item.relX + widthStuds;
    if (item.relY < minY) minY = item.relY;
    if (item.relY + lengthStuds > maxY) maxY = item.relY + lengthStuds;
  }

  const groupWidth = maxX - minX;

  // 90-deg clockwise rotation in grid space:
  const rotated: GroupRelativeItem[] = items.map((item) => {
    const nextRot = (((item.rotation + 90) % 360) as BrickRotation);
    const { widthStuds: nextWidth } = getBrickFootprint(item.type, nextRot);

    const localX = item.relX - minX;
    const localY = item.relY - minY;

    const newLocalX = localY;
    const newLocalY = groupWidth - (localX + nextWidth);

    return {
      ...item,
      relX: newLocalX,
      relY: newLocalY,
      rotation: nextRot,
    };
  });

  // Re-anchor so minX and minY start at 0
  let newMinX = Infinity;
  let newMinY = Infinity;
  for (const r of rotated) {
    if (r.relX < newMinX) newMinX = r.relX;
    if (r.relY < newMinY) newMinY = r.relY;
  }

  return rotated.map((r) => ({
    ...r,
    relX: r.relX - newMinX,
    relY: r.relY - newMinY,
  }));
}

/**
 * Mirrors relative offsets of a group across X or Z axis
 */
export function mirrorGroupRelativeItems(items: GroupRelativeItem[], axis: "x" | "z"): GroupRelativeItem[] {
  if (items.length === 0) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    const { widthStuds, lengthStuds } = getBrickFootprint(item.type, item.rotation);
    if (item.relX < minX) minX = item.relX;
    if (item.relX + widthStuds > maxX) maxX = item.relX + widthStuds;
    if (item.relY < minY) minY = item.relY;
    if (item.relY + lengthStuds > maxY) maxY = item.relY + lengthStuds;
  }

  const groupWidth = maxX - minX;
  const groupLength = maxY - minY;

  const mirrored: GroupRelativeItem[] = items.map((item) => {
    const nextRot = mirrorRotation(item.rotation, axis);
    const { widthStuds: nextWidth, lengthStuds: nextLength } = getBrickFootprint(item.type, nextRot);

    const localX = item.relX - minX;
    const localY = item.relY - minY;

    let newLocalX = localX;
    let newLocalY = localY;

    if (axis === "x") {
      newLocalX = groupWidth - (localX + nextWidth);
    } else {
      newLocalY = groupLength - (localY + nextLength);
    }

    return {
      ...item,
      relX: newLocalX,
      relY: newLocalY,
      rotation: nextRot,
    };
  });

  let newMinX = Infinity;
  let newMinY = Infinity;
  for (const m of mirrored) {
    if (m.relX < newMinX) newMinX = m.relX;
    if (m.relY < newMinY) newMinY = m.relY;
  }

  return mirrored.map((m) => ({
    ...m,
    relX: m.relX - newMinX,
    relY: m.relY - newMinY,
  }));
}

/**
 * Resolves candidate grid positions for all items in a group anchored at (anchorGridX, anchorGridY)
 */
export function resolveGroupCandidatePositions(
  items: GroupRelativeItem[],
  anchorGridX: number,
  anchorGridY: number,
  occupancy: OccupancyMap,
  terrainHeightProvider?: (gx: number, gy: number) => number
): { candidates: GhostBrickItem[]; isValid: boolean; reason?: string } {
  if (items.length === 0) {
    return { candidates: [], isValid: false };
  }

  // 1. Find minRelZ of items
  let minRelZ = Infinity;
  for (const item of items) {
    if (item.relZ < minRelZ) minRelZ = item.relZ;
  }

  // 2. Determine ground/terrain elevation and minimum requiredBaseZ
  let maxTerrainZ = 0;
  let hasVoid = false;

  if (terrainHeightProvider) {
    let highestTz = -Infinity;
    for (const item of items) {
      const itemGridX = anchorGridX + item.relX;
      const itemGridY = anchorGridY + item.relY;
      const { widthStuds, lengthStuds } = getBrickFootprint(item.type, item.rotation);

      for (let dx = 0; dx < widthStuds; dx++) {
        for (let dy = 0; dy < lengthStuds; dy++) {
          const tz = terrainHeightProvider(itemGridX + dx, itemGridY + dy);
          if (tz <= -900) {
            hasVoid = true;
          } else if (tz > highestTz) {
            highestTz = tz;
          }
        }
      }
    }
    maxTerrainZ = highestTz !== -Infinity ? highestTz : 0;
  }

  let requiredBaseZ = terrainHeightProvider ? maxTerrainZ - minRelZ : Math.max(0, -minRelZ);

  // Check external bricks in occupancy to prevent penetration
  for (const item of items) {
    const itemGridX = anchorGridX + item.relX;
    const itemGridY = anchorGridY + item.relY;
    const { widthStuds, lengthStuds } = getBrickFootprint(item.type, item.rotation);

    for (let dx = 0; dx < widthStuds; dx++) {
      for (let dy = 0; dy < lengthStuds; dy++) {
        const colZ = occupancy.getHighestOccupiedZ(itemGridX + dx, itemGridY + dy);
        if (colZ !== undefined) {
          // A brick is below. To clear it: candGridZ >= colZ + 1
          // baseZ + item.relZ >= colZ + 1 => baseZ >= colZ + 1 - item.relZ
          const needed = colZ + 1 - item.relZ;
          if (needed > requiredBaseZ) {
            requiredBaseZ = needed;
          }
        }
      }
    }
  }

  // 3. Construct candidate positions
  const candidates: GhostBrickItem[] = items.map((item) => ({
    id: item.id,
    type: item.type,
    color: item.color,
    gridX: anchorGridX + item.relX,
    gridY: anchorGridY + item.relY,
    gridZ: requiredBaseZ + item.relZ,
    rotation: item.rotation,
  }));

  // 4. Validate external collision against placed bricks
  for (const cand of candidates) {
    const { widthStuds, lengthStuds, heightUnits } = getBrickFootprint(cand.type, cand.rotation);

    for (let dx = 0; dx < widthStuds; dx++) {
      for (let dy = 0; dy < lengthStuds; dy++) {
        for (let dz = 0; dz < heightUnits; dz++) {
          if (occupancy.isCellOccupied(cand.gridX + dx, cand.gridY + dy, cand.gridZ + dz)) {
            return { candidates, isValid: false, reason: "collision" };
          }
        }
      }
    }
  }

  // 5. Support check for the group as a whole
  // The group is supported if:
  // - At least one bottom brick rests on solid ground/terrain (not void)
  // - OR at least one brick in the group rests on top of an external occupied brick
  let hasExternalSupport = false;

  for (const cand of candidates) {
    const { widthStuds, lengthStuds } = getBrickFootprint(cand.type, cand.rotation);

    if (terrainHeightProvider) {
      let restingOnTerrain = false;
      for (let dx = 0; dx < widthStuds; dx++) {
        for (let dy = 0; dy < lengthStuds; dy++) {
          const tz = terrainHeightProvider(cand.gridX + dx, cand.gridY + dy);
          if (tz > -900 && cand.gridZ === tz) {
            restingOnTerrain = true;
            break;
          }
        }
        if (restingOnTerrain) break;
      }
      if (restingOnTerrain) {
        hasExternalSupport = true;
        break;
      }
    } else {
      if (cand.gridZ === 0 || cand.gridZ === requiredBaseZ + minRelZ) {
        hasExternalSupport = true;
        break;
      }
    }

    for (let dx = 0; dx < widthStuds; dx++) {
      for (let dy = 0; dy < lengthStuds; dy++) {
        if (occupancy.isCellOccupied(cand.gridX + dx, cand.gridY + dy, cand.gridZ - 1)) {
          hasExternalSupport = true;
          break;
        }
      }
      if (hasExternalSupport) break;
    }
    if (hasExternalSupport) break;
  }

  // Void rejection: if candidate group foundation is over void without brick support underneath
  if (hasVoid && !hasExternalSupport) {
    return { candidates, isValid: false, reason: "out_of_bounds" };
  }

  if (!hasExternalSupport) {
    return { candidates, isValid: false, reason: "unsupported" };
  }

  return { candidates, isValid: true };
}
