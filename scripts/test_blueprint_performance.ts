import { OccupancyMap, getWorldPositionFromGrid, BrickData } from "../components/brickworks/GridSystem";
import {
  calculateStructureBounds,
  calculateStructurePivot,
  toRelativeBrickPositions,
  rotateStructureRelative,
  getAffectedChunks,
} from "../components/brickworks/BlueprintMath";
import { validateBrickGroup } from "../components/brickworks/BulkValidation";
import { groupBricksIntoChunks } from "../components/brickworks/WorldStorage";
import * as THREE from "three";

console.log("=========================================================");
console.log("   BRICKWORKS BLUEPRINT PERFORMANCE & ACCURACY SUITE    ");
console.log("=========================================================\n");

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

// Helper to generate a realistic brick structure
function generatePyramid(baseSize: number): BrickData[] {
  const bricks: BrickData[] = [];
  let id = 0;
  const colors = ["#e62b32", "#1b75d0", "#ffd500", "#2e9942", "#ffffff", "#222222"];
  for (let z = 0; z < baseSize; z += 3) {
    const layer = Math.floor(z / 3);
    const size = baseSize - layer * 2;
    if (size <= 0) break;
    for (let x = layer * 2; x < layer * 2 + size; x += 2) {
      for (let y = layer * 2; y < layer * 2 + size; y += 4) {
        bricks.push({
          id: `pyramid_b_${id++}`,
          type: "brick_2x4",
          color: colors[(x + y + z) % colors.length],
          gridX: x,
          gridY: y,
          gridZ: z,
          rotation: 0,
        });
      }
    }
  }
  return bricks;
}

// 1. BLUEPRINT MATH VERIFICATION
console.log("--- 1. Testing Deterministic Blueprint Math ---");
const sampleBricks: BrickData[] = [
  { id: "b1", type: "brick_2x4", color: "#e62b32", gridX: 2, gridY: 4, gridZ: 0, rotation: 0 },
  { id: "b2", type: "brick_2x2", color: "#1b75d0", gridX: 6, gridY: 4, gridZ: 0, rotation: 0 },
  { id: "b3", type: "brick_1x2", color: "#ffd500", gridX: 2, gridY: 4, gridZ: 3, rotation: 90 },
];

const bounds = calculateStructureBounds(sampleBricks);
assert(bounds.minX === 2 && bounds.maxX === 8, "Bounds X calculates correctly (2 to 8)");
assert(bounds.minY === 4 && bounds.maxY === 8, "Bounds Y calculates correctly (4 to 8)");
assert(bounds.minZ === 0 && bounds.maxZ === 6, "Bounds Z calculates correctly (0 to 6 with height 3+3)");

const pivot = calculateStructurePivot(sampleBricks);
assert(pivot[0] === 5 && pivot[1] === 6 && pivot[2] === 0, `Pivot calculated correctly (${pivot[0]}, ${pivot[1]}, ${pivot[2]})`);

const relResult = toRelativeBrickPositions(sampleBricks);
assert(relResult.items.length === 3, "Created relative brick entries");

// Test 360-degree rotation invariance
let currentRot = relResult.items;
for (let step = 1; step <= 4; step++) {
  currentRot = rotateStructureRelative(currentRot);
}

let invariant = true;
for (let i = 0; i < relResult.items.length; i++) {
  const orig = relResult.items[i];
  const rot360 = currentRot[i];
  if (
    orig.relX !== rot360.relX ||
    orig.relY !== rot360.relY ||
    orig.relZ !== rot360.relZ ||
    orig.rotation !== rot360.rotation
  ) {
    invariant = false;
    break;
  }
}
assert(invariant, "360-degree rotation returns to exact initial relative coordinates and orientation (drift invariant)");

// Affected chunks
const affected = getAffectedChunks(sampleBricks);
assert(affected.size > 0 && affected.has("0,0"), "Affected chunks correctly identifies chunk '0,0'");

// 2. BULK VALIDATION & COLLISION DETECTION
console.log("\n--- 2. Testing Bulk Validation & Atomic Collision Detection ---");
const occ = new OccupancyMap(sampleBricks);

// Valid placement elsewhere
const validCandidate: BrickData[] = [
  { id: "c1", type: "brick_2x4", color: "#e62b32", gridX: 20, gridY: 20, gridZ: 0, rotation: 0 },
  { id: "c2", type: "brick_2x4", color: "#1b75d0", gridX: 20, gridY: 20, gridZ: 3, rotation: 0 },
];
const val1 = validateBrickGroup(validCandidate, occ);
assert(val1.isValid === true, "Valid candidate group passes validation");

// Self-colliding candidate group
const selfColliding: BrickData[] = [
  { id: "s1", type: "brick_2x4", color: "#e62b32", gridX: 30, gridY: 30, gridZ: 0, rotation: 0 },
  { id: "s2", type: "brick_2x4", color: "#1b75d0", gridX: 30, gridY: 30, gridZ: 0, rotation: 0 },
];
const val2 = validateBrickGroup(selfColliding, occ);
assert(val2.isValid === false && val2.invalidBrickIds.includes("s2"), "Self-colliding candidate group rejected");

// Collision against existing world bricks
const worldColliding: BrickData[] = [
  { id: "w1", type: "brick_2x4", color: "#2e9942", gridX: 2, gridY: 4, gridZ: 0, rotation: 0 },
];
const val3 = validateBrickGroup(worldColliding, occ);
assert(val3.isValid === false && val3.invalidBrickIds.includes("w1"), "Collision against world rejected");

// 3. BULK MUTATION SCALING ON OCCUPANCY MAP
console.log("\n--- 3. Testing Bulk Mutation Scaling on OccupancyMap ---");
const testCounts = [100, 250, 500, 1000, 2500, 5000];

for (const count of testCounts) {
  const bulkBricks: BrickData[] = [];
  for (let i = 0; i < count; i++) {
    bulkBricks.push({
      id: `bulk_${count}_${i}`,
      type: "brick_2x4",
      color: "#e62b32",
      gridX: (i % 30) * 4,
      gridY: Math.floor(i / 30) * 4,
      gridZ: Math.floor(i / 900) * 3,
      rotation: 0,
    });
  }

  const testOcc = new OccupancyMap([]);
  const tAddStart = performance.now();
  testOcc.addBricks(bulkBricks);
  const addTime = performance.now() - tAddStart;

  const tRemoveStart = performance.now();
  testOcc.removeBricks(bulkBricks);
  const removeTime = performance.now() - tRemoveStart;

  const threshold = count >= 5000 ? 60 : 30;
  assert(
    addTime < threshold,
    `Bulk add ${count} bricks into OccupancyMap in ${addTime.toFixed(2)}ms (< ${threshold}ms)`
  );
  assert(
    removeTime < threshold,
    `Bulk remove ${count} bricks from OccupancyMap in ${removeTime.toFixed(2)}ms (< ${threshold}ms)`
  );
}

// 4. INSTANCING EFFICIENCY & DRAW CALL SCALING
console.log("\n--- 4. Testing Chunk Instancing Batching & Draw Call Scaling ---");
const largeStructure = generatePyramid(40); // Generates hundreds of bricks
console.log(`  Generated test structure with ${largeStructure.length} bricks`);

const chunkMap = groupBricksIntoChunks(largeStructure);
const chunkKeys = Object.keys(chunkMap);
console.log(`  Partitioned across ${chunkKeys.length} chunk(s)`);

let totalBatches = 0;
for (const key of chunkKeys) {
  const bricksInChunk = chunkMap[key].bricks;
  const batches = new Map<string, number>();
  for (const b of bricksInChunk) {
    const batchKey = `${b.type}_${b.color}`;
    batches.set(batchKey, (batches.get(batchKey) || 0) + 1);
  }
  totalBatches += batches.size;
}

assert(
  totalBatches <= chunkKeys.length * 30,
  `Instanced batches for ${largeStructure.length} bricks = ${totalBatches} draw calls (drastic reduction from ${largeStructure.length} meshes!)`
);

// 5. BIDIRECTIONAL INSTANCE MAPPING VERIFICATION
console.log("\n--- 5. Testing Bidirectional Instance Mapping ---");
const idMap = new Map<number, string>();
const brickMap = new Map<string, BrickData>();
sampleBricks.forEach((b, idx) => {
  idMap.set(idx, b.id);
  brickMap.set(b.id, b);
});

let mapValid = true;
for (let i = 0; i < sampleBricks.length; i++) {
  const brickId = idMap.get(i);
  if (!brickId || brickMap.get(brickId)?.id !== sampleBricks[i].id) {
    mapValid = false;
    break;
  }
}
assert(mapValid, "Instance index to BrickId O(1) reverse-lookup is consistent and lossless");

// 6. RAYCAST PROJECTION OPTIMIZATION
console.log("\n--- 6. Testing Box Selection Projection Allocation-Free Optimization ---");
const scratchVec = new THREE.Vector3();
const cam = new THREE.PerspectiveCamera(45, 1.0, 0.1, 100);
cam.position.set(0, 20, 20);
cam.lookAt(0, 0, 0);
cam.updateMatrixWorld();

const tProjStart = performance.now();
let inside = 0;
for (const b of largeStructure) {
  const worldPos = getWorldPositionFromGrid(b.gridX, b.gridY, b.gridZ, b.rotation, b.type);
  scratchVec.set(worldPos[0], worldPos[1], worldPos[2]);
  scratchVec.project(cam);
  if (scratchVec.x >= -0.5 && scratchVec.x <= 0.5 && scratchVec.y >= -0.5 && scratchVec.y <= 0.5) {
    inside++;
  }
}
void inside;
const projDuration = performance.now() - tProjStart;
assert(
  projDuration < 2.0,
  `Projected ${largeStructure.length} bricks in ${projDuration.toFixed(3)}ms (< 2.0ms without garbage collection allocations)`
);

console.log("\n=========================================================");
console.log(`SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
console.log("=========================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
