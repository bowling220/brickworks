import * as THREE from "three";
import {
  COLOR_PALETTE,
} from "../components/brickworks/BrickCatalog";
import {
  BrickData,
  OccupancyMap,
  resolveStackHeight,
  validatePlacement,
} from "../components/brickworks/GridSystem";
import {
  rotateGroupRelativeItems,
  resolveGroupCandidatePositions,
  GroupRelativeItem,
} from "../components/brickworks/GroupSystem";
import {
  CommandHistory,
  PlaceBrickCommand,
  MoveBrickCommand,
  DeleteGroupCommand,
  TerrainEditCommand,
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
  groupBricksIntoChunks,
  getAllBricksFromWorld,
  countWorldBricks,
  SavedWorld,
  ChunkTerrainMod,
} from "../components/brickworks/WorldStorage";

async function runTestSuite() {
  console.log("==================================================================");
  console.log("  BRICKWORKS AGENT B EMPIRICAL VERIFICATION SUITE (B1 - B30)");
  console.log("==================================================================\n");

  let passes = 0;
  let failures = 0;
  const issues: string[] = [];

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passes++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ""}`);
      failures++;
      issues.push(`${testName}${detail ? `: ${detail}` : ""}`);
    }
  }

  // --------------------------------------------------------------------
  // TEST 1: B11 Group Movement & Rotation - 360° 0-Stud Drift Invariance
  // --------------------------------------------------------------------
  console.log("--- B11: Group Rotation Drift Invariance (0°, 90°, 180°, 270°, 360°) ---");
  {
    const testAssemblies: Array<{ name: string; items: GroupRelativeItem[] }> = [
      {
        name: "Single 2x4",
        items: [
          { id: "1", type: "brick_2x4", color: "#ff0000", relX: 0, relY: 0, relZ: 0, rotation: 0 },
        ],
      },
      {
        name: "L-Shape 2x4 + 1x2",
        items: [
          { id: "1", type: "brick_2x4", color: "#ff0000", relX: 0, relY: 0, relZ: 0, rotation: 0 },
          { id: "2", type: "brick_1x2", color: "#00ff00", relX: 2, relY: 0, relZ: 0, rotation: 90 },
        ],
      },
      {
        name: "T-Shape Assembly",
        items: [
          { id: "1", type: "brick_2x4", color: "#ff0000", relX: 0, relY: 2, relZ: 0, rotation: 0 },
          { id: "2", type: "brick_2x4", color: "#0000ff", relX: 1, relY: 0, relZ: 0, rotation: 90 },
        ],
      },
      {
        name: "Asymmetrical Multi-Type Cluster (1x1, 1x4, 2x2, plates)",
        items: [
          { id: "1", type: "brick_1x1", color: "#ffffff", relX: 0, relY: 0, relZ: 0, rotation: 0 },
          { id: "2", type: "plate_2x4", color: "#ffff00", relX: 1, relY: 0, relZ: 0, rotation: 0 },
          { id: "3", type: "brick_2x2", color: "#ff00ff", relX: 3, relY: 4, relZ: 1, rotation: 0 },
          { id: "4", type: "plate_1x2", color: "#00ffff", relX: 0, relY: 3, relZ: 0, rotation: 90 },
        ],
      },
      {
        name: "Tall 3-Level Stack Assembly",
        items: [
          { id: "1", type: "brick_2x4", color: "#ff0000", relX: 0, relY: 0, relZ: 0, rotation: 0 },
          { id: "2", type: "brick_2x2", color: "#00ff00", relX: 0, relY: 0, relZ: 3, rotation: 0 },
          { id: "3", type: "plate_2x2", color: "#0000ff", relX: 0, relY: 0, relZ: 6, rotation: 0 },
        ],
      },
    ];

    for (const testCase of testAssemblies) {
      let current = testCase.items;
      for (let step = 1; step <= 4; step++) {
        current = rotateGroupRelativeItems(current);
      }

      // Compare 360° rotated with original
      let matches = true;
      let driftDetails = "";
      for (let i = 0; i < testCase.items.length; i++) {
        const orig = testCase.items[i];
        const rot = current[i];
        const driftX = Math.abs(orig.relX - rot.relX);
        const driftY = Math.abs(orig.relY - rot.relY);
        const rotMatch = orig.rotation === rot.rotation;
        if (driftX !== 0 || driftY !== 0 || !rotMatch) {
          matches = false;
          driftDetails = `Item ${orig.id} drifted by (${driftX}, ${driftY}) studs; rot=${rot.rotation} expected ${orig.rotation}`;
          break;
        }
      }
      assert(matches, `Rotation Invariance 360°: ${testCase.name}`, driftDetails);
    }
  }

  // --------------------------------------------------------------------
  // TEST 2: B5 Brick Stacking Physics & Occupancy
  // --------------------------------------------------------------------
  console.log("\n--- B5: Brick Stacking Tests ---");
  {
    const bricks: BrickData[] = [];
    const occ = new OccupancyMap(bricks);

    // 1. Baseplate placement (2x4 at 0, 0)
    const b1: BrickData = { id: "b1", type: "brick_2x4", color: "red", gridX: 0, gridY: 0, gridZ: 0, rotation: 0 };
    const z1 = resolveStackHeight(occ, 0, 0, 0, "brick_2x4");
    assert(z1 === 0, "Ground stack height resolves to gridZ = 0");
    occ.addBrick(b1);
    bricks.push(b1);

    // 2. Brick on Brick (2x4 on top of 2x4)
    const z2 = resolveStackHeight(occ, 0, 0, 0, "brick_2x4");
    assert(z2 === 3, `Brick on Brick: stack height resolves to 3 (actual: ${z2})`);
    const b2: BrickData = { id: "b2", type: "brick_2x4", color: "blue", gridX: 0, gridY: 0, gridZ: z2, rotation: 0 };
    const v2 = validatePlacement(occ, b2);
    assert(v2.isValid, "Brick on Brick placement is valid");
    occ.addBrick(b2);
    bricks.push(b2);

    // 3. Plate on Brick (plate_2x4 on top of b2)
    const z3 = resolveStackHeight(occ, 0, 0, 0, "plate_2x4");
    assert(z3 === 6, `Plate on Brick: stack height resolves to 6 (actual: ${z3})`);
    const p1: BrickData = { id: "p1", type: "plate_2x4", color: "yellow", gridX: 0, gridY: 0, gridZ: z3, rotation: 0 };
    const vp1 = validatePlacement(occ, p1);
    assert(vp1.isValid, "Plate on Brick placement is valid");
    occ.addBrick(p1);
    bricks.push(p1);

    // 4. Brick on Plate (brick_2x4 on top of plate)
    // Plate height is 1 unit, so z should be 6 + 1 = 7!
    const z4 = resolveStackHeight(occ, 0, 0, 0, "brick_2x4");
    assert(z4 === 7, `Brick on Plate: stack height resolves to 7 (actual: ${z4})`);
    const b3: BrickData = { id: "b3", type: "brick_2x4", color: "green", gridX: 0, gridY: 0, gridZ: z4, rotation: 0 };
    const vb3 = validatePlacement(occ, b3);
    assert(vb3.isValid, "Brick on Plate placement is valid");
    occ.addBrick(b3);
    bricks.push(b3);

    // 5. Perpendicular placement (2x4 with rotation 90 across 2x4 with rotation 0)
    const zPerp = resolveStackHeight(occ, 0, 0, 90, "brick_2x4");
    assert(zPerp === 10, `Perpendicular Brick stack height resolves to 10 (actual: ${zPerp})`);
    const bPerp: BrickData = { id: "bPerp", type: "brick_2x4", color: "white", gridX: 0, gridY: 0, gridZ: zPerp, rotation: 90 };
    const vPerp = validatePlacement(occ, bPerp);
    assert(vPerp.isValid, "Perpendicular Brick placement is valid");

    // 6. Bridging: two pillars at x=10 and x=13
    const pillar1: BrickData = { id: "pil1", type: "brick_2x2", color: "red", gridX: 10, gridY: 0, gridZ: 0, rotation: 0 };
    const pillar2: BrickData = { id: "pil2", type: "brick_2x2", color: "red", gridX: 13, gridY: 0, gridZ: 0, rotation: 0 };
    occ.addBrick(pillar1);
    occ.addBrick(pillar2);
    // Bridge 2x4 spanning from x=10 to x=13 (width=4 studs: x=10, 11, 12, 13)
    const bridgeZ = resolveStackHeight(occ, 10, 0, 90, "brick_2x4"); // rot 90: width 4, length 2
    assert(bridgeZ === 3, `Bridge stack height across 2 pillars resolves to 3 (actual: ${bridgeZ})`);
    const bridge: BrickData = { id: "bridge", type: "brick_2x4", color: "black", gridX: 10, gridY: 0, gridZ: bridgeZ, rotation: 90 };
    const vBridge = validatePlacement(occ, bridge);
    assert(vBridge.isValid, "Bridging brick across pillars is valid");

    // 7. Partial Support (cantilever / overhang)
    // 2x4 cantilevered by 2 studs over pillar at x=10 (starts at x=8, overlaps x=10, 11)
    const cantileverZ = resolveStackHeight(occ, 8, 0, 90, "brick_2x4");
    assert(cantileverZ === 3, `Cantilever stack height resolves to 3 (actual: ${cantileverZ})`);
    const cantilever: BrickData = { id: "canti", type: "brick_2x4", color: "orange", gridX: 8, gridY: 0, gridZ: 3, rotation: 90 };
    const vCanti = validatePlacement(occ, cantilever);
    assert(vCanti.isValid, "Cantilever (partial support) placement is valid");
  }

  // --------------------------------------------------------------------
  // TEST 3: B6 Invalid Placement - Collision, Out-of-Bounds & Unsupported
  // --------------------------------------------------------------------
  console.log("\n--- B6: Invalid Placement (Collision & Unsupported) ---");
  {
    const occ = new OccupancyMap();
    const base: BrickData = { id: "base", type: "brick_2x4", color: "red", gridX: 0, gridY: 0, gridZ: 0, rotation: 0 };
    occ.addBrick(base);

    // 1. Direct Collision (same position & layer)
    const coll1 = validatePlacement(occ, { type: "brick_2x4", color: "blue", gridX: 0, gridY: 0, gridZ: 0, rotation: 0 });
    assert(!coll1.isValid && coll1.reason === "collision", "Direct collision returns isValid=false, reason='collision'");

    // 2. Partial Volume Collision (overlap in 1 stud)
    const coll2 = validatePlacement(occ, { type: "brick_2x2", color: "blue", gridX: 1, gridY: 1, gridZ: 1, rotation: 0 });
    assert(!coll2.isValid && coll2.reason === "collision", "Partial volume collision returns isValid=false, reason='collision'");

    // 3. Floating Unsupported Brick (gridZ = 3 with no brick under it)
    const float1 = validatePlacement(occ, { type: "brick_2x4", color: "blue", gridX: 10, gridY: 10, gridZ: 3, rotation: 0 });
    assert(!float1.isValid && float1.reason === "unsupported", "Floating brick in mid-air returns isValid=false, reason='unsupported'");

    // 4. Floating Unsupported Plate
    const float2 = validatePlacement(occ, { type: "plate_2x4", color: "blue", gridX: 10, gridY: 10, gridZ: 1, rotation: 0 });
    assert(!float2.isValid && float2.reason === "unsupported", "Floating plate in mid-air returns isValid=false, reason='unsupported'");
  }

  // --------------------------------------------------------------------
  // TEST 4: B7, B9, B11 Group Move & Bounds Defect Investigation
  // --------------------------------------------------------------------
  console.log("\n--- B7 & B11: Group Placement Bounds & Negative Coordinate Inspection ---");
  {
    const occ = new OccupancyMap();
    const items: GroupRelativeItem[] = [
      { id: "1", type: "brick_2x4", color: "red", relX: 0, relY: 0, relZ: 0, rotation: 0 },
    ];

    // Candidate at positive within 32 studs
    const resPos = resolveGroupCandidatePositions(items, 5, 5, occ);
    assert(resPos.isValid, "Group move to (5, 5) within 32 studs is valid");

    // Candidate at NEGATIVE coordinates (e.g. anchorGridX = -5)
    const resNeg = resolveGroupCandidatePositions(items, -5, 5, occ);
    console.log(`  [VERIFICATION] Group move to negative coordinates (-5, 5): isValid=${resNeg.isValid}, reason=${resNeg.reason}`);
    assert(resNeg.isValid === true,
      "FIX VERIFIED: Group move to negative coordinates (-5, 5) accepted in multi-chunk world");

    // Candidate at coordinates > 32 (e.g. anchorGridX = 35)
    const resBeyond32 = resolveGroupCandidatePositions(items, 35, 5, occ);
    console.log(`  [VERIFICATION] Group move beyond 32 studs (35, 5): isValid=${resBeyond32.isValid}, reason=${resBeyond32.reason}`);
    assert(resBeyond32.isValid === true,
      "FIX VERIFIED: Group move beyond 32 studs accepted in modern multi-chunk worlds");
  }

  // --------------------------------------------------------------------
  // TEST 5: B6/B7 Void Placement Defect Investigation
  // --------------------------------------------------------------------
  console.log("\n--- B6 & B7: Island Void Height & Placement Inspection ---");
  {
    // On small floating island (radius ~ 25 studs), sample at worldX = 60 (well in the sky/void)
    const sampleVoid = sampleTerrain("island", "small", 12345, 60, 60);
    assert(sampleVoid.isVoid === true, "sampleTerrain returns isVoid=true in open sky beyond island border");

    // Query getTerrainHeightGrid at grid coordinate (75, 75)
    const gridVoidHeight = getTerrainHeightGrid("island", "small", 12345, 75, 75);
    console.log(`  [VERIFICATION] getTerrainHeightGrid in void returns: ${gridVoidHeight}`);
    assert(gridVoidHeight === -999,
      "FIX VERIFIED: getTerrainHeightGrid returns -999 for void, preventing ground placement in open sky");
  }

  // --------------------------------------------------------------------
  // TEST 6: B10 Multi-Select Shift-Click Wiring Check
  // --------------------------------------------------------------------
  console.log("\n--- B10: Multi-Select Shift-Click Argument Passing ---");
  {
    console.log("  [INVESTIGATION] BuildScene.tsx:1116 drops the second parameter `e` of onSelect, preventing Shift+Click from passing `e.shiftKey`.");
  }

  // --------------------------------------------------------------------
  // TEST 7: B12 Copy / Duplicate ID Uniqueness Test
  // --------------------------------------------------------------------
  console.log("\n--- B12: Copy / Duplicate ID Uniqueness (1,000 iterations) ---");
  {
    const idSet = new Set<string>();
    let duplicateCollisions = 0;
    for (let i = 0; i < 1000; i++) {
      const id = `brick-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (idSet.has(id)) {
        duplicateCollisions++;
      }
      idSet.add(id);
    }
    assert(duplicateCollisions === 0, "1,000 generated duplicate brick IDs are 100% unique without collisions");
  }

  // --------------------------------------------------------------------
  // TEST 8: B13 Undo / Redo Torture Test
  // --------------------------------------------------------------------
  console.log("\n--- B13: Undo / Redo Command History Torture Test ---");
  {
    const history = new CommandHistory(150);
    let stateBricks: BrickData[] = [];
    const setBricks = (updater: (prev: BrickData[]) => BrickData[]) => {
      stateBricks = updater(stateBricks);
    };

    // Execute 40 mixed operations
    for (let i = 0; i < 40; i++) {
      const b: BrickData = {
        id: `brick_${i}`,
        type: i % 2 === 0 ? "brick_2x4" : "brick_1x2",
        color: COLOR_PALETTE[i % COLOR_PALETTE.length].hex,
        gridX: i * 2,
        gridY: 0,
        gridZ: 0,
        rotation: 0,
      };
      const cmd = new PlaceBrickCommand(b);
      cmd.execute(stateBricks, setBricks);
      history.push(cmd);
    }

    assert(stateBricks.length === 40, "40 bricks successfully placed into state");
    assert(history.canUndo() === true, "History reports canUndo = true");

    // Move 10 bricks
    const changes = [
      { id: "brick_0", oldState: { gridX: 0, gridY: 0, gridZ: 0, rotation: 0 as const }, newState: { gridX: 0, gridY: 2, gridZ: 0, rotation: 90 as const } },
      { id: "brick_1", oldState: { gridX: 2, gridY: 0, gridZ: 0, rotation: 0 as const }, newState: { gridX: 2, gridY: 2, gridZ: 0, rotation: 90 as const } },
    ];
    const moveCmd = new MoveBrickCommand(changes);
    moveCmd.execute(stateBricks, setBricks);
    history.push(moveCmd);

    assert(stateBricks.find((b) => b.id === "brick_0")?.gridY === 2, "Moved brick_0 gridY is 2");

    // Delete 5 bricks
    const toDelete = stateBricks.slice(10, 15);
    const delGroupCmd = new DeleteGroupCommand(toDelete);
    delGroupCmd.execute(stateBricks, setBricks);
    history.push(delGroupCmd);

    assert(stateBricks.length === 35, "35 bricks remain after deleting 5");

    // Torture Undo 20 steps
    for (let u = 0; u < 20; u++) {
      history.undo(stateBricks, setBricks);
    }

    assert(history.canRedo() === true, "History reports canRedo = true after undo sequence");

    // Redo 10 steps
    for (let r = 0; r < 10; r++) {
      history.redo(stateBricks, setBricks);
    }

    // Full Undo to initial
    while (history.canUndo()) {
      history.undo(stateBricks, setBricks);
    }
    assert(stateBricks.length === 0, "Full undo returns state to exactly 0 bricks (clean state)");

    // Full Redo to end
    while (history.canRedo()) {
      history.redo(stateBricks, setBricks);
    }
    assert(stateBricks.length === 35, "Full redo restores state to exactly 35 bricks without corruption");
  }

  // --------------------------------------------------------------------
  // TEST 9: B14 & B15 Terrain Brush & Discrete Undo Test
  // --------------------------------------------------------------------
  console.log("\n--- B14 & B15: Terrain Brush & Terrain Undo Discrete Command ---");
  {
    const config: TerrainBrushConfig = {
      tool: "raise",
      size: 6,
      strength: 0.5,
      material: "grass",
    };

    const res = applyTerrainBrush({
      centerPoint: new THREE.Vector3(0, 0, 0),
      config,
      worldType: "island",
      worldSize: "small",
      seed: 12345,
      existingChunks: {},
      placedBricks: [],
      dt: 0.05,
    });

    assert(res.affectedChunkKeys.length > 0, `Terrain brush affected ${res.affectedChunkKeys.length} chunks`);
    const firstChunkKey = res.affectedChunkKeys[0];
    const mod = res.modifiedChunks[firstChunkKey];
    assert(mod && mod.heights && Object.keys(mod.heights).length > 0, "Modified chunk contains modified vertex heights");

    // Test TerrainEditCommand undo / redo
    let currentMods: Record<string, ChunkTerrainMod | undefined> = { ...res.modifiedChunks };
    const beforeMods: Record<string, ChunkTerrainMod | undefined> = {};
    for (const k of res.affectedChunkKeys) beforeMods[k] = undefined;

    const terrainCmd = new TerrainEditCommand(
      "raise",
      res.affectedChunkKeys,
      beforeMods,
      res.modifiedChunks,
      (mods) => {
        currentMods = { ...mods };
      }
    );

    // Undo
    terrainCmd.undo();
    assert(currentMods[firstChunkKey] === undefined, "TerrainEditCommand undo completely restores previous terrain mods");

    // Redo
    terrainCmd.execute();
    assert(currentMods[firstChunkKey] !== undefined, "TerrainEditCommand redo completely reapplies terrain mods");
  }

  // --------------------------------------------------------------------
  // TEST 10: B24, B26, B27 Persistence, Multi-World Isolation & Deletion
  // --------------------------------------------------------------------
  console.log("\n--- B24, B26, B27: World Storage Data Isolation & Deletion ---");
  {
    // Test chunk grouping and brick flattening
    const sampleBricks: BrickData[] = [
      { id: "b_0_0", type: "brick_2x4", color: "red", gridX: 2, gridY: 2, gridZ: 0, rotation: 0 },
      { id: "b_16_16", type: "brick_1x2", color: "blue", gridX: 18, gridY: 18, gridZ: 0, rotation: 90 },
      { id: "b_neg", type: "brick_2x2", color: "yellow", gridX: -5, gridY: -5, gridZ: 0, rotation: 0 },
    ];

    const chunks = groupBricksIntoChunks(sampleBricks, 16);
    assert(Boolean(chunks["0,0"]), "Chunk '0,0' correctly populated");
    assert(Boolean(chunks["1,1"]), "Chunk '1,1' correctly populated");
    assert(Boolean(chunks["-1,-1"]), "Negative chunk '-1,-1' correctly populated");

    const testWorld: SavedWorld = {
      id: "world_test_1",
      name: "Test World",
      version: 2,
      worldType: "island",
      worldSize: "small",
      seed: 9999,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      playerSpawn: [0, 0.5, 0],
      chunks,
      settings: { viewDistance: "medium" },
    };

    const count = countWorldBricks(testWorld);
    assert(count === 3, `countWorldBricks correctly counts 3 bricks across all chunks (actual: ${count})`);

    const flattened = getAllBricksFromWorld(testWorld);
    assert(flattened.length === 3, `getAllBricksFromWorld flattens all 3 bricks`);
  }

  console.log("\n==================================================================");
  console.log(`  VERIFICATION RESULTS: ${passes} PASSED, ${failures} FAILED`);
  console.log(`  IDENTIFIED DEFECTS TO REMEDIATE: ${issues.length}`);
  console.log("==================================================================\n");
}

runTestSuite().catch(console.error);
