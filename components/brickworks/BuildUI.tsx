"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  RotateCw,
  Trash2,
  Bug,
  Undo2,
  Redo2,
  Move,
  X,
  CopyPlus,
  CheckSquare,
  Layers,
  Save,
  FolderOpen,
  Check,
  Loader2,
  Edit3,
  Hammer,
  MousePointerClick,
  Footprints,
  Focus,
  Mountain,
  Paintbrush,
  ArrowUp,
  ArrowDown,
  Minus,
  Waves,
  Map as MapIcon,
  LifeBuoy,
  Pipette,
  FlipHorizontal,
  FlipVertical,
  Palette,
  LayoutGrid,
  Box,
  Sun,
  Moon,
  Cloud,
  CloudRain,
  Zap,
} from "lucide-react";
import { BrickData } from "./GridSystem";
import { BuildDebugInfo } from "./BuildScene";
import { formatTimeOfDay, WeatherType } from "./WorldEnvironment";
import {
  BRICK_LIST,
  BRICK_CATALOG,
  COLOR_PALETTE,
  BrickTypeId,
  DEFAULT_BRICK_TYPE,
  DEFAULT_BRICK_COLOR,
} from "./BrickCatalog";
import { getRecentParts } from "./PartsBrowser";
import { MobileWalkInput, WalkHeightPreset } from "./WalkController";
import { TerrainBrushConfig } from "./TerrainBrush";
import { CompassHUD } from "./CompassHUD";

export type EditorMode = "build" | "select" | "terrain" | "walk";
export type BuildTool = "single" | "line" | "area" | "eyedropper";

interface BuildUIProps {
  onBack: () => void;
  onRotate: () => void;
  onDeleteSelected: () => void;
  onSelectType: (type: BrickTypeId) => void;
  onSelectColor: (color: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onStartMove?: () => void;
  onCancelMove?: () => void;
  onDeselect?: () => void;
  onDuplicate?: () => void;
  onSelectAll?: () => void;
  isMultiSelectMode?: boolean;
  onToggleMultiSelectMode?: () => void;
  boxSelectRect?: { x: number; y: number; width: number; height: number } | null;
  selectedCount?: number;
  isMoving?: boolean;
  activeType?: BrickTypeId;
  activeColor?: string;
  rotation: number;
  selectedBrick: BrickData | null;
  debugInfo?: BuildDebugInfo | null;
  // Mode Switcher Props
  editorMode?: EditorMode;
  onModeChange?: (mode: EditorMode) => void;
  // Advanced Build Tool Props
  buildTool?: BuildTool;
  onSelectBuildTool?: (tool: BuildTool) => void;
  onOpenPartsBrowser?: () => void;
  lineToolStep?: "start" | "end" | null;
  areaToolStep?: "start" | "end" | null;
  // Advanced Select Mode Props
  onMirror?: (axis: "x" | "z") => void;
  onMassRecolor?: (color: string) => void;
  onMassReplace?: () => void;
  onSelectSameType?: () => void;
  onSelectSameColor?: () => void;
  // Walk Mode & Pointer Lock Props
  isPointerLocked?: boolean;
  onMobileWalkInput?: (input: MobileWalkInput) => void;
  walkHeightPreset?: WalkHeightPreset;
  onWalkHeightChange?: (preset: WalkHeightPreset) => void;
  // Save / Persistence Props
  buildName?: string;
  onRenameBuild?: (newName: string) => void;
  onSave?: () => void;
  saveStatus?: "idle" | "saving" | "saved" | "unsaved" | "error";
  lastSavedAt?: Date | null;
  onOpenMyBuilds?: () => void;
  // Camera controls
  onRecenterCamera?: () => void;
  // Terrain Mode Props
  terrainBrushConfig?: TerrainBrushConfig;
  onTerrainBrushConfigChange?: (config: TerrainBrushConfig) => void;
  // World Navigation & Map Props
  onOpenMap?: () => void;
  onUnstuck?: () => void;
  playerYaw?: number;
  playerPosition?: [number, number, number];
  // Blueprint Props
  onOpenBlueprints?: () => void;
  onSaveAsBlueprint?: () => void;
  isBlueprintPlacement?: boolean;
  blueprintPlacementName?: string;
  blueprintPlacementBrickCount?: number;
  blueprintRotationDeg?: 0 | 90 | 180 | 270;
  onCancelBlueprintPlacement?: () => void;
  onDoneBlueprintPlacement?: () => void;
  // Environment & Atmosphere Props
  onOpenEnvironmentSettings?: () => void;
  environmentTime?: number;
  weatherType?: WeatherType;
}

/**
 * Mini visual stud representation for palette buttons
 */
function MiniBrickPreview({
  widthStuds,
  lengthStuds,
  isPlate,
  color,
}: {
  widthStuds: number;
  lengthStuds: number;
  isPlate: boolean;
  color: string;
}) {
  const dotCount = widthStuds * lengthStuds;
  const gridStyle = {
    gridTemplateColumns: `repeat(${lengthStuds}, 1fr)`,
    gridTemplateRows: `repeat(${widthStuds}, 1fr)`,
    height: isPlate ? "12px" : "18px",
    width: `${Math.max(16, lengthStuds * 8)}px`,
    backgroundColor: color,
  };

  return (
    <div className={`palette-mini-brick ${isPlate ? "is-plate" : ""}`} style={gridStyle} aria-hidden="true">
      {Array.from({ length: dotCount }).map((_, i) => (
        <span key={i} className="mini-stud-dot" />
      ))}
    </div>
  );
}

/**
 * Mobile on-screen touch virtual joystick, look drag pad, and jump button for Walk Mode
 */
function MobileWalkTouchControls({
  onMobileInput,
}: {
  onMobileInput: (input: MobileWalkInput) => void;
}) {
  const joystickCenterRef = useRef<{ x: number; y: number } | null>(null);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const touchStateRef = useRef<MobileWalkInput>({
    moveX: 0,
    moveZ: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    jumpRequested: false,
  });

  const lastLookTouch = useRef<{ x: number; y: number } | null>(null);

  const handleJoystickStart = (e: React.TouchEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    joystickCenterRef.current = { x: cx, y: cy };
    setIsJoystickActive(true);
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    if (!joystickCenterRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - joystickCenterRef.current.x;
    const dy = touch.clientY - joystickCenterRef.current.y;
    const maxRadius = 42;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    setKnobPos({ x: knobX, y: knobY });

    touchStateRef.current.moveX = knobX / maxRadius;
    touchStateRef.current.moveZ = -knobY / maxRadius; // Dragging up = move forward
    onMobileInput({ ...touchStateRef.current });
  };

  const handleJoystickEnd = () => {
    joystickCenterRef.current = null;
    setIsJoystickActive(false);
    setKnobPos({ x: 0, y: 0 });
    touchStateRef.current.moveX = 0;
    touchStateRef.current.moveZ = 0;
    onMobileInput({ ...touchStateRef.current });
  };

  const handleLookStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    lastLookTouch.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookMove = (e: React.TouchEvent) => {
    if (!lastLookTouch.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - lastLookTouch.current.x;
    const dy = touch.clientY - lastLookTouch.current.y;
    lastLookTouch.current = { x: touch.clientX, y: touch.clientY };

    touchStateRef.current.lookDeltaX = dx;
    touchStateRef.current.lookDeltaY = dy;
    onMobileInput({ ...touchStateRef.current });

    touchStateRef.current.lookDeltaX = 0;
    touchStateRef.current.lookDeltaY = 0;
  };

  const handleLookEnd = () => {
    lastLookTouch.current = null;
    touchStateRef.current.lookDeltaX = 0;
    touchStateRef.current.lookDeltaY = 0;
    onMobileInput({ ...touchStateRef.current });
  };

  const handleJump = () => {
    touchStateRef.current.jumpRequested = true;
    onMobileInput({ ...touchStateRef.current });
    setTimeout(() => {
      touchStateRef.current.jumpRequested = false;
      onMobileInput({ ...touchStateRef.current });
    }, 120);
  };

  return (
    <div className="mobile-walk-overlay" aria-label="Mobile walk controls">
      {/* Left Joystick Area */}
      <div
        className="mobile-joystick-zone"
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        onTouchCancel={handleJoystickEnd}
      >
        <div className={`mobile-joystick-ring ${isJoystickActive ? "is-active" : ""}`}>
          <div
            className="mobile-joystick-knob"
            style={{ transform: `translate(${knobPos.x}px, ${knobPos.y}px)` }}
          />
        </div>
      </div>

      {/* Right Look Area & Jump Button */}
      <div
        className="mobile-look-zone"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
      >
        <button
          type="button"
          className="mobile-walk-jump-btn"
          onTouchStart={(e) => {
            e.stopPropagation();
            handleJump();
          }}
          onClick={handleJump}
          aria-label="Jump"
        >
          <span>JUMP</span>
        </button>
      </div>
    </div>
  );
}

export function BuildUI({
  onBack,
  onRotate,
  onDeleteSelected,
  onSelectType,
  onSelectColor,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onStartMove,
  onCancelMove,
  onDeselect,
  onDuplicate,
  onSelectAll,
  isMultiSelectMode = false,
  onToggleMultiSelectMode,
  boxSelectRect = null,
  selectedCount = 0,
  isMoving = false,
  activeType = DEFAULT_BRICK_TYPE,
  activeColor = DEFAULT_BRICK_COLOR,
  rotation,
  selectedBrick,
  debugInfo,
  editorMode = "build",
  onModeChange,
  buildTool = "single",
  onSelectBuildTool,
  onOpenPartsBrowser,
  lineToolStep = null,
  areaToolStep = null,
  onMirror,
  onMassRecolor,
  onMassReplace,
  onSelectSameType,
  onSelectSameColor,
  isPointerLocked = false,
  onMobileWalkInput,
  walkHeightPreset = "normal",
  onWalkHeightChange,
  buildName = "Untitled Build",
  onRenameBuild,
  onSave,
  saveStatus = "saved",
  onOpenMyBuilds,
  onRecenterCamera,
  terrainBrushConfig,
  onTerrainBrushConfigChange,
  onOpenMap,
  onUnstuck,
  playerYaw = 0,
  playerPosition,
  onOpenBlueprints,
  onSaveAsBlueprint,
  isBlueprintPlacement = false,
  blueprintPlacementName,
  blueprintPlacementBrickCount,
  blueprintRotationDeg = 0,
  onCancelBlueprintPlacement,
  onDoneBlueprintPlacement,
  onOpenEnvironmentSettings,
  environmentTime,
  weatherType = "clear",
}: BuildUIProps) {
  const [showDebug, setShowDebug] = useState(false);
  const [editingTitleText, setEditingTitleText] = useState<string | null>(null);

  const isEditingTitle = editingTitleText !== null;
  const currentTitleInput = editingTitleText !== null ? editingTitleText : buildName;

  const handleSaveTitle = () => {
    const trimmed = (editingTitleText || "").trim();
    if (trimmed && onRenameBuild) {
      onRenameBuild(trimmed);
    }
    setEditingTitleText(null);
  };

  // Toggle debug overlay (F2 or ~), mode switching (B, S, T, V), build tools (L, K, I, P), recenter (F), height toggle (H), map (M), and Ctrl+S manual save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === "F2" || e.key === "`") {
        e.preventDefault();
        setShowDebug((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        onSave?.();
      } else if (editorMode !== "walk" && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        if (editorMode !== "build") {
          onModeChange?.("build");
        } else {
          onSelectBuildTool?.("single");
        }
      } else if (editorMode !== "walk" && (e.key === "s" || e.key === "S")) {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onModeChange?.("select");
        }
      } else if (editorMode !== "walk" && (e.key === "t" || e.key === "T")) {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onModeChange?.("terrain");
        }
      } else if (editorMode === "build" && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        onSelectBuildTool?.(buildTool === "line" ? "single" : "line");
      } else if (editorMode === "build" && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        onSelectBuildTool?.(buildTool === "area" ? "single" : "area");
      } else if (editorMode === "build" && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        onSelectBuildTool?.(buildTool === "eyedropper" ? "single" : "eyedropper");
      } else if (editorMode === "build" && (e.key === "p" || e.key === "P")) {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onOpenPartsBrowser?.();
        }
      } else if (editorMode === "select" && selectedCount > 0 && (e.key === "x" || e.key === "X")) {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onMirror?.("x");
        }
      } else if (editorMode === "select" && selectedCount > 0 && (e.key === "z" || e.key === "Z")) {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onMirror?.("z");
        }
      } else if (e.key === "Escape") {
        if (buildTool !== "single") {
          onSelectBuildTool?.("single");
        }
      } else if (e.key === "m" || e.key === "M") {
        if (!e.ctrlKey && !e.metaKey && (editorMode !== "select" || selectedCount === 0)) {
          e.preventDefault();
          onOpenMap?.();
        }
      } else if (e.key === "v" || e.key === "V") {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onModeChange?.(editorMode === "walk" ? "build" : "walk");
        }
      } else if (editorMode === "walk" && (e.key === "h" || e.key === "H")) {
        e.preventDefault();
        const order: WalkHeightPreset[] = ["minifig", "normal", "tall"];
        const curIdx = order.indexOf(walkHeightPreset || "normal");
        const nextIdx = (curIdx + 1) % order.length;
        onWalkHeightChange?.(order[nextIdx]);
      } else if (editorMode !== "walk" && (e.key === "f" || e.key === "F")) {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onRecenterCamera?.();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    buildTool,
    editorMode,
    onMirror,
    onModeChange,
    onOpenMap,
    onOpenPartsBrowser,
    onRecenterCamera,
    onSave,
    onSelectBuildTool,
    onWalkHeightChange,
    selectedCount,
    walkHeightPreset,
  ]);

  const selectedDef = selectedBrick ? BRICK_CATALOG[selectedBrick.type] : null;
  const count = selectedCount > 0 ? selectedCount : (selectedBrick ? 1 : 0);

  return (
    <div className="build-ui-root" aria-label="Build mode controls">
      {/* 2D Box Selection Marquee (Desktop click-drag with Shift or Multi-Select mode) */}
      <div
        id="box-select-marquee"
        className="selection-box-rect"
        style={
          boxSelectRect
            ? {
                left: `${boxSelectRect.x}px`,
                top: `${boxSelectRect.y}px`,
                width: `${boxSelectRect.width}px`,
                height: `${boxSelectRect.height}px`,
              }
            : { display: "none" }
        }
        aria-hidden="true"
      />

      {/* Top Bar: Return to Menu, Mode Switcher, Title & Save controls, Selection tools & Undo / Redo */}
      <div className="build-top-bar">
        <div className="build-top-nav-group">
          <button
            type="button"
            className="build-back-button glass-button"
            onClick={onBack}
            aria-label="Back to main menu"
          >
            <ArrowLeft size={20} strokeWidth={2.6} />
            <span>Menu</span>
          </button>

          {onOpenMyBuilds && editorMode !== "walk" && (
            <button
              type="button"
              className="build-my-builds-button glass-button"
              onClick={onOpenMyBuilds}
              aria-label="Open My Worlds library"
              title="Open My Worlds library"
            >
              <FolderOpen size={18} strokeWidth={2.4} />
              <span className="my-builds-btn-label">My Worlds</span>
            </button>
          )}
        </div>

        {/* Center: Mode Switcher & (if not in Walk Mode) Title / Save status */}
        <div className="build-top-center-cluster flex items-center gap-3">
          {/* Tactile Game-like Mode Switcher */}
          <div className="build-mode-segmented-control" role="tablist" aria-label="Editor interaction modes">
            <button
              type="button"
              role="tab"
              aria-selected={editorMode === "build"}
              className={`mode-segment-btn ${editorMode === "build" ? "is-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onModeChange?.("build");
              }}
              title="Build Mode (Key B) - Click surfaces to stack & place bricks"
            >
              <Hammer size={15} strokeWidth={2.6} />
              <span>BUILD</span>
              <kbd className="mode-key">B</kbd>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={editorMode === "select"}
              className={`mode-segment-btn ${editorMode === "select" ? "is-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onModeChange?.("select");
              }}
              title="Select Mode (Key S) - Click existing bricks to select & edit"
            >
              <MousePointerClick size={15} strokeWidth={2.6} />
              <span>SELECT</span>
              <kbd className="mode-key">S</kbd>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={editorMode === "terrain"}
              className={`mode-segment-btn ${editorMode === "terrain" ? "is-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onModeChange?.("terrain");
              }}
              title="Terrain Mode (Key T) - Sculpt, shape, and paint the world"
            >
              <Mountain size={15} strokeWidth={2.6} />
              <span>TERRAIN</span>
              <kbd className="mode-key">T</kbd>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={editorMode === "walk"}
              className={`mode-segment-btn ${editorMode === "walk" ? "is-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onModeChange?.("walk");
              }}
              title="Walk Mode (Key V) - Explore your creation at human scale"
            >
              <Footprints size={15} strokeWidth={2.6} />
              <span>WALK</span>
              <kbd className="mode-key">V</kbd>
            </button>
          </div>

          {/* Build Title (Editable) & Subtle Save Status - Hidden during Walk Mode */}
          {editorMode !== "walk" && (
            <div className="build-title-container">
              {isEditingTitle ? (
                <div className="build-title-edit-box">
                  <input
                    type="text"
                    value={currentTitleInput}
                    onChange={(e) => setEditingTitleText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle();
                      if (e.key === "Escape") {
                        setEditingTitleText(null);
                      }
                    }}
                    className="build-title-input"
                    maxLength={80}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    className="build-title-confirm-btn"
                    aria-label="Save title"
                  >
                    <Check size={16} strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="build-title-display-btn"
                  onClick={() => setEditingTitleText(buildName)}
                  title="Click to rename build"
                  aria-label={`Build name: ${buildName}. Click to rename`}
                >
                  <span className="build-title-text">{buildName}</span>
                  <Edit3 size={13} className="build-title-edit-icon" />
                </button>
              )}

              {/* Non-intrusive Save Status Indicator */}
              <div className={`build-save-status-pill status-${saveStatus}`} role="status" aria-live="polite">
                {saveStatus === "saving" && (
                  <>
                    <Loader2 size={13} className="animate-spin text-amber-300" />
                    <span>Saving...</span>
                  </>
                )}
                {saveStatus === "saved" && (
                  <>
                    <Check size={13} className="text-green-400" strokeWidth={3} />
                    <span>Saved</span>
                  </>
                )}
                {saveStatus === "unsaved" && (
                  <>
                    <span className="status-dot is-unsaved" />
                    <span>Unsaved</span>
                  </>
                )}
                {saveStatus === "error" && (
                  <>
                    <span className="status-dot is-error" />
                    <span>Save failed</span>
                  </>
                )}
                {saveStatus === "idle" && (
                  <>
                    <span className="status-dot is-idle" />
                    <span>Ready</span>
                  </>
                )}
              </div>

              {/* Quick Save Button */}
              {onSave && (
                <button
                  type="button"
                  className="build-manual-save-button glass-button"
                  onClick={onSave}
                  disabled={saveStatus === "saving"}
                  title="Save Build (Ctrl+S)"
                  aria-label="Save Build (Ctrl+S)"
                >
                  <Save size={16} strokeWidth={2.4} />
                  <span>Save</span>
                  <kbd className="key-hint">Ctrl+S</kbd>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="build-top-tools">
          {/* Multi-Select mode toggle & Select All (strictly in SELECT mode) */}
          {editorMode === "select" && (
            <>
              <button
                type="button"
                className={`build-multiselect-toggle glass-button ${isMultiSelectMode ? "is-active" : ""}`}
                onClick={onToggleMultiSelectMode}
                aria-label="Toggle multi-select mode"
                title="Multi-Select Mode (Hold Shift or toggle this button)"
              >
                <CheckSquare size={18} strokeWidth={2.4} />
                <span className="multiselect-label">Multi-Select</span>
              </button>

              <button
                type="button"
                className="build-select-all-button glass-button"
                onClick={onSelectAll}
                aria-label="Select All Bricks (Ctrl+A)"
                title="Select All (Ctrl+A)"
              >
                <Layers size={18} strokeWidth={2.4} />
                <span>All</span>
              </button>
            </>
          )}

          {/* History Undo / Redo (during Build & Select) */}
          {editorMode !== "walk" && (
            <div className="build-history-buttons">
              <button
                type="button"
                className="build-history-button glass-button"
                onClick={onUndo}
                disabled={!canUndo}
                aria-label="Undo (Ctrl+Z)"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={19} strokeWidth={2.6} />
                <span className="sr-only">Undo</span>
              </button>
              <button
                type="button"
                className="build-history-button glass-button"
                onClick={onRedo}
                disabled={!canRedo}
                aria-label="Redo (Ctrl+Y or Ctrl+Shift+Z)"
                title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
              >
                <Redo2 size={19} strokeWidth={2.6} />
                <span className="sr-only">Redo</span>
              </button>
            </div>
          )}

          {/* Recenter / Frame View Button (Key F) */}
          {editorMode !== "walk" && onRecenterCamera && (
            <button
              type="button"
              className="build-recenter-button glass-button"
              onClick={onRecenterCamera}
              aria-label="Recenter Camera on Baseplate (Key F)"
              title="Recenter / Frame View (Key F)"
            >
              <Focus size={18} strokeWidth={2.4} />
              <span className="recenter-label">Frame</span>
              <kbd className="key-hint">F</kbd>
            </button>
          )}

          {/* World Map & Waypoints button (Key M) */}
          {onOpenMap && (
            <button
              type="button"
              className="build-map-button glass-button"
              onClick={onOpenMap}
              aria-label="Open World Map (Key M)"
              title="World Map & Waypoints (Key M)"
            >
              <MapIcon size={18} strokeWidth={2.4} />
              <span className="map-btn-label">Map</span>
              <kbd className="key-hint">M</kbd>
            </button>
          )}

          {/* Atmosphere & Weather Settings button */}
          {onOpenEnvironmentSettings && (
            <button
              type="button"
              className="build-environment-button glass-button"
              onClick={onOpenEnvironmentSettings}
              aria-label="Open World Atmosphere & Time Settings"
              title="Atmosphere, Weather & Time"
            >
              {weatherType === "rain" ? (
                <CloudRain size={18} strokeWidth={2.4} className="text-blue-400" />
              ) : weatherType === "storm" ? (
                <Zap size={18} strokeWidth={2.4} className="text-amber-400" />
              ) : weatherType === "cloudy" ? (
                <Cloud size={18} strokeWidth={2.4} className="text-slate-300" />
              ) : environmentTime !== undefined && (environmentTime < 5.5 || environmentTime >= 19.5) ? (
                <Moon size={18} strokeWidth={2.4} className="text-sky-300" />
              ) : (
                <Sun size={18} strokeWidth={2.4} className="text-amber-400" />
              )}
              {environmentTime !== undefined && (
                <span className="env-time-label font-mono text-xs hidden sm:inline">
                  {formatTimeOfDay(environmentTime)}
                </span>
              )}
            </button>
          )}

          {/* Unstuck button in Walk mode */}
          {editorMode === "walk" && onUnstuck && (
            <button
              type="button"
              className="build-unstuck-btn glass-button"
              onClick={onUnstuck}
              aria-label="Unstuck player (teleport to safe ground)"
              title="Unstuck - Teleport to safe ground"
            >
              <LifeBuoy size={16} strokeWidth={2.4} />
              <span>Unstuck</span>
            </button>
          )}

          {/* Exit Walk button (when in Walk mode) */}
          {editorMode === "walk" && (
            <button
              type="button"
              className="build-exit-walk-btn"
              onClick={() => onModeChange?.("build")}
              aria-label="Exit Walk Mode (Key V or B)"
            >
              <span>Exit Walk</span>
            </button>
          )}
        </div>
      </div>

      {/* Optional Dev-only Debug Overlay (Toggled via F2 or ~) */}
      {showDebug && debugInfo && (
        <div className="build-debug-overlay" role="region" aria-label="Development grid debug info">
          <div className="debug-header">
            <Bug size={14} />
            <span>GRID TELEMETRY</span>
          </div>
          <div className="debug-row">
            <span>Grid X, Y:</span>
            <strong>{debugInfo.gridX}, {debugInfo.gridY}</strong>
          </div>
          <div className="debug-row">
            <span>Layer (gridZ):</span>
            <strong className="text-yellow-300">{debugInfo.gridZ}</strong>
          </div>
          <div className="debug-row">
            <span>Type:</span>
            <strong>{debugInfo.type}</strong>
          </div>
          <div className="debug-row">
            <span>Rotation:</span>
            <strong>{debugInfo.rotation}°</strong>
          </div>
          <div className="debug-row">
            <span>Validity:</span>
            <span className={debugInfo.isValid ? "text-green-400 font-black" : "text-red-400 font-black"}>
              {debugInfo.isValid ? "VALID" : `INVALID (${debugInfo.reason || "blocked"})`}
            </span>
          </div>
          <div className="debug-row">
            <span>Total Bricks:</span>
            <strong>{debugInfo.totalBricks}</strong>
          </div>
          <div className="debug-row">
            <span>Occupied 3D Cells:</span>
            <strong>{debugInfo.occupiedCells}</strong>
          </div>
        </div>
      )}

      {/* Bottom Center: Game Inventory Tray & Color Swatches (strictly in BUILD Mode) */}
      {editorMode === "build" && !isMoving && (
        <div className="build-bottom-tray-container">
          {/* Build Sub-Tool Selector Bar */}
          <div className="flex items-center gap-1.5 p-1 bg-black/60 backdrop-blur-xl border border-white/15 rounded-2xl shadow-xl mb-1 text-white" role="radiogroup" aria-label="Build sub-tools">
            <button
              type="button"
              role="radio"
              aria-checked={buildTool === "single"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                buildTool === "single"
                  ? "bg-amber-400 text-black shadow-md scale-105"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
              onClick={() => onSelectBuildTool?.("single")}
              title="Single Brick Mode (Key B / 1) - Place one brick at a time"
            >
              <Hammer size={13} strokeWidth={2.6} />
              <span>Single</span>
              <kbd className="text-[10px] px-1 py-0.2 bg-black/20 rounded font-mono">B</kbd>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={buildTool === "line"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                buildTool === "line"
                  ? "bg-amber-400 text-black shadow-md scale-105"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
              onClick={() => onSelectBuildTool?.("line")}
              title="Line / Wall Mode (Key L) - Click start and end points to generate straight walls and lines"
            >
              <Minus size={13} strokeWidth={2.6} className="rotate-45" />
              <span>Line / Wall</span>
              <kbd className="text-[10px] px-1 py-0.2 bg-black/20 rounded font-mono">L</kbd>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={buildTool === "area"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                buildTool === "area"
                  ? "bg-amber-400 text-black shadow-md scale-105"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
              onClick={() => onSelectBuildTool?.("area")}
              title="Area / Floor Mode (Key K) - Click two corners to fill floors, plates, or roofs"
            >
              <LayoutGrid size={13} strokeWidth={2.6} />
              <span>Area / Floor</span>
              <kbd className="text-[10px] px-1 py-0.2 bg-black/20 rounded font-mono">K</kbd>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={buildTool === "eyedropper"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                buildTool === "eyedropper"
                  ? "bg-amber-400 text-black shadow-md scale-105"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
              onClick={() => onSelectBuildTool?.("eyedropper")}
              title="Eyedropper Tool (Key I) - Click any brick to sample its type and color"
            >
              <Pipette size={13} strokeWidth={2.6} />
              <span>Sample</span>
              <kbd className="text-[10px] px-1 py-0.2 bg-black/20 rounded font-mono">I</kbd>
            </button>

            {onOpenPartsBrowser && (
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-300 hover:text-amber-200 hover:bg-amber-400/20 transition-all border border-amber-400/30 ml-1"
                onClick={onOpenPartsBrowser}
                title="Parts Browser (Key P) - Browse all 40+ bricks, slopes, windows, doors, arches & props"
              >
                <Box size={13} strokeWidth={2.6} />
                <span>All Parts...</span>
                <kbd className="text-[10px] px-1 py-0.2 bg-black/20 rounded font-mono">P</kbd>
              </button>
            )}
          </div>

          {/* Circular Color Swatches */}
          <div className="color-swatches-row" role="radiogroup" aria-label="Brick color selection">
            {COLOR_PALETTE.map((c) => {
              const isSelected = c.hex === activeColor;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`color-swatch-circle ${isSelected ? "is-selected" : ""}`}
                  style={{ backgroundColor: c.hex }}
                  onClick={() => onSelectColor(c.hex)}
                  aria-label={`Color: ${c.name}`}
                  aria-checked={isSelected}
                  role="radio"
                />
              );
            })}
          </div>

          {/* Horizontally scrollable brick & plate palette */}
          <div className="brick-palette-tray" role="radiogroup" aria-label="Brick shape selection">
            {/* Quick All Parts button at start of tray */}
            {onOpenPartsBrowser && (
              <button
                type="button"
                className="palette-brick-item parts-catalog-shortcut-btn"
                onClick={onOpenPartsBrowser}
                aria-label="Open full Parts Catalog (Key P)"
                title="Parts Catalog (Key P)"
              >
                <div className="w-8 h-5 rounded border border-dashed border-amber-400/60 flex items-center justify-center text-amber-400">
                  <Box size={14} />
                </div>
                <span className="item-label text-amber-400 font-bold">Catalog</span>
                <span className="item-shortcut">P</span>
              </button>
            )}

            {BRICK_LIST.map((item) => {
              const isSelected = item.id === activeType;
              const isPlate = item.category === "plate" || item.category === "tile";

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`palette-brick-item ${isSelected ? "is-selected" : ""} ${isPlate ? "is-plate-item" : ""}`}
                  onClick={() => onSelectType(item.id)}
                  aria-label={`${item.name}${item.shortcut ? ` (Key ${item.shortcut})` : ""}`}
                  aria-checked={isSelected}
                  role="radio"
                >
                  <MiniBrickPreview
                    widthStuds={item.widthStuds}
                    lengthStuds={item.lengthStuds}
                    isPlate={isPlate}
                    color={activeColor}
                  />
                  <span className="item-label">{item.label}</span>
                  {item.shortcut && <span className="item-shortcut">{item.shortcut}</span>}
                </button>
              );
            })}
          </div>

          {/* Blueprints Library Button */}
          {onOpenBlueprints && (
            <button
              type="button"
              className="blueprint-open-btn glass-button flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white/90 hover:text-white whitespace-nowrap"
              onClick={onOpenBlueprints}
              aria-label="Open Blueprints Library"
              title="Blueprints - Place saved structures"
            >
              <Layers size={15} strokeWidth={2.6} className="text-amber-400" />
              <span>Blueprints</span>
            </button>
          )}
        </div>
      )}

      {/* Active Sub-Tool Banner (Line, Area, Eyedropper) */}
      {editorMode === "build" && buildTool !== "single" && (
        <div className="build-moving-container" role="status" aria-live="polite">
          <div className="moving-status-card">
            <div className="moving-badge">
              {buildTool === "line" && (
                <>
                  <Minus size={18} strokeWidth={2.8} className="rotate-45 text-amber-400" />
                  <span>{lineToolStep === "end" ? "Click end position to place line" : "Line / Wall Tool"}</span>
                </>
              )}
              {buildTool === "area" && (
                <>
                  <LayoutGrid size={18} strokeWidth={2.8} className="text-amber-400" />
                  <span>{areaToolStep === "end" ? "Click second corner to fill area" : "Area / Floor Tool"}</span>
                </>
              )}
              {buildTool === "eyedropper" && (
                <>
                  <Pipette size={18} strokeWidth={2.8} className="text-amber-400" />
                  <span>Eyedropper Tool</span>
                </>
              )}
            </div>
            <p className="moving-hint">
              {buildTool === "line" && "Click start position, then click end position • R to rotate • Esc to cancel"}
              {buildTool === "area" && "Click first corner, then click opposite corner • R to rotate • Esc to cancel"}
              {buildTool === "eyedropper" && "Click any placed brick in the scene to sample its type and color • Esc to exit"}
            </p>
            <button
              type="button"
              className="build-cancel-move-button"
              onClick={() => onSelectBuildTool?.("single")}
              aria-label="Cancel tool (Escape)"
            >
              <X size={18} strokeWidth={2.6} />
              <span>Cancel</span>
              <kbd className="key-hint">Esc</kbd>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Center: Terrain Editing Tools Tray (strictly in TERRAIN Mode) */}
      {editorMode === "terrain" && (
        <div className="build-bottom-tray-container terrain-tray-container">
          <div className="terrain-tools-card glass-panel flex flex-col items-center gap-3 p-3 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/15 shadow-2xl text-white">
            {/* Tool Selector Buttons */}
            <div className="flex items-center gap-1.5 p-1 bg-white/10 rounded-xl" role="radiogroup" aria-label="Terrain deformation tool">
              {(
                [
                  { id: "raise", label: "Raise", icon: ArrowUp, desc: "Raise terrain" },
                  { id: "lower", label: "Lower", icon: ArrowDown, desc: "Lower terrain" },
                  { id: "flatten", label: "Flatten", icon: Minus, desc: "Flatten plateau" },
                  { id: "smooth", label: "Smooth", icon: Waves, desc: "Smooth contours" },
                  { id: "paint", label: "Paint", icon: Paintbrush, desc: "Paint material" },
                ] as const
              ).map((t) => {
                const isSelected = (terrainBrushConfig?.tool || "raise") === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-amber-400 text-black shadow-md scale-105"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }`}
                    onClick={() =>
                      onTerrainBrushConfigChange?.({
                        ...(terrainBrushConfig || {
                          tool: "raise",
                          size: 6,
                          strength: 0.5,
                          material: "grass",
                        }),
                        tool: t.id,
                      })
                    }
                    title={t.desc}
                  >
                    <Icon size={14} strokeWidth={2.6} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Material Swatches (shown only when Paint tool is active) */}
            {terrainBrushConfig?.tool === "paint" && (
              <div className="flex items-center gap-2" role="radiogroup" aria-label="Terrain surface material">
                {(
                  [
                    { id: "grass", label: "Grass", color: "#34a853" },
                    { id: "dirt", label: "Dirt", color: "#795548" },
                    { id: "stone", label: "Stone", color: "#9e9e9e" },
                    { id: "sand", label: "Sand", color: "#f4d03f" },
                  ] as const
                ).map((mat) => {
                  const isSelected = (terrainBrushConfig?.material || "grass") === mat.id;
                  return (
                    <button
                      key={mat.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        isSelected
                          ? "border-amber-400 bg-white/20 text-white font-bold scale-105"
                          : "border-white/20 bg-black/30 text-white/75 hover:bg-white/10"
                      }`}
                      onClick={() =>
                        onTerrainBrushConfigChange?.({
                          ...(terrainBrushConfig || {
                            tool: "paint",
                            size: 6,
                            strength: 0.5,
                            material: "grass",
                          }),
                          material: mat.id,
                        })
                      }
                    >
                      <span className="w-3 h-3 rounded-full border border-white/30" style={{ backgroundColor: mat.color }} />
                      <span>{mat.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Sliders for Brush Size and Strength */}
            <div className="flex items-center gap-5 text-xs font-medium text-white/90">
              <label className="flex items-center gap-2 cursor-pointer">
                <span>Radius: {terrainBrushConfig?.size || 6}m</span>
                <input
                  type="range"
                  min={2}
                  max={16}
                  step={1}
                  value={terrainBrushConfig?.size || 6}
                  onChange={(e) =>
                    onTerrainBrushConfigChange?.({
                      ...(terrainBrushConfig || {
                        tool: "raise",
                        size: 6,
                        strength: 0.5,
                        material: "grass",
                      }),
                      size: Number(e.target.value),
                    })
                  }
                  className="w-24 accent-amber-400 cursor-pointer"
                />
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <span>Strength: {Math.round((terrainBrushConfig?.strength || 0.5) * 100)}%</span>
                <input
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={terrainBrushConfig?.strength || 0.5}
                  onChange={(e) =>
                    onTerrainBrushConfigChange?.({
                      ...(terrainBrushConfig || {
                        tool: "raise",
                        size: 6,
                        strength: 0.5,
                        material: "grass",
                      }),
                      strength: Number(e.target.value),
                    })
                  }
                  className="w-24 accent-amber-400 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Active Move Mode Banner at Bottom Center (SELECT Mode) */}
      {editorMode === "select" && isMoving && (
        <div className="build-moving-container" role="status" aria-live="polite">
          <div className="moving-status-card">
            <div className="moving-badge">
              <Move size={18} strokeWidth={2.8} />
              <span>
                {count > 1
                  ? `Moving ${count} Bricks`
                  : `Moving ${selectedDef?.label || "Brick"}`}
              </span>
            </div>
            <p className="moving-hint">Click or tap any valid position to place • R to rotate</p>
            <button
              type="button"
              className="build-cancel-move-button"
              onClick={onCancelMove}
              aria-label="Cancel move (Escape)"
            >
              <X size={18} strokeWidth={2.6} />
              <span>Cancel</span>
              <kbd className="key-hint">Esc</kbd>
            </button>
          </div>
        </div>
      )}

      {/* Blueprint Placement Mode Banner */}
      {isBlueprintPlacement && (
        <div className="build-moving-container" role="status" aria-live="polite">
          <div className="moving-status-card blueprint-placement-card">
            <div className="moving-badge">
              <Layers size={18} strokeWidth={2.8} className="text-amber-400" />
              <span className="font-bold">{blueprintPlacementName || "Blueprint"}</span>
              {blueprintPlacementBrickCount != null && (
                <span className="text-white/50 text-xs ml-1">• {blueprintPlacementBrickCount} bricks</span>
              )}
            </div>
            <p className="moving-hint">
              Click to place • R rotate ({blueprintRotationDeg}°) • Click again to stamp another • Esc exit
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="build-cancel-move-button"
                onClick={onCancelBlueprintPlacement}
                aria-label="Cancel Blueprint placement (Escape)"
              >
                <X size={18} strokeWidth={2.6} />
                <span>Cancel</span>
                <kbd className="key-hint">Esc</kbd>
              </button>
              <button
                type="button"
                className="build-done-blueprint-button glass-button"
                onClick={onDoneBlueprintPlacement}
                aria-label="Finish Blueprint placement"
                style={{ backgroundColor: "rgba(245,160,0,0.3)", borderColor: "rgba(245,160,0,0.5)" }}
              >
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Right: Controls (Rotate in Build & Select; Move, Duplicate, Mirror, Recolor, Delete in Select) */}
      {editorMode !== "walk" && (
        <div className="build-bottom-controls">
          {editorMode === "select" && count > 0 && !isMoving && (
            <div className="selected-brick-actions" role="toolbar" aria-label="Selection actions">
              <div className="selection-count-badge">
                <span>{count} selected</span>
              </div>

              {/* Move */}
              <button
                type="button"
                className="build-move-button"
                onClick={onStartMove}
                aria-label={count > 1 ? "Move selected group (M key)" : "Move selected brick (M key)"}
              >
                <Move size={18} strokeWidth={2.6} />
                <span>{count > 1 ? "Move Group" : "Move"}</span>
                <kbd className="key-hint">M</kbd>
              </button>

              {/* Duplicate */}
              <button
                type="button"
                className="build-duplicate-button"
                onClick={onDuplicate}
                aria-label={count > 1 ? "Duplicate selected group (Ctrl+D)" : "Duplicate selected brick (Ctrl+D)"}
              >
                <CopyPlus size={18} strokeWidth={2.4} />
                <span>Duplicate</span>
                <kbd className="key-hint">Ctrl+D</kbd>
              </button>

              {/* Mirror X & Z */}
              {onMirror && (
                <>
                  <button
                    type="button"
                    className="build-mirror-btn glass-button flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-white/90 hover:text-white"
                    onClick={() => onMirror("x")}
                    aria-label="Mirror selection along X axis (Key X)"
                    title="Mirror X (Key X)"
                  >
                    <FlipHorizontal size={15} strokeWidth={2.4} className="text-amber-400" />
                    <span>Flip X</span>
                    <kbd className="key-hint">X</kbd>
                  </button>
                  <button
                    type="button"
                    className="build-mirror-btn glass-button flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-white/90 hover:text-white"
                    onClick={() => onMirror("z")}
                    aria-label="Mirror selection along Z axis (Key Z)"
                    title="Mirror Z (Key Z)"
                  >
                    <FlipVertical size={15} strokeWidth={2.4} className="text-amber-400" />
                    <span>Flip Z</span>
                    <kbd className="key-hint">Z</kbd>
                  </button>
                </>
              )}

              {/* Mass Recolor */}
              {onMassRecolor && (
                <button
                  type="button"
                  className="build-recolor-btn glass-button flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-white/90 hover:text-white"
                  onClick={() => onMassRecolor(activeColor)}
                  aria-label={`Recolor selection to active color (${activeColor})`}
                  title="Recolor selection to active color"
                >
                  <div className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-sm" style={{ backgroundColor: activeColor }} />
                  <span>Recolor</span>
                </button>
              )}

              {/* Select Same Type & Color */}
              {onSelectSameType && (
                <button
                  type="button"
                  className="build-same-type-btn glass-button flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-white/90 hover:text-white"
                  onClick={onSelectSameType}
                  aria-label="Select all bricks of same type in the world"
                  title="Select all bricks of same type in world"
                >
                  <Box size={14} strokeWidth={2.4} />
                  <span>Same Type</span>
                </button>
              )}

              {onSelectSameColor && (
                <button
                  type="button"
                  className="build-same-color-btn glass-button flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-white/90 hover:text-white"
                  onClick={onSelectSameColor}
                  aria-label="Select all bricks of same color in the world"
                  title="Select all bricks of same color in world"
                >
                  <Palette size={14} strokeWidth={2.4} />
                  <span>Same Color</span>
                </button>
              )}

              {/* Save Blueprint */}
              {onSaveAsBlueprint && (
                <button
                  type="button"
                  className="build-save-blueprint-button"
                  onClick={onSaveAsBlueprint}
                  aria-label="Save selection as reusable Blueprint"
                  title="Save as Blueprint"
                >
                  <Layers size={17} strokeWidth={2.4} />
                  <span>Blueprint</span>
                </button>
              )}

              {/* Delete */}
              <button
                type="button"
                className="build-delete-button"
                onClick={onDeleteSelected}
                aria-label={count > 1 ? `Delete ${count} selected bricks (Delete / Backspace)` : "Delete selected brick (Delete / Backspace)"}
              >
                <Trash2 size={18} strokeWidth={2.4} />
                <span>Delete</span>
                <kbd className="key-hint">Del</kbd>
              </button>

              {/* Deselect */}
              <button
                type="button"
                className="build-deselect-button glass-button"
                onClick={onDeselect}
                aria-label="Deselect (Escape)"
                title="Deselect (Esc)"
              >
                <X size={17} strokeWidth={2.6} />
                <span className="sr-only">Deselect</span>
              </button>
            </div>
          )}

          <button
            type="button"
            className="build-rotate-button glass-button"
            onClick={onRotate}
            aria-label="Rotate brick 90 degrees (R key)"
          >
            <RotateCw size={22} strokeWidth={2.6} />
            <span>Rotate</span>
            <span className="rotation-angle-pill">{rotation}°</span>
            <kbd className="key-hint">R</kbd>
          </button>
        </div>
      )}

      {/* WALK MODE HUD OVERLAY (Minimal immersive exploration) */}
      {editorMode === "walk" && (
        <>
          <CompassHUD yaw={playerYaw} position={playerPosition} />

          <div className="walk-hud-controls-pill">
            <span className="walk-hint-dot" />
            <span className="walk-controls-text">
              {isPointerLocked
                ? "Esc to unlock mouse • WASD to walk • Space jump • Shift sprint • H toggle height"
                : "Click to lock mouse • Drag or WASD to move • Space jump • Shift sprint • H toggle height"}
            </span>

            <div className="walk-height-switcher" role="group" aria-label="Walk eye height preset">
              <span className="walk-height-label">Height (H):</span>
              <button
                type="button"
                className={`walk-height-btn ${walkHeightPreset === "minifig" ? "active" : ""}`}
                onClick={() => onWalkHeightChange?.("minifig")}
                title="Minifig scale (2.4 units tall)"
              >
                Minifig (2.4)
              </button>
              <button
                type="button"
                className={`walk-height-btn ${walkHeightPreset === "normal" ? "active" : ""}`}
                onClick={() => onWalkHeightChange?.("normal")}
                title="Default Human scale (3.5 units tall)"
              >
                Human (3.5)
              </button>
              <button
                type="button"
                className={`walk-height-btn ${walkHeightPreset === "tall" ? "active" : ""}`}
                onClick={() => onWalkHeightChange?.("tall")}
                title="Tall / Roof inspection scale (5.0 units tall)"
              >
                Tall (5.0)
              </button>
            </div>
          </div>

          <div className="walk-center-reticle" aria-hidden="true" />

          {onMobileWalkInput && (
            <MobileWalkTouchControls onMobileInput={onMobileWalkInput} />
          )}
        </>
      )}
    </div>
  );
}
