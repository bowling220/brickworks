type AnimationUpdateCallback = (settlingBrickOffsets: Map<string, number>) => void;

interface ActiveAnimation {
  startTime: number;
  durationMs: number;
}

/**
 * Centralized high-performance animation manager for brick placement snap/settle.
 * Only consumes CPU ticks when newly placed or moved bricks are in flight (~140ms).
 * Completely sleeps when settled, eliminating idle per-brick useFrame hooks.
 */
class BrickAnimationManager {
  private activeAnimations = new Map<string, ActiveAnimation>();
  private listeners = new Set<AnimationUpdateCallback>();
  private animFrameId: number | null = null;

  triggerSettle(brickIds: string[], durationMs = 140): void {
    const now = performance.now();
    for (const id of brickIds) {
      this.activeAnimations.set(id, { startTime: now, durationMs });
    }
    this.ensureLoopRunning();
  }

  getOffset(brickId: string): number {
    const anim = this.activeAnimations.get(brickId);
    if (!anim) return 0;
    const now = performance.now();
    const elapsed = now - anim.startTime;
    const progress = Math.min(1, elapsed / anim.durationMs);
    return (1 - progress) * 0.15;
  }

  isSettling(brickId: string): boolean {
    return this.activeAnimations.has(brickId);
  }

  subscribe(callback: AnimationUpdateCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private ensureLoopRunning(): void {
    if (this.animFrameId !== null || this.activeAnimations.size === 0) return;

    const tick = () => {
      if (this.activeAnimations.size === 0) {
        this.animFrameId = null;
        // Broadcast empty map so renderers finalize resting matrices
        for (const cb of this.listeners) {
          cb(new Map());
        }
        return;
      }

      const now = performance.now();
      const offsets = new Map<string, number>();

      for (const [id, anim] of this.activeAnimations.entries()) {
        const elapsed = now - anim.startTime;
        const progress = Math.min(1, elapsed / anim.durationMs);
        if (progress >= 1) {
          this.activeAnimations.delete(id);
        } else {
          // Quadratic ease-out drop
          const easeOut = 1 - Math.pow(1 - progress, 2);
          const yOffset = (1 - easeOut) * 0.15;
          offsets.set(id, yOffset);
        }
      }

      for (const cb of this.listeners) {
        cb(offsets);
      }

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }
}

export const globalBrickAnimationManager = new BrickAnimationManager();
