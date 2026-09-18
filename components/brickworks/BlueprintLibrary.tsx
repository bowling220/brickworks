"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Search,
  Star,
  MoreVertical,
  Copy,
  Edit3,
  Trash2,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BlueprintData,
  getBlueprintStorageService,
} from "./BlueprintStorage";

// ──────────────────────────────────────────────
// Save Blueprint Dialog
// ──────────────────────────────────────────────

export function SaveBlueprintDialog({
  isOpen,
  onClose,
  onSave,
  defaultName = "",
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  defaultName?: string;
}) {
  const [name, setName] = useState(defaultName || "My Blueprint");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.select();
    }
  }, [isOpen]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-24px)] sm:max-w-[380px] border-white/20 bg-[#0d1b2e]/95 text-white backdrop-blur-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black tracking-tight">
            Save as Blueprint
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-white/80">
            Blueprint Name
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
                if (e.key === "Escape") onClose();
              }}
              maxLength={80}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 placeholder:text-white/40"
              placeholder="e.g. Small House"
              autoFocus
              aria-label="Blueprint name"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────
// Rename Blueprint Dialog
// ──────────────────────────────────────────────

export function RenameBlueprintDialog({
  isOpen,
  currentName,
  onClose,
  onRename,
}: {
  isOpen: boolean;
  currentName: string;
  onClose: () => void;
  onRename: (newName: string) => void;
}) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.select();
    }
  }, [isOpen]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onRename(trimmed);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-24px)] sm:max-w-[380px] border-white/20 bg-[#0d1b2e]/95 text-white backdrop-blur-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black tracking-tight">
            Rename Blueprint
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") onClose();
            }}
            maxLength={80}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50"
            autoFocus
            aria-label="New Blueprint name"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={!name.trim()} className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Rename
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────
// Delete Blueprint Confirm Dialog
// ──────────────────────────────────────────────

export function DeleteBlueprintConfirmDialog({
  isOpen,
  blueprintName,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  blueprintName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-24px)] sm:max-w-[400px] border-white/20 bg-[#0d1b2e]/95 text-white backdrop-blur-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black tracking-tight text-red-400">
            Delete Blueprint
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-white/80 pt-1">
          Delete <strong className="text-white">&quot;{blueprintName}&quot;</strong>?
          This will not affect structures already placed from this Blueprint.
        </p>
        <div className="flex justify-end gap-2 pt-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onClose(); }}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-500 transition-colors"
          >
            Delete
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────
// Blueprint Card
// ──────────────────────────────────────────────

type SortMode = "recent" | "name" | "bricks";

function BlueprintCard({
  blueprint,
  onPlace,
  onToggleFavorite,
  onRename,
  onDuplicate,
  onDelete,
}: {
  blueprint: BlueprintData;
  onPlace: () => void;
  onToggleFavorite: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close overflow menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  // Dominant color swatch from first brick
  const dominantColor = blueprint.bricks[0]?.color || "#0a7cf5";

  return (
    <div className="bp-card group relative flex flex-col rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all overflow-hidden">
      {/* Color accent bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: dominantColor }} />

      <div className="flex flex-col gap-1.5 p-3">
        {/* Name + Favorite */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-white truncate leading-tight flex-1" title={blueprint.name}>
            {blueprint.name}
          </h3>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className="shrink-0 p-0.5 transition-colors"
            aria-label={blueprint.isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star
              size={14}
              strokeWidth={2.4}
              className={blueprint.isFavorite ? "fill-amber-400 text-amber-400" : "text-white/30 hover:text-amber-400/70"}
            />
          </button>
        </div>

        {/* Brick count & dims */}
        <p className="text-[11px] text-white/50 leading-tight">
          {blueprint.brickCount} brick{blueprint.brickCount !== 1 ? "s" : ""}
          {" · "}
          {blueprint.widthStuds}×{blueprint.lengthStuds} studs
        </p>

        {/* Actions */}
        <div className="flex items-center gap-1.5 mt-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPlace(); }}
            className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold text-black transition-colors"
            aria-label={`Place ${blueprint.name}`}
          >
            PLACE
          </button>

          {/* Overflow menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="rounded-lg p-1.5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Blueprint actions"
            >
              <MoreVertical size={14} strokeWidth={2.4} />
            </button>

            {showMenu && (
              <div className="absolute right-0 bottom-full mb-1 z-50 min-w-[130px] rounded-lg border border-white/15 bg-[#0d1b2e]/95 backdrop-blur-xl shadow-2xl py-1 text-xs">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10"
                  onClick={() => { setShowMenu(false); onRename(); }}
                >
                  <Edit3 size={12} /> Rename
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10"
                  onClick={() => { setShowMenu(false); onDuplicate(); }}
                >
                  <Copy size={12} /> Duplicate
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                  onClick={() => { setShowMenu(false); onDelete(); }}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Blueprint Library Dialog
// ──────────────────────────────────────────────

export function BlueprintLibrary({
  isOpen,
  onClose,
  onPlaceBlueprint,
}: {
  isOpen: boolean;
  onClose: () => void;
  onPlaceBlueprint: (blueprint: BlueprintData) => void;
}) {
  const [blueprints, setBlueprints] = useState<BlueprintData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  // Sub-dialog states
  const [renameTarget, setRenameTarget] = useState<BlueprintData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlueprintData | null>(null);

  const storage = useMemo(() => getBlueprintStorageService(), []);

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    storage.listBlueprints().then((list) => {
      if (!isCancelled) {
        setBlueprints(list);
        setIsLoading(false);
      }
    }).catch((err) => {
      console.error("[BRICKWORKS] Failed to load blueprints:", err);
      if (!isCancelled) {
        setIsLoading(false);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [isOpen, storage]);

  // Filter & sort
  const filtered = useMemo(() => {
    let list = blueprints;

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((bp) => bp.name.toLowerCase().includes(q));
    }

    // Favorites first, then sort
    const favs = list.filter((bp) => bp.isFavorite);
    const rest = list.filter((bp) => !bp.isFavorite);

    const sortFn = (a: BlueprintData, b: BlueprintData) => {
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "bricks") return b.brickCount - a.brickCount;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    };

    return [...favs.sort(sortFn), ...rest.sort(sortFn)];
  }, [blueprints, search, sortMode]);

  const handleToggleFavorite = useCallback(async (id: string) => {
    try {
      await storage.toggleFavorite(id);
      setBlueprints((prev) =>
        prev.map((bp) => (bp.id === id ? { ...bp, isFavorite: !bp.isFavorite } : bp))
      );
    } catch (err) {
      console.error("[BRICKWORKS] Failed to toggle favorite:", err);
    }
  }, [storage]);

  const handleDuplicate = useCallback(async (id: string) => {
    try {
      const dup = await storage.duplicateBlueprint(id);
      setBlueprints((prev) => [dup, ...prev]);
    } catch (err) {
      console.error("[BRICKWORKS] Failed to duplicate blueprint:", err);
    }
  }, [storage]);

  const handleRename = useCallback(async (id: string, newName: string) => {
    try {
      await storage.renameBlueprint(id, newName);
      setBlueprints((prev) =>
        prev.map((bp) => (bp.id === id ? { ...bp, name: newName, updatedAt: new Date().toISOString() } : bp))
      );
    } catch (err) {
      console.error("[BRICKWORKS] Failed to rename blueprint:", err);
    }
  }, [storage]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await storage.deleteBlueprint(id);
      setBlueprints((prev) => prev.filter((bp) => bp.id !== id));
    } catch (err) {
      console.error("[BRICKWORKS] Failed to delete blueprint:", err);
    }
  }, [storage]);

  const handlePlace = useCallback((bp: BlueprintData) => {
    onPlaceBlueprint(bp);
    onClose();
  }, [onPlaceBlueprint, onClose]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[calc(100vw-24px)] sm:max-w-[520px] max-h-[88dvh] border-white/15 bg-[#0b1628]/95 text-white backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
                <Layers size={20} strokeWidth={2.8} className="text-amber-400" />
                Blueprints
              </DialogTitle>
            </div>
            <p className="text-xs text-white/50 mt-0.5">
              Save structures you&apos;ve built and reuse them anywhere.
            </p>
          </DialogHeader>

          {/* Search + Sort Controls */}
          <div className="shrink-0 flex items-center gap-2 mt-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search blueprints..."
                className="w-full rounded-lg border border-white/15 bg-white/5 pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-amber-400/50 placeholder:text-white/30"
                aria-label="Search blueprints"
              />
            </div>
            <div className="flex rounded-lg border border-white/15 bg-white/5 p-0.5">
              {(
                [
                  { id: "recent", label: "Recent" },
                  { id: "name", label: "A-Z" },
                  { id: "bricks", label: "Size" },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSortMode(s.id)}
                  className={`rounded-md px-2 py-1 text-[10px] font-bold transition-all ${
                    sortMode === s.id
                      ? "bg-amber-500 text-black"
                      : "text-white/50 hover:text-white"
                  }`}
                  aria-label={`Sort by ${s.label}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Blueprint Grid */}
          <div className="flex-1 overflow-y-auto mt-3 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-white/40 text-sm">
                Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <Layers size={36} className="text-white/15" />
                {search.trim() ? (
                  <p className="text-sm text-white/40">
                    No blueprints matching &quot;{search.trim()}&quot;
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-white/50">No Blueprints yet</p>
                    <p className="text-xs text-white/35 max-w-[280px]">
                      Select part of a build in Select Mode and choose &quot;Save as Blueprint&quot; to save it here.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-2">
                {filtered.map((bp) => (
                  <BlueprintCard
                    key={bp.id}
                    blueprint={bp}
                    onPlace={() => handlePlace(bp)}
                    onToggleFavorite={() => handleToggleFavorite(bp.id)}
                    onRename={() => setRenameTarget(bp)}
                    onDuplicate={() => handleDuplicate(bp.id)}
                    onDelete={() => setDeleteTarget(bp)}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sub-dialogs */}
      {renameTarget && (
        <RenameBlueprintDialog
          isOpen={!!renameTarget}
          currentName={renameTarget.name}
          onClose={() => setRenameTarget(null)}
          onRename={(newName) => {
            handleRename(renameTarget.id, newName);
            setRenameTarget(null);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteBlueprintConfirmDialog
          isOpen={!!deleteTarget}
          blueprintName={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            handleDelete(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}
    </>
  );
}
