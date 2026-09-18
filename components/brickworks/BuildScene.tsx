"use client";

import { useState, useCallback, useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ChunkBrickRenderer } from "./ChunkBrickRenderer";
import { SelectionOverlayRenderer } from "./SelectionOverlayRenderer";
import { globalBrickAnimationManager } from "./BrickAnimationManager";
import { GhostBrick } from "./GhostBrick";
import { GroupGhost, GhostBrickItem } from "./GroupGhost";
import { BlueprintGhostRenderer } from "./BlueprintGhostRenderer";
import { ChunkManager } from "./ChunkManager";
import { WorldType, WorldSize } from "./WorldStorage";
import { getTerrainHeightGrid } from "./TerrainGenerator";
import { getAudioManager } from "./AudioManager";
import {
  BrickData,
  BrickRotation,
  OccupancyMap,
  snapRayToGrid,
  resolveStackHeight,
  validatePlacement,
  getWorldPositionFromGrid,
} from "./GridSystem";
import {
  createGroupStructure,
  rotateGroupRelativeItems,
  resolveGroupCandidatePositions,
  GroupRelativeItem,
} from "./GroupSystem";
import {
  BrickTypeId,
  DEFAULT_BRICK_TYPE,
  DEFAULT_BRICK_COLOR,
} from "./BrickCatalog";
import {
  generateLineBricks,
  generateAreaBricks,
  generateMirroredBricks,
} from "./ToolMath";
import { BuildTool } from "./BuildUI";
import {
  CommandHistory,
  PlaceBrickCommand,
  DeleteBrickCommand,
  MoveBrickCommand,
  PlaceGroupCommand,
  DeleteGroupCommand,
  RecolorGroupCommand,
  ReplacePartsCommand,
  BrickTransform,
  BrickChange,
  TerrainEditCommand,
} from "./CommandHistory";
import { TerrainBrushConfig, applyTerrainBrush } from "./TerrainBrush";
import { TerrainBrushMesh } from "./TerrainBrushMesh";
import { ChunkTerrainMod } from "./WorldStorage";

export interface BuildSceneHandle {
  rotate: () => void;
  deleteSelected: () => void;
  deselect: () => void;
  setType: (type: BrickTypeId) => void;
  setColor: (color: string) => void;
  startMove: (brickId?: string) => void;
  cancelMove: () => void;
  confirmMove: () => void;
  undo: () => void;
  redo: () => void;
  duplicate: () => void;
  copy: () => void;
  paste: () => void;
  selectAll: () => void;
  toggleMultiSelectMode: (enabled?: boolean) => void;
  loadBricks: (bricks: BrickData[]) => void;
  getBricks: () => BrickData[];
  addBricks: (bricks: BrickData[]) => void;
  removeBricks: (ids: string[]) => void;
  updateBricks: (changes: BrickChange[]) => void;
  startBlueprintPlacement: (items: GroupRelativeItem[], name?: string, brickCount?: number) => void;
  cancelBlueprintPlacement: () => void;
  mirrorSelected: (axis: "x" | "z") => void;
  recolorSelected: (color: string) => void;
  replaceSelected: (type: BrickTypeId) => void;
  selectSameType: () => void;
  selectSameColor: () => void;
}

export interface BuildDebugInfo {
  gridX: number;
  gridY: number;
  gridZ: number;
  rotation: BrickRotation;
  type: BrickTypeId;
  color: string;
  isValid: boolean;
  reason?: string;
  totalBricks: number;
  occupiedCells: number;
}

interface BuildSceneProps {
  onSelectBrick?: (brick: BrickData | null) => void;
  onSelectionChange?: (selectedIds: string[], selectedBricks: BrickData[]) => void;
  onRotationChange?: (rotation: BrickRotation) => void;
  onTypeChange?: (type: BrickTypeId) => void;
  onColorChange?: (color: string) => void;
  onBrickPlacedSound?: (brick: BrickData) => void;
  onDebugUpdate?: (info: BuildDebugInfo) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onMoveModeChange?: (isMoving: boolean) => void;
  onBoxSelectChange?: (isBoxSelecting: boolean, rect: { x: number; y: number; width: number; height: number } | null) => void;
  isMultiSelectMode?: boolean;
  onBricksChange?: (bricks: BrickData[]) => void;
  editorMode?: "build" | "select" | "terrain" | "walk";
  buildTool?: BuildTool;
  onBuildToolChange?: (tool: BuildTool) => void;
  onLineToolStateChange?: (step: "start" | "end" | null, count: number) => void;
  onAreaToolStateChange?: (step: "start" | "end" | null, count: number) => void;
  worldType?: WorldType;
  worldSize?: WorldSize;
  seed?: number;
  viewDistance?: "low" | "medium" | "high";
  focusPosition?: [number, number, number];
  terrainBrushConfig?: TerrainBrushConfig;
  terrainMods?: Record<string, { terrainMod?: ChunkTerrainMod }>;
  onTerrainChange?: (modifiedChunks: Record<string, ChunkTerrainMod>, affectedChunkKeys: string[]) => void;
  onChunksExplored?: (chunkKeys: string[]) => void;
  onBlueprintStateChange?: (state: BlueprintPlacementState) => void;
}

export interface BlueprintPlacementState {
  isActive: boolean;
  name?: string;
  brickCount?: number;
  rotationDeg: 0 | 90 | 180 | 270;
  isValid: boolean;
  reason?: string;
}

export const BuildScene = forwardRef<BuildSceneHandle, BuildSceneProps>(function BuildScene(
  {
    onSelectBrick,
    onSelectionChange,
    onRotationChange,
    onTypeChange,
    onColorChange,
    onBrickPlacedSound,
    onDebugUpdate,
    onHistoryChange,
    onMoveModeChange,
    onBoxSelectChange,
    isMultiSelectMode = false,
    onBricksChange,
    editorMode = "build",
    buildTool = "single",
    onBuildToolChange,
    onLineToolStateChange,
    onAreaToolStateChange,
    worldType = "island",
    worldSize = "small",
    seed = 12345,
    viewDistance = "medium",
    focusPosition = [0, 0, 0],
    terrainBrushConfig,
    terrainMods,
    onTerrainChange,
    onChunksExplored,
    onBlueprintStateChange,
  },
  ref
) {
  const { camera, gl } = useThree();

  const [activeType, setActiveType] = useState<BrickTypeId>(DEFAULT_BRICK_TYPE);
  const [activeColor, setActiveColor] = useState<string>(DEFAULT_BRICK_COLOR);
  const [placedBricks, setPlacedBricks] = useState<BrickData[]>([]);
  const placedBricksRef = useRef<BrickData[]>(placedBricks);
  useEffect(() => {
    placedBricksRef.current = placedBricks;
  }, [placedBricks]);
  const [selectedBrickIds, setSelectedBrickIds] = useState<string[]>([]);
  const [rotation, setRotation] = useState<BrickRotation>(0);
  const [lastHitPoint, setLastHitPoint] = useState<[number, number, number] | null>(null);

  // Advanced Build Tools State
  const [lineState, setLineState] = useState<{
    start: { gridX: number; gridY: number; gridZ: number } | null;
    candidates: BrickData[];
  }>({
    start: null,
    candidates: [],
  });

  const [areaState, setAreaState] = useState<{
    cornerA: { gridX: number; gridY: number; gridZ: number } | null;
    candidates: BrickData[];
  }>({
    cornerA: null,
    candidates: [],
  });

  // Reset tool steps on mode / tool change
  useEffect(() => {
    setLineState({ start: null, candidates: [] });
    setAreaState({ cornerA: null, candidates: [] });
    onLineToolStateChange?.(null, 0);
    onAreaToolStateChange?.(null, 0);
  }, [buildTool, editorMode]);

  // Centralized command history
  const history = useRef(new CommandHistory(150)).current;

  // Terrain Brush Stroke State
  const [terrainBrushPoint, setTerrainBrushPoint] = useState<[number, number, number] | null>(null);
  const terrainBrushPointRef = useRef<[number, number, number] | null>(null);
  const isTerrainBrushingRef = useRef(false);
  const strokeInitialModsRef = useRef<Record<string, ChunkTerrainMod | undefined>>({});
  const strokeCurrentModsRef = useRef<Record<string, ChunkTerrainMod>>({});
  const strokeAffectedKeysRef = useRef<string[]>([]);
  const lastBrushApplyTimeRef = useRef(0);

  const onTerrainChangeRef = useRef(onTerrainChange);
  useEffect(() => {
    onTerrainChangeRef.current = onTerrainChange;
  }, [onTerrainChange]);

  const applyBrushAt = useCallback((hitWorld: [number, number, number]) => {
    if (!terrainBrushConfig) return;
    const now = performance.now();
    const dt = lastBrushApplyTimeRef.current ? (now - lastBrushApplyTimeRef.current) / 1000 : 0.05;
    lastBrushApplyTimeRef.current = now;

    const res = applyTerrainBrush({
      centerPoint: new THREE.Vector3(hitWorld[0], hitWorld[1], hitWorld[2]),
      config: terrainBrushConfig,
      worldType,
      worldSize,
      seed,
      existingChunks: {
        ...(terrainMods || {}),
        ...Object.fromEntries(
          Object.entries(strokeCurrentModsRef.current).map(([k, v]) => [k, { terrainMod: v }])
        ),
      },
      placedBricks: placedBricksRef.current,
      dt: Math.min(dt, 0.1),
    });

    if (res.affectedChunkKeys.length > 0) {
      for (const k of res.affectedChunkKeys) {
        if (!(k in strokeInitialModsRef.current)) {
          strokeInitialModsRef.current[k] = terrainMods?.[k]?.terrainMod;
        }
        if (!strokeAffectedKeysRef.current.includes(k)) {
          strokeAffectedKeysRef.current.push(k);
        }
        strokeCurrentModsRef.current[k] = res.modifiedChunks[k];
      }

      onTerrainChangeRef.current?.(res.modifiedChunks, res.affectedChunkKeys);
    }
  }, [seed, terrainBrushConfig, terrainMods, worldSize, worldType]);

  // Canvas pointer down for terrain mode stroke initiation
  useEffect(() => {
    if (editorMode !== "terrain") {
      if (isTerrainBrushingRef.current) {
        isTerrainBrushingRef.current = false;
        window.dispatchEvent(new CustomEvent("brickworks-terrain-sculpt-end"));
      }
      terrainBrushPointRef.current = null;
      setTerrainBrushPoint(null);
      return;
    }

    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const brushPt = terrainBrushPointRef.current;
      if (brushPt) {
        isTerrainBrushingRef.current = true;
        window.dispatchEvent(new CustomEvent("brickworks-terrain-sculpt-start"));
        lastBrushApplyTimeRef.current = performance.now();
        strokeInitialModsRef.current = {};
        strokeCurrentModsRef.current = {};
        strokeAffectedKeysRef.current = [];
        applyBrushAt(brushPt);
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (isTerrainBrushingRef.current) {
        isTerrainBrushingRef.current = false;
        window.dispatchEvent(new CustomEvent("brickworks-terrain-sculpt-end"));
        if (strokeAffectedKeysRef.current.length > 0) {
          const tool = terrainBrushConfig?.tool || "brush";
          const affected = [...strokeAffectedKeysRef.current];
          const before = { ...strokeInitialModsRef.current };
          const after = { ...strokeCurrentModsRef.current };

          const cmd = new TerrainEditCommand(
            tool,
            affected,
            before,
            after,
            (mods) => {
              const cleanMods: Record<string, ChunkTerrainMod> = {};
              for (const [k, v] of Object.entries(mods)) {
                cleanMods[k] = v || { heights: {}, materials: {} };
              }
              onTerrainChangeRef.current?.(cleanMods, affected);
            }
          );

          history.push(cmd);
          onHistoryChange?.(history.canUndo(), history.canRedo());
          strokeAffectedKeysRef.current = [];
        }
      }
    };

    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      if (isTerrainBrushingRef.current) {
        isTerrainBrushingRef.current = false;
        window.dispatchEvent(new CustomEvent("brickworks-terrain-sculpt-end"));
      }
    };
  }, [editorMode, gl.domElement, terrainBrushConfig, applyBrushAt, history, onHistoryChange]);

  // Group Move / Duplicate Placement Mode State
  const [groupMoveState, setGroupMoveState] = useState<{
    isActive: boolean;
    isDuplicate: boolean;
    movingIds: string[];
    originalTransforms: Record<string, BrickTransform>;
    items: GroupRelativeItem[];
    candidates: GhostBrickItem[];
    isValid: boolean;
    reason?: string;
    isBlueprintPlacement: boolean;
    blueprintName?: string;
    blueprintBrickCount?: number;
    blueprintOriginalItems?: GroupRelativeItem[];
    blueprintRotationCount: number;
  }>({
    isActive: false,
    isDuplicate: false,
    movingIds: [],
    originalTransforms: {},
    items: [],
    candidates: [],
    isValid: true,
    isBlueprintPlacement: false,
    blueprintRotationCount: 0,
  });

  // Internal memory clipboard for Copy / Paste
  const clipboardRef = useRef<BrickData[]>([]);

  // Normal Single-Placement Ghost State
  const [ghost, setGhost] = useState<{
    gridX: number;
    gridY: number;
    gridZ: number;
    isValid: boolean;
    reason?: string;
    visible: boolean;
  }>({
    gridX: 14,
    gridY: 14,
    gridZ: 0,
    isValid: true,
    visible: false,
  });

  // Selected bricks array
  const selectedBricks = useMemo(() => {
    return placedBricks.filter((b) => selectedBrickIds.includes(b.id));
  }, [placedBricks, selectedBrickIds]);

  // Synchronize selection changes with parent UI (only when selection IDs actually change)
  const prevSelectedIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const prev = prevSelectedIdsRef.current;
    if (prev.length === selectedBrickIds.length && prev.every((id, i) => id === selectedBrickIds[i])) {
      return;
    }
    prevSelectedIdsRef.current = selectedBrickIds;
    onSelectionChange?.(selectedBrickIds, selectedBricks);
    onSelectBrick?.(selectedBricks.length === 1 ? selectedBricks[0] : null);
  }, [onSelectBrick, onSelectionChange, selectedBrickIds, selectedBricks]);

  // Effective bricks excluding those currently being moved
  const effectiveBricks = useMemo(() => {
    if (groupMoveState.isActive && !groupMoveState.isDuplicate && groupMoveState.movingIds.length > 0) {
      const movingSet = new Set(groupMoveState.movingIds);
      return placedBricks.filter((b) => !movingSet.has(b.id));
    }
    return placedBricks;
  }, [groupMoveState.isActive, groupMoveState.isDuplicate, groupMoveState.movingIds, placedBricks]);

  // Fast 3D spatial occupancy index
  const occupancy = useMemo(() => new OccupancyMap(effectiveBricks), [effectiveBricks]);

  const terrainHeightProvider = useCallback(
    (gx: number, gy: number) => getTerrainHeightGrid(worldType, worldSize, seed, gx, gy),
    [worldType, worldSize, seed]
  );

  // Evaluates normal single placement ghost
  const updateSingleGhostAt = useCallback((
    hitWorld: [number, number, number],
    rot: BrickRotation,
    type: BrickTypeId,
    currentColor: string,
    currentOccupancy: OccupancyMap
  ) => {
    const { gridX, gridY } = snapRayToGrid(hitWorld, rot, type);
    const gridZ = resolveStackHeight(currentOccupancy, gridX, gridY, rot, type, terrainHeightProvider);
    const result = validatePlacement(currentOccupancy, {
      type,
      gridX,
      gridY,
      gridZ,
      rotation: rot,
    }, terrainHeightProvider);

    setGhost({
      gridX,
      gridY,
      gridZ,
      isValid: result.isValid,
      reason: result.reason,
      visible: true,
    });

    // Update Line Tool candidates if start point is set
    if (buildTool === "line" && lineState.start) {
      const lineBricks = generateLineBricks(
        lineState.start,
        { gridX, gridY, gridZ },
        type,
        currentColor,
        rot
      );
      setLineState((prev) => ({ ...prev, candidates: lineBricks }));
      onLineToolStateChange?.("end", lineBricks.length);
    }

    // Update Area Tool candidates if cornerA is set
    if (buildTool === "area" && areaState.cornerA) {
      const areaBricks = generateAreaBricks(
        areaState.cornerA,
        { gridX, gridY, gridZ },
        type,
        currentColor,
        rot
      );
      setAreaState((prev) => ({ ...prev, candidates: areaBricks }));
      onAreaToolStateChange?.("end", areaBricks.length);
    }

    onDebugUpdate?.({
      gridX,
      gridY,
      gridZ,
      rotation: rot,
      type,
      color: currentColor,
      isValid: result.isValid,
      reason: result.reason,
      totalBricks: placedBricks.length,
      occupiedCells: currentOccupancy.size(),
    });
  }, [areaState.cornerA, buildTool, lineState.start, onAreaToolStateChange, onDebugUpdate, onLineToolStateChange, placedBricks.length, terrainHeightProvider]);

  // Evaluates group ghost candidates at hitWorld
  const updateGroupGhostAt = useCallback((
    hitWorld: [number, number, number],
    items: GroupRelativeItem[],
    currentOccupancy: OccupancyMap
  ) => {
    if (items.length === 0) return;

    // Anchor snaps to grid
    const anchorType = items[0].type;
    const anchorRot = items[0].rotation;
    const { gridX: anchorGridX, gridY: anchorGridY } = snapRayToGrid(hitWorld, anchorRot, anchorType);

    const { candidates, isValid, reason } = resolveGroupCandidatePositions(
      items,
      anchorGridX,
      anchorGridY,
      currentOccupancy
    );

    setGroupMoveState((prev) => ({
      ...prev,
      items,
      candidates,
      isValid,
      reason,
    }));
  }, []);

  // Update ghost positions or terrain brush when pointer moves
  const handlePointerMoveWorld = useCallback((hitWorld: [number, number, number]) => {
    if (editorMode === "walk") return;

    if (editorMode === "terrain") {
      terrainBrushPointRef.current = hitWorld;
      setTerrainBrushPoint(hitWorld);
      if (isTerrainBrushingRef.current) {
        applyBrushAt(hitWorld);
      }
      return;
    }

    setLastHitPoint(hitWorld);

    if (groupMoveState.isActive) {
      updateGroupGhostAt(hitWorld, groupMoveState.items, occupancy);
    } else {
      updateSingleGhostAt(hitWorld, rotation, activeType, activeColor, occupancy);
    }
  }, [activeColor, activeType, applyBrushAt, editorMode, groupMoveState.isActive, groupMoveState.items, occupancy, rotation, updateGroupGhostAt, updateSingleGhostAt]);

  // Set active brick type
  const handleSetType = useCallback((newType: BrickTypeId) => {
    if (groupMoveState.isActive) return;
    setActiveType(newType);
    onTypeChange?.(newType);
    if (lastHitPoint) {
      updateSingleGhostAt(lastHitPoint, rotation, newType, activeColor, occupancy);
    }
  }, [activeColor, groupMoveState.isActive, lastHitPoint, occupancy, onTypeChange, rotation, updateSingleGhostAt]);

  // Set active color
  const handleSetColor = useCallback((newColor: string) => {
    setActiveColor(newColor);
    onColorChange?.(newColor);
    if (lastHitPoint && !groupMoveState.isActive) {
      updateSingleGhostAt(lastHitPoint, rotation, activeType, newColor, occupancy);
    }
  }, [activeType, groupMoveState.isActive, lastHitPoint, occupancy, onColorChange, rotation, updateSingleGhostAt]);

  // Toggle rotation (4-way: 0 -> 90 -> 180 -> 270 -> 0)
  const toggleRotation = useCallback(() => {
    if (groupMoveState.isActive) {
      // Rotate group items by 90 degrees around integer center
      const nextItems = rotateGroupRelativeItems(groupMoveState.items);
      if (lastHitPoint) {
        updateGroupGhostAt(lastHitPoint, nextItems, occupancy);
      } else {
        setGroupMoveState((prev) => ({ ...prev, items: nextItems }));
      }
      // Track cumulative rotation for Blueprint HUD display
      if (groupMoveState.isBlueprintPlacement) {
        setGroupMoveState((prev) => ({
          ...prev,
          items: nextItems,
          blueprintRotationCount: prev.blueprintRotationCount + 1,
        }));
      }
    } else {
      setRotation((current) => {
        const next: BrickRotation = ((current + 90) % 360) as BrickRotation;
        onRotationChange?.(next);
        if (lastHitPoint) {
          updateSingleGhostAt(lastHitPoint, next, activeType, activeColor, occupancy);
        }
        return next;
      });
    }
  }, [activeColor, activeType, groupMoveState.isActive, groupMoveState.isBlueprintPlacement, groupMoveState.items, lastHitPoint, occupancy, onRotationChange, updateGroupGhostAt, updateSingleGhostAt]);

  // Advanced Select Mode Tools: Mirror, Recolor, Replace, Filter
  const mirrorSelected = useCallback((axis: "x" | "z") => {
    if (selectedBricks.length === 0) return;
    const mirrored = generateMirroredBricks(selectedBricks, axis);
    if (mirrored.length === 0) return;

    const changes: BrickChange[] = selectedBricks.map((b) => {
      const m = mirrored.find((x) => x.id === b.id)!;
      return {
        id: b.id,
        oldState: { gridX: b.gridX, gridY: b.gridY, gridZ: b.gridZ, rotation: b.rotation },
        newState: { gridX: m.gridX, gridY: m.gridY, gridZ: m.gridZ, rotation: m.rotation },
      };
    });

    const cmd = new MoveBrickCommand(changes);
    cmd.execute(placedBricks, setPlacedBricks);
    history.push(cmd);
    onHistoryChange?.(history.canUndo(), history.canRedo());
    globalBrickAnimationManager.triggerSettle(changes.map((c) => c.id));
  }, [history, onHistoryChange, placedBricks, selectedBricks]);

  const recolorSelected = useCallback((newColor: string) => {
    if (selectedBricks.length === 0) return;
    const changes = selectedBricks.map((b) => ({
      id: b.id,
      oldColor: b.color,
      newColor,
      oldType: b.type,
      newType: b.type,
    }));
    const cmd = new RecolorGroupCommand(changes);
    cmd.execute(placedBricks, setPlacedBricks);
    history.push(cmd);
    onHistoryChange?.(history.canUndo(), history.canRedo());
  }, [history, onHistoryChange, placedBricks, selectedBricks]);

  const replaceSelected = useCallback((newType: BrickTypeId) => {
    if (selectedBricks.length === 0) return;
    const changes = selectedBricks.map((b) => ({
      id: b.id,
      oldType: b.type,
      newType,
      oldColor: b.color,
      newColor: b.color,
    }));
    const cmd = new ReplacePartsCommand(changes);
    cmd.execute(placedBricks, setPlacedBricks);
    history.push(cmd);
    onHistoryChange?.(history.canUndo(), history.canRedo());
    globalBrickAnimationManager.triggerSettle(changes.map((c) => c.id));
  }, [history, onHistoryChange, placedBricks, selectedBricks]);

  const selectSameType = useCallback(() => {
    if (selectedBricks.length === 0) return;
    const types = new Set(selectedBricks.map((b) => b.type));
    const matches = placedBricks.filter((b) => types.has(b.type)).map((b) => b.id);
    setSelectedBrickIds(matches);
  }, [placedBricks, selectedBricks]);

  const selectSameColor = useCallback(() => {
    if (selectedBricks.length === 0) return;
    const colors = new Set(selectedBricks.map((b) => b.color));
    const matches = placedBricks.filter((b) => colors.has(b.color)).map((b) => b.id);
    setSelectedBrickIds(matches);
  }, [placedBricks, selectedBricks]);

  // Start Move Mode on selected brick(s)
  const startMove = useCallback((targetId?: string) => {
    const idsToMove = targetId ? [targetId] : selectedBrickIds;
    if (idsToMove.length === 0) return;

    const bricksToMove = placedBricks.filter((b) => idsToMove.includes(b.id));
    if (bricksToMove.length === 0) return;

    const groupStructure = createGroupStructure(bricksToMove);
    const originalTransforms: Record<string, BrickTransform> = {};
    for (const b of bricksToMove) {
      originalTransforms[b.id] = {
        gridX: b.gridX,
        gridY: b.gridY,
        gridZ: b.gridZ,
        rotation: b.rotation,
      };
    }

    // Occupancy without moving bricks
    const movingSet = new Set(idsToMove);
    const occWithout = new OccupancyMap(placedBricks.filter((b) => !movingSet.has(b.id)));

    setGroupMoveState({
      isActive: true,
      isDuplicate: false,
      movingIds: idsToMove,
      originalTransforms,
      items: groupStructure.items,
      candidates: [],
      isValid: true,
      isBlueprintPlacement: false,
      blueprintRotationCount: 0,
    });

    onMoveModeChange?.(true);

    const hit = lastHitPoint || getWorldPositionFromGrid(
      bricksToMove[0].gridX,
      bricksToMove[0].gridY,
      bricksToMove[0].gridZ,
      bricksToMove[0].rotation,
      bricksToMove[0].type
    );
    updateGroupGhostAt(hit, groupStructure.items, occWithout);
  }, [lastHitPoint, onMoveModeChange, placedBricks, selectedBrickIds, updateGroupGhostAt]);

  // Cancel Move / Duplicate Placement
  const cancelMove = useCallback(() => {
    if (!groupMoveState.isActive) return;

    setGroupMoveState({
      isActive: false,
      isDuplicate: false,
      movingIds: [],
      originalTransforms: {},
      items: [],
      candidates: [],
      isValid: true,
      isBlueprintPlacement: false,
      blueprintRotationCount: 0,
    });

    onMoveModeChange?.(false);

    if (lastHitPoint) {
      const fullOccupancy = new OccupancyMap(placedBricks);
      updateSingleGhostAt(lastHitPoint, rotation, activeType, activeColor, fullOccupancy);
    }
  }, [activeColor, activeType, groupMoveState.isActive, lastHitPoint, onMoveModeChange, placedBricks, rotation, updateSingleGhostAt]);

  // Confirm Move or Duplicate Placement
  const confirmMove = useCallback(() => {
    if (!groupMoveState.isActive || !groupMoveState.isValid || groupMoveState.candidates.length === 0) {
      return;
    }

    if (groupMoveState.isDuplicate) {
      // DUPLICATE / PASTE / BLUEPRINT CONFIRMATION
      const newBricks: BrickData[] = groupMoveState.candidates.map((cand) => ({
        id: `brick-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: cand.type,
        color: cand.color,
        gridX: cand.gridX,
        gridY: cand.gridY,
        gridZ: cand.gridZ,
        rotation: cand.rotation,
      }));

      const cmd = newBricks.length === 1
        ? new PlaceBrickCommand(newBricks[0])
        : new PlaceGroupCommand(newBricks);

      cmd.execute(placedBricks, setPlacedBricks);
      history.push(cmd);
      onHistoryChange?.(history.canUndo(), history.canRedo());

      // Tactile sound & settle triggers
      if (newBricks.length > 0) {
        if (groupMoveState.isBlueprintPlacement || newBricks.length > 1) {
          getAudioManager().playBlueprintPlacement(newBricks.length);
        } else {
          onBrickPlacedSound?.(newBricks[0]);
        }
        globalBrickAnimationManager.triggerSettle(newBricks.map((b) => b.id));
      }

      // Blueprint repeated stamping: stay in placement mode
      if (groupMoveState.isBlueprintPlacement && groupMoveState.blueprintOriginalItems) {
        // Re-enter with same items for repeated placement
        const nextOccupancy = new OccupancyMap([...placedBricks, ...newBricks]);
        const currentItems = groupMoveState.items; // Keep current rotation state
        setGroupMoveState((prev) => ({
          ...prev,
          candidates: [],
          isValid: true,
          reason: undefined,
        }));
        // Re-evaluate ghost at current pointer position
        if (lastHitPoint) {
          setTimeout(() => {
            updateGroupGhostAt(lastHitPoint, currentItems, nextOccupancy);
          }, 0);
        }
        return; // Don't exit move mode
      }

      // Normal duplicate/paste: select newly placed bricks and exit
      setSelectedBrickIds(newBricks.map((b) => b.id));
    } else {
      // MOVE CONFIRMATION
      const changes = groupMoveState.candidates
        .filter((cand) => cand.id && groupMoveState.originalTransforms[cand.id])
        .map((cand) => ({
          id: cand.id!,
          oldState: groupMoveState.originalTransforms[cand.id!],
          newState: {
            gridX: cand.gridX,
            gridY: cand.gridY,
            gridZ: cand.gridZ,
            rotation: cand.rotation,
          },
        }));

      const hasChanged = changes.some(
        (c) =>
          c.oldState.gridX !== c.newState.gridX ||
          c.oldState.gridY !== c.newState.gridY ||
          c.oldState.gridZ !== c.newState.gridZ ||
          c.oldState.rotation !== c.newState.rotation
      );

      if (hasChanged) {
        const cmd = new MoveBrickCommand(changes);
        cmd.execute(placedBricks, setPlacedBricks);
        history.push(cmd);
        onHistoryChange?.(history.canUndo(), history.canRedo());
        globalBrickAnimationManager.triggerSettle(changes.map((c) => c.id));

        const firstMoved = placedBricks.find((b) => b.id === changes[0]?.id);
        if (firstMoved) {
          onBrickPlacedSound?.({
            ...firstMoved,
            gridX: changes[0].newState.gridX,
            gridY: changes[0].newState.gridY,
            gridZ: changes[0].newState.gridZ,
            rotation: changes[0].newState.rotation,
          });
        }
      }
    }

    setGroupMoveState({
      isActive: false,
      isDuplicate: false,
      movingIds: [],
      originalTransforms: {},
      items: [],
      candidates: [],
      isValid: true,
      isBlueprintPlacement: false,
      blueprintRotationCount: 0,
    });
    onMoveModeChange?.(false);
  }, [groupMoveState, history, lastHitPoint, onBrickPlacedSound, onHistoryChange, onMoveModeChange, placedBricks, updateGroupGhostAt]);

  // Start Duplicate or Paste placement mode
  const startDuplicateOrPaste = useCallback((sourceBricks: BrickData[]) => {
    if (sourceBricks.length === 0) return;

    const groupStructure = createGroupStructure(sourceBricks);

    setGroupMoveState({
      isActive: true,
      isDuplicate: true,
      movingIds: [], // Original bricks stay solid and occupied
      originalTransforms: {},
      items: groupStructure.items,
      candidates: [],
      isValid: true,
      isBlueprintPlacement: false,
      blueprintRotationCount: 0,
    });

    onMoveModeChange?.(true);

    const hit = lastHitPoint || getWorldPositionFromGrid(
      sourceBricks[0].gridX,
      sourceBricks[0].gridY,
      sourceBricks[0].gridZ,
      sourceBricks[0].rotation,
      sourceBricks[0].type
    );
    updateGroupGhostAt(hit, groupStructure.items, occupancy);
  }, [lastHitPoint, occupancy, onMoveModeChange, updateGroupGhostAt]);

  // Duplicate selected bricks (Ctrl+D)
  const duplicate = useCallback(() => {
    if (selectedBricks.length === 0) return;
    startDuplicateOrPaste(selectedBricks);
  }, [selectedBricks, startDuplicateOrPaste]);

  // Copy selected bricks (Ctrl+C)
  const copy = useCallback(() => {
    if (selectedBricks.length === 0) return;
    clipboardRef.current = selectedBricks.map((b) => ({ ...b }));
  }, [selectedBricks]);

  // Paste copied bricks (Ctrl+V)
  const paste = useCallback(() => {
    if (clipboardRef.current.length === 0) return;
    startDuplicateOrPaste(clipboardRef.current);
  }, [startDuplicateOrPaste]);

  // Select All bricks (Ctrl+A)
  const selectAll = useCallback(() => {
    if (placedBricks.length === 0) return;
    setSelectedBrickIds(placedBricks.map((b) => b.id));
  }, [placedBricks]);

  // Deselect All
  const deselect = useCallback(() => {
    if (groupMoveState.isActive) {
      cancelMove();
    }
    setSelectedBrickIds([]);
  }, [cancelMove, groupMoveState.isActive]);

  // Delete selected bricks (single or group)
  const deleteSelected = useCallback(() => {
    if (groupMoveState.isActive) {
      cancelMove();
    }
    if (selectedBrickIds.length === 0) return;

    const toDelete = placedBricks.filter((b) => selectedBrickIds.includes(b.id));
    if (toDelete.length === 0) return;

    const cmd = toDelete.length === 1
      ? new DeleteBrickCommand(toDelete[0])
      : new DeleteGroupCommand(toDelete);

    cmd.execute(placedBricks, setPlacedBricks);
    history.push(cmd);
    onHistoryChange?.(history.canUndo(), history.canRedo());

    setSelectedBrickIds([]);
  }, [cancelMove, groupMoveState.isActive, history, onHistoryChange, placedBricks, selectedBrickIds]);

  // Undo latest command
  const undo = useCallback(() => {
    if (groupMoveState.isActive) {
      cancelMove();
    }
    const cmd = history.undo(placedBricks, setPlacedBricks);
    if (cmd) {
      onHistoryChange?.(history.canUndo(), history.canRedo());
      globalBrickAnimationManager.triggerSettle(cmd.affectedBrickIds);
      setSelectedBrickIds([]);
    }
  }, [cancelMove, groupMoveState.isActive, history, onHistoryChange, placedBricks]);

  // Redo latest undone command
  const redo = useCallback(() => {
    if (groupMoveState.isActive) {
      cancelMove();
    }
    const cmd = history.redo(placedBricks, setPlacedBricks);
    if (cmd) {
      onHistoryChange?.(history.canUndo(), history.canRedo());
      globalBrickAnimationManager.triggerSettle(cmd.affectedBrickIds);
    }
  }, [cancelMove, groupMoveState.isActive, history, onHistoryChange, placedBricks]);

  // Load a complete set of bricks into the scene (clearing undo history)
  const isExternalLoadRef = useRef(false);
  const prevBricksRef = useRef<BrickData[]>(placedBricks);

  const loadBricks = useCallback((bricks: BrickData[]) => {
    if (groupMoveState.isActive) {
      cancelMove();
    }
    setSelectedBrickIds([]);
    history.clear();
    onHistoryChange?.(false, false);
    isExternalLoadRef.current = true;
    prevBricksRef.current = bricks;
    setPlacedBricks(bricks);
    placedBricksRef.current = bricks;
  }, [cancelMove, groupMoveState.isActive, history, onHistoryChange]);

  const getBricks = useCallback(() => {
    return placedBricksRef.current;
  }, []);

  // Atomic Bulk Mutation APIs (Prepared for Blueprint Mode & large structure duplication)
  const addBricks = useCallback((bricksToAdd: BrickData[]) => {
    if (bricksToAdd.length === 0) return;
    const cmd = bricksToAdd.length === 1
      ? new PlaceBrickCommand(bricksToAdd[0])
      : new PlaceGroupCommand(bricksToAdd);

    cmd.execute(placedBricks, setPlacedBricks);
    history.push(cmd);
    onHistoryChange?.(history.canUndo(), history.canRedo());
    globalBrickAnimationManager.triggerSettle(bricksToAdd.map((b) => b.id));
    if (bricksToAdd.length > 1) {
      getAudioManager().playBlueprintPlacement(bricksToAdd.length);
    } else {
      onBrickPlacedSound?.(bricksToAdd[0]);
    }
  }, [history, onBrickPlacedSound, onHistoryChange, placedBricks]);

  const removeBricks = useCallback((idsToRemove: string[]) => {
    if (idsToRemove.length === 0) return;
    const idSet = new Set(idsToRemove);
    const toDelete = placedBricks.filter((b) => idSet.has(b.id));
    if (toDelete.length === 0) return;

    const cmd = toDelete.length === 1
      ? new DeleteBrickCommand(toDelete[0])
      : new DeleteGroupCommand(toDelete);

    cmd.execute(placedBricks, setPlacedBricks);
    history.push(cmd);
    onHistoryChange?.(history.canUndo(), history.canRedo());
    setSelectedBrickIds((prev) => prev.filter((id) => !idSet.has(id)));
  }, [history, onHistoryChange, placedBricks]);

  const updateBricks = useCallback((changes: BrickChange[]) => {
    if (changes.length === 0) return;
    const cmd = new MoveBrickCommand(changes);
    cmd.execute(placedBricks, setPlacedBricks);
    history.push(cmd);
    onHistoryChange?.(history.canUndo(), history.canRedo());
    globalBrickAnimationManager.triggerSettle(changes.map((c) => c.id));
  }, [history, onHistoryChange, placedBricks]);

  // Stable reference to onBricksChange callback to prevent re-triggering effects
  const onBricksChangeRef = useRef(onBricksChange);
  useEffect(() => {
    onBricksChangeRef.current = onBricksChange;
  }, [onBricksChange]);

  // Notify parent component on brick edits (debounced autosave trigger)
  const isInitialRender = useRef(true);
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      prevBricksRef.current = placedBricks;
      return;
    }
    if (isExternalLoadRef.current) {
      isExternalLoadRef.current = false;
      prevBricksRef.current = placedBricks;
      return;
    }
    // Only fire if placedBricks reference actually changed from user action
    if (prevBricksRef.current === placedBricks) {
      return;
    }
    prevBricksRef.current = placedBricks;
    onBricksChangeRef.current?.(placedBricks);
  }, [placedBricks]);

  // Multi-select state (supports both external isMultiSelectMode prop and imperative toggle)
  const [internalMultiSelect, setInternalMultiSelect] = useState<boolean | null>(null);
  const effectiveMultiSelect = internalMultiSelect !== null ? internalMultiSelect : isMultiSelectMode;

  const toggleMultiSelectMode = useCallback((enabled?: boolean) => {
    setInternalMultiSelect((prev) => (enabled !== undefined ? enabled : !(prev ?? isMultiSelectMode)));
  }, [isMultiSelectMode]);

  // ─── Blueprint Placement Mode ───────────────────────────────────────────────
  const onBlueprintStateChangeRef = useRef(onBlueprintStateChange);
  useEffect(() => {
    onBlueprintStateChangeRef.current = onBlueprintStateChange;
  }, [onBlueprintStateChange]);

  // Notify parent about Blueprint placement state changes
  useEffect(() => {
    onBlueprintStateChangeRef.current?.({
      isActive: groupMoveState.isBlueprintPlacement && groupMoveState.isActive,
      name: groupMoveState.blueprintName,
      brickCount: groupMoveState.blueprintBrickCount,
      rotationDeg: ((groupMoveState.blueprintRotationCount % 4) * 90) as 0 | 90 | 180 | 270,
      isValid: groupMoveState.isValid,
      reason: groupMoveState.reason,
    });
  }, [
    groupMoveState.isBlueprintPlacement,
    groupMoveState.isActive,
    groupMoveState.blueprintName,
    groupMoveState.blueprintBrickCount,
    groupMoveState.blueprintRotationCount,
    groupMoveState.isValid,
    groupMoveState.reason,
  ]);

  const startBlueprintPlacement = useCallback((
    items: GroupRelativeItem[],
    name?: string,
    brickCount?: number
  ) => {
    if (items.length === 0) return;

    setGroupMoveState({
      isActive: true,
      isDuplicate: true,
      movingIds: [],
      originalTransforms: {},
      items,
      candidates: [],
      isValid: true,
      isBlueprintPlacement: true,
      blueprintName: name,
      blueprintBrickCount: brickCount || items.length,
      blueprintOriginalItems: items.map((i) => ({ ...i })),
      blueprintRotationCount: 0,
    });

    onMoveModeChange?.(true);

    if (lastHitPoint) {
      updateGroupGhostAt(lastHitPoint, items, occupancy);
    }
  }, [lastHitPoint, occupancy, onMoveModeChange, updateGroupGhostAt]);

  const cancelBlueprintPlacement = useCallback(() => {
    if (!groupMoveState.isBlueprintPlacement) return;

    setGroupMoveState({
      isActive: false,
      isDuplicate: false,
      movingIds: [],
      originalTransforms: {},
      items: [],
      candidates: [],
      isValid: true,
      isBlueprintPlacement: false,
      blueprintRotationCount: 0,
    });

    onMoveModeChange?.(false);

    if (lastHitPoint) {
      const fullOccupancy = new OccupancyMap(placedBricks);
      updateSingleGhostAt(lastHitPoint, rotation, activeType, activeColor, fullOccupancy);
    }
  }, [activeColor, activeType, groupMoveState.isBlueprintPlacement, lastHitPoint, onMoveModeChange, placedBricks, rotation, updateSingleGhostAt]);

  // Expose imperative actions to UI
  useImperativeHandle(ref, () => ({
    rotate: toggleRotation,
    deleteSelected,
    deselect,
    setType: handleSetType,
    setColor: handleSetColor,
    startMove,
    cancelMove,
    confirmMove,
    undo,
    redo,
    duplicate,
    copy,
    paste,
    selectAll,
    toggleMultiSelectMode,
    loadBricks,
    getBricks,
    addBricks,
    removeBricks,
    updateBricks,
    startBlueprintPlacement,
    cancelBlueprintPlacement,
    mirrorSelected,
    recolorSelected,
    replaceSelected,
    selectSameType,
    selectSameColor,
  }), [toggleRotation, deleteSelected, deselect, handleSetType, handleSetColor, startMove, cancelMove, confirmMove, undo, redo, duplicate, copy, paste, selectAll, toggleMultiSelectMode, loadBricks, getBricks, addBricks, removeBricks, updateBricks, startBlueprintPlacement, cancelBlueprintPlacement, mirrorSelected, recolorSelected, replaceSelected, selectSameType, selectSameColor]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if (isCtrlOrCmd && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
      } else if (isCtrlOrCmd && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        duplicate();
      } else if (isCtrlOrCmd && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        copy();
      } else if (isCtrlOrCmd && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        paste();
      } else if (isCtrlOrCmd && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        selectAll();
      } else if (e.key === "m" || e.key === "M") {
        if (selectedBrickIds.length > 0 && !groupMoveState.isActive) {
          e.preventDefault();
          startMove();
        }
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        toggleRotation();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedBrickIds.length > 0 && !groupMoveState.isActive) {
          e.preventDefault();
          deleteSelected();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (groupMoveState.isActive) {
          cancelMove();
        } else if (selectedBrickIds.length > 0) {
          deselect();
        }
      } else if (editorMode === "build" && !groupMoveState.isActive && selectedBrickIds.length <= 1) {
        if (e.key === "1") { e.preventDefault(); handleSetType("brick_1x1"); }
        else if (e.key === "2") { e.preventDefault(); handleSetType("brick_1x2"); }
        else if (e.key === "3") { e.preventDefault(); handleSetType("brick_1x4"); }
        else if (e.key === "4") { e.preventDefault(); handleSetType("brick_2x2"); }
        else if (e.key === "5") { e.preventDefault(); handleSetType("brick_2x4"); }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelMove, copy, deleteSelected, deselect, duplicate, editorMode, groupMoveState.isActive, handleSetType, paste, redo, selectAll, selectedBrickIds.length, startMove, toggleRotation, undo]);

  // Desktop Drag-Box Selection listeners on canvas DOM element
  const boxDragRef = useRef<{ startX: number; startY: number; isDragging: boolean } | null>(null);
  const boxDragEndTimeRef = useRef<number>(0);

  useEffect(() => {
    const dom = gl.domElement;

    const handlePointerDown = (e: PointerEvent) => {
      // Only initiate box drag if in SELECT mode and (Multi-Select mode is active or Shift is held down)
      if (editorMode !== "select") return;
      if (!effectiveMultiSelect && !e.shiftKey) return;
      if (groupMoveState.isActive) return;

      boxDragRef.current = { startX: e.clientX, startY: e.clientY, isDragging: false };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!boxDragRef.current) return;
      const dx = e.clientX - boxDragRef.current.startX;
      const dy = e.clientY - boxDragRef.current.startY;

      if (Math.hypot(dx, dy) > 8) {
        if (!boxDragRef.current.isDragging) {
          boxDragRef.current.isDragging = true;
          onBoxSelectChange?.(true, null);
        }
        const marquee = document.getElementById("box-select-marquee");
        if (marquee) {
          marquee.style.display = "block";
          marquee.style.left = `${Math.min(boxDragRef.current.startX, e.clientX)}px`;
          marquee.style.top = `${Math.min(boxDragRef.current.startY, e.clientY)}px`;
          marquee.style.width = `${Math.abs(dx)}px`;
          marquee.style.height = `${Math.abs(dy)}px`;
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!boxDragRef.current) return;

      if (boxDragRef.current.isDragging) {
        boxDragEndTimeRef.current = Date.now();
        const marquee = document.getElementById("box-select-marquee");
        if (marquee) {
          marquee.style.display = "none";
        }

        const x1 = Math.min(boxDragRef.current.startX, e.clientX);
        const x2 = Math.max(boxDragRef.current.startX, e.clientX);
        const y1 = Math.min(boxDragRef.current.startY, e.clientY);
        const y2 = Math.max(boxDragRef.current.startY, e.clientY);

        const rect = dom.getBoundingClientRect();
        const newlySelected: string[] = [];
        const scratchProjVec = new THREE.Vector3();

        for (const b of placedBricks) {
          const world = getWorldPositionFromGrid(b.gridX, b.gridY, b.gridZ, b.rotation, b.type);
          scratchProjVec.set(world[0], world[1], world[2]);
          scratchProjVec.project(camera);

          // Skip bricks behind camera
          if (scratchProjVec.z > 1.0) continue;

          const px = rect.left + ((scratchProjVec.x + 1) / 2) * rect.width;
          const py = rect.top + ((-scratchProjVec.y + 1) / 2) * rect.height;

          if (px >= x1 && px <= x2 && py >= y1 && py <= y2) {
            newlySelected.push(b.id);
          }
        }

        setSelectedBrickIds((prev) => Array.from(new Set([...prev, ...newlySelected])));
        onBoxSelectChange?.(false, null);
      }

      boxDragRef.current = null;
    };

    dom.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      dom.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [camera, editorMode, gl, effectiveMultiSelect, groupMoveState.isActive, onBoxSelectChange, placedBricks]);

  // Pointer move handler over baseplate or bricks
  const handlePointerMove = useCallback((e: { point: THREE.Vector3; normal?: THREE.Vector3 }) => {
    if (editorMode === "walk") return;
    const hit: [number, number, number] = [e.point.x, e.point.y, e.point.z];
    handlePointerMoveWorld(hit);
  }, [editorMode, handlePointerMoveWorld]);

  const handlePointerLeave = useCallback(() => {
    setGhost((g) => ({ ...g, visible: false }));
    setLastHitPoint(null);
    terrainBrushPointRef.current = null;
    setTerrainBrushPoint(null);
  }, []);

  // Place brick(s) on click in BUILD mode (Single, Line, Area)
  const handlePlaceAction = useCallback(() => {
    if (editorMode !== "build") return;

    if (buildTool === "eyedropper") {
      // If clicked empty surface with eyedropper, return to single
      onBuildToolChange?.("single");
      return;
    }

    if (buildTool === "line") {
      if (lineState.start === null) {
        if (!ghost.visible || !ghost.isValid) return;
        setLineState({
          start: { gridX: ghost.gridX, gridY: ghost.gridY, gridZ: ghost.gridZ },
          candidates: [],
        });
        onLineToolStateChange?.("end", 1);
        return;
      }

      if (lineState.candidates.length > 0) {
        const cmd = new PlaceGroupCommand(lineState.candidates);
        cmd.execute(placedBricks, setPlacedBricks);
        history.push(cmd);
        onHistoryChange?.(history.canUndo(), history.canRedo());
        globalBrickAnimationManager.triggerSettle(lineState.candidates.map((b) => b.id));
        onBrickPlacedSound?.(lineState.candidates[0]);
      }

      setLineState({ start: null, candidates: [] });
      onLineToolStateChange?.(null, 0);

      const nextOcc = new OccupancyMap([...placedBricks, ...lineState.candidates]);
      if (lastHitPoint) {
        updateSingleGhostAt(lastHitPoint, rotation, activeType, activeColor, nextOcc);
      }
      return;
    }

    if (buildTool === "area") {
      if (areaState.cornerA === null) {
        if (!ghost.visible || !ghost.isValid) return;
        setAreaState({
          cornerA: { gridX: ghost.gridX, gridY: ghost.gridY, gridZ: ghost.gridZ },
          candidates: [],
        });
        onAreaToolStateChange?.("end", 1);
        return;
      }

      if (areaState.candidates.length > 0) {
        const cmd = new PlaceGroupCommand(areaState.candidates);
        cmd.execute(placedBricks, setPlacedBricks);
        history.push(cmd);
        onHistoryChange?.(history.canUndo(), history.canRedo());
        globalBrickAnimationManager.triggerSettle(areaState.candidates.map((b) => b.id));
        onBrickPlacedSound?.(areaState.candidates[0]);
      }

      setAreaState({ cornerA: null, candidates: [] });
      onAreaToolStateChange?.(null, 0);

      const nextOcc = new OccupancyMap([...placedBricks, ...areaState.candidates]);
      if (lastHitPoint) {
        updateSingleGhostAt(lastHitPoint, rotation, activeType, activeColor, nextOcc);
      }
      return;
    }

    // Default "single" brick tool
    if (!ghost.visible || !ghost.isValid) return;

    const newBrick: BrickData = {
      id: `brick-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: activeType,
      color: activeColor,
      gridX: ghost.gridX,
      gridY: ghost.gridY,
      gridZ: ghost.gridZ,
      rotation,
    };

    const cmd = new PlaceBrickCommand(newBrick);
    cmd.execute(placedBricks, setPlacedBricks);
    history.push(cmd);
    onHistoryChange?.(history.canUndo(), history.canRedo());

    globalBrickAnimationManager.triggerSettle([newBrick.id]);
    setSelectedBrickIds([]);

    onBrickPlacedSound?.(newBrick);

    const nextOccupancy = new OccupancyMap([...placedBricks, newBrick]);
    if (lastHitPoint) {
      updateSingleGhostAt(lastHitPoint, rotation, activeType, activeColor, nextOccupancy);
    }
  }, [activeColor, activeType, areaState.candidates, areaState.cornerA, buildTool, editorMode, ghost, history, lastHitPoint, lineState.candidates, lineState.start, onAreaToolStateChange, onBrickPlacedSound, onBuildToolChange, onHistoryChange, onLineToolStateChange, placedBricks, rotation, updateSingleGhostAt]);

  // Automatically deselect and cancel move when entering BUILD, TERRAIN, or WALK mode
  const cancelMoveRef = useRef(cancelMove);
  useEffect(() => {
    cancelMoveRef.current = cancelMove;
  }, [cancelMove]);

  const groupMoveActiveRef = useRef(groupMoveState.isActive);
  useEffect(() => {
    groupMoveActiveRef.current = groupMoveState.isActive;
  }, [groupMoveState.isActive]);

  useEffect(() => {
    if (editorMode !== "select") {
      setInternalMultiSelect((prev) => (prev !== null ? null : prev));
    }
    if (editorMode === "build") {
      setSelectedBrickIds((prev) => (prev.length > 0 ? [] : prev));
      terrainBrushPointRef.current = null;
      setTerrainBrushPoint((prev) => (prev !== null ? null : prev));
      if (groupMoveActiveRef.current) {
        cancelMoveRef.current();
      }
    } else if (editorMode === "terrain") {
      setGhost((g) => (g.visible ? { ...g, visible: false } : g));
      setSelectedBrickIds((prev) => (prev.length > 0 ? [] : prev));
      if (groupMoveActiveRef.current) {
        cancelMoveRef.current();
      }
    } else if (editorMode === "walk") {
      setGhost((g) => (g.visible ? { ...g, visible: false } : g));
      setSelectedBrickIds((prev) => (prev.length > 0 ? [] : prev));
      terrainBrushPointRef.current = null;
      setTerrainBrushPoint((prev) => (prev !== null ? null : prev));
      if (groupMoveActiveRef.current) {
        cancelMoveRef.current();
      }
    }
  }, [editorMode]);

  // Brick click handler (Shift+click, touch multi-select, normal select, eyedropper, or confirm move on top)
  const handleBrickClick = useCallback((id: string, e?: { shiftKey?: boolean }) => {
    // Suppress click immediately after box drag selection
    if (Date.now() - boxDragEndTimeRef.current < 200) {
      return;
    }

    // In WALK mode, ignore brick clicks
    if (editorMode === "walk") {
      return;
    }

    // In BUILD mode:
    if (editorMode === "build") {
      if (buildTool === "eyedropper") {
        const target = placedBricks.find((b) => b.id === id);
        if (target) {
          handleSetType(target.type);
          handleSetColor(target.color);
          onBuildToolChange?.("single");
        }
        return;
      }
      handlePlaceAction();
      return;
    }

    // In SELECT mode:
    if (groupMoveState.isActive) {
      confirmMove();
      return;
    }

    const isMulti = effectiveMultiSelect || e?.shiftKey;

    if (isMulti) {
      // Toggle individual brick selection
      setSelectedBrickIds((prev) => {
        if (prev.includes(id)) {
          return prev.filter((x) => x !== id);
        }
        return [...prev, id];
      });
    } else {
      // Normal single selection
      setSelectedBrickIds((prev) => (prev.length === 1 && prev[0] === id ? [] : [id]));
    }
  }, [buildTool, confirmMove, editorMode, effectiveMultiSelect, groupMoveState.isActive, handlePlaceAction, handleSetColor, handleSetType, onBuildToolChange, placedBricks]);

  // Baseplate click: confirm move, deselect, or place brick(s)
  const handlePlateClick = useCallback(() => {
    // Suppress click immediately after box drag selection
    if (Date.now() - boxDragEndTimeRef.current < 200) {
      return;
    }

    // In WALK mode, ignore plate clicks
    if (editorMode === "walk") {
      return;
    }

    // In TERRAIN mode, click applies brush
    if (editorMode === "terrain") {
      const brushPt = terrainBrushPointRef.current;
      if (brushPt) {
        applyBrushAt(brushPt);
      }
      return;
    }

    // In BUILD mode, perform build action
    if (editorMode === "build") {
      handlePlaceAction();
      return;
    }

    // In SELECT mode:
    if (groupMoveState.isActive) {
      confirmMove();
      return;
    }

    if (selectedBrickIds.length > 0) {
      deselect();
    }
  }, [applyBrushAt, confirmMove, deselect, editorMode, groupMoveState.isActive, handlePlaceAction, selectedBrickIds.length]);

  const movingOriginSet = useMemo(() => {
    if (groupMoveState.isActive && !groupMoveState.isDuplicate) {
      return new Set(groupMoveState.movingIds);
    }
    return new Set<string>();
  }, [groupMoveState.isActive, groupMoveState.isDuplicate, groupMoveState.movingIds]);

  const movingOriginBricks = useMemo(() => {
    if (groupMoveState.isActive && !groupMoveState.isDuplicate) {
      const set = new Set(groupMoveState.movingIds);
      return placedBricks.filter((b) => set.has(b.id));
    }
    return [];
  }, [groupMoveState.isActive, groupMoveState.isDuplicate, groupMoveState.movingIds, placedBricks]);

  return (
    <group position={[0, 0, 0]}>
      {/* Procedural Terrain Chunks & Scenery */}
      <ChunkManager
        worldType={worldType}
        worldSize={worldSize}
        seed={seed}
        viewDistance={viewDistance}
        focusPosition={focusPosition}
        terrainMods={terrainMods}
        onChunksExplored={onChunksExplored}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={handlePlateClick}
      />

      {/* Terrain Brush Visual Ring */}
      {editorMode === "terrain" && terrainBrushPoint && terrainBrushConfig && (
        <TerrainBrushMesh position={terrainBrushPoint} config={terrainBrushConfig} />
      )}

      {/* Placed Bricks: Chunk-Partitioned Instanced Rendering */}
      <ChunkBrickRenderer
        bricks={placedBricks}
        movingOriginSet={movingOriginSet}
        onSelect={handleBrickClick}
        onPointerMove={handlePointerMove}
      />

      {/* High-Performance Selection & Move Origin Overlays */}
      <SelectionOverlayRenderer
        selectedBricks={selectedBricks}
        movingOriginBricks={movingOriginBricks}
      />

      {/* Single Ghost Preview (when in BUILD mode with single tool or 1st point of line/area) */}
      {!groupMoveState.isActive && editorMode === "build" && (buildTool === "single" || (buildTool === "line" && !lineState.start) || (buildTool === "area" && !areaState.cornerA) || buildTool === "eyedropper") && (
        <GhostBrick
          type={activeType}
          color={activeColor}
          gridX={ghost.gridX}
          gridY={ghost.gridY}
          gridZ={ghost.gridZ}
          rotation={rotation}
          isValid={ghost.isValid}
          reason={ghost.reason}
          visible={ghost.visible}
        />
      )}

      {/* Line Tool Preview Ghost */}
      {editorMode === "build" && buildTool === "line" && lineState.candidates.length > 0 && (
        <GroupGhost
          bricks={lineState.candidates.map((b) => ({
            id: b.id,
            type: b.type,
            color: b.color,
            gridX: b.gridX,
            gridY: b.gridY,
            gridZ: b.gridZ,
            rotation: b.rotation,
            isValid: true,
          }))}
          isValid={true}
          visible={true}
        />
      )}

      {/* Area Tool Preview Ghost */}
      {editorMode === "build" && buildTool === "area" && areaState.candidates.length > 0 && (
        <GroupGhost
          bricks={areaState.candidates.map((b) => ({
            id: b.id,
            type: b.type,
            color: b.color,
            gridX: b.gridX,
            gridY: b.gridY,
            gridZ: b.gridZ,
            rotation: b.rotation,
            isValid: true,
          }))}
          isValid={true}
          visible={true}
        />
      )}

      {/* Group Ghost Preview (when in Group Move or Duplicate Placement mode) */}
      {groupMoveState.isActive && (
        groupMoveState.isBlueprintPlacement && groupMoveState.candidates.length > 100
          ? <BlueprintGhostRenderer
              bricks={groupMoveState.candidates}
              isValid={groupMoveState.isValid}
              visible={true}
            />
          : <GroupGhost
              bricks={groupMoveState.candidates}
              isValid={groupMoveState.isValid}
              reason={groupMoveState.reason}
              visible={true}
            />
      )}
    </group>
  );
});
