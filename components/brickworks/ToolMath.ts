import { BrickData, BrickRotation, getBrickFootprint } from "./GridSystem";
import { BrickTypeId } from "./BrickCatalog";

export interface GridPoint {
  gridX: number;
  gridY: number;
  gridZ: number;
}

/**
 * Transforms part rotation under horizontal axis mirroring (0°, 90°, 180°, 270°)
 * Guaranteed 2x mirror = exact original rotation.
 */
export function mirrorRotation(rotation: BrickRotation | number, axis: "x" | "z"): BrickRotation {
  const rot = ((rotation % 360) + 360) % 360;
  if (axis === "x") {
    // Flip across X axis (horizontal):
    // 0° (along +X) <-> 180° (along -X)
    // 90° (along +Z) and 270° (along -Z) remain
    if (rot === 0) return 180;
    if (rot === 180) return 0;
    return (rot as BrickRotation);
  } else {
    // Flip across Z axis (depth / gridY):
    // 90° (along +Z) <-> 270° (along -Z)
    // 0° and 180° remain
    if (rot === 90) return 270;
    if (rot === 270) return 90;
    return (rot as BrickRotation);
  }
}

/**
 * Generates a straight line / wall of repeated bricks between start and end coordinates.
 * Constrained to cardinal grid axes (X or Y/Z).
 */
export function generateLineBricks(
  start: GridPoint,
  end: GridPoint,
  type: BrickTypeId,
  color: string,
  rotation: BrickRotation
): BrickData[] {
  const fp = getBrickFootprint(type, rotation);
  const dx = end.gridX - start.gridX;
  const dy = end.gridY - start.gridY;

  const bricks: BrickData[] = [];
  const startZ = start.gridZ;

  // Decide dominant axis
  if (Math.abs(dx) >= Math.abs(dy)) {
    // Along X axis
    const step = fp.widthStuds;
    const direction = dx >= 0 ? 1 : -1;
    const totalDist = Math.abs(dx);
    const count = Math.max(1, Math.floor(totalDist / step) + 1);

    for (let i = 0; i < count; i++) {
      const gx = start.gridX + (direction >= 0 ? i * step : -(i + 1) * step + 1);
      bricks.push({
        id: `line-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type,
        color,
        gridX: gx,
        gridY: start.gridY,
        gridZ: startZ,
        rotation,
      });
    }
  } else {
    // Along Y/Z axis
    const step = fp.lengthStuds;
    const direction = dy >= 0 ? 1 : -1;
    const totalDist = Math.abs(dy);
    const count = Math.max(1, Math.floor(totalDist / step) + 1);

    for (let i = 0; i < count; i++) {
      const gy = start.gridY + (direction >= 0 ? i * step : -(i + 1) * step + 1);
      bricks.push({
        id: `line-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type,
        color,
        gridX: start.gridX,
        gridY: gy,
        gridZ: startZ,
        rotation,
      });
    }
  }

  return bricks;
}

/**
 * Generates a 2D tiled floor / area of repeated bricks between two opposite corners.
 */
export function generateAreaBricks(
  cornerA: GridPoint,
  cornerB: GridPoint,
  type: BrickTypeId,
  color: string,
  rotation: BrickRotation
): BrickData[] {
  const fp = getBrickFootprint(type, rotation);
  const minX = Math.min(cornerA.gridX, cornerB.gridX);
  const maxX = Math.max(cornerA.gridX, cornerB.gridX);
  const minY = Math.min(cornerA.gridY, cornerB.gridY);
  const maxY = Math.max(cornerA.gridY, cornerB.gridY);
  const z = cornerA.gridZ;

  const totalWidth = maxX - minX + 1;
  const totalLength = maxY - minY + 1;

  const countX = Math.max(1, Math.floor(totalWidth / fp.widthStuds));
  const countY = Math.max(1, Math.floor(totalLength / fp.lengthStuds));

  const bricks: BrickData[] = [];
  let idx = 0;

  for (let ix = 0; ix < countX; ix++) {
    for (let iy = 0; iy < countY; iy++) {
      const gx = minX + ix * fp.widthStuds;
      const gy = minY + iy * fp.lengthStuds;

      bricks.push({
        id: `area-${idx++}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type,
        color,
        gridX: gx,
        gridY: gy,
        gridZ: z,
        rotation,
      });
    }
  }

  return bricks;
}

/**
 * Generates mirrored copies of a group of bricks across the specified axis (X or Z).
 * Preserves integer-grid snapping, offsets, and mirrored part orientations.
 */
export function generateMirroredBricks(
  sourceBricks: BrickData[],
  axis: "x" | "z"
): BrickData[] {
  if (sourceBricks.length === 0) return [];

  // Compute 3D bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const b of sourceBricks) {
    const fp = getBrickFootprint(b.type, b.rotation);
    if (b.gridX < minX) minX = b.gridX;
    if (b.gridX + fp.widthStuds > maxX) maxX = b.gridX + fp.widthStuds;
    if (b.gridY < minY) minY = b.gridY;
    if (b.gridY + fp.lengthStuds > maxY) maxY = b.gridY + fp.lengthStuds;
  }

  const groupWidth = maxX - minX;
  const groupLength = maxY - minY;

  return sourceBricks.map((b, idx) => {
    const nextRot = mirrorRotation(b.rotation, axis);
    const fp = getBrickFootprint(b.type, nextRot);

    let newGridX = b.gridX;
    let newGridY = b.gridY;

    if (axis === "x") {
      // Mirror along X axis: flip relative to bounding center
      const localX = b.gridX - minX;
      const mirroredLocalX = groupWidth - (localX + fp.widthStuds);
      newGridX = minX + mirroredLocalX;
    } else {
      // Mirror along Y (depth / Z in 3D): flip relative to bounding center
      const localY = b.gridY - minY;
      const mirroredLocalY = groupLength - (localY + fp.lengthStuds);
      newGridY = minY + mirroredLocalY;
    }

    return {
      id: `mirror-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: b.type,
      color: b.color,
      gridX: newGridX,
      gridY: newGridY,
      gridZ: b.gridZ,
      rotation: nextRot,
    };
  });
}
