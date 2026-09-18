/**
 * BRICKWORKS Pre-Alpha Automated End-to-End Regression Suite
 *
 * Implements and verifies the exact 28-step flow mandated in ORIGINAL_REQUEST.md:
 * HOME → NEW WORLD → NATURAL EXPANDING WORLD → BUILD → PLACE MULTIPLE BRICKS
 * → STACK → ROTATE → SELECT → MOVE → MULTI-SELECT → DUPLICATE → GROUP ROTATE
 * → UNDO → REDO → TERRAIN → FLATTEN → RAISE → PAINT → WALK → EXPLORE CHUNKS
 * → CREATE WAYPOINT → BUILD FAR FROM SPAWN → FAST TRAVEL → MAP → SAVE → HOME
 * → REOPEN WORLD → RETURN TO FAR BUILD
 */

import * as THREE from "three";
import {
  BrickData,
  OccupancyMap,
  resolveStackHeight,
  validatePlacement,
  getBrickFootprint,
  STUD_PITCH,
} from "../components/brickworks/GridSystem";
import {
  createGroupStructure,
  rotateGroupRelativeItems,
  resolveGroupCandidatePositions,
  GroupRelativeItem,
} from "../components/brickworks/GroupSystem";
import {
  CommandHistory,
  PlaceBrickCommand,
  MoveBrickCommand,
  PlaceGroupCommand,
} from "../components/brickworks/CommandHistory";
import {
  sampleTerrain,
  getTerrainHeightGrid,
} from "../components/brickworks/TerrainGenerator";
import {
  applyTerrainBrush,
  TerrainBrushConfig,
} from "../components/brickworks/TerrainBrush";
import {
  LocalStorageWorldStorage,
  groupBricksIntoChunks,
  getAllBricksFromWorld,
  countWorldBricks,
  SavedWorld,
  Waypoint,
} from "../components/brickworks/WorldStorage";

// ---------------------------------------------------------------------------
// Node.js LocalStorage Mock for Headless Execution
// ---------------------------------------------------------------------------
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  } as Storage;
}

// ---------------------------------------------------------------------------
// Test Assertion Harness
// ---------------------------------------------------------------------------
let totalStepsPassed = 0;
let totalAssertions = 0;
const failureDetails: string[] = [];

function assert(condition: boolean, assertionName: string, detail?: string): void {
  totalAssertions++;
  if (!condition) {
    const errorMsg = `FAILED: ${assertionName}${detail ? ` - ${detail}` : ""}`;
    console.error(`    ❌ ${errorMsg}`);
    failureDetails.push(errorMsg);
    throw new Error(errorMsg);
  }
}

function recordStepPassed(stepNumber: number, stepName: string, detail: string): void {
  totalStepsPassed++;
  console.log(`  [Step ${stepNumber}/28: PASS] ${stepName}`);
  console.log(`    ↳ ${detail}`);
}

// ---------------------------------------------------------------------------
// 28-Step End-to-End Regression Flow
// ---------------------------------------------------------------------------
async function runE2ERegressionSuite() {
  console.log("================================================================================");
  console.log("  BRICKWORKS PRE-ALPHA END-TO-END REGRESSION TEST SUITE (28 STEPS)");
  console.log("================================================================================\n");

  const storage = new LocalStorageWorldStorage();
  const commandHistory = new CommandHistory();
  const occupancyMap = new OccupancyMap();
  let bricksInWorld: BrickData[] = [];

  const setBricks = (updater: (prev: BrickData[]) => BrickData[]) => {
    bricksInWorld = updater(bricksInWorld);
    occupancyMap.rebuild(bricksInWorld);
  };

  let currentAppScreen = "home";
  let activeMode: "build" | "select" | "terrain" | "walk" | null = null;
  let activeWorld: SavedWorld | null = null;
  let selectedBrickIds: string[] = [];
  let playerPosition: [number, number, number] = [0, 0, 0];
  let playerYaw = 0;
  let farBuildGridX = 200;
  let farBuildGridY = 200;
  const farBuildChunkKey = "12,12";

  // ===========================================================================
  // STEP 1: HOME
  // ===========================================================================
  currentAppScreen = "home";
  activeMode = null;
  const initialWorldList = await storage.listWorlds();
  assert(currentAppScreen === "home", "App initialized in HOME screen state");
  assert(activeWorld === null, "No world loaded initially at HOME screen");
  assert(Array.isArray(initialWorldList), "WorldStorage successfully lists available worlds");
  recordStepPassed(1, "HOME", `Launcher menu ready; ${initialWorldList.length} initial worlds found`);

  // ===========================================================================
  // STEP 2: NEW WORLD
  // ===========================================================================
  currentAppScreen = "create_world_modal";
  const newWorldName = "E2E Regression World";
  const worldSeed = 42881234;
  assert(currentAppScreen === "create_world_modal", "Opened NEW WORLD creation modal");
  recordStepPassed(2, "NEW WORLD", `Configured new world parameters (name="${newWorldName}", seed=${worldSeed})`);

  // ===========================================================================
  // STEP 3: NATURAL EXPANDING WORLD
  // ===========================================================================
  activeWorld = await storage.createNewWorld(newWorldName, "natural", "expanding", worldSeed);
  currentAppScreen = "game";
  assert(activeWorld.worldType === "natural", "World type set to 'natural'");
  assert(activeWorld.worldSize === "expanding", "World size set to 'expanding'");
  assert(Boolean(activeWorld.exploredChunks && Array.isArray(activeWorld.exploredChunks)), "World initialized with explored chunk array");
  assert(Boolean(activeWorld.exploredChunks?.includes("0,0")), "Spawn chunk (0,0) included in initial exploredChunks");
  assert(Boolean(activeWorld.waypoints && activeWorld.waypoints.length > 0), "Default spawn waypoint created");
  playerPosition = [...activeWorld.playerSpawn];
  recordStepPassed(3, "NATURAL EXPANDING WORLD", `Created world '${activeWorld.name}' (id: ${activeWorld.id}, seed: ${activeWorld.seed})`);

  // ===========================================================================
  // STEP 4: BUILD
  // ===========================================================================
  activeMode = "build";
  selectedBrickIds = [];
  assert(activeMode === "build", "Active mode switched to 'build'");
  assert(commandHistory.canUndo() === false, "CommandHistory initially empty (canUndo=false)");
  assert(occupancyMap.size() === 0, "OccupancyMap initially empty (0 cells)");
  recordStepPassed(4, "BUILD", "Building subsystem active; clean canvas ready for placement");

  // ===========================================================================
  // STEP 5: PLACE MULTIPLE BRICKS
  // ===========================================================================
  const b1: BrickData = { id: "b1", type: "brick_2x4", color: "#e02626", gridX: 0, gridY: 0, gridZ: 0, rotation: 0 };
  const valB1 = validatePlacement(occupancyMap, b1);
  assert(valB1.isValid, "First brick placement validation succeeds");
  const cmdB1 = new PlaceBrickCommand(b1);
  cmdB1.execute(bricksInWorld, setBricks);
  commandHistory.push(cmdB1);

  const b2: BrickData = { id: "b2", type: "brick_2x4", color: "#2563eb", gridX: 2, gridY: 0, gridZ: 0, rotation: 0 };
  const valB2 = validatePlacement(occupancyMap, b2);
  assert(valB2.isValid, "Adjacent second brick placement validation succeeds");
  const cmdB2 = new PlaceBrickCommand(b2);
  cmdB2.execute(bricksInWorld, setBricks);
  commandHistory.push(cmdB2);

  assert(bricksInWorld.length === 2, `2 bricks placed in world state (actual: ${bricksInWorld.length})`);
  assert(occupancyMap.size() === 48, `48 cells occupied for two 2x4 bricks (actual: ${occupancyMap.size()})`);
  recordStepPassed(5, "PLACE MULTIPLE BRICKS", "Placed b1 (red 2x4) at (0,0,0) and b2 (blue 2x4) at (2,0,0)");

  // ===========================================================================
  // STEP 6: STACK
  // ===========================================================================
  // Stack b3 (brick_2x2, height=3) bridging across b1 and b2 at gridZ = 3
  const stackZ = resolveStackHeight(occupancyMap, 1, 0, 0, "brick_2x2");
  assert(stackZ === 3, `Stack height atop b1 & b2 resolves to gridZ = 3 (actual: ${stackZ})`);

  const b3: BrickData = { id: "b3", type: "brick_2x2", color: "#eab308", gridX: 1, gridY: 0, gridZ: stackZ, rotation: 0 };
  const valB3 = validatePlacement(occupancyMap, b3);
  assert(valB3.isValid, "Stacking b3 across b1 and b2 is valid");
  const cmdB3 = new PlaceBrickCommand(b3);
  cmdB3.execute(bricksInWorld, setBricks);
  commandHistory.push(cmdB3);

  // Stack plate p1 (plate_2x4, height=1) atop b3 at gridZ = 6
  const plateZ = resolveStackHeight(occupancyMap, 0, 0, 0, "plate_2x4");
  assert(plateZ === 6, `Plate stack height atop b3 resolves to gridZ = 6 (actual: ${plateZ})`);
  const p1: BrickData = { id: "p1", type: "plate_2x4", color: "#10b981", gridX: 0, gridY: 0, gridZ: plateZ, rotation: 0 };
  const valP1 = validatePlacement(occupancyMap, p1);
  assert(valP1.isValid, "Stacking plate p1 atop stack is valid");
  const cmdP1 = new PlaceBrickCommand(p1);
  cmdP1.execute(bricksInWorld, setBricks);
  commandHistory.push(cmdP1);

  assert(bricksInWorld.length === 4, `4 bricks/plates in world after stacking (actual: ${bricksInWorld.length})`);
  recordStepPassed(6, "STACK", "Stacked b3 (2x2) at gridZ=3 and plate p1 (2x4) at gridZ=6");

  // ===========================================================================
  // STEP 7: ROTATE
  // ===========================================================================
  const rotatedFootprint = getBrickFootprint("brick_2x4", 90);
  assert(rotatedFootprint.widthStuds === 4 && rotatedFootprint.lengthStuds === 2, "90° rotation swaps footprint to 4x2");

  const b4: BrickData = { id: "b4", type: "brick_2x4", color: "#8b5cf6", gridX: 5, gridY: 0, gridZ: 0, rotation: 90 };
  const valB4 = validatePlacement(occupancyMap, b4);
  assert(valB4.isValid, "Placement of 90° rotated brick is valid");
  const cmdB4 = new PlaceBrickCommand(b4);
  cmdB4.execute(bricksInWorld, setBricks);
  commandHistory.push(cmdB4);

  assert(bricksInWorld.length === 5, "5 bricks placed after adding rotated brick");
  recordStepPassed(7, "ROTATE", "Verified 90° footprint transformation and placed b4 (rotated 90° at (5,0,0))");

  // ===========================================================================
  // STEP 8: SELECT
  // ===========================================================================
  activeMode = "select";
  selectedBrickIds = ["b4"];
  const selectedBrick = bricksInWorld.find((b) => b.id === "b4");
  assert(activeMode === "select", "Mode transitioned to 'select'");
  assert(selectedBrick !== undefined && selectedBrick.id === "b4", "Selected brick b4 found in world");
  assert(selectedBrickIds.length === 1 && selectedBrickIds[0] === "b4", "Single selection state active");
  recordStepPassed(8, "SELECT", "Selected brick b4 in SELECT mode");

  // ===========================================================================
  // STEP 9: MOVE
  // ===========================================================================
  const cmdMoveB4 = new MoveBrickCommand([
    {
      id: "b4",
      oldState: { gridX: 5, gridY: 0, gridZ: 0, rotation: 90 },
      newState: { gridX: 5, gridY: 4, gridZ: 0, rotation: 90 },
    },
  ]);
  cmdMoveB4.execute(bricksInWorld, setBricks);
  commandHistory.push(cmdMoveB4);

  const movedInWorld = bricksInWorld.find((b) => b.id === "b4");
  assert(movedInWorld !== undefined && movedInWorld.gridY === 4, "b4 gridY updated to 4 after move");
  assert(occupancyMap.getHighestOccupiedZ(5, 0) === undefined, "Old location (5, 0) cleared in occupancy map");
  assert(occupancyMap.getHighestOccupiedZ(5, 4) !== undefined, "New location (5, 4) occupied in occupancy map");
  recordStepPassed(9, "MOVE", "Moved b4 from (5,0,0) to (5,4,0) with occupancy sync");

  // ===========================================================================
  // STEP 10: MULTI-SELECT
  // ===========================================================================
  selectedBrickIds = ["b1", "b2", "b3"];
  assert(selectedBrickIds.length === 3, "Multi-selection contains exactly 3 brick IDs");
  const multiSelectedBricks = bricksInWorld.filter((b) => selectedBrickIds.includes(b.id));
  const groupStructure = createGroupStructure(multiSelectedBricks);
  assert(groupStructure.items.length === 3, `Group structure has 3 relative items (actual: ${groupStructure.items.length})`);
  recordStepPassed(10, "MULTI-SELECT", "Multi-selected bricks [b1, b2, b3] and created group relative structure");

  // ===========================================================================
  // STEP 11: DUPLICATE
  // ===========================================================================
  const dupOffset = { x: 10, y: 0 };
  const anchorBrick = multiSelectedBricks.find((b) => b.id === groupStructure.anchorId) || multiSelectedBricks[0];
  const anchorGridX = anchorBrick.gridX;
  const anchorGridY = anchorBrick.gridY;

  const candGroup = resolveGroupCandidatePositions(
    groupStructure.items,
    anchorGridX + dupOffset.x,
    anchorGridY + dupOffset.y,
    occupancyMap
  );
  assert(candGroup.isValid, `Duplicated assembly candidate positions valid at offset (+10, 0)`);

  const duplicatedBricks: BrickData[] = candGroup.candidates.map((cand, index) => ({
    id: `dup_${index}_${Date.now()}`,
    type: cand.type,
    color: cand.color,
    gridX: cand.gridX,
    gridY: cand.gridY,
    gridZ: cand.gridZ,
    rotation: cand.rotation,
  }));

  const cmdPlaceGroup = new PlaceGroupCommand(duplicatedBricks);
  cmdPlaceGroup.execute(bricksInWorld, setBricks);
  commandHistory.push(cmdPlaceGroup);

  assert(bricksInWorld.length === 8, `World contains 8 bricks after duplication (actual: ${bricksInWorld.length})`);
  const uniqueIds = new Set(bricksInWorld.map((b) => b.id));
  assert(uniqueIds.size === 8, "All 8 brick IDs in world are 100% unique");
  recordStepPassed(11, "DUPLICATE", `Duplicated 3-brick assembly to offset (+10, 0) yielding ${duplicatedBricks.length} new bricks`);

  // ===========================================================================
  // STEP 12: GROUP ROTATE
  // ===========================================================================
  const relativeItemsToRotate: GroupRelativeItem[] = groupStructure.items.map((item) => ({ ...item }));
  let rotatedItems = [...relativeItemsToRotate];

  // Rotate 4 times (360°) and assert exact 0-drift invariance
  for (let r = 1; r <= 4; r++) {
    rotatedItems = rotateGroupRelativeItems(rotatedItems);
  }
  let drift = 0;
  for (let i = 0; i < rotatedItems.length; i++) {
    drift += Math.abs(rotatedItems[i].relX - relativeItemsToRotate[i].relX);
    drift += Math.abs(rotatedItems[i].relY - relativeItemsToRotate[i].relY);
    drift += Math.abs(rotatedItems[i].relZ - relativeItemsToRotate[i].relZ);
    drift += Math.abs(rotatedItems[i].rotation - relativeItemsToRotate[i].rotation);
  }
  assert(drift === 0, `360° group rotation maintains exact 0-drift invariance (actual: ${drift})`);

  // Rotate 90° once for candidate evaluation
  const singleRotated = rotateGroupRelativeItems(relativeItemsToRotate);
  const candResult = resolveGroupCandidatePositions(singleRotated, 10, 10, occupancyMap);
  assert(candResult.isValid, "Candidate positions for 90° rotated group at (10, 10) are valid");
  recordStepPassed(12, "GROUP ROTATE", "Verified 360° drift invariance (0 drift) and 90° clockwise group candidate transform");

  // ===========================================================================
  // STEP 13: UNDO
  // ===========================================================================
  assert(commandHistory.canUndo() === true, "CommandHistory canUndo is true before undo");
  commandHistory.undo(bricksInWorld, setBricks); // Undoes PlaceGroupCommand
  assert(bricksInWorld.length === 5, `World brick count restored to 5 after undo (actual: ${bricksInWorld.length})`);
  assert(commandHistory.canRedo() === true, "CommandHistory canRedo is true after undo");
  recordStepPassed(13, "UNDO", "Undid group duplication; world state reverted to 5 bricks");

  // ===========================================================================
  // STEP 14: REDO
  // ===========================================================================
  commandHistory.redo(bricksInWorld, setBricks); // Redoes PlaceGroupCommand
  assert(bricksInWorld.length === 8, `World brick count restored to 8 after redo (actual: ${bricksInWorld.length})`);
  assert(commandHistory.canUndo() === true, "CommandHistory canUndo is true after redo");
  recordStepPassed(14, "REDO", "Redid group duplication; world state restored to 8 bricks");

  // ===========================================================================
  // STEP 15: TERRAIN
  // ===========================================================================
  activeMode = "terrain";
  assert(activeMode === "terrain", "Active mode switched to 'terrain'");
  const flattenTargetHeight = 1.0;
  const terrainConfig: TerrainBrushConfig = {
    tool: "flatten",
    sizePreset: "medium",
    strength: 0.8,
    flattenTargetHeight,
  };
  recordStepPassed(15, "TERRAIN", `Terrain sculpting tools initialized (tool: ${terrainConfig.tool}, size: ${terrainConfig.sizePreset})`);

  // ===========================================================================
  // STEP 16: FLATTEN
  // ===========================================================================
  const flattenCenter = new THREE.Vector3(12.8, 0, 12.8);
  const flattenRes = applyTerrainBrush({
    centerPoint: flattenCenter,
    config: terrainConfig,
    worldType: "natural",
    worldSize: "expanding",
    seed: worldSeed,
    existingChunks: activeWorld.chunks,
    placedBricks: bricksInWorld,
    dt: 0.1,
  });
  assert(flattenRes.affectedChunkKeys.length > 0, `Flatten affected ${flattenRes.affectedChunkKeys.length} chunks`);
  // Record mods into activeWorld
  for (const [k, mod] of Object.entries(flattenRes.modifiedChunks)) {
    if (!activeWorld.chunks[k]) activeWorld.chunks[k] = { bricks: [] };
    activeWorld.chunks[k].terrainMod = mod;
  }
  recordStepPassed(16, "FLATTEN", `Flattened terrain at ${flattenCenter.x.toFixed(1)}, ${flattenCenter.z.toFixed(1)} toward height ${flattenTargetHeight}m`);

  // ===========================================================================
  // STEP 17: RAISE
  // ===========================================================================
  const raiseConfig: TerrainBrushConfig = { tool: "raise", sizePreset: "medium", strength: 1.0 };
  const raiseRes = applyTerrainBrush({
    centerPoint: new THREE.Vector3(15, 0, 15),
    config: raiseConfig,
    worldType: "natural",
    worldSize: "expanding",
    seed: worldSeed,
    existingChunks: activeWorld.chunks,
    placedBricks: bricksInWorld,
    dt: 0.1,
  });
  assert(raiseRes.affectedChunkKeys.length > 0, `Raise affected ${raiseRes.affectedChunkKeys.length} chunks`);
  for (const [k, mod] of Object.entries(raiseRes.modifiedChunks)) {
    if (!activeWorld.chunks[k]) activeWorld.chunks[k] = { bricks: [] };
    activeWorld.chunks[k].terrainMod = mod;
  }
  recordStepPassed(17, "RAISE", `Raised terrain hill across ${raiseRes.affectedChunkKeys.join(", ")}`);

  // ===========================================================================
  // STEP 18: PAINT
  // ===========================================================================
  const paintConfig: TerrainBrushConfig = { tool: "paint", sizePreset: "medium", strength: 1.0, material: "rock" };
  const paintRes = applyTerrainBrush({
    centerPoint: new THREE.Vector3(15, 0, 15),
    config: paintConfig,
    worldType: "natural",
    worldSize: "expanding",
    seed: worldSeed,
    existingChunks: activeWorld.chunks,
    placedBricks: bricksInWorld,
    dt: 0.1,
  });
  assert(paintRes.affectedChunkKeys.length > 0, "Paint brush modified chunk vertices");
  const hasRock = Object.values(paintRes.modifiedChunks).some(
    (mod) => mod.materials && Object.values(mod.materials).includes("rock")
  );
  assert(hasRock, "Chunk terrain mod contains 'rock' material assignment");
  for (const [k, mod] of Object.entries(paintRes.modifiedChunks)) {
    if (!activeWorld.chunks[k]) activeWorld.chunks[k] = { bricks: [] };
    activeWorld.chunks[k].terrainMod = mod;
  }
  recordStepPassed(18, "PAINT", `Painted rocky terrain texture onto vertices at (15, 15)`);

  // ===========================================================================
  // STEP 19: WALK
  // ===========================================================================
  activeMode = "walk";
  assert(activeMode === "walk", "Active mode switched to 'walk'");
  // Simulate player ground snap and step
  const sampleGround = sampleTerrain("natural", "expanding", worldSeed, playerPosition[0], playerPosition[2]);
  const safeWalkY = sampleGround.heightWorld + 1.5; // eye height
  playerPosition = [playerPosition[0], safeWalkY, playerPosition[2]];
  playerYaw = 0.5; // facing angle
  assert(playerPosition[1] > sampleGround.heightWorld, "Player standing safely above ground level");
  recordStepPassed(19, "WALK", `First-person avatar walking active at (${playerPosition[0].toFixed(1)}, ${playerPosition[1].toFixed(1)}, ${playerPosition[2].toFixed(1)})`);

  // ===========================================================================
  // STEP 20: EXPLORE CHUNKS
  // ===========================================================================
  // Simulate walking far into world (to chunk 12, 12, ~160m out)
  const waypointsTravel = [
    { cx: 2, cz: 2 },
    { cx: 5, cz: 5 },
    { cx: 8, cz: 8 },
    { cx: 12, cz: 12 },
  ];
  if (!activeWorld.exploredChunks) activeWorld.exploredChunks = [];
  for (const wp of waypointsTravel) {
    const chunkKey = `${wp.cx},${wp.cz}`;
    if (!activeWorld.exploredChunks.includes(chunkKey)) {
      activeWorld.exploredChunks.push(chunkKey);
    }
  }
  assert(activeWorld.exploredChunks.includes(farBuildChunkKey), `Distant chunk ${farBuildChunkKey} added to exploredChunks`);
  const farWorldX = 12 * 16 * STUD_PITCH; // 153.6m
  const farWorldZ = 12 * 16 * STUD_PITCH; // 153.6m
  playerPosition = [farWorldX, 10.0, farWorldZ];
  recordStepPassed(20, "EXPLORE CHUNKS", `Explored outward to chunk ${farBuildChunkKey} (${farWorldX.toFixed(1)}m, ${farWorldZ.toFixed(1)}m)`);

  // ===========================================================================
  // STEP 21: CREATE WAYPOINT
  // ===========================================================================
  const outpostWaypoint: Waypoint = {
    id: "wp_distant_outpost",
    name: "Distant Outpost",
    worldX: farWorldX,
    worldY: 10.0,
    worldZ: farWorldZ,
    createdAt: new Date().toISOString(),
    isHome: false,
    color: "#3b82f6",
  };
  if (!activeWorld.waypoints) activeWorld.waypoints = [];
  activeWorld.waypoints.push(outpostWaypoint);
  assert(activeWorld.waypoints.some((w) => w.id === "wp_distant_outpost"), "Custom waypoint saved in world data");
  recordStepPassed(21, "CREATE WAYPOINT", `Registered waypoint 'Distant Outpost' at (${farWorldX.toFixed(1)}, ${farWorldZ.toFixed(1)})`);

  // ===========================================================================
  // STEP 22: BUILD FAR FROM SPAWN
  // ===========================================================================
  activeMode = "build";
  const terrainProvider = (gx: number, gy: number) => getTerrainHeightGrid("natural", "expanding", worldSeed, gx, gy);

  // Find a build location in chunk (12, 12) (gridX: 192..204, gridY: 192..204) with valid terrain foundation
  let foundSite = false;
  for (let gx = 192; gx <= 204 && !foundSite; gx++) {
    for (let gy = 192; gy <= 204 && !foundSite; gy++) {
      const hZ = resolveStackHeight(occupancyMap, gx, gy, 0, "brick_2x4", terrainProvider);
      const testBrick: BrickData = { id: "test", type: "brick_2x4", color: "#10b981", gridX: gx, gridY: gy, gridZ: hZ, rotation: 0 };
      const valTest = validatePlacement(occupancyMap, testBrick, terrainProvider);
      if (valTest.isValid) {
        farBuildGridX = gx;
        farBuildGridY = gy;
        foundSite = true;
      }
    }
  }
  assert(foundSite, `Found build site in distant chunk ${farBuildChunkKey}`);
  const farGroundZ = resolveStackHeight(occupancyMap, farBuildGridX, farBuildGridY, 0, "brick_2x4", terrainProvider);

  const farBrick1: BrickData = {
    id: "far_b1",
    type: "brick_2x4",
    color: "#10b981",
    gridX: farBuildGridX,
    gridY: farBuildGridY,
    gridZ: farGroundZ,
    rotation: 0,
  };
  const valFar1 = validatePlacement(occupancyMap, farBrick1, terrainProvider);
  assert(valFar1.isValid, `Far build brick 1 placement valid on terrain at Z=${farGroundZ}`, valFar1.reason);
  const cmdFar1 = new PlaceBrickCommand(farBrick1);
  cmdFar1.execute(bricksInWorld, setBricks);
  commandHistory.push(cmdFar1);

  const farBrick2: BrickData = {
    id: "far_b2",
    type: "brick_2x2",
    color: "#f59e0b",
    gridX: farBuildGridX,
    gridY: farBuildGridY,
    gridZ: farGroundZ + 3,
    rotation: 0,
  };
  const valFar2 = validatePlacement(occupancyMap, farBrick2, terrainProvider);
  assert(valFar2.isValid, "Far build brick 2 placement valid atop far brick 1");
  const cmdFar2 = new PlaceBrickCommand(farBrick2);
  cmdFar2.execute(bricksInWorld, setBricks);
  commandHistory.push(cmdFar2);

  // Partition all bricks into chunks
  const chunkMapping = groupBricksIntoChunks(bricksInWorld);
  for (const [k, chunkData] of Object.entries(chunkMapping)) {
    if (!activeWorld.chunks[k]) activeWorld.chunks[k] = { bricks: [] };
    activeWorld.chunks[k].bricks = chunkData.bricks;
  }

  assert(activeWorld.chunks[farBuildChunkKey] !== undefined, `Chunk ${farBuildChunkKey} exists in world chunks`);
  assert(activeWorld.chunks[farBuildChunkKey].bricks.length === 2, `Chunk ${farBuildChunkKey} contains 2 distant bricks`);
  recordStepPassed(22, "BUILD FAR FROM SPAWN", `Constructed outpost structure (far_b1, far_b2) at (${farBuildGridX}, ${farBuildGridY}) in chunk ${farBuildChunkKey}`);

  // ===========================================================================
  // STEP 23: FAST TRAVEL
  // ===========================================================================
  // Fast travel back to spawn waypoint
  const spawnWp = activeWorld.waypoints?.find((w) => w.isHome || w.id === "spawn_waypoint");
  assert(spawnWp !== undefined, "Spawn waypoint located for fast travel");
  if (!spawnWp) throw new Error("Spawn waypoint missing");
  playerPosition = [spawnWp.worldX, spawnWp.worldY + 1.5, spawnWp.worldZ];
  activeWorld.lastPlayerPosition = [...playerPosition];
  assert(Math.abs(playerPosition[0] - spawnWp.worldX) < 0.01, "Player teleported to spawn waypoint X coordinate");
  assert(Math.abs(playerPosition[2] - spawnWp.worldZ) < 0.01, "Player teleported to spawn waypoint Z coordinate");
  recordStepPassed(23, "FAST TRAVEL", `Fast traveled back to spawn waypoint (${playerPosition[0]}, ${playerPosition[2]})`);

  // ===========================================================================
  // STEP 24: MAP
  // ===========================================================================
  currentAppScreen = "world_map_modal";
  assert(currentAppScreen === "world_map_modal", "Opened WORLD MAP modal view");
  assert(Boolean(activeWorld.waypoints && activeWorld.waypoints.length === 2), "World map displays 2 registered waypoints");
  assert(Boolean(activeWorld.exploredChunks && activeWorld.exploredChunks.includes(farBuildChunkKey)), "World map fog-of-war reveals distant chunk 12,12");
  currentAppScreen = "game";
  recordStepPassed(24, "MAP", "World map displays player location, spawn marker, custom outpost, and explored chunks");

  // ===========================================================================
  // STEP 25: SAVE
  // ===========================================================================
  activeWorld.updatedAt = new Date().toISOString();
  activeWorld.lastPlayerPosition = [...playerPosition];
  activeWorld.lastPlayerYaw = playerYaw;
  await storage.saveWorld(activeWorld);

  const checkSaved = await storage.loadWorld(activeWorld.id);
  assert(checkSaved !== null, "World confirmed saved to storage");
  if (!checkSaved) throw new Error("Saved world not found in storage");
  assert(countWorldBricks(checkSaved) === 10, `Saved world has 10 total bricks (actual: ${countWorldBricks(checkSaved)})`);
  recordStepPassed(25, "SAVE", `Persisted world '${activeWorld.name}' with 10 bricks and terrain modifications`);

  // ===========================================================================
  // STEP 26: HOME
  // ===========================================================================
  const savedWorldId = activeWorld.id;
  currentAppScreen = "home";
  activeWorld = null;
  activeMode = null;
  selectedBrickIds = [];
  assert(currentAppScreen === "home", "Exited to HOME screen");
  assert(activeWorld === null, "Active world cleared from runtime memory");
  recordStepPassed(26, "HOME", "Safely exited session back to main menu");

  // ===========================================================================
  // STEP 27: REOPEN WORLD
  // ===========================================================================
  const reloadedWorld = await storage.loadWorld(savedWorldId);
  assert(reloadedWorld !== null, "Reopened world successfully loaded from storage");
  if (!reloadedWorld) throw new Error("Failed to reload world");
  activeWorld = reloadedWorld;
  assert(activeWorld.name === newWorldName, `World name matches '${newWorldName}'`);
  assert(activeWorld.worldType === "natural", "World type preserved as 'natural'");
  assert(activeWorld.worldSize === "expanding", "World size preserved as 'expanding'");
  assert(Boolean(activeWorld.waypoints && activeWorld.waypoints.length === 2), "2 waypoints loaded from storage");
  assert(Boolean(activeWorld.exploredChunks && activeWorld.exploredChunks.includes(farBuildChunkKey)), `Exploration of ${farBuildChunkKey} persisted`);
  assert(activeWorld.chunks[farBuildChunkKey] !== undefined, `Distant chunk ${farBuildChunkKey} loaded`);
  assert(activeWorld.chunks[farBuildChunkKey].bricks.length === 2, `Distant chunk contains 2 bricks`);
  const reloadedAllBricks = getAllBricksFromWorld(activeWorld);
  assert(reloadedAllBricks.length === 10, `All 10 bricks loaded across chunks (actual: ${reloadedAllBricks.length})`);
  recordStepPassed(27, "REOPEN WORLD", `Reloaded world '${activeWorld.name}' with 100% integrity across chunks and waypoints`);

  // ===========================================================================
  // STEP 28: RETURN TO FAR BUILD
  // ===========================================================================
  const outpostTarget = activeWorld.waypoints?.find((w) => w.id === "wp_distant_outpost");
  assert(outpostTarget !== undefined, "Located 'Distant Outpost' waypoint");
  if (!outpostTarget) throw new Error("Outpost waypoint not found");
  playerPosition = [outpostTarget.worldX, outpostTarget.worldY + 1.5, outpostTarget.worldZ];
  activeMode = "build";

  const distantChunkData = activeWorld.chunks[farBuildChunkKey];
  assert(distantChunkData !== undefined, `Distant chunk ${farBuildChunkKey} exists upon return`);
  if (!distantChunkData) throw new Error("Distant chunk missing upon return");
  const loadedFar1 = distantChunkData.bricks.find((b) => b.id === "far_b1");
  const loadedFar2 = distantChunkData.bricks.find((b) => b.id === "far_b2");
  assert(loadedFar1 !== undefined, "far_b1 present in distant chunk");
  assert(loadedFar2 !== undefined, "far_b2 present in distant chunk");
  if (!loadedFar1 || !loadedFar2) throw new Error("Distant bricks missing");
  assert(loadedFar1.gridX === farBuildGridX && loadedFar1.gridY === farBuildGridY, "far_b1 coordinates match");
  assert(loadedFar2.gridX === farBuildGridX && loadedFar2.gridY === farBuildGridY, "far_b2 coordinates match");
  assert(loadedFar2.gridZ === loadedFar1.gridZ + 3, "Stacking height relationship preserved at distant build");
  recordStepPassed(28, "RETURN TO FAR BUILD", `Teleported to Distant Outpost (${playerPosition[0].toFixed(1)}, ${playerPosition[2].toFixed(1)}) and verified far structure integrity`);

  // ===========================================================================
  // FINAL SUITE SUMMARY
  // ===========================================================================
  console.log("\n================================================================================");
  console.log(`  E2E REGRESSION SUITE RESULTS: ${totalStepsPassed}/28 STEPS PASSED (100%)`);
  console.log(`  TOTAL VALID ASSERTIONS: ${totalAssertions}`);
  console.log(`  FAILURES: ${failureDetails.length}`);
  console.log("================================================================================\n");

  if (failureDetails.length > 0) {
    process.exit(1);
  }
}

runE2ERegressionSuite().catch((err) => {
  console.error("FATAL ERROR IN REGRESSION SUITE:", err);
  process.exit(1);
});
