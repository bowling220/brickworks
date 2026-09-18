"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Compass,
  Plus,
  Trash2,
  Copy,
  Edit2,
  Check,
  X,
  Clock,
  Layers,
  Sparkles,
  Mountain,
  Trees,
  Square,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  WorldMetadata,
  SavedWorld,
  getWorldStorageService,
  WorldType,
} from "./WorldStorage";

interface MyWorldsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWorld: (world: SavedWorld) => void;
  onNewWorld: () => void;
  currentWorldId?: string | null;
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins === 1) return "1 min ago";
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  } catch {
    return "recently";
  }
}

function WorldTypeBadge({ type }: { type: WorldType }) {
  if (type === "island") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
        <Mountain size={11} strokeWidth={2.6} />
        <span>Island</span>
      </span>
    );
  }
  if (type === "flat") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
        <Square size={11} strokeWidth={2.6} />
        <span>Flat</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
      <Trees size={11} strokeWidth={2.6} />
      <span>Natural</span>
    </span>
  );
}

export function MyWorldsDialog({
  isOpen,
  onClose,
  onOpenWorld,
  onNewWorld,
  currentWorldId,
}: MyWorldsDialogProps) {
  const [worlds, setWorlds] = useState<WorldMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const storage = getWorldStorageService();

  const refreshWorlds = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const list = await storage.listWorlds();
      setWorlds(list);
    } catch (err) {
      setErrorMessage(`Failed to load worlds: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [storage]);

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;

    storage.listWorlds()
      .then((list) => {
        if (!ignore) {
          setWorlds(list);
          setRenamingId(null);
          setDeleteConfirmId(null);
          setErrorMessage(null);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMessage(`Failed to load worlds: ${err instanceof Error ? err.message : String(err)}`);
        }
      });

    return () => {
      ignore = true;
    };
  }, [isOpen, storage]);

  const handleOpen = async (id: string) => {
    try {
      const loaded = await storage.loadWorld(id);
      if (loaded) {
        onOpenWorld(loaded);
        onClose();
      } else {
        setErrorMessage("World could not be found.");
      }
    } catch (err) {
      setErrorMessage(`Could not open world: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleStartRename = (meta: WorldMetadata) => {
    setRenamingId(meta.id);
    setRenameText(meta.name);
  };

  const handleConfirmRename = async (id: string) => {
    const trimmed = renameText.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }

    try {
      await storage.renameWorld(id, trimmed);
      setRenamingId(null);
      await refreshWorlds();
    } catch (err) {
      setErrorMessage(`Could not rename: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await storage.duplicateWorld(id);
      await refreshWorlds();
    } catch (err) {
      setErrorMessage(`Could not duplicate: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await storage.deleteWorld(id);
      setDeleteConfirmId(null);
      await refreshWorlds();
    } catch (err) {
      setErrorMessage(`Could not delete: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="my-builds-dialog-panel border-white/35 bg-[#0a2e5c]/95 text-white shadow-[0_30px_90px_rgba(0,18,50,.65)] backdrop-blur-3xl sm:max-w-[660px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-white/15">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 shadow-md shadow-amber-500/30 text-stone-900">
                <Compass size={22} strokeWidth={2.8} />
              </span>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  MY WORLDS
                </DialogTitle>
                <DialogDescription className="text-blue-200/80 text-xs font-semibold">
                  Saved locally in your browser storage
                </DialogDescription>
              </div>
            </div>

            {/* Create New World Button */}
            <button
              type="button"
              className="new-build-modal-button"
              onClick={() => {
                onNewWorld();
                onClose();
              }}
              aria-label="Create new world"
            >
              <Plus size={18} strokeWidth={3} />
              <span>Create World</span>
            </button>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-200 text-xs font-bold">
            {errorMessage}
          </div>
        )}

        {/* Worlds List Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
          {isLoading ? (
            <div className="py-12 text-center text-blue-200/70 font-bold flex flex-col items-center gap-3">
              <span className="animate-spin w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full" />
              <span>Loading saved worlds...</span>
            </div>
          ) : worlds.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center gap-4 text-blue-100/70">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-amber-300">
                <Sparkles size={32} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">No saved worlds yet</h3>
                <p className="text-xs text-blue-200/70 mt-1 max-w-[280px]">
                  Create a floating island or open world and start building your adventure!
                </p>
              </div>
              <button
                type="button"
                className="new-build-modal-button mt-2"
                onClick={() => {
                  onNewWorld();
                  onClose();
                }}
              >
                <Plus size={18} strokeWidth={3} />
                <span>Create Your First World</span>
              </button>
            </div>
          ) : (
            worlds.map((w) => {
              const isCurrent = w.id === currentWorldId;
              const isRenaming = renamingId === w.id;
              const isDeleting = deleteConfirmId === w.id;

              return (
                <div
                  key={w.id}
                  className={`build-card-item ${isCurrent ? "is-current-build" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleConfirmRename(w.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-white/15 border border-white/30 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            maxLength={80}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleConfirmRename(w.id)}
                            className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-400 transition cursor-pointer"
                            aria-label="Confirm rename"
                          >
                            <Check size={14} strokeWidth={3} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingId(null)}
                            className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition cursor-pointer"
                            aria-label="Cancel rename"
                          >
                            <X size={14} strokeWidth={3} />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-black text-white truncate max-w-[280px]">
                              {w.name}
                            </h4>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 text-[10px] font-black tracking-wider uppercase">
                                Current
                              </span>
                            )}
                            <WorldTypeBadge type={w.worldType} />
                            <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-blue-200 text-[10px] font-extrabold capitalize">
                              {w.worldSize}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-xs text-blue-200/70 font-semibold">
                            <span className="flex items-center gap-1">
                              <Layers size={13} className="text-amber-300" />
                              <span>{w.brickCount.toLocaleString()} bricks</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={13} />
                              <span>{formatRelativeTime(w.updatedAt)}</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      {isDeleting ? (
                        <div className="flex items-center gap-2 bg-red-950/60 p-1.5 rounded-xl border border-red-500/40">
                          <span className="text-xs text-red-200 font-bold px-1">Delete?</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(w.id)}
                            className="px-2 py-1 rounded-lg bg-red-600 text-white hover:bg-red-500 text-xs font-black transition cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 rounded-lg bg-white/10 text-white hover:bg-white/20 text-xs font-bold transition cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartRename(w)}
                            className="p-2 rounded-xl text-blue-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
                            title="Rename world"
                            aria-label="Rename world"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(w.id)}
                            className="p-2 rounded-xl text-blue-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
                            title="Duplicate world"
                            aria-label="Duplicate world"
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(w.id)}
                            className="p-2 rounded-xl text-blue-200 hover:text-red-300 hover:bg-red-500/20 transition cursor-pointer"
                            title="Delete world"
                            aria-label="Delete world"
                          >
                            <Trash2 size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpen(w.id)}
                            className="ml-1 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-stone-950 font-black text-xs shadow-md shadow-emerald-500/25 transition cursor-pointer"
                          >
                            PLAY
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Backward-compatible alias
export const MyBuildsDialog = MyWorldsDialog;
