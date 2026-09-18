"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Star,
  X,
  Layers,
  Sparkles,
  Box,
  LayoutGrid,
  Building,
  TreePine,
  Maximize2,
  Sliders,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BRICK_CATALOG,
  BRICK_LIST,
  BRICK_CATEGORIES,
  BrickDefinition,
  BrickCategory,
  BrickTypeId,
} from "./BrickCatalog";

const FAVORITES_KEY = "brickworks_favorite_parts";
const RECENTS_KEY = "brickworks_recent_parts";

interface PartsBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  activeType: BrickTypeId;
  onSelectPart: (type: BrickTypeId) => void;
  activeColor?: string;
}

/**
 * Storage helpers for favorite and recent parts
 */
export function getFavoriteParts(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFavoriteParts(favs: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  } catch {
    // Ignore storage quota
  }
}

export function getRecentParts(): BrickTypeId[] {
  if (typeof window === "undefined") return ["brick_2x4", "brick_2x2", "brick_1x2", "plate_2x4", "slope_2x4", "tile_2x4"];
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : ["brick_2x4", "brick_2x2", "brick_1x2", "plate_2x4", "slope_2x4", "tile_2x4"];
  } catch {
    return ["brick_2x4", "brick_2x2", "brick_1x2", "plate_2x4", "slope_2x4", "tile_2x4"];
  }
}

export function trackRecentPart(type: BrickTypeId): void {
  if (typeof window === "undefined") return;
  try {
    const current = getRecentParts().filter((t) => t !== type);
    const updated = [type, ...current].slice(0, 10);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

/**
 * Mini 2D SVG preview of brick/plate/slope/tile/prop shape
 */
function PartThumbnail({
  def,
  color = "#e62b32",
}: {
  def: BrickDefinition;
  color?: string;
}) {
  const isPlate = def.category === "plate" || def.category === "tile" || def.category === "road";
  const isSlope = def.category === "slope";
  const isWindow = def.geometryType === "window";
  const isDoor = def.geometryType === "door_frame" || def.geometryType === "arch";
  const isColumn = def.geometryType === "column";

  const maxDimension = Math.max(def.widthStuds, def.lengthStuds, 2);
  const scale = 24 / maxDimension;

  const w = def.widthStuds * scale;
  const l = def.lengthStuds * scale;

  return (
    <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/10 overflow-hidden shadow-inner group-hover:border-white/20 transition-all">
      {isWindow ? (
        <div
          className="w-8 h-8 rounded border-2 border-white/80 flex items-center justify-center relative overflow-hidden"
          style={{ backgroundColor: `${color}33`, borderColor: color }}
        >
          <div className="w-5 h-5 rounded-sm bg-sky-300/40 border border-sky-200/60" />
        </div>
      ) : isDoor ? (
        <div
          className="w-7 h-9 rounded-t-full border-2 border-white/80 flex items-end justify-center relative pb-0.5"
          style={{ borderColor: color }}
        >
          <div className="w-4 h-6 rounded-t-full bg-black/40" />
        </div>
      ) : isColumn ? (
        <div
          className="w-4 h-9 rounded-sm border border-white/80 flex flex-col justify-between items-center py-0.5"
          style={{ backgroundColor: color, borderColor: "#ffffffaa" }}
        >
          <div className="w-5 h-1 bg-white/80 rounded-xs" />
          <div className="w-3 h-5 bg-white/20 rounded-xs" />
          <div className="w-5 h-1 bg-white/80 rounded-xs" />
        </div>
      ) : (
        <div
          className={`rounded-sm transition-transform group-hover:scale-105 flex items-center justify-center relative shadow-sm ${
            isSlope ? "clip-slope" : ""
          }`}
          style={{
            width: `${Math.max(w, 14)}px`,
            height: `${Math.max(l, 14)}px`,
            backgroundColor: color,
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: isPlate ? "3px" : "4px",
          }}
        >
          {def.hasTopStuds && (
            <div className="grid grid-cols-2 gap-0.5 p-0.5 pointer-events-none opacity-80">
              {Array.from({ length: Math.min(def.widthStuds * def.lengthStuds, 4) }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/60 shadow-xs" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PartsBrowser({
  isOpen,
  onClose,
  activeType,
  onSelectPart,
  activeColor = "#e62b32",
}: PartsBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState<BrickCategory | "all" | "favorites">("all");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFavorites(getFavoriteParts());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const toggleFavorite = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      saveFavoriteParts(next);
      return next;
    });
  }, []);

  const filteredParts = useMemo(() => {
    let list = BRICK_LIST;

    // Category filter
    if (selectedCategory === "favorites") {
      list = list.filter((p) => favorites.includes(p.id));
    } else if (selectedCategory !== "all") {
      list = list.filter((p) => p.category === selectedCategory);
    }

    // Search query filter
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        if (p.name.toLowerCase().includes(q)) return true;
        if (p.label.toLowerCase().includes(q)) return true;
        if (p.category.toLowerCase().includes(q)) return true;
        if (p.tags.some((t) => t.toLowerCase().includes(q))) return true;
        const dim = `${p.widthStuds}x${p.lengthStuds}`;
        const dimSpace = `${p.widthStuds} x ${p.lengthStuds}`;
        if (dim.includes(q) || dimSpace.includes(q)) return true;
        return false;
      });
    }

    return list;
  }, [selectedCategory, search, favorites]);

  const handleSelect = useCallback(
    (type: BrickTypeId) => {
      trackRecentPart(type);
      onSelectPart(type);
      onClose();
    },
    [onSelectPart, onClose]
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-24px)] sm:max-w-[720px] max-h-[88dvh] border-white/15 bg-[#0b1628]/95 text-white backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="p-4 pb-2 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
              <Box size={20} strokeWidth={2.8} className="text-amber-400" />
              Parts Browser
            </DialogTitle>
            <span className="text-xs text-white/40 font-semibold mr-6">
              {filteredParts.length} parts available
            </span>
          </div>

          {/* Search bar */}
          <div className="relative mt-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, size (e.g. '2x4', 'slope', 'window', 'door')..."
              className="w-full rounded-xl border border-white/15 bg-white/5 pl-9 pr-8 py-2 text-xs text-white outline-none focus:border-amber-400/60 focus:bg-white/10 placeholder:text-white/30 transition-colors"
              aria-label="Search parts"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === "all"
                  ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                  : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory("favorites")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === "favorites"
                  ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                  : "bg-white/5 text-amber-300/80 hover:text-amber-200 hover:bg-white/10"
              }`}
            >
              <Star size={12} fill={selectedCategory === "favorites" ? "#000" : "currentColor"} />
              Favorites ({favorites.length})
            </button>

            {BRICK_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    isSelected
                      ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                      : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Parts Grid */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {filteredParts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <Box size={36} className="text-white/20" />
              <p className="text-sm font-bold text-white/50">No parts found</p>
              <p className="text-xs text-white/30">Try a different search term or category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {filteredParts.map((def) => {
                const isSelected = def.id === activeType;
                const isFav = favorites.includes(def.id);

                return (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => handleSelect(def.id)}
                    className={`group relative flex flex-col p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-amber-400 bg-amber-500/15 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/40"
                        : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 hover:scale-[1.01]"
                    }`}
                  >
                    {/* Favorite star button */}
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(def.id, e)}
                      className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${
                        isFav ? "text-amber-400" : "text-white/20 hover:text-white/60"
                      }`}
                      aria-label={isFav ? "Remove favorite" : "Add to favorites"}
                    >
                      <Star size={13} fill={isFav ? "currentColor" : "none"} />
                    </button>

                    {/* Preview Thumbnail */}
                    <div className="flex items-center justify-center my-1.5">
                      <PartThumbnail def={def} color={activeColor} />
                    </div>

                    {/* Part Details */}
                    <div className="mt-1 flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                        {def.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                        <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white/70">
                          {def.widthStuds} × {def.lengthStuds}
                        </span>
                        <span className="capitalize">{def.category}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
