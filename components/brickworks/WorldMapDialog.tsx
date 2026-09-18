"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapPin,
  Compass,
  Plus,
  Trash2,
  Edit2,
  Home,
  Star,
  ZoomIn,
  ZoomOut,
  LocateFixed,
  Zap,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SavedWorld, Waypoint } from "./WorldStorage";
import { CHUNK_SIZE, STUD_PITCH } from "./GridSystem";
import { sampleTerrain, WATER_LEVEL } from "./TerrainGenerator";

interface WorldMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  world: SavedWorld | null;
  playerPosition?: [number, number, number];
  playerYaw?: number;
  onFastTravel: (targetPos: [number, number, number]) => void;
  onAddWaypoint: (name: string, pos: [number, number, number]) => void;
  onDeleteWaypoint: (id: string) => void;
  onRenameWaypoint: (id: string, name: string) => void;
  onSetHomeSpawn: (id: string) => void;
}

export function WorldMapDialog({
  open,
  onOpenChange,
  world,
  playerPosition = [0, 0, 0],
  playerYaw = 0,
  onFastTravel,
  onAddWaypoint,
  onDeleteWaypoint,
  onRenameWaypoint,
  onSetHomeSpawn,
}: WorldMapDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Map view camera state in world units
  const [panX, setPanX] = useState<number>(playerPosition[0] || 0);
  const [panZ, setPanZ] = useState<number>(playerPosition[2] || 0);
  const [zoom, setZoom] = useState<number>(8); // pixels per world meter (zoom range: 3 to 24)

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panZ: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panZ: 0,
  });

  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const [newWaypointName, setNewWaypointName] = useState("");
  const [isCreatingWaypoint, setIsCreatingWaypoint] = useState(false);
  const [editingWaypointId, setEditingWaypointId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const chunkSpan = CHUNK_SIZE * STUD_PITCH; // 12.8m

  // Reset map position to player location whenever dialog is opened
  useEffect(() => {
    if (open) {
      const frameId = requestAnimationFrame(() => {
        setPanX(playerPosition[0] || 0);
        setPanZ(playerPosition[2] || 0);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [open, playerPosition]);

  // Center functions
  const centerOnPlayer = useCallback(() => {
    setPanX(playerPosition[0] || 0);
    setPanZ(playerPosition[2] || 0);
    setZoom(10);
  }, [playerPosition]);

  const centerOnSpawn = useCallback(() => {
    setPanX(0);
    setPanZ(0);
    setZoom(10);
  }, []);

  // Canvas Mouse Pan & Zoom Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX,
      panZ,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const dx = (e.clientX - dragStartRef.current.x) / zoom;
    const dz = (e.clientY - dragStartRef.current.y) / zoom;
    setPanX(dragStartRef.current.panX - dx);
    setPanZ(dragStartRef.current.panZ - dz);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.2 : 0.833;
    setZoom((prev) => Math.max(3, Math.min(24, prev * zoomFactor)));
  };

  // Render Map Canvas
  useEffect(() => {
    if (!open || !canvasRef.current || !world) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cz = height / 2;

    // 1. Background (Unexplored void/fog)
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, width, height);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    const gridStep = chunkSpan * zoom;
    const startX = (cx - panX * zoom) % gridStep;
    const startZ = (cz - panZ * zoom) % gridStep;

    for (let x = startX; x < width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = startZ; y < height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const exploredSet = new Set(world.exploredChunks || ["0,0"]);

    // 2. Draw Explored Chunks
    for (const chunkKey of exploredSet) {
      const parts = chunkKey.split(",");
      const chunkX = parseInt(parts[0], 10);
      const chunkZ = parseInt(parts[1], 10);

      const chunkOriginX = chunkX * chunkSpan;
      const chunkOriginZ = chunkZ * chunkSpan;

      const screenX0 = cx + (chunkOriginX - panX) * zoom;
      const screenZ0 = cz + (chunkOriginZ - panZ) * zoom;
      const screenSpan = chunkSpan * zoom;

      // Frustum culling for offscreen chunks
      if (
        screenX0 + screenSpan < 0 ||
        screenX0 > width ||
        screenZ0 + screenSpan < 0 ||
        screenZ0 > height
      ) {
        continue;
      }

      // Draw 4x4 sub-quads per chunk for rich terrain representation
      const subRes = 4;
      const subStep = chunkSpan / subRes;
      const subScreenStep = screenSpan / subRes;
      const terrainMod = world.chunks?.[chunkKey]?.terrainMod;

      for (let iz = 0; iz < subRes; iz++) {
        for (let ix = 0; ix < subRes; ix++) {
          const sampleWx = chunkOriginX + (ix + 0.5) * subStep;
          const sampleWz = chunkOriginZ + (iz + 0.5) * subStep;

          const baseSample = sampleTerrain(world.worldType, world.worldSize, world.seed, sampleWx, sampleWz);
          if (baseSample.isVoid) continue;

          // Check for modified material or height
          const vertIdx = Math.floor((iz / subRes) * 8) * 9 + Math.floor((ix / subRes) * 8);
          const mat = terrainMod?.materials?.[vertIdx] || baseSample.surfaceType;
          const h = terrainMod?.heights?.[vertIdx] !== undefined ? terrainMod.heights[vertIdx] : baseSample.heightWorld;

          let color = "#22c55e"; // Grass
          if (mat === "water" || h <= WATER_LEVEL + 0.05) {
            color = "#0284c7";
          } else if (mat === "rock") {
            color = "#475569";
          } else if (mat === "soil") {
            color = "#78350f";
          } else if (mat === "sand") {
            color = "#d97706";
          }

          // Subtle elevation shading
          const shade = Math.max(-0.25, Math.min(0.25, h * 0.03));
          ctx.fillStyle = color;
          ctx.fillRect(
            screenX0 + ix * subScreenStep,
            screenZ0 + iz * subScreenStep,
            subScreenStep + 0.5,
            subScreenStep + 0.5
          );

          if (shade > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${shade})`;
            ctx.fillRect(
              screenX0 + ix * subScreenStep,
              screenZ0 + iz * subScreenStep,
              subScreenStep + 0.5,
              subScreenStep + 0.5
            );
          } else if (shade < 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${-shade})`;
            ctx.fillRect(
              screenX0 + ix * subScreenStep,
              screenZ0 + iz * subScreenStep,
              subScreenStep + 0.5,
              subScreenStep + 0.5
            );
          }
        }
      }

      // Chunk boundary indicator
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.strokeRect(screenX0, screenZ0, screenSpan, screenSpan);
    }

    // 3. Draw World Spawn Marker
    const spawnSx = cx + (0 - panX) * zoom;
    const spawnSz = cz + (0 - panZ) * zoom;
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(spawnSx, spawnSz, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 4. Draw Waypoints
    const waypoints = world.waypoints || [];
    for (const wp of waypoints) {
      const sx = cx + (wp.worldX - panX) * zoom;
      const sz = cz + (wp.worldZ - panZ) * zoom;

      // Outer glow for selected waypoint
      if (wp.id === selectedWaypointId) {
        ctx.fillStyle = "rgba(250, 204, 21, 0.35)";
        ctx.beginPath();
        ctx.arc(sx, sz, 13, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = wp.isHome ? "#38bdf8" : wp.color || "#f43f5e";
      ctx.beginPath();
      ctx.arc(sx, sz, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Waypoint Name label
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 4;
      ctx.fillText(wp.name, sx, sz - 9);
      ctx.shadowBlur = 0;
    }

    // 5. Draw Player Position & Direction Arrow
    const px = cx + (playerPosition[0] - panX) * zoom;
    const pz = cz + (playerPosition[2] - panZ) * zoom;

    ctx.save();
    ctx.translate(px, pz);
    // In three.js standard, yaw = 0 faces -Z (North), yaw = PI/2 faces -X (West)
    // Canvas standard: 0 is right (+X), PI/2 is down (+Z).
    // Camera yaw in canvas space:
    ctx.rotate(playerYaw + Math.PI);

    // Player Direction Indicator
    ctx.fillStyle = "#06b6d4";
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(-6, -7);
    ctx.lineTo(0, -3);
    ctx.lineTo(6, -7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Player Center Dot
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(px, pz, 2.5, 0, Math.PI * 2);
    ctx.fill();

  }, [open, world, panX, panZ, zoom, playerPosition, playerYaw, selectedWaypointId, chunkSpan]);

  const handleCreateWaypoint = () => {
    const name = newWaypointName.trim() || `Waypoint ${(world?.waypoints?.length || 0) + 1}`;
    onAddWaypoint(name, [playerPosition[0], playerPosition[1], playerPosition[2]]);
    setNewWaypointName("");
    setIsCreatingWaypoint(false);
  };

  const handleStartRename = (wp: Waypoint) => {
    setEditingWaypointId(wp.id);
    setEditingName(wp.name);
  };

  const handleConfirmRename = (id: string) => {
    if (editingName.trim()) {
      onRenameWaypoint(id, editingName.trim());
    }
    setEditingWaypointId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-24px)] sm:max-w-4xl max-h-[88dvh] flex flex-col p-0 overflow-hidden bg-slate-950/95 border-white/10 text-white shadow-2xl backdrop-blur-xl">
        <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <Compass className="text-amber-400 shrink-0" size={20} />
            <DialogTitle className="text-lg font-bold text-white tracking-wide">
              WORLD MAP
            </DialogTitle>
            <span className="text-xs text-slate-400 font-mono ml-2 truncate">
              {world?.name} • {world?.exploredChunks?.length || 1} Chunks Explored
            </span>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto mr-6 sm:mr-6">
            <button
              onClick={() => setZoom((prev) => Math.min(24, prev * 1.3))}
              className="p-1.5 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={() => setZoom((prev) => Math.max(3, prev * 0.77))}
              className="p-1.5 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={centerOnPlayer}
              className="p-1.5 rounded-md hover:bg-white/10 text-cyan-400 hover:text-cyan-300 transition-colors"
              title="Center on Player"
            >
              <LocateFixed size={16} />
            </button>
            <button
              onClick={centerOnSpawn}
              className="p-1.5 rounded-md hover:bg-white/10 text-amber-400 hover:text-amber-300 transition-colors"
              title="Center on World Spawn"
            >
              <Star size={16} />
            </button>
          </div>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 min-h-[360px] sm:min-h-[460px] overflow-hidden">
          {/* Interactive Map Canvas */}
          <div className="relative flex-1 min-h-[220px] bg-slate-950 overflow-hidden cursor-grab active:cursor-grabbing">
            <canvas
              ref={canvasRef}
              width={640}
              height={500}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              className="w-full h-full block select-none"
            />

            {/* Bottom Left Legend */}
            <div className="absolute bottom-3 left-3 pointer-events-none flex items-center gap-3 rounded-md bg-slate-900/80 px-3 py-1.5 text-[11px] font-mono text-slate-300 backdrop-blur-md border border-white/10">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400" />
                Player
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
                Spawn
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500" />
                Waypoint
              </span>
            </div>
          </div>

          {/* Waypoints Management Panel */}
          <div className="w-full md:w-72 border-t md:border-t-0 md:border-l border-white/10 bg-slate-900/50 flex flex-col p-3 sm:p-4 max-h-[200px] md:max-h-none overflow-y-auto shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={13} className="text-amber-400" />
                Waypoints
              </h3>
              {!isCreatingWaypoint && (
                <button
                  onClick={() => setIsCreatingWaypoint(true)}
                  className="flex items-center gap-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2 py-1 text-xs font-semibold transition-colors"
                >
                  <Plus size={12} />
                  New
                </button>
              )}
            </div>

            {/* Create Waypoint inline form */}
            {isCreatingWaypoint && (
              <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
                <div className="text-xs font-medium text-amber-200 mb-1.5">Add Waypoint at Player</div>
                <input
                  type="text"
                  placeholder="e.g. Castle, Town, Lake..."
                  value={newWaypointName}
                  onChange={(e) => setNewWaypointName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateWaypoint()}
                  className="w-full rounded border border-white/20 bg-slate-950 px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-400 mb-2"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => setIsCreatingWaypoint(false)}
                    className="rounded px-2 py-1 text-[11px] text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateWaypoint}
                    className="rounded bg-amber-500 hover:bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-slate-950"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Waypoints List */}
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {/* World Spawn (Permanent) */}
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5 hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Star size={12} className="text-amber-400" />
                    World Spawn
                  </span>
                  <button
                    onClick={() => {
                      onFastTravel([0, 0.5, 0]);
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-2 py-0.5 text-[11px] font-semibold transition-colors"
                  >
                    <Zap size={11} />
                    Travel
                  </button>
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-1">X 0 • Y 0.5 • Z 0</div>
              </div>

              {/* Custom Waypoints */}
              {(world?.waypoints || [])
                .filter((w) => w.id !== "spawn_waypoint")
                .map((wp) => (
                  <div
                    key={wp.id}
                    onClick={() => {
                      setSelectedWaypointId(wp.id);
                      setPanX(wp.worldX);
                      setPanZ(wp.worldZ);
                    }}
                    className={`rounded-lg border p-2.5 cursor-pointer transition-colors ${
                      selectedWaypointId === wp.id
                        ? "border-amber-400/50 bg-amber-400/10"
                        : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {editingWaypointId === wp.id ? (
                        <div className="flex items-center gap-1 flex-1 mr-2">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleConfirmRename(wp.id)}
                            className="w-full rounded border border-white/30 bg-slate-950 px-1.5 py-0.5 text-xs text-white"
                            autoFocus
                          />
                          <button
                            onClick={() => handleConfirmRename(wp.id)}
                            className="text-[10px] text-amber-300 hover:text-white"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-white flex items-center gap-1.5 truncate">
                          {wp.isHome ? (
                            <Home size={12} className="text-cyan-400 shrink-0" />
                          ) : (
                            <MapPin size={12} className="text-rose-400 shrink-0" />
                          )}
                          {wp.name}
                        </span>
                      )}

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onFastTravel([wp.worldX, wp.worldY, wp.worldZ]);
                            onOpenChange(false);
                          }}
                          className="flex items-center gap-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-1.5 py-0.5 text-[10px] font-semibold transition-colors"
                          title="Fast Travel"
                        >
                          <Zap size={10} />
                          Travel
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRename(wp);
                          }}
                          className="p-1 text-slate-400 hover:text-white transition-colors"
                          title="Rename"
                        >
                          <Edit2 size={11} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteWaypoint(wp.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1">
                      <span>
                        X {Math.round(wp.worldX)} • Y {wp.worldY.toFixed(1)} • Z {Math.round(wp.worldZ)}
                      </span>
                      {!wp.isHome && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetHomeSpawn(wp.id);
                          }}
                          className="text-slate-400 hover:text-cyan-300 font-sans"
                        >
                          Set Home
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
