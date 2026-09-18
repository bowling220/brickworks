"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Settings, UserRound, Volume2, Music2, Sparkles, FolderOpen } from "lucide-react";
import { BuildUI, EditorMode, BuildTool } from "@/components/brickworks/BuildUI";
import { BuildSceneHandle, BuildDebugInfo, BlueprintPlacementState } from "@/components/brickworks/BuildScene";
import { BrickData, BrickRotation } from "@/components/brickworks/GridSystem";
import { GameMode } from "@/components/brickworks/BuildCamera";
import { BrickTypeId, DEFAULT_BRICK_COLOR } from "@/components/brickworks/BrickCatalog";
import { MobileWalkInput, WalkHeightPreset } from "@/components/brickworks/WalkController";
import { trackRecentPart } from "@/components/brickworks/PartsBrowser";
import {
  SavedWorld,
  SavedBrickData,
  getWorldStorageService,
  groupBricksIntoChunks,
  getAllBricksFromWorld,
  Waypoint,
  ChunkTerrainMod,
} from "@/components/brickworks/WorldStorage";
import { TerrainBrushConfig } from "@/components/brickworks/TerrainBrush";
import { setPlayerMovementState, getPlayerMovementState } from "@/components/brickworks/PlayerState";
import {
  BlueprintData,
  createBlueprintFromSelection,
  getBlueprintStorageService,
} from "@/components/brickworks/BlueprintStorage";
import { GroupRelativeItem } from "@/components/brickworks/GroupSystem";
import dynamic from "next/dynamic";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

const PartsBrowser = dynamic(
  () => import("@/components/brickworks/PartsBrowser").then((m) => m.PartsBrowser),
  { ssr: false }
);
const MyWorldsDialog = dynamic(
  () => import("@/components/brickworks/MyWorldsDialog").then((m) => m.MyWorldsDialog),
  { ssr: false }
);
const CreateWorldDialog = dynamic(
  () => import("@/components/brickworks/CreateWorldDialog").then((m) => m.CreateWorldDialog),
  { ssr: false }
);
const WorldMapDialog = dynamic(
  () => import("@/components/brickworks/WorldMapDialog").then((m) => m.WorldMapDialog),
  { ssr: false }
);
const BlueprintLibrary = dynamic(
  () => import("@/components/brickworks/BlueprintLibrary").then((m) => m.BlueprintLibrary),
  { ssr: false }
);
const SaveBlueprintDialog = dynamic(
  () => import("@/components/brickworks/BlueprintLibrary").then((m) => m.SaveBlueprintDialog),
  { ssr: false }
);
const SkyScene = dynamic(
  () => import("@/components/brickworks/SkyScene").then((m) => m.SkyScene),
  { ssr: false }
);
const EnvironmentSettingsDialog = dynamic(
  () => import("@/components/brickworks/EnvironmentSettingsDialog").then((m) => m.EnvironmentSettingsDialog),
  { ssr: false }
);
import {
  WorldEnvironmentState,
  GraphicsQuality,
  getDefaultWorldEnvironment,
  advanceWorldEnvironment,
} from "@/components/brickworks/WorldEnvironment";
import { getAudioManager } from "@/components/brickworks/AudioManager";
import { getMusicManager } from "@/components/brickworks/MusicManager";

function AccountButton() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  return (
    <button
      className="account-button glass-button"
      type="button"
      onClick={() => setIsLoggedIn((value) => !value)}
      aria-label={isLoggedIn ? "Open profile" : "Log in or sign up"}
    >
      <span className="icon-orb" aria-hidden="true">
        <UserRound size={19} strokeWidth={2.8} />
      </span>
      <span>{isLoggedIn ? "Profile" : "Login / Sign Up"}</span>
    </button>
  );
}

function SettingsButton({ onOpenAdvanced }: { onOpenAdvanced?: () => void }) {
  const [sound, setSound] = useState(true);
  const [music, setMusic] = useState(true);
  const [effects, setEffects] = useState(true);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="settings-button glass-button"
          type="button"
          aria-label="Open settings"
        >
          <Settings size={28} strokeWidth={2.8} aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="settings-panel border-white/40 bg-[#113c74]/90 text-white shadow-[0_30px_80px_rgba(0,24,65,.45)] backdrop-blur-2xl sm:max-w-[390px]">
        <DialogHeader>
          <p className="settings-kicker">Game menu</p>
          <DialogTitle className="text-3xl font-black tracking-tight">Settings</DialogTitle>
          <DialogDescription className="text-blue-100/80">
            Tune the world before your next build.
          </DialogDescription>
        </DialogHeader>
        <div className="settings-list">
          <SettingRow
            icon={<Volume2 />}
            label="Sound effects"
            checked={sound}
            onCheckedChange={(val) => {
              setSound(val);
              getAudioManager().setSfxVolume(val ? 0.6 : 0.0);
            }}
          />
          <SettingRow
            icon={<Music2 />}
            label="Music"
            checked={music}
            onCheckedChange={(val) => {
              setMusic(val);
              getAudioManager().setMusicVolume(val ? 0.22 : 0.0);
            }}
          />
          <SettingRow icon={<Sparkles />} label="Ambient motion" checked={effects} onCheckedChange={setEffects} />
        </div>
        {onOpenAdvanced && (
          <div className="pt-2 border-t border-white/10 mt-2">
            <button
              type="button"
              onClick={onOpenAdvanced}
              className="w-full py-2 px-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/30 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <span>Atmosphere, Weather & Audio Settings</span>
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettingRow({
  icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = `setting-${label.replaceAll(" ", "-").toLowerCase()}`;
  return (
    <div className="setting-row">
      <span className="setting-icon" aria-hidden="true">{icon}</span>
      <label htmlFor={id}>{label}</label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-[#38d866] data-[state=unchecked]:bg-white/20"
      />
    </div>
  );
}

function PlayButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="play-area">
      <button type="button" className="play-button" onClick={onClick}>
        <span className="play-icon" aria-hidden="true" />
        <span>PLAY</span>
      </button>
    </div>
  );
}

export default function HomePage() {
  const [gameMode, setGameMode] = useState<GameMode>("home");
  const [selectedBrick, setSelectedBrick] = useState<BrickData | null>(null);
  const [selectedBrickIds, setSelectedBrickIds] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [rotation, setRotation] = useState<BrickRotation>(0);
  const [activeType, setActiveType] = useState<BrickTypeId>("brick_2x4");
  const [activeColor, setActiveColor] = useState<string>(DEFAULT_BRICK_COLOR);
  const [debugInfo, setDebugInfo] = useState<BuildDebugInfo | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const buildSceneRef = useRef<BuildSceneHandle>(null);

  // Editor Mode & Advanced Tool System
  const [editorMode, setEditorMode] = useState<EditorMode>("build");
  const [buildTool, setBuildTool] = useState<BuildTool>("single");
  const [isPartsBrowserOpen, setIsPartsBrowserOpen] = useState(false);
  const [lineToolStep, setLineToolStep] = useState<"start" | "end" | null>(null);
  const [areaToolStep, setAreaToolStep] = useState<"start" | "end" | null>(null);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [mobileWalkInput, setMobileWalkInput] = useState<MobileWalkInput | undefined>(undefined);
  const [placedBricks, setPlacedBricks] = useState<BrickData[]>([]);
  const [walkHeightPreset, setWalkHeightPreset] = useState<WalkHeightPreset>("normal");
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const handleRecenterCamera = useCallback(() => {
    setRecenterTrigger((prev) => prev + 1);
  }, []);

  // Terrain Editing State
  const [terrainBrushConfig, setTerrainBrushConfig] = useState<TerrainBrushConfig>({
    tool: "raise",
    size: 6,
    strength: 0.5,
    material: "grass",
  });
  const [terrainMods, setTerrainMods] = useState<Record<string, { terrainMod?: ChunkTerrainMod }>>({});
  const terrainModsRef = useRef(terrainMods);
  useEffect(() => {
    terrainModsRef.current = terrainMods;
  }, [terrainMods]);

  // World Navigation, Waypoints & Safety State
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const waypointsRef = useRef(waypoints);
  useEffect(() => {
    waypointsRef.current = waypoints;
  }, [waypoints]);

  const [homeSpawnId, setHomeSpawnId] = useState<string | undefined>(undefined);
  const homeSpawnIdRef = useRef(homeSpawnId);
  useEffect(() => {
    homeSpawnIdRef.current = homeSpawnId;
  }, [homeSpawnId]);

  const [exploredChunks, setExploredChunks] = useState<string[]>(["0,0"]);
  const exploredChunksRef = useRef(exploredChunks);
  useEffect(() => {
    exploredChunksRef.current = exploredChunks;
  }, [exploredChunks]);

  const [lastSafePosition, setLastSafePosition] = useState<[number, number, number]>([0, 0.5, 0]);
  const lastSafePositionRef = useRef(lastSafePosition);
  useEffect(() => {
    lastSafePositionRef.current = lastSafePosition;
  }, [lastSafePosition]);

  const [isMapOpen, setIsMapOpen] = useState(false);
  const [teleportTarget, setTeleportTarget] = useState<[number, number, number] | null>(null);
  const [isTeleporting, setIsTeleporting] = useState(false);

  // Persistence & Saved Worlds State
  const [currentWorld, setCurrentWorld] = useState<SavedWorld | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "unsaved" | "error">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isMyWorldsOpen, setIsMyWorldsOpen] = useState(false);
  const [isCreateWorldOpen, setIsCreateWorldOpen] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isBlueprintLibraryOpen, setIsBlueprintLibraryOpen] = useState(false);
  const [isSaveBlueprintOpen, setIsSaveBlueprintOpen] = useState(false);
  const [blueprintPlacementState, setBlueprintPlacementState] = useState<BlueprintPlacementState | null>(null);

  const storage = useMemo(() => getWorldStorageService(), []);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentWorldRef = useRef<SavedWorld | null>(currentWorld);
  useEffect(() => {
    currentWorldRef.current = currentWorld;
  }, [currentWorld]);

  // Environment, Atmosphere, Weather & Audio State
  const [environment, setEnvironment] = useState<WorldEnvironmentState>(() => getDefaultWorldEnvironment());
  const environmentRef = useRef(environment);
  useEffect(() => {
    environmentRef.current = environment;
  }, [environment]);

  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>("medium");
  const [reducedLightningFlash, setReducedLightningFlash] = useState(false);
  const [lightningFlashActive, setLightningFlashActive] = useState(false);
  const [isEnvironmentSettingsOpen, setIsEnvironmentSettingsOpen] = useState(false);

  const homeSpawnPos = useMemo<[number, number, number] | undefined>(() => {
    const wp = waypoints.find((w) => w.id === homeSpawnId) || waypoints.find((w) => w.isHome);
    if (wp) return [wp.worldX, wp.worldY, wp.worldZ];
    return currentWorld?.playerSpawn;
  }, [currentWorld?.playerSpawn, homeSpawnId, waypoints]);

  // Core Save Executor (Chunk-based Persistence with terrain and waypoints)
  const executeSave = useCallback(async (bricksOverride?: BrickData[]) => {
    let world = currentWorldRef.current;
    if (!world) {
      world = await storage.createNewWorld();
      currentWorldRef.current = world;
      setCurrentWorld(world);
    }

    setSaveStatus("saving");
    try {
      const bricks = bricksOverride || buildSceneRef.current?.getBricks() || [];
      const savedBricks: SavedBrickData[] = bricks.map((b) => ({
        id: b.id,
        type: b.type,
        color: b.color,
        gridX: b.gridX,
        gridY: b.gridY,
        gridZ: b.gridZ,
        rotation: b.rotation,
      }));

      const chunkData = groupBricksIntoChunks(savedBricks);

      // Merge modified chunk terrain mods into chunk data
      for (const [k, chunk] of Object.entries(terrainModsRef.current || {})) {
        if (chunk?.terrainMod) {
          if (!chunkData[k]) {
            chunkData[k] = { bricks: [] };
          }
          chunkData[k].terrainMod = chunk.terrainMod;
        }
      }

      // Preserve existing terrain mods from current world
      for (const [k, existingChunk] of Object.entries(world.chunks || {})) {
        if (existingChunk?.terrainMod && !chunkData[k]?.terrainMod) {
          if (!chunkData[k]) {
            chunkData[k] = { bricks: [] };
          }
          chunkData[k].terrainMod = existingChunk.terrainMod;
        }
      }

      const updated: SavedWorld = {
        ...world,
        updatedAt: new Date().toISOString(),
        lastPlayerPosition: getPlayerMovementState().pos || world.lastPlayerPosition,
        lastPlayerYaw: getPlayerMovementState().yaw ?? world.lastPlayerYaw,
        chunks: chunkData,
        bricks: savedBricks,
        waypoints: waypointsRef.current,
        homeSpawnId: homeSpawnIdRef.current,
        exploredChunks: exploredChunksRef.current,
        lastSafePosition: lastSafePositionRef.current,
        environment: environmentRef.current,
      };

      await storage.saveWorld(updated);
      currentWorldRef.current = updated;
      setCurrentWorld(updated);
      setIsDirty(false);
      setSaveStatus("saved");
      setLastSavedAt(new Date());
    } catch (err) {
      console.error("Failed to save world:", err);
      setSaveStatus("error");
    }
  }, [storage]);

  // Terrain Change Callback
  const handleTerrainChange = useCallback((modifiedChunks: Record<string, ChunkTerrainMod>, affectedChunkKeys: string[]) => {
    getAudioManager().playTerrainSculpt();
    setTerrainMods((prev) => {
      const next = { ...prev };
      for (const k of affectedChunkKeys) {
        next[k] = { terrainMod: modifiedChunks[k] };
      }
      terrainModsRef.current = next;
      return next;
    });

    setIsDirty(true);
    setSaveStatus("unsaved");

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      executeSave();
    }, 1500);
  }, [executeSave]);

  // Explored Chunks Tracking
  const handleChunksExplored = useCallback((chunkKeys: string[]) => {
    setExploredChunks((prev) => {
      const set = new Set(prev);
      let changed = false;
      for (const k of chunkKeys) {
        if (!set.has(k)) {
          set.add(k);
          changed = true;
        }
      }
      if (!changed) return prev;
      const next = Array.from(set);
      exploredChunksRef.current = next;
      return next;
    });
  }, []);

  // Safe Position Tracking
  const handleSafePositionChange = useCallback((pos: [number, number, number]) => {
    setLastSafePosition(pos);
    lastSafePositionRef.current = pos;
  }, []);

  // Fast Travel Handler
  const handleFastTravel = useCallback((dest: [number, number, number]) => {
    getAudioManager().playFastTravel();
    setIsTeleporting(true);
    setTeleportTarget(dest);
    if (editorMode !== "walk") {
      setPlayerMovementState(dest, getPlayerMovementState().yaw);
      setRecenterTrigger((prev) => prev + 1);
    }
    setTimeout(() => {
      setIsTeleporting(false);
    }, 600);
  }, [editorMode]);

  // Waypoints CRUD
  const handleAddWaypoint = useCallback((name: string, pos?: [number, number, number]) => {
    getAudioManager().playWaypointSet();
    const targetPos = pos || getPlayerMovementState().pos || currentWorldRef.current?.playerSpawn || [0, 0.5, 0];
    const newWaypoint: Waypoint = {
      id: `wp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim() || `Waypoint ${waypointsRef.current.length + 1}`,
      worldX: Math.round(targetPos[0] * 10) / 10,
      worldY: Math.round(targetPos[1] * 10) / 10,
      worldZ: Math.round(targetPos[2] * 10) / 10,
      createdAt: new Date().toISOString(),
      color: "#00d2ff",
      isHome: false,
    };
    setWaypoints((prev) => {
      const next = [...prev, newWaypoint];
      waypointsRef.current = next;
      return next;
    });
    setIsDirty(true);
    setSaveStatus("unsaved");
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => executeSave(), 1000);
  }, [executeSave]);

  const handleDeleteWaypoint = useCallback((id: string) => {
    setWaypoints((prev) => {
      const next = prev.filter((w) => w.id !== id);
      waypointsRef.current = next;
      return next;
    });
    if (homeSpawnIdRef.current === id) {
      setHomeSpawnId(undefined);
      homeSpawnIdRef.current = undefined;
    }
    setIsDirty(true);
    setSaveStatus("unsaved");
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => executeSave(), 1000);
  }, [executeSave]);

  const handleRenameWaypoint = useCallback((id: string, newName: string) => {
    setWaypoints((prev) => {
      const next = prev.map((w) => (w.id === id ? { ...w, name: newName } : w));
      waypointsRef.current = next;
      return next;
    });
    setIsDirty(true);
    setSaveStatus("unsaved");
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => executeSave(), 1000);
  }, [executeSave]);

  const handleSetHomeSpawn = useCallback((id: string) => {
    setHomeSpawnId(id);
    homeSpawnIdRef.current = id;
    setWaypoints((prev) => {
      const next = prev.map((w) => ({ ...w, isHome: w.id === id }));
      waypointsRef.current = next;
      return next;
    });
    setIsDirty(true);
    setSaveStatus("unsaved");
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => executeSave(), 1000);
  }, [executeSave]);

  const handleUnstuck = useCallback(() => {
    const homeWp = waypointsRef.current.find((w) => w.id === homeSpawnIdRef.current);
    const target: [number, number, number] = lastSafePositionRef.current
      ? [...lastSafePositionRef.current]
      : homeWp
      ? [homeWp.worldX, homeWp.worldY, homeWp.worldZ]
      : currentWorldRef.current?.playerSpawn || [0, 0.5, 0];
    handleFastTravel(target);
  }, [handleFastTravel]);

  // Debounced Autosave (1.5s after changes settle)
  const handleBricksChange = useCallback((bricks: BrickData[]) => {
    setPlacedBricks(bricks);
    setIsDirty(true);
    setSaveStatus("unsaved");

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      executeSave(bricks);
    }, 1500);
  }, [executeSave]);

  const handleManualSave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    executeSave();
  }, [executeSave]);

  const handleRenameWorld = useCallback(async (newName: string) => {
    const world = currentWorldRef.current;
    if (!world) return;
    try {
      await storage.renameWorld(world.id, newName);
      const updated = { ...world, name: newName };
      currentWorldRef.current = updated;
      setCurrentWorld(updated);
    } catch (err) {
      console.error("Rename failed:", err);
    }
  }, [storage]);

  const handlePlayerPositionChange = useCallback((pos: [number, number, number], yaw: number) => {
    setPlayerMovementState(pos, yaw);
    if (currentWorldRef.current) {
      currentWorldRef.current.lastPlayerPosition = pos;
      currentWorldRef.current.lastPlayerYaw = yaw;
    }
  }, []);

  const handleOpenWorld = useCallback((world: SavedWorld) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    const bricks = getAllBricksFromWorld(world);
    currentWorldRef.current = world;
    const initialPos = world.lastPlayerPosition || world.playerSpawn || [0, 0.5, 0];
    const initialYaw = world.lastPlayerYaw ?? 0;
    setPlayerMovementState(initialPos, initialYaw);

    // Load terrain modifications
    const loadedMods: Record<string, { terrainMod?: ChunkTerrainMod }> = {};
    if (world.chunks) {
      for (const [k, c] of Object.entries(world.chunks)) {
        if (c?.terrainMod) {
          loadedMods[k] = { terrainMod: c.terrainMod };
        }
      }
    }
    setTerrainMods(loadedMods);
    terrainModsRef.current = loadedMods;

    // Load waypoints and exploration
    const wps = world.waypoints?.length
      ? world.waypoints
      : [
          {
            id: "spawn_waypoint",
            name: "World Spawn",
            worldX: world.playerSpawn?.[0] || 0,
            worldY: world.playerSpawn?.[1] || 0.5,
            worldZ: world.playerSpawn?.[2] || 0,
            createdAt: new Date().toISOString(),
            isHome: true,
            color: "#ffd700",
          },
        ];
    setWaypoints(wps);
    waypointsRef.current = wps;
    setHomeSpawnId(world.homeSpawnId || "spawn_waypoint");
    homeSpawnIdRef.current = world.homeSpawnId || "spawn_waypoint";
    setExploredChunks(world.exploredChunks?.length ? world.exploredChunks : ["0,0"]);
    exploredChunksRef.current = world.exploredChunks?.length ? world.exploredChunks : ["0,0"];
    setLastSafePosition(world.lastSafePosition || world.playerSpawn || [0, 0.5, 0]);
    lastSafePositionRef.current = world.lastSafePosition || world.playerSpawn || [0, 0.5, 0];

    setCurrentWorld(world);
    setPlacedBricks(bricks);
    buildSceneRef.current?.loadBricks(bricks);

    const loadedEnv = world.environment || getDefaultWorldEnvironment();
    setEnvironment(loadedEnv);
    environmentRef.current = loadedEnv;
    getAudioManager().setWeatherState(loadedEnv.weatherType, loadedEnv.weatherIntensity);
    const isNight = loadedEnv.timeOfDay < 5.0 || loadedEnv.timeOfDay >= 19.5;
    const isRain = loadedEnv.weatherType === "rain" || loadedEnv.weatherType === "storm";
    getAudioManager().setAmbienceState(isNight, isRain, loadedEnv.windStrength);
    getMusicManager().start(loadedEnv.timeOfDay, loadedEnv.weatherType);

    setIsDirty(false);
    setSaveStatus("saved");
    setEditorMode("build");
    setGameMode("transitioning-to-build");
  }, []);

  const handleWorldCreated = useCallback((newWorld: SavedWorld) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    currentWorldRef.current = newWorld;
    const initialPos = newWorld.playerSpawn || [0, 0.5, 0];
    setPlayerMovementState(initialPos, 0);

    setTerrainMods({});
    terrainModsRef.current = {};

    const wps = newWorld.waypoints?.length
      ? newWorld.waypoints
      : [
          {
            id: "spawn_waypoint",
            name: "World Spawn",
            worldX: newWorld.playerSpawn?.[0] || 0,
            worldY: newWorld.playerSpawn?.[1] || 0.5,
            worldZ: newWorld.playerSpawn?.[2] || 0,
            createdAt: new Date().toISOString(),
            isHome: true,
            color: "#ffd700",
          },
        ];
    setWaypoints(wps);
    waypointsRef.current = wps;
    setHomeSpawnId(newWorld.homeSpawnId || "spawn_waypoint");
    homeSpawnIdRef.current = newWorld.homeSpawnId || "spawn_waypoint";
    setExploredChunks(["0,0"]);
    exploredChunksRef.current = ["0,0"];
    setLastSafePosition(newWorld.playerSpawn || [0, 0.5, 0]);
    lastSafePositionRef.current = newWorld.playerSpawn || [0, 0.5, 0];

    setCurrentWorld(newWorld);
    setPlacedBricks([]);
    buildSceneRef.current?.loadBricks([]);

    const defEnv = newWorld.environment || getDefaultWorldEnvironment();
    setEnvironment(defEnv);
    environmentRef.current = defEnv;
    getAudioManager().setWeatherState(defEnv.weatherType, defEnv.weatherIntensity);
    const isNight = defEnv.timeOfDay < 5.0 || defEnv.timeOfDay >= 19.5;
    const isRain = defEnv.weatherType === "rain" || defEnv.weatherType === "storm";
    getAudioManager().setAmbienceState(isNight, isRain, defEnv.windStrength);
    getMusicManager().start(defEnv.timeOfDay, defEnv.weatherType);

    setIsDirty(false);
    setSaveStatus("saved");
    setEditorMode("build");
    setGameMode("transitioning-to-build");
  }, []);

  // Transition to Build Mode: resumes recent world or prompts Create World
  const handlePlay = useCallback(async () => {
    getAudioManager().playUiClick();
    getMusicManager().start(environment.timeOfDay, environment.weatherType);
    if (!currentWorld) {
      try {
        const recentId = await storage.getRecentWorldId();
        if (recentId) {
          const loaded = await storage.loadWorld(recentId);
          if (loaded) {
            handleOpenWorld(loaded);
            return;
          }
        }
      } catch {
        // Fallback to Create World modal
      }

      // If no recent world exists, prompt user to create their first world!
      setIsCreateWorldOpen(true);
      return;
    }

    setEditorMode("build");
    setGameMode("transitioning-to-build");
  }, [currentWorld, environment.timeOfDay, environment.weatherType, handleOpenWorld, storage]);

  // Transition back to Home Menu (safe leave protection)
  const handleBackToMenu = useCallback(() => {
    if (isDirty && saveStatus === "error") {
      setShowUnsavedDialog(true);
      return;
    }

    if (isDirty) {
      executeSave();
    }

    setEditorMode("build");
    setGameMode("transitioning-to-home");
  }, [executeSave, isDirty, saveStatus]);

  const handleTransitionComplete = useCallback(() => {
    setGameMode((current) => {
      if (current === "transitioning-to-build") return "build";
      if (current === "transitioning-to-home") return "home";
      return current;
    });
  }, []);

  const handleEditorModeChange = useCallback((nextMode: EditorMode) => {
    setEditorMode(nextMode);
    if (nextMode === "build" || nextMode === "walk" || nextMode === "terrain") {
      buildSceneRef.current?.deselect();
      if (isMoving) {
        buildSceneRef.current?.cancelMove();
      }
      if (isMultiSelectMode) {
        setIsMultiSelectMode(false);
        buildSceneRef.current?.toggleMultiSelectMode(false);
      }
      setSelectedBrick(null);
      setSelectedBrickIds([]);
    }
  }, [isMoving, isMultiSelectMode]);

  const handleCycleWalkHeight = useCallback(() => {
    setWalkHeightPreset((prev) => {
      if (prev === "minifig") return "normal";
      if (prev === "normal") return "tall";
      return "minifig";
    });
  }, []);

  // Palette & Color Selection handlers
  const handleSelectType = useCallback((type: BrickTypeId) => {
    setActiveType(type);
    buildSceneRef.current?.setType(type);
  }, []);

  const handleSelectColor = useCallback((color: string) => {
    setActiveColor(color);
    buildSceneRef.current?.setColor(color);
  }, []);

  // Action History & Move handlers
  const handleHistoryChange = useCallback((undoable: boolean, redoable: boolean) => {
    setCanUndo(undoable);
    setCanRedo(redoable);
  }, []);

  const handleMoveModeChange = useCallback((moving: boolean) => {
    setIsMoving(moving);
  }, []);

  const handleUndo = useCallback(() => {
    buildSceneRef.current?.undo();
  }, []);

  const handleRedo = useCallback(() => {
    buildSceneRef.current?.redo();
  }, []);

  const handleStartMove = useCallback(() => {
    buildSceneRef.current?.startMove();
  }, []);

  const handleCancelMove = useCallback(() => {
    buildSceneRef.current?.cancelMove();
  }, []);

  const handleDeselect = useCallback(() => {
    buildSceneRef.current?.deselect();
  }, []);

  // Selection & Group management handlers
  const handleSelectionChange = useCallback((ids: string[], bricks: BrickData[]) => {
    setSelectedBrickIds(ids);
    setSelectedBrick(bricks.length > 0 ? bricks[bricks.length - 1] : null);
  }, []);

  const handleBoxSelectChange = useCallback((selecting: boolean) => {
    setIsBoxSelecting(selecting);
  }, []);

  const handleToggleMultiSelect = useCallback(() => {
    setIsMultiSelectMode((prev) => {
      const next = !prev;
      buildSceneRef.current?.toggleMultiSelectMode(next);
      return next;
    });
  }, []);

  const handleDuplicate = useCallback(() => {
    buildSceneRef.current?.duplicate();
  }, []);

  const handleSelectAll = useCallback(() => {
    buildSceneRef.current?.selectAll();
  }, []);

  // Tactile placement sound hook
  const handleBrickPlacedSound = useCallback((brick: BrickData) => {
    getAudioManager().playPlaceBrick(brick.type);
  }, []);

  // Smooth background environment tick (advances in 0.5s chunks without 60fps React re-renders)
  const accumulatedDeltaRef = useRef(0);
  const handleAdvanceEnvironment = useCallback((delta: number) => {
    accumulatedDeltaRef.current += delta;
    if (accumulatedDeltaRef.current >= 0.5) {
      const advanced = advanceWorldEnvironment(environmentRef.current, accumulatedDeltaRef.current);
      accumulatedDeltaRef.current = 0;
      environmentRef.current = advanced;
      setEnvironment(advanced);

      const isNight = advanced.timeOfDay < 5.0 || advanced.timeOfDay >= 19.5;
      const isRain = advanced.weatherType === "rain" || advanced.weatherType === "storm";
      getAudioManager().setAmbienceState(isNight, isRain, advanced.windStrength);
    }
  }, []);

  // Lightning Flash and Delayed Thunder sound coordination
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleFlashVisual = useCallback(() => {
    if (reducedLightningFlash) return;
    setLightningFlashActive(true);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => {
      setLightningFlashActive(false);
    }, 150);
  }, [reducedLightningFlash]);

  const handleLightningEvent = useCallback((delayMs: number, intensity: number) => {
    setTimeout(() => {
      getAudioManager().playThunder(intensity);
    }, delayMs);
  }, []);

  const handleOpenBlueprints = useCallback(() => {
    setIsBlueprintLibraryOpen(true);
  }, []);

  const handleSaveAsBlueprint = useCallback(() => {
    if (selectedBrickIds.length === 0) return;
    setIsSaveBlueprintOpen(true);
  }, [selectedBrickIds.length]);

  const handleSaveBlueprintConfirm = useCallback(async (name: string) => {
    const selectedBricks = placedBricks.filter((b) => selectedBrickIds.includes(b.id));
    if (selectedBricks.length === 0) return;

    try {
      const bp = createBlueprintFromSelection(selectedBricks, name);
      const bpStorage = getBlueprintStorageService();
      await bpStorage.saveBlueprint(bp);
    } catch (err) {
      console.error("[BRICKWORKS] Failed to save blueprint:", err);
    }
  }, [placedBricks, selectedBrickIds]);

  const handlePlaceBlueprint = useCallback((blueprint: BlueprintData) => {
    if (!blueprint.bricks || blueprint.bricks.length === 0) return;

    const items: GroupRelativeItem[] = blueprint.bricks.map((b, idx) => ({
      id: `bp-cand-${idx}`,
      type: b.type,
      color: b.color,
      relX: b.relX,
      relY: b.relY,
      relZ: b.relZ,
      rotation: b.rotation,
    }));

    if (editorMode !== "build") {
      setEditorMode("build");
    }

    buildSceneRef.current?.startBlueprintPlacement(items, blueprint.name, blueprint.brickCount);
  }, [editorMode]);

  const handleCancelBlueprintPlacement = useCallback(() => {
    buildSceneRef.current?.cancelBlueprintPlacement();
  }, []);

  const handleDoneBlueprintPlacement = useCallback(() => {
    buildSceneRef.current?.cancelBlueprintPlacement();
  }, []);

  const handleRotate = useCallback(() => {
    buildSceneRef.current?.rotate();
  }, []);

  const handleDeleteSelected = useCallback(() => {
    buildSceneRef.current?.deleteSelected();
  }, []);

  // Advanced Building Tools & Specialized Pieces callbacks
  const handleSelectBuildTool = useCallback((tool: BuildTool) => {
    setBuildTool(tool);
  }, []);

  const handleSelectPart = useCallback((type: BrickTypeId) => {
    setActiveType(type);
    trackRecentPart(type);
    buildSceneRef.current?.setType(type);
  }, []);

  const handleMirror = useCallback((axis: "x" | "z") => {
    buildSceneRef.current?.mirrorSelected(axis);
  }, []);

  const handleMassRecolor = useCallback((color: string) => {
    buildSceneRef.current?.recolorSelected(color);
  }, []);

  const handleMassReplace = useCallback(() => {
    setIsPartsBrowserOpen(true);
  }, []);

  const handleSelectSameType = useCallback(() => {
    buildSceneRef.current?.selectSameType();
  }, []);

  const handleSelectSameColor = useCallback(() => {
    buildSceneRef.current?.selectSameColor();
  }, []);

  const handleLineToolStateChange = useCallback((step: "start" | "end" | null) => {
    setLineToolStep(step);
  }, []);

  const handleAreaToolStateChange = useCallback((step: "start" | "end" | null) => {
    setAreaToolStep(step);
  }, []);

  const isHomeVisible = gameMode === "home";
  const isHomeFading = gameMode === "transitioning-to-build";
  const isBuildVisible = gameMode === "build" || gameMode === "transitioning-to-build";

  return (
    <main className={`home-shell mode-${gameMode}`} suppressHydrationWarning>
      {/* Unified 3D World Canvas hosting Home & Build scenes */}
      <SkyScene
        mode={gameMode}
        onTransitionComplete={handleTransitionComplete}
        buildSceneRef={buildSceneRef}
        onSelectBrick={setSelectedBrick}
        onSelectionChange={handleSelectionChange}
        onRotationChange={setRotation}
        onTypeChange={setActiveType}
        onColorChange={setActiveColor}
        onBrickPlacedSound={handleBrickPlacedSound}
        onDebugUpdate={setDebugInfo}
        onHistoryChange={handleHistoryChange}
        onMoveModeChange={handleMoveModeChange}
        onBoxSelectChange={handleBoxSelectChange}
        isMultiSelectMode={isMultiSelectMode}
        isBoxSelecting={isBoxSelecting}
        onBricksChange={handleBricksChange}
        editorMode={editorMode}
        buildTool={buildTool}
        onBuildToolChange={setBuildTool}
        onLineToolStateChange={handleLineToolStateChange}
        onAreaToolStateChange={handleAreaToolStateChange}
        placedBricks={placedBricks}
        onExitWalk={() => handleEditorModeChange("build")}
        mobileWalkInput={mobileWalkInput}
        onPointerLockChange={setIsPointerLocked}
        walkHeightPreset={walkHeightPreset}
        onCycleHeightPreset={handleCycleWalkHeight}
        recenterTrigger={recenterTrigger}
        worldType={currentWorld?.worldType || "island"}
        worldSize={currentWorld?.worldSize || "small"}
        seed={currentWorld?.seed || 12345}
        viewDistance={currentWorld?.settings?.viewDistance || "medium"}
        playerSpawn={currentWorld?.playerSpawn || [0, 0, 11.2]}
        lastPlayerPosition={currentWorld?.lastPlayerPosition}
        lastPlayerYaw={currentWorld?.lastPlayerYaw}
        onPlayerPositionChange={handlePlayerPositionChange}
        terrainBrushConfig={terrainBrushConfig}
        terrainMods={terrainMods}
        onTerrainChange={handleTerrainChange}
        onChunksExplored={handleChunksExplored}
        onBlueprintStateChange={setBlueprintPlacementState}
        lastSafePos={lastSafePosition}
        homeSpawnPos={homeSpawnPos}
        onSafePositionChange={handleSafePositionChange}
        teleportTarget={teleportTarget}
        onTeleportComplete={() => setTeleportTarget(null)}
        environment={environment}
        graphicsQuality={graphicsQuality}
        reducedLightningFlash={reducedLightningFlash}
        lightningFlashActive={lightningFlashActive}
        onLightningEvent={handleLightningEvent}
        onFlashVisual={handleFlashVisual}
        onAdvanceEnvironment={handleAdvanceEnvironment}
      />

      {/* Atmospheric vignette */}
      <div className="sky-vignette" aria-hidden="true" />

      {/* HOME MENU UI LAYER (Fades smoothly during transition) */}
      <div className={`menu-ui-layer ${!isHomeVisible && !isHomeFading ? "pointer-events-none opacity-0" : ""} ${isHomeFading ? "fade-out" : ""}`}>
        {/* Top bar with single Account button */}
        <header className="top-bar">
          <AccountButton />
        </header>

        {/* Central hero UI positioned directly beneath the 3D floating island */}
        <section className="hero-ui-container" aria-labelledby="brickworks-title">
          <h1 id="brickworks-title" className="sr-only">BRICKWORKS</h1>
          <p className="hero-tagline">BUILD YOUR NEXT ADVENTURE</p>
          <PlayButton onClick={handlePlay} />

          {/* Secondary My Worlds Entrypoint on Homepage */}
          <div className="homepage-secondary-actions">
            <button
              type="button"
              className="homepage-my-builds-button glass-button"
              onClick={() => setIsMyWorldsOpen(true)}
              aria-label="Open My Worlds library"
            >
              <FolderOpen size={19} strokeWidth={2.4} />
              <span>MY WORLDS</span>
            </button>
          </div>
        </section>

        {/* Clean circular settings gear button */}
        <div className="corner-settings">
          <SettingsButton onOpenAdvanced={() => setIsEnvironmentSettingsOpen(true)} />
        </div>
      </div>

      {/* BUILD MODE HUD UI LAYER */}
      {isBuildVisible && (
        <div className={`build-ui-layer ${gameMode === "transitioning-to-build" ? "fade-in" : ""}`}>
          <BuildUI
            onBack={handleBackToMenu}
            onRotate={handleRotate}
            onDeleteSelected={handleDeleteSelected}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            onStartMove={handleStartMove}
            onCancelMove={handleCancelMove}
            onDeselect={handleDeselect}
            onDuplicate={handleDuplicate}
            onSelectAll={handleSelectAll}
            isMultiSelectMode={isMultiSelectMode}
            onToggleMultiSelectMode={handleToggleMultiSelect}
            boxSelectRect={null}
            selectedCount={selectedBrickIds.length}
            isMoving={isMoving}
            rotation={rotation}
            selectedBrick={selectedBrick}
            activeType={activeType}
            activeColor={activeColor}
            onSelectType={handleSelectType}
            onSelectColor={handleSelectColor}
            buildTool={buildTool}
            onSelectBuildTool={handleSelectBuildTool}
            onOpenPartsBrowser={() => setIsPartsBrowserOpen(true)}
            lineToolStep={lineToolStep}
            areaToolStep={areaToolStep}
            onMirror={handleMirror}
            onMassRecolor={handleMassRecolor}
            onMassReplace={handleMassReplace}
            onSelectSameType={handleSelectSameType}
            onSelectSameColor={handleSelectSameColor}
            debugInfo={debugInfo}
            buildName={currentWorld?.name || "Untitled World"}
            onRenameBuild={handleRenameWorld}
            onSave={handleManualSave}
            saveStatus={saveStatus}
            lastSavedAt={lastSavedAt}
            onOpenMyBuilds={() => setIsMyWorldsOpen(true)}
            editorMode={editorMode}
            onModeChange={handleEditorModeChange}
            isPointerLocked={isPointerLocked}
            onMobileWalkInput={setMobileWalkInput}
            walkHeightPreset={walkHeightPreset}
            onWalkHeightChange={setWalkHeightPreset}
            onRecenterCamera={handleRecenterCamera}
            terrainBrushConfig={terrainBrushConfig}
            onTerrainBrushConfigChange={setTerrainBrushConfig}
            onOpenMap={() => setIsMapOpen(true)}
            onUnstuck={handleUnstuck}
            onOpenBlueprints={handleOpenBlueprints}
            onSaveAsBlueprint={handleSaveAsBlueprint}
            isBlueprintPlacement={blueprintPlacementState?.isActive}
            blueprintPlacementName={blueprintPlacementState?.name}
            blueprintPlacementBrickCount={blueprintPlacementState?.brickCount}
            blueprintRotationDeg={blueprintPlacementState?.rotationDeg || 0}
            onCancelBlueprintPlacement={handleCancelBlueprintPlacement}
            onDoneBlueprintPlacement={handleDoneBlueprintPlacement}
            onOpenEnvironmentSettings={() => setIsEnvironmentSettingsOpen(true)}
            environmentTime={environment.timeOfDay}
            weatherType={environment.weatherType}
          />
        </div>
      )}

      {/* Specialized Parts Browser Modal Dialog */}
      <PartsBrowser
        isOpen={isPartsBrowserOpen}
        onClose={() => setIsPartsBrowserOpen(false)}
        activeType={activeType}
        onSelectPart={handleSelectPart}
        activeColor={activeColor}
      />

      {/* My Worlds Library Modal Dialog */}
      <MyWorldsDialog
        isOpen={isMyWorldsOpen}
        onClose={() => setIsMyWorldsOpen(false)}
        onOpenWorld={handleOpenWorld}
        onNewWorld={() => setIsCreateWorldOpen(true)}
        currentWorldId={currentWorld?.id}
      />

      {/* Blueprint Library Modal Dialog */}
      <BlueprintLibrary
        isOpen={isBlueprintLibraryOpen}
        onClose={() => setIsBlueprintLibraryOpen(false)}
        onPlaceBlueprint={handlePlaceBlueprint}
      />

      {/* Save Selection as Blueprint Modal Dialog */}
      <SaveBlueprintDialog
        isOpen={isSaveBlueprintOpen}
        onClose={() => setIsSaveBlueprintOpen(false)}
        onSave={handleSaveBlueprintConfirm}
        defaultName="My Blueprint"
      />

      {/* Create World Modal Dialog */}
      <CreateWorldDialog
        isOpen={isCreateWorldOpen}
        onClose={() => setIsCreateWorldOpen(false)}
        onWorldCreated={handleWorldCreated}
      />

      {/* Unsaved Changes Warning Dialog */}
      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent className="border-red-400/40 bg-[#0d223f]/95 text-white shadow-2xl backdrop-blur-2xl sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-amber-300">
              Unsaved Changes
            </DialogTitle>
            <DialogDescription className="text-blue-100/80 text-sm mt-1">
              Your latest world edits could not be saved to your browser storage. If you leave now, recent changes might not be preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition cursor-pointer"
              onClick={() => setShowUnsavedDialog(false)}
            >
              Stay in World
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm transition cursor-pointer"
              onClick={() => {
                setShowUnsavedDialog(false);
                setGameMode("transitioning-to-home");
              }}
            >
              Leave Anyway
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Interactive 2D World Map Dialog */}
      {isMapOpen && (
        <WorldMapDialog
          open={isMapOpen}
          onOpenChange={setIsMapOpen}
          world={currentWorld ? {
            ...currentWorld,
            waypoints,
            homeSpawnId,
            exploredChunks,
          } : null}
          playerPosition={getPlayerMovementState().pos}
          playerYaw={getPlayerMovementState().yaw}
          onFastTravel={(dest) => {
            handleFastTravel(dest);
            setIsMapOpen(false);
          }}
          onAddWaypoint={handleAddWaypoint}
          onDeleteWaypoint={handleDeleteWaypoint}
          onRenameWaypoint={handleRenameWaypoint}
          onSetHomeSpawn={handleSetHomeSpawn}
        />
      )}

      {/* Fast Travel / Teleport Fade Transition Overlay */}
      {isTeleporting && (
        <div
          className="fixed inset-0 z-[9999] pointer-events-none bg-sky-200/50 backdrop-blur-sm animate-pulse transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* World Atmosphere, Weather & Audio Settings Dialog */}
      <EnvironmentSettingsDialog
        isOpen={isEnvironmentSettingsOpen}
        onClose={() => setIsEnvironmentSettingsOpen(false)}
        environment={environment}
        onEnvironmentChange={(newEnv) => {
          setEnvironment(newEnv);
          environmentRef.current = newEnv;
          setIsDirty(true);
          setSaveStatus("unsaved");
        }}
        graphicsQuality={graphicsQuality}
        onGraphicsQualityChange={setGraphicsQuality}
        reducedLightningFlash={reducedLightningFlash}
        onReducedLightningFlashChange={setReducedLightningFlash}
      />
    </main>
  );
}
