"use client";

import { useState, useEffect, useRef } from "react";
import {
  Compass,
  Sparkles,
  Dices,
  ChevronDown,
  ChevronUp,
  X,
  Play,
  Trees,
  Square,
  Mountain,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { WorldType, WorldSize, SavedWorld, getWorldStorageService } from "./WorldStorage";

interface CreateWorldDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onWorldCreated: (world: SavedWorld) => void;
}

const WORLD_NAME_SUGGESTIONS = [
  "Cloud Citadel",
  "Sunny Meadows",
  "Brickstone Valley",
  "Sky Haven",
  "Emerald Plateau",
  "Sapphire Isle",
  "Pinecone Hills",
  "Golden Ridge",
  "Starlight Island",
  "Endless Horizon",
];

interface WorldTypeInfo {
  type: WorldType;
  title: string;
  tagline: string;
  icon: typeof Mountain;
  color: string;
  gradient: string;
  description: string;
  defaultSize: WorldSize;
  sizes: Array<{ size: WorldSize; label: string; desc: string }>;
}

const WORLD_TYPES_CONFIG: Record<WorldType, WorldTypeInfo> = {
  island: {
    type: "island",
    title: "Floating Island",
    tagline: "Contained sky environment",
    icon: Mountain,
    color: "#38d866",
    gradient: "from-emerald-500/30 via-teal-500/20 to-sky-500/30",
    description: "A floating paradise surrounded by clouds. Organic rocky edges tapering into open sky.",
    defaultSize: "small",
    sizes: [
      { size: "small", label: "Small", desc: "64 × 64 studs • Fast & cozy" },
      { size: "medium", label: "Medium", desc: "128 × 128 studs • Towns & towers" },
      { size: "large", label: "Large", desc: "256 × 256 studs • Grand kingdoms" },
      { size: "huge", label: "Huge", desc: "512 × 512 studs • Massive showcase" },
    ],
  },
  flat: {
    type: "flat",
    title: "Flat World",
    tagline: "Expansive creative canvas",
    icon: Square,
    color: "#3ba2ff",
    gradient: "from-blue-500/30 via-indigo-500/20 to-cyan-500/30",
    description: "A smooth, level plane with zero terrain obstacles. Pure freedom to build anything.",
    defaultSize: "medium",
    sizes: [
      { size: "small", label: "Small", desc: "128 × 128 studs • Quick testing" },
      { size: "medium", label: "Medium", desc: "256 × 256 studs • Cities & roads" },
      { size: "large", label: "Large", desc: "512 × 512 studs • Enormous scale" },
      { size: "massive", label: "Massive", desc: "1024 × 1024 studs • Mega builds" },
      { size: "expanding", label: "Expanding", desc: "Endless • Dynamic chunk streaming" },
    ],
  },
  natural: {
    type: "natural",
    title: "Natural World",
    tagline: "Living procedural wilderness",
    icon: Trees,
    color: "#f59e0b",
    gradient: "from-amber-500/30 via-orange-500/20 to-emerald-500/30",
    description: "Rolling hills, plateaus, valleys, forests, and blue lakes generated deterministically from your seed.",
    defaultSize: "medium",
    sizes: [
      { size: "small", label: "Small", desc: "Valley & surrounding peaks" },
      { size: "medium", label: "Medium", desc: "Multiple hills & lakes" },
      { size: "large", label: "Large", desc: "Massive wilderness region" },
      { size: "expanding", label: "Expanding", desc: "Infinite exploration & discovery" },
    ],
  },
};

/**
 * Lightweight Canvas 2D rotating isometric preview
 */
function WorldPreviewCanvas({
  worldType,
  worldSize,
  seed,
}: {
  worldType: WorldType;
  worldSize: WorldSize;
  seed: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId: number;
    let angle = 0;

    const render = () => {
      angle += 0.012;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2 + 10;

      // Draw stylized preview based on worldType
      if (worldType === "island") {
        // Floating island with underside cone
        const radius = worldSize === "small" ? 54 : worldSize === "medium" ? 64 : 76;
        const taperDepth = radius * 0.7;

        ctx.save();
        ctx.translate(cx, cy);

        // Island shadow in cloud space
        ctx.beginPath();
        ctx.ellipse(0, taperDepth + 24, radius * 0.7, radius * 0.22, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 30, 80, 0.18)";
        ctx.fill();

        // Underside rock cone
        ctx.beginPath();
        ctx.moveTo(-radius * 0.95, -4);
        ctx.quadraticCurveTo(-radius * 0.4, taperDepth * 0.7, 0, taperDepth);
        ctx.quadraticCurveTo(radius * 0.4, taperDepth * 0.7, radius * 0.95, -4);
        ctx.closePath();
        const rockGrad = ctx.createLinearGradient(0, 0, 0, taperDepth);
        rockGrad.addColorStop(0, "#5a3a1f");
        rockGrad.addColorStop(0.35, "#3d4856");
        rockGrad.addColorStop(1, "#27303d");
        ctx.fillStyle = rockGrad;
        ctx.fill();

        // Green grass top surface
        ctx.beginPath();
        ctx.ellipse(0, -6, radius * 0.95, radius * 0.42, 0, 0, Math.PI * 2);
        const grassGrad = ctx.createLinearGradient(-radius, -radius * 0.4, radius, radius * 0.4);
        grassGrad.addColorStop(0, "#48e06f");
        grassGrad.addColorStop(1, "#28b548");
        ctx.fillStyle = grassGrad;
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Mini castle / house blocks on top
        const rotX = Math.cos(angle) * (radius * 0.35);
        const rotY = Math.sin(angle) * (radius * 0.16) - 10;
        ctx.fillStyle = "#ff3b45";
        ctx.fillRect(rotX - 7, rotY - 12, 14, 12);
        ctx.fillStyle = "#ffc72c";
        ctx.fillRect(rotX - 4, rotY - 18, 8, 6);

        ctx.restore();
      } else if (worldType === "flat") {
        // Expansive flat creative grid
        const span = 85;
        ctx.save();
        ctx.translate(cx, cy - 8);

        // Isometric diamond plane
        ctx.beginPath();
        ctx.moveTo(0, -span * 0.45);
        ctx.lineTo(span, 0);
        ctx.lineTo(0, span * 0.45);
        ctx.lineTo(-span, 0);
        ctx.closePath();

        const flatGrad = ctx.createLinearGradient(-span, 0, span, 0);
        flatGrad.addColorStop(0, "#32cc5c");
        flatGrad.addColorStop(1, "#22ab45");
        ctx.fillStyle = flatGrad;
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 3;
        ctx.stroke();

        // Grid lines
        ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
        ctx.lineWidth = 1;
        for (let i = -3; i <= 3; i++) {
          const step = (span / 4) * i;
          ctx.beginPath();
          ctx.moveTo(step, -span * 0.45 + Math.abs(step) * 0.45);
          ctx.lineTo(step, span * 0.45 - Math.abs(step) * 0.45);
          ctx.stroke();
        }

        ctx.restore();
      } else {
        // Natural world with rolling hills, trees, water
        const span = 85;
        ctx.save();
        ctx.translate(cx, cy - 6);

        // Water base
        ctx.beginPath();
        ctx.moveTo(0, -span * 0.45);
        ctx.lineTo(span, 0);
        ctx.lineTo(0, span * 0.45);
        ctx.lineTo(-span, 0);
        ctx.closePath();
        ctx.fillStyle = "#1e90ff";
        ctx.fill();

        // Hill 1
        ctx.beginPath();
        ctx.arc(-22, -4, 38, 0, Math.PI * 2);
        ctx.fillStyle = "#38d866";
        ctx.fill();

        // Hill 2
        ctx.beginPath();
        ctx.arc(26, 6, 32, 0, Math.PI * 2);
        ctx.fillStyle = "#27b850";
        ctx.fill();

        // Little trees
        const treeX = Math.cos(angle * 0.8) * 12 - 16;
        ctx.fillStyle = "#694025";
        ctx.fillRect(treeX - 2, -18, 4, 10);
        ctx.fillStyle = "#1e8438";
        ctx.beginPath();
        ctx.arc(treeX, -24, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [worldType, worldSize, seed]);

  return (
    <div className="relative w-full h-[180px] rounded-2xl overflow-hidden bg-gradient-to-b from-[#195392] to-[#0d3460] border border-white/20 shadow-inner flex items-center justify-center">
      <canvas ref={canvasRef} width={280} height={180} className="w-full h-full" />
      <span className="absolute bottom-2.5 left-3 text-[11px] font-extrabold uppercase tracking-wider text-blue-200/70 bg-black/30 px-2.5 py-1 rounded-full backdrop-blur-md">
        3D Preview • {worldType.toUpperCase()}
      </span>
    </div>
  );
}

export function CreateWorldDialog({
  isOpen,
  onClose,
  onWorldCreated,
}: CreateWorldDialogProps) {
  const [worldType, setWorldType] = useState<WorldType>("island");
  const [worldSize, setWorldSize] = useState<WorldSize>("small");
  const [name, setName] = useState("My World");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1000000000));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);

  // Auto-align default size when changing type
  const handleTypeChange = (type: WorldType) => {
    setWorldType(type);
    setWorldSize(WORLD_TYPES_CONFIG[type].defaultSize);
  };

  const handleRandomizeName = () => {
    const pick = WORLD_NAME_SUGGESTIONS[Math.floor(Math.random() * WORLD_NAME_SUGGESTIONS.length)];
    setName(pick);
  };

  const handleRandomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 1000000000));
  };

  const currentConfig = WORLD_TYPES_CONFIG[worldType];

  const handleCreate = async () => {
    setIsGenerating(true);
    setGenerationStep(1); // "Generating terrain..."

    const storage = getWorldStorageService();

    setTimeout(() => {
      setGenerationStep(2); // "Growing trees..."
    }, 450);

    setTimeout(() => {
      setGenerationStep(3); // "Preparing your world..."
    }, 850);

    setTimeout(async () => {
      try {
        const finalName = name.trim() || "My World";
        const newWorld = await storage.createNewWorld(finalName, worldType, worldSize, seed);
        setIsGenerating(false);
        onWorldCreated(newWorld);
        onClose();
      } catch (err) {
        console.error("Failed to create world:", err);
        setIsGenerating(false);
      }
    }, 1250);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isGenerating && onClose()}>
      <DialogContent className="create-world-dialog-panel border-white/30 bg-[#0c2a55]/95 text-white shadow-[0_30px_90px_rgba(0,18,50,.75)] backdrop-blur-3xl w-[calc(100vw-24px)] sm:max-w-[680px] max-h-[88dvh] flex flex-col p-0 overflow-hidden">
        {/* Dialog Header */}
        <DialogHeader className="p-4 sm:p-6 pb-4 border-b border-white/15 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-500 shadow-md shadow-emerald-500/30 text-stone-950">
                <Compass size={24} strokeWidth={2.8} />
              </span>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  CREATE WORLD
                </DialogTitle>
                <DialogDescription className="text-blue-200/80 text-xs font-semibold">
                  Select environment style and scale before entering Build Mode
                </DialogDescription>
              </div>
            </div>
            {!isGenerating && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Loading Generation Transition Overlay */}
        {isGenerating && (
          <div className="absolute inset-0 z-50 bg-[#092244]/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center mb-5 shadow-xl shadow-emerald-500/20">
              <Loader2 size={36} className="text-emerald-400 animate-spin" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2">Building Your World</h3>
            <p className="text-sm font-bold text-blue-200/80 min-h-[24px]">
              {generationStep === 1 && "Generating terrain elevations..."}
              {generationStep === 2 && "Planting trees and natural scenery..."}
              {generationStep === 3 && "Preparing chunk streaming & lighting..."}
            </p>
            <div className="w-48 h-2 rounded-full bg-white/10 mt-6 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-300 rounded-full"
                style={{ width: `${(generationStep / 3) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
          {/* World Name Input with Randomizer */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-blue-200 flex items-center justify-between">
              <span>World Name</span>
              <button
                type="button"
                onClick={handleRandomizeName}
                className="text-emerald-300 hover:text-emerald-200 flex items-center gap-1.5 cursor-pointer text-[11px] font-bold"
              >
                <Sparkles size={13} />
                <span>Random Name</span>
              </button>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={45}
                className="flex-1 px-4 py-3 rounded-2xl bg-white/10 border border-white/25 text-white font-bold text-base focus:outline-none focus:ring-2 focus:ring-emerald-400/70 focus:border-transparent transition shadow-inner"
                placeholder="Enter world name..."
              />
            </div>
          </div>

          {/* Interactive World Preview */}
          <WorldPreviewCanvas worldType={worldType} worldSize={worldSize} seed={seed} />

          {/* World Type Selection (3 Cards) */}
          <div className="space-y-2.5">
            <label className="text-xs font-black uppercase tracking-wider text-blue-200">
              World Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(Object.keys(WORLD_TYPES_CONFIG) as WorldType[]).map((type) => {
                const conf = WORLD_TYPES_CONFIG[type];
                const isSelected = worldType === type;
                const Icon = conf.icon;

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeChange(type)}
                    className={`relative text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-gradient-to-b from-white/20 to-white/10 border-emerald-400 shadow-[0_8px_24px_rgba(40,220,100,0.25)] ring-2 ring-emerald-400/50"
                        : "bg-white/5 border-white/15 hover:bg-white/10 hover:border-white/25"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="p-2 rounded-xl text-white shadow-sm"
                          style={{ backgroundColor: conf.color }}
                        >
                          <Icon size={18} strokeWidth={2.6} />
                        </span>
                        {isSelected && (
                          <CheckCircle2 size={18} className="text-emerald-400" />
                        )}
                      </div>
                      <h4 className="text-base font-black text-white">{conf.title}</h4>
                      <p className="text-[11px] font-semibold text-blue-200/80 mt-0.5">
                        {conf.tagline}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-blue-100/70 font-medium px-1">
              {currentConfig.description}
            </p>
          </div>

          {/* World Size Selector (Chips adapted to current type) */}
          <div className="space-y-2.5">
            <label className="text-xs font-black uppercase tracking-wider text-blue-200">
              World Size
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {currentConfig.sizes.map((s) => {
                const isSelected = worldSize === s.size;
                return (
                  <button
                    key={s.size}
                    type="button"
                    onClick={() => setWorldSize(s.size)}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      isSelected
                        ? "bg-emerald-500/25 border-emerald-400 text-white shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400"
                        : "bg-white/5 border-white/15 text-blue-100/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <div className="text-sm font-black text-white">{s.label}</div>
                    <div className="text-[10px] font-semibold text-blue-200/70 mt-0.5 line-clamp-1">
                      {s.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advanced Settings Collapsible (World Seed) */}
          <div className="border-t border-white/15 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="flex items-center justify-between w-full text-xs font-bold text-blue-200 hover:text-white transition cursor-pointer py-1"
            >
              <span>Advanced World Settings (Seed)</span>
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showAdvanced && (
              <div className="mt-3 p-4 rounded-2xl bg-black/20 border border-white/15 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-blue-200/80">World Seed</label>
                  <button
                    type="button"
                    onClick={handleRandomizeSeed}
                    className="text-xs text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Dices size={14} />
                    <span>Roll New Seed</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                  />
                </div>
                <p className="text-[11px] text-blue-200/60 font-medium">
                  The same seed and world settings generate the exact same terrain features and trees.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Dialog Footer Actions */}
        <div className="p-6 border-t border-white/15 flex items-center justify-between bg-black/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-5 py-2.5 rounded-2xl text-white/80 hover:text-white hover:bg-white/10 font-bold text-sm transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleCreate}
            disabled={isGenerating}
            className="px-7 py-3 rounded-2xl bg-gradient-to-b from-[#44e16d] to-[#1bb54b] hover:from-[#4df07a] hover:to-[#22c856] text-stone-950 font-black text-base shadow-[0_10px_25px_rgba(30,210,85,0.45)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Play size={18} fill="currentColor" strokeWidth={0} />
            <span>CREATE WORLD</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
