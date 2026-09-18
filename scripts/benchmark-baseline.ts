import { OccupancyMap, resolveStackHeight, getWorldPositionFromGrid, BrickData } from "../components/brickworks/GridSystem";
import { createGroupStructure, resolveGroupCandidatePositions } from "../components/brickworks/GroupSystem";
import { groupBricksIntoChunks } from "../components/brickworks/WorldStorage";
import * as THREE from "three";

console.log("=== RUNNING BASELINE BENCHMARK ===");

function generateBricks(count: number): BrickData[] {
  const bricks: BrickData[] = [];
  const colors = ["#e62b32", "#1b75d0", "#ffd500", "#2e9942", "#ffffff", "#222222"];
  const types: Array<BrickData["type"]> = ["brick_2x4", "brick_2x2", "brick_1x2", "plate_2x4", "plate_2x2"];
  for (let i = 0; i < count; i++) {
    bricks.push({
      id: "brick_" + i,
      type: types[i % types.length],
      color: colors[i % colors.length],
      gridX: (i % 20) * 4,
      gridY: Math.floor(i / 20) * 4,
      gridZ: Math.floor(i / 400) * 3,
      rotation: (i % 4 === 0 ? 90 : 0) as 0 | 90,
    });
  }
  return bricks;
}

const counts = [100, 500, 1000, 2500, 5000];

for (const count of counts) {
  const bricks = generateBricks(count);

  // 1. Occupancy rebuild
  const t0 = performance.now();
  const occ = new OccupancyMap(bricks);
  const occTime = performance.now() - t0;

  // 2. Single placement resolution & validation time
  const t1 = performance.now();
  for (let i = 0; i < 50; i++) {
    resolveStackHeight(occ, 10, 10, 0, "brick_2x4");
  }
  const placeQueryTime = (performance.now() - t1) / 50;

  // 3. Selection / Box Select projection time (with 5000 Vector3 allocations)
  const cam = new THREE.PerspectiveCamera(44, 1.5, 0.1, 350);
  cam.position.set(0, 15, 25);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();

  const t2 = performance.now();
  let insideCount = 0;
  for (let iter = 0; iter < 10; iter++) {
    for (const b of bricks) {
      const w = getWorldPositionFromGrid(b.gridX, b.gridY, b.gridZ, b.rotation, b.type);
      const v = new THREE.Vector3(w[0], w[1], w[2]);
      v.project(cam);
      if (v.x >= -0.5 && v.x <= 0.5 && v.y >= -0.5 && v.y <= 0.5) insideCount++;
    }
  }
  const boxSelectTime = (performance.now() - t2) / 10;
  void insideCount;

  // 4. Group candidate resolution (100-brick group)
  const group100 = bricks.slice(0, Math.min(100, count));
  const groupStruct = createGroupStructure(group100);
  const t3 = performance.now();
  for (let iter = 0; iter < 10; iter++) {
    resolveGroupCandidatePositions(groupStruct.items, 5, 5, occ);
  }
  const groupResolveTime = (performance.now() - t3) / 10;

  // 5. Chunk grouping & Serialization
  const t4 = performance.now();
  const chunked = groupBricksIntoChunks(bricks);
  const chunkTime = performance.now() - t4;

  const t5 = performance.now();
  const jsonStr = JSON.stringify(chunked);
  const serializeTime = performance.now() - t5;

  // 6. Mesh count in current architecture (1 body + studs per brick)
  let totalMeshes = 0;
  for (const b of bricks) {
    if (b.type.includes("2x4")) totalMeshes += 9;
    else if (b.type.includes("2x2")) totalMeshes += 5;
    else if (b.type.includes("1x2")) totalMeshes += 3;
    else totalMeshes += 9;
  }

  console.log(`\n=== ${count} BRICKS ===`);
  console.log(`Total Meshes (Current): ${totalMeshes}`);
  console.log(`Occupancy Rebuild: ${occTime.toFixed(2)} ms`);
  console.log(`Placement Stack Query: ${placeQueryTime.toFixed(3)} ms`);
  console.log(`Marquee Box Projection: ${boxSelectTime.toFixed(2)} ms`);
  console.log(`100-Brick Group Candidate Validation: ${groupResolveTime.toFixed(2)} ms`);
  console.log(`Chunk Grouping: ${chunkTime.toFixed(2)} ms (${Object.keys(chunked).length} chunks)`);
  console.log(`JSON Serialization: ${serializeTime.toFixed(2)} ms (${(jsonStr.length / 1024).toFixed(1)} KB)`);
}
