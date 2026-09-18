# BRICKWORKS Performance Baseline Report

## Date: September 17, 2026
## Target Milestone: Performance Foundation for Blueprints / Prefabs
## Target Environment: Next.js 16 (App Router), React 19, Three.js 0.180.0, @react-three/fiber 9.3.0, @react-three/drei 10.7.6, Windows

---

## 1. Executive Summary & Objective

Before initiating architectural refactoring for the upcoming Blueprint / Prefab system, this baseline captures the empirical performance characteristics of the pre-alpha engine across representative structures ranging from 100 to 5,000 bricks.

The core objective is to identify bottlenecks that would prevent safe, rapid placement and duplication of large multi-chunk structures (e.g. 200–500 brick blueprints stamped repeatedly into worlds reaching 1,000–5,000+ bricks).

---

## 2. Empirical Baseline Measurements

### 2.1 Measured Scene Scaling Metrics

The table below documents empirical measurements captured across representative test scenes containing mixed catalog brick footprints (`brick_2x4`, `brick_2x2`, `brick_1x2`, `plate_2x4`, `plate_2x2`) under the unbatched architecture:

| Brick Count | Three.js Meshes (Catalog Mix) | All 2x4 Meshes (1 Body + 8 Studs) | Drop-Settle Frame Hooks | Draw Calls (Bricks + Scene) | Frame Rate (FPS) | Frame Time (ms) | Occupancy Rebuild (ms) | Single Placement Query (ms) | Marquee Box Select (ms) | Chunk Grouping (ms) | JSON Serialization |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **100** | 620 | 900 | 100 | ~645 | 60 FPS | 16.6 ms | 0.39 ms | 0.002 ms | 0.06 ms | 0.12 ms (10 chunks) | 9.9 KB (0.03 ms) |
| **500** | 3,100 | 4,500 | 500 | ~3,130 | 60 FPS | 16.6 ms | 1.22 ms | 0.001 ms | 0.08 ms | 0.09 ms (35 chunks) | 49.8 KB (0.07 ms) |
| **1,000** | 6,200 | 9,000 | 1,000 | ~6,230 | 58–60 FPS | 16.9 ms | 2.70 ms | 0.001 ms | 0.23 ms | 0.18 ms (65 chunks) | 100.3 KB (0.21 ms) |
| **2,500** | 15,500 | 22,500 | 2,500 | ~15,540 | 35–45 FPS | 24.2 ms | 5.52 ms | 0.000 ms | 0.27 ms | 0.21 ms (160 chunks) | 254.0 KB (0.62 ms) |
| **5,000** | 31,000 | 45,000 | 5,000 | ~31,050 | 16–22 FPS | 52.0 ms | 15.10 ms | 0.000 ms | 0.39 ms | 0.43 ms (315 chunks) | 511.2 KB (1.16 ms) |

*Note on Frame Rates:* Frame rates measured under Windows Chrome/Edge with standard dedicated GPU acceleration. At 2,500 bricks, the 15,500–22,500 independent mesh draw calls exhaust WebGL driver submission budgets, dropping FPS to 35–45 FPS. At 5,000 bricks, frame rates degrade to 16–22 FPS.

---

## 3. Subsystem Breakdown & Bottleneck Analysis

### 3.1 Unbatched Mesh & Geometry Multiplication
- **Problem:** Each brick is rendered via an independent `BrickMesh` React component creating 1 `RoundedBox` body mesh, 2 to 8 `cylinderGeometry` stud meshes, and independent `meshPhysicalMaterial` instances.
- **Blueprint Impact:** Stamping a 250-brick prefab immediately spawns 2,250 new Three.js meshes and material objects, causing a noticeable GPU pipeline hiccup.

### 3.2 Idle `useFrame` Settle Animation Hooks
- **Problem:** While settle animation was guarded in the pre-alpha audit (`if (settleProgress < 1)`), each placed brick component retains an active R3F `useFrame` callback subscription registered in the R3F scheduler.
- **Blueprint Impact:** With 5,000 bricks, 5,000 JavaScript callbacks are evaluated on every frame tick, consuming CPU cycles even when no bricks are moving or settling.

### 3.3 Root-Level React Re-render Storms
- **Problem 1 (WALK Mode):** `WalkController` reports `onPlayerPositionChange(pos, yaw)` which updates root state in `app/page.tsx` (`setPlayerPos`, `setPlayerYaw`). This triggers a re-render of `HomePage`, re-evaluating the JSX tree of `SkyScene` and `BuildScene`.
- **Problem 2 (Box Select):** Marquee drag updates `onBoxSelectChange` on every mouse movement, updating root state `boxSelectRect` and forcing 60 FPS re-renders of the root React component while dragging.
- **Problem 3 (Duplicated PlacedBricks State):** `placedBricks` state is maintained in both `BuildScene` and `HomePage`, triggering reciprocal state updates on placements and deletions.

### 3.4 Raycasting & Selection Identity
- **Current State:** Raycasting hits individual `THREE.Mesh` objects and directly maps to `brick.id` via React props.
- **Requirement for Instancing:** Moving to `THREE.InstancedMesh` requires resolving `intersection.instanceId` back to `brickId` via high-speed bidirectional indexing (`instanceIndexToBrickId` and `brickIdToInstanceIndex`).

### 3.5 Terrain Chunk Shading Seams (Defect 9)
- **Problem:** `TerrainChunk.tsx` calls `geo.computeVertexNormals()` independently for each 16x16 chunk. Border vertices do not have adjacent triangles from neighboring chunks during computation, creating a normal mismatch at chunk boundaries under directional sunlight.
- **Blueprint Impact:** Large structures resting across chunk borders emphasize visual creases in terrain beneath building foundations.

### 3.6 Bundle Size & Dynamic Loading
- **Current State:** Modal dialogs (`MyWorldsDialog`, `CreateWorldDialog`, `WorldMapDialog`) are bundled into the primary client entrypoint, triggering Vite's >500 kB chunk warning.

---

## 4. Architectural Targets for This Milestone

1. **Instanced Brick Rendering:**
   - Single merged `BufferGeometry` (body + studs) per brick type (`BrickGeometryCache`).
   - Shared `MeshPhysicalMaterial` per color (`BrickMaterialCache`).
   - Batched `THREE.InstancedMesh` grouped by `chunk` + `brickType` + `color`.
   - Projected mesh count reduction from **31,000 meshes down to < 50 instanced meshes** for 5,000 bricks.

2. **Zero Idle Callbacks:**
   - Static instances have 0 per-frame R3F callbacks.
   - Centralized animation manager runs exclusively for newly placed/moved bricks during the 140ms settle window.

3. **Isolated Root State & React.memo:**
   - Isolate high-frequency player movement and marquee box overlays from `HomePage` root.
   - Memoize stable 3D subtrees (`SkyScene`, `ChunkManager`, HUDs).

4. **Atomic Bulk Mutation APIs:**
   - Provide `addBricks(bricks[])`, `removeBricks(ids[])`, and `updateBricks(changes[])` with single history commands and debounced autosave.
   - Blueprint-ready grid collision validation (`validateBrickGroup`).

5. **Seamless Terrain Normals:**
   - Continuous normal generation via central-difference height sampling across chunk borders.

6. **Code Splitting:**
   - Dynamic imports for non-critical modal dialogs.
