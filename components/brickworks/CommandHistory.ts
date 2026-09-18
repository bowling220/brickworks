import { BrickData, BrickRotation } from "./GridSystem";
import { BrickTypeId } from "./BrickCatalog";
import { ChunkTerrainMod } from "./WorldStorage";

export interface BrickTransform {
  gridX: number;
  gridY: number;
  gridZ: number;
  rotation: BrickRotation;
}

export interface BrickChange {
  id: string;
  oldState: BrickTransform;
  newState: BrickTransform;
}

export interface BuildCommand {
  type: "place" | "delete" | "move" | "terrain" | "recolor" | "replace";
  description: string;
  execute: (
    bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ) => void;
  undo: (
    bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ) => void;
  affectedBrickIds: string[];
}

/**
 * Command for placing a new brick
 */
export class PlaceBrickCommand implements BuildCommand {
  type = "place" as const;
  description: string;
  affectedBrickIds: string[];

  constructor(public brick: BrickData) {
    this.description = `Place ${brick.type}`;
    this.affectedBrickIds = [brick.id];
  }

  execute(
    _bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ) {
    setBricks((prev) => {
      if (prev.some((b) => b.id === this.brick.id)) return prev;
      return [...prev, this.brick];
    });
  }

  undo(
    _bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ) {
    setBricks((prev) => prev.filter((b) => b.id !== this.brick.id));
  }
}

/**
 * Command for deleting a brick
 */
export class DeleteBrickCommand implements BuildCommand {
  type = "delete" as const;
  description: string;
  affectedBrickIds: string[];

  constructor(public brick: BrickData) {
    this.description = `Delete ${brick.type}`;
    this.affectedBrickIds = [brick.id];
  }

  execute(
    _bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ) {
    setBricks((prev) => prev.filter((b) => b.id !== this.brick.id));
  }

  undo(
    _bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ) {
    setBricks((prev) => {
      if (prev.some((b) => b.id === this.brick.id)) return prev;
      return [...prev, this.brick];
    });
  }
}

/**
 * Command for placing multiple bricks at once (Duplicate, Paste)
 */
export class PlaceGroupCommand implements BuildCommand {
  type = "place" as const;
  description: string;
  affectedBrickIds: string[];

  constructor(public bricks: BrickData[]) {
    this.description = `Place group (${bricks.length} bricks)`;
    this.affectedBrickIds = bricks.map((b) => b.id);
  }

  execute(
    _bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ) {
    setBricks((prev) => {
      const existingIds = new Set(prev.map((b) => b.id));
      const toAdd = this.bricks.filter((b) => !existingIds.has(b.id));
      return [...prev, ...toAdd];
    });
  }

  undo(
    _bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ) {
    const removeSet = new Set(this.affectedBrickIds);
    setBricks((prev) => prev.filter((b) => !removeSet.has(b.id)));
  }
}

/**
 * Command for deleting multiple bricks at once
 */
export class DeleteGroupCommand implements BuildCommand {
  type = "delete" as const;
  description: string;
  affectedBrickIds: string[];

  constructor(public bricks: BrickData[]) {
    this.description = `Delete group (${bricks.length} bricks)`;
    this.affectedBrickIds = bricks.map((b) => b.id);
  }

  execute(
    _bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ) {
    const removeSet = new Set(this.affectedBrickIds);
    setBricks((prev) => prev.filter((b) => !removeSet.has(b.id)));
  }

  undo(
    _bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ) {
    setBricks((prev) => {
      const existingIds = new Set(prev.map((b) => b.id));
      const toRestore = this.bricks.filter((b) => !existingIds.has(b.id));
      return [...prev, ...toRestore];
    });
  }
}

/**
 * Command for moving one or more bricks (prepared for future multi-brick operations)
 */
export class MoveBrickCommand implements BuildCommand {
  type = "move" as const;
  description: string;
  affectedBrickIds: string[];

  constructor(public changes: BrickChange[]) {
    this.description = `Move ${changes.length} brick${changes.length > 1 ? "s" : ""}`;
    this.affectedBrickIds = changes.map((c) => c.id);
  }

  execute(
    _bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ) {
    const changeMap = new Map(this.changes.map((c) => [c.id, c]));
    setBricks((prev) =>
      prev.map((brick) => {
        const change = changeMap.get(brick.id);
        if (!change) return brick;
        return {
          ...brick,
          gridX: change.newState.gridX,
          gridY: change.newState.gridY,
          gridZ: change.newState.gridZ,
          rotation: change.newState.rotation,
        };
      })
    );
  }

  undo(
    _bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ) {
    const changeMap = new Map(this.changes.map((c) => [c.id, c]));
    setBricks((prev) =>
      prev.map((brick) => {
        const change = changeMap.get(brick.id);
        if (!change) return brick;
        return {
          ...brick,
          gridX: change.oldState.gridX,
          gridY: change.oldState.gridY,
          gridZ: change.oldState.gridZ,
          rotation: change.oldState.rotation,
        };
      })
    );
  }
}

export interface BrickColorChange {
  id: string;
  oldColor: string;
  newColor: string;
}

/**
 * Command for recoloring multiple bricks at once
 */
export class RecolorGroupCommand implements BuildCommand {
  type = "recolor" as const;
  description: string;
  affectedBrickIds: string[];

  constructor(public changes: BrickColorChange[]) {
    this.description = `Recolor ${changes.length} bricks`;
    this.affectedBrickIds = changes.map((c) => c.id);
  }

  execute(
    _bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ) {
    const changeMap = new Map(this.changes.map((c) => [c.id, c.newColor]));
    setBricks((prev) =>
      prev.map((b) => {
        const newColor = changeMap.get(b.id);
        if (newColor) return { ...b, color: newColor };
        return b;
      })
    );
  }

  undo(
    _bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ) {
    const changeMap = new Map(this.changes.map((c) => [c.id, c.oldColor]));
    setBricks((prev) =>
      prev.map((b) => {
        const oldColor = changeMap.get(b.id);
        if (oldColor) return { ...b, color: oldColor };
        return b;
      })
    );
  }
}

export interface BrickReplaceChange {
  id: string;
  oldType: BrickTypeId;
  newType: BrickTypeId;
  oldColor: string;
  newColor: string;
}

/**
 * Command for replacing multiple parts with a new part type/color at once
 */
export class ReplacePartsCommand implements BuildCommand {
  type = "replace" as const;
  description: string;
  affectedBrickIds: string[];

  constructor(public changes: BrickReplaceChange[]) {
    this.description = `Replace ${changes.length} parts`;
    this.affectedBrickIds = changes.map((c) => c.id);
  }

  execute(
    _bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ) {
    const changeMap = new Map(this.changes.map((c) => [c.id, c]));
    setBricks((prev) =>
      prev.map((b) => {
        const change = changeMap.get(b.id);
        if (change) return { ...b, type: change.newType, color: change.newColor };
        return b;
      })
    );
  }

  undo(
    _bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ) {
    const changeMap = new Map(this.changes.map((c) => [c.id, c]));
    setBricks((prev) =>
      prev.map((b) => {
        const change = changeMap.get(b.id);
        if (change) return { ...b, type: change.oldType, color: change.oldColor };
        return b;
      })
    );
  }
}

/**
 * Manages action history with configurable maximum capacity (default 150)
 */
export class CommandHistory {
  private undoStack: BuildCommand[] = [];
  private redoStack: BuildCommand[] = [];
  private maxCapacity: number;

  constructor(maxCapacity = 150) {
    this.maxCapacity = maxCapacity;
  }

  push(command: BuildCommand) {
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxCapacity) {
      this.undoStack.shift(); // Discard oldest entry
    }
    this.redoStack = []; // Clear redo stack on new action
  }

  undo(
    bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ): BuildCommand | null {
    const command = this.undoStack.pop();
    if (!command) return null;

    command.undo(bricks, setBricks);
    this.redoStack.push(command);
    return command;
  }

  redo(
    bricks: BrickData[],
    setBricks: (updater: (prev: BrickData[]) => BrickData[]) => void
  ): BuildCommand | null {
    const command = this.redoStack.pop();
    if (!command) return null;

    command.execute(bricks, setBricks);
    this.undoStack.push(command);
    return command;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

/**
 * Command for continuous terrain brush strokes (Raise, Lower, Flatten, Smooth, Paint)
 */
export class TerrainEditCommand implements BuildCommand {
  type = "terrain" as const;
  description: string;
  affectedBrickIds: string[] = [];

  constructor(
    public tool: string,
    public affectedChunkKeys: string[],
    public beforeMods: Record<string, ChunkTerrainMod | undefined>,
    public afterMods: Record<string, ChunkTerrainMod>,
    public applyMods: (mods: Record<string, ChunkTerrainMod | undefined>) => void
  ) {
    this.description = `Terrain ${tool}`;
  }

  execute() {
    this.applyMods(this.afterMods);
  }

  undo() {
    this.applyMods(this.beforeMods);
  }
}
