import { BrickData, BrickRotation, getBrickFootprint, getChunkKey } from "./GridSystem";
import { BrickTypeId, BRICK_CATALOG } from "./BrickCatalog";

export interface BlueprintRelativeItem {
  id: string;
  type: BrickTypeId;
  color: string;
  relX: number; // Integer offset in studs
  relY: number; // Integer offset in studs (Three.js Z axis)
  relZ: number; // Integer offset in vertical units (Three.js Y axis)
  rotation: BrickRotation;
}

export interface StructureBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  widthStuds: number;
  lengthStuds: number;
  heightUnits: number;
}

export interface StructureMetadata {
  brickCount: number;
  plateCount: number;
  totalBricks: number;
  widthStuds: number;
  lengthStuds: number;
  heightUnits: number;
  bounds: StructureBounds;
  estimatedWeightUnits: number;
}

/**
 * Calculates discrete integer bounding box of a collection of bricks in grid coordinates
 */
export function calculateStructureBounds(
  bricks: Array<Pick<BrickData, "type" | "gridX" | "gridY" | "gridZ" | "rotation">>
): StructureBounds {
  if (bricks.length === 0) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      minZ: 0,
      maxZ: 0,
      widthStuds: 0,
      lengthStuds: 0,
      heightUnits: 0,
    };
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
    heightUnits: maxZ - minZ,
  };
}

/**
 * Returns a deterministic integer pivot point for a collection of bricks
 */
export function calculateStructurePivot(
  bricks: Array<Pick<BrickData, "type" | "gridX" | "gridY" | "gridZ" | "rotation">>
): [number, number, number] {
  const bounds = calculateStructureBounds(bricks);
  const pivotX = bounds.minX + Math.floor(bounds.widthStuds / 2);
  const pivotY = bounds.minY + Math.floor(bounds.lengthStuds / 2);
  const pivotZ = bounds.minZ;
  return [pivotX, pivotY, pivotZ];
}

/**
 * Converts world-positioned bricks into relative items relative to an anchor
 */
export function toRelativeBrickPositions(bricks: BrickData[]): {
  anchor: { gridX: number; gridY: number; gridZ: number };
  items: BlueprintRelativeItem[];
} {
  if (bricks.length === 0) {
    return { anchor: { gridX: 0, gridY: 0, gridZ: 0 }, items: [] };
  }

  // Anchor is the lowest, bottom-left brick
  const sorted = [...bricks].sort((a, b) => {
    if (a.gridZ !== b.gridZ) return a.gridZ - b.gridZ;
    if (a.gridX !== b.gridX) return a.gridX - b.gridX;
    return a.gridY - b.gridY;
  });

  const anchor = {
    gridX: sorted[0].gridX,
    gridY: sorted[0].gridY,
    gridZ: sorted[0].gridZ,
  };

  const items: BlueprintRelativeItem[] = bricks.map((b) => ({
    id: b.id,
    type: b.type,
    color: b.color,
    relX: b.gridX - anchor.gridX,
    relY: b.gridY - anchor.gridY,
    relZ: b.gridZ - anchor.gridZ,
    rotation: b.rotation,
  }));

  return { anchor, items };
}

/**
 * Rotates relative items 90° clockwise with exact integer math and 360° invariance
 */
export function rotateStructureRelative(items: BlueprintRelativeItem[]): BlueprintRelativeItem[] {
  if (items.length <= 1) {
    return items.map((item) => ({
      ...item,
      rotation: (((item.rotation + 90) % 360) as BrickRotation),
    }));
  }

  // Compute 2D bounding box
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

  const rotated = items.map((item) => {
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

  // Re-anchor to minX=0, minY=0
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
 * Returns set of chunk keys ("cx,cz") touched by a structure
 */
export function getAffectedChunks(
  bricks: Array<Pick<BrickData, "type" | "gridX" | "gridY" | "rotation">>
): Set<string> {
  const keys = new Set<string>();
  for (const b of bricks) {
    const { widthStuds, lengthStuds } = getBrickFootprint(b.type, b.rotation);
    // Sample corners to capture all touched chunks
    keys.add(getChunkKey(b.gridX, b.gridY));
    keys.add(getChunkKey(b.gridX + widthStuds - 1, b.gridY));
    keys.add(getChunkKey(b.gridX, b.gridY + lengthStuds - 1));
    keys.add(getChunkKey(b.gridX + widthStuds - 1, b.gridY + lengthStuds - 1));
  }
  return keys;
}

/**
 * Calculates comprehensive size and piece metadata for structure previews
 */
export function getStructureMetadata(bricks: BrickData[]): StructureMetadata {
  const bounds = calculateStructureBounds(bricks);
  let plateCount = 0;
  let brickCount = 0;

  for (const b of bricks) {
    const def = BRICK_CATALOG[b.type];
    if (def?.category === "plate") {
      plateCount++;
    } else {
      brickCount++;
    }
  }

  return {
    brickCount,
    plateCount,
    totalBricks: bricks.length,
    widthStuds: bounds.widthStuds,
    lengthStuds: bounds.lengthStuds,
    heightUnits: bounds.heightUnits,
    bounds,
    estimatedWeightUnits: brickCount * 3 + plateCount,
  };
}
