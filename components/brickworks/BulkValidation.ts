import { BrickData, OccupancyMap, getOccupiedCells, getBrickFootprint } from "./GridSystem";

export interface BulkValidationResult {
  isValid: boolean;
  invalidBrickIds: string[];
  reason?: "collision" | "unsupported" | "out_of_bounds" | "self_collision";
}

/**
 * Validates a large collection of candidate bricks (e.g. for Blueprints, group move, or duplicate)
 * against self-collision, external collision, terrain elevation, and structural foundation.
 */
export function validateBrickGroup(
  candidates: BrickData[],
  occupancy: OccupancyMap,
  terrainHeightProvider?: (gx: number, gy: number) => number,
  ignoredBrickIds?: Set<string>
): BulkValidationResult {
  if (candidates.length === 0) {
    return { isValid: false, invalidBrickIds: [], reason: "unsupported" };
  }

  const invalidBrickIds = new Set<string>();

  // 1. Check internal self-collision among candidates
  const candidateCells = new Map<string, string>(); // "x,y,z" -> brickId
  for (const brick of candidates) {
    const cells = getOccupiedCells(brick);
    for (const c of cells) {
      const key = `${c.x},${c.y},${c.z}`;
      const existing = candidateCells.get(key);
      if (existing) {
        invalidBrickIds.add(brick.id);
        invalidBrickIds.add(existing);
        return {
          isValid: false,
          invalidBrickIds: Array.from(invalidBrickIds),
          reason: "self_collision",
        };
      }
      candidateCells.set(key, brick.id);
    }
  }

  // 2. Check external collision against placed world bricks
  for (const brick of candidates) {
    const cells = getOccupiedCells(brick);
    for (const c of cells) {
      const externalBrickId = occupancy.getBrickAt(c.x, c.y, c.z);
      if (externalBrickId && (!ignoredBrickIds || !ignoredBrickIds.has(externalBrickId))) {
        invalidBrickIds.add(brick.id);
        return {
          isValid: false,
          invalidBrickIds: Array.from(invalidBrickIds),
          reason: "collision",
        };
      }
    }
  }

  // 3. Terrain & Void checks
  let hasValidFoundation = false;
  let hasVoid = false;

  for (const brick of candidates) {
    const { widthStuds, lengthStuds } = getBrickFootprint(brick.type, brick.rotation);

    // Check if brick rests atop an external placed brick
    for (let dx = 0; dx < widthStuds; dx++) {
      for (let dy = 0; dy < lengthStuds; dy++) {
        const supportZ = brick.gridZ - 1;
        const belowBrickId = occupancy.getBrickAt(brick.gridX + dx, brick.gridY + dy, supportZ);
        if (belowBrickId && (!ignoredBrickIds || !ignoredBrickIds.has(belowBrickId))) {
          hasValidFoundation = true;
        }
      }
    }

    // Check terrain support if terrain height provider is supplied
    if (terrainHeightProvider) {
      for (let dx = 0; dx < widthStuds; dx++) {
        for (let dy = 0; dy < lengthStuds; dy++) {
          const tz = terrainHeightProvider(brick.gridX + dx, brick.gridY + dy);
          if (tz <= -900) {
            hasVoid = true;
          } else if (brick.gridZ <= tz + 1) {
            // Rests on or near ground
            hasValidFoundation = true;
          }
        }
      }
    } else {
      // In flat/standard world, ground is at gridZ = 0
      if (brick.gridZ <= 0) {
        hasValidFoundation = true;
      }
    }
  }

  if (hasVoid && !hasValidFoundation) {
    return {
      isValid: false,
      invalidBrickIds: candidates.map((b) => b.id),
      reason: "out_of_bounds",
    };
  }

  if (!hasValidFoundation) {
    return {
      isValid: false,
      invalidBrickIds: candidates.map((b) => b.id),
      reason: "unsupported",
    };
  }

  return {
    isValid: true,
    invalidBrickIds: [],
  };
}
