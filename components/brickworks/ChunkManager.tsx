"use client";

import { useRef, useState, useEffect, memo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WorldType, WorldSize, ChunkTerrainMod } from "./WorldStorage";
import { TerrainChunk } from "./TerrainChunk";
import { CHUNK_SIZE, STUD_PITCH } from "./GridSystem";
import { WORLD_SIZE_STUDS } from "./TerrainGenerator";

interface ChunkManagerProps {
  worldType: WorldType;
  worldSize: WorldSize;
  seed: number;
  viewDistance?: "low" | "medium" | "high";
  focusPosition?: [number, number, number]; // [x, y, z] from player or orbit camera
  terrainMods?: Record<string, { terrainMod?: ChunkTerrainMod }>;
  onChunksExplored?: (chunkKeys: string[]) => void;
  onPointerMove?: (e: { point: THREE.Vector3; normal: THREE.Vector3 }) => void;
  onPointerLeave?: () => void;
  onClick?: (e: { point: THREE.Vector3; normal: THREE.Vector3 }) => void;
}

const HYSTERESIS_CONFIG: Record<"low" | "medium" | "high", { loadRadius: number; unloadRadius: number }> = {
  low: { loadRadius: 3, unloadRadius: 5 },
  medium: { loadRadius: 4, unloadRadius: 6 },
  high: { loadRadius: 6, unloadRadius: 8 },
};

function computeHysteresisChunks(
  centerCx: number,
  centerCz: number,
  currentMap: Map<string, { cx: number; cz: number }>,
  viewDistance: "low" | "medium" | "high",
  worldType: WorldType,
  worldSize: WorldSize
): {
  nextMap: Map<string, { cx: number; cz: number }>;
  activeChunks: Array<{ key: string; cx: number; cz: number }>;
  newlyExploredKeys: string[];
} {
  const { loadRadius, unloadRadius } = HYSTERESIS_CONFIG[viewDistance] || HYSTERESIS_CONFIG.medium;
  const totalStuds = WORLD_SIZE_STUDS[worldType][worldSize];
  const isFiniteWorld = Number.isFinite(totalStuds);

  const minBoundChunk = isFiniteWorld ? -Math.ceil(totalStuds / (2 * CHUNK_SIZE)) - 1 : -Infinity;
  const maxBoundChunk = isFiniteWorld ? Math.ceil(totalStuds / (2 * CHUNK_SIZE)) + 1 : Infinity;

  const nextMap = new Map<string, { cx: number; cz: number }>();
  const newlyExploredKeys: string[] = [];

  // 1. Retain existing chunks if within unloadRadius
  for (const [key, { cx, cz }] of currentMap.entries()) {
    const dx = cx - centerCx;
    const dz = cz - centerCz;
    if (dx * dx + dz * dz <= unloadRadius * unloadRadius) {
      if (cx >= minBoundChunk && cx <= maxBoundChunk && cz >= minBoundChunk && cz <= maxBoundChunk) {
        nextMap.set(key, { cx, cz });
      }
    }
  }

  // 2. Load new chunks within loadRadius
  for (let dx = -loadRadius; dx <= loadRadius; dx++) {
    for (let dz = -loadRadius; dz <= loadRadius; dz++) {
      if (dx * dx + dz * dz > loadRadius * loadRadius) continue;

      const cx = centerCx + dx;
      const cz = centerCz + dz;

      if (cx < minBoundChunk || cx > maxBoundChunk || cz < minBoundChunk || cz > maxBoundChunk) {
        continue;
      }

      const key = `${cx},${cz}`;
      if (!nextMap.has(key)) {
        nextMap.set(key, { cx, cz });
        newlyExploredKeys.push(key);
      }
    }
  }

  return {
    nextMap,
    activeChunks: Array.from(nextMap.entries()).map(([key, coords]) => ({ key, ...coords })),
    newlyExploredKeys,
  };
}

export const ChunkManager = memo(function ChunkManager({
  worldType,
  worldSize,
  seed,
  viewDistance = "medium",
  focusPosition = [0, 0, 0],
  terrainMods,
  onChunksExplored,
  onPointerMove,
  onPointerLeave,
  onClick,
}: ChunkManagerProps) {
  const [activeChunks, setActiveChunks] = useState<Array<{ key: string; cx: number; cz: number }>>(() => {
    const initial = computeHysteresisChunks(0, 0, new Map(), viewDistance, worldType, worldSize);
    return initial.activeChunks;
  });

  const mountedMapRef = useRef<Map<string, { cx: number; cz: number }>>(
    new Map(activeChunks.map((c) => [c.key, { cx: c.cx, cz: c.cz }]))
  );
  const centerChunkRef = useRef<{ cx: number; cz: number }>({ cx: 0, cz: 0 });
  const lastCheckedPos = useRef(new THREE.Vector3());

  const onChunksExploredRef = useRef(onChunksExplored);
  useEffect(() => {
    onChunksExploredRef.current = onChunksExplored;
  }, [onChunksExplored]);

  // Frame-based Hysteresis Chunk Streaming
  useFrame(({ camera }) => {
    const targetX = focusPosition ? focusPosition[0] : camera.position.x;
    const targetZ = focusPosition ? focusPosition[2] : camera.position.z;

    const chunkSpan = CHUNK_SIZE * STUD_PITCH;
    const curCx = Math.floor(targetX / chunkSpan);
    const curCz = Math.floor(targetZ / chunkSpan);

    if (curCx !== centerChunkRef.current.cx || curCz !== centerChunkRef.current.cz) {
      if (lastCheckedPos.current.distanceTo(new THREE.Vector3(targetX, 0, targetZ)) > chunkSpan * 0.4) {
        lastCheckedPos.current.set(targetX, 0, targetZ);
        centerChunkRef.current = { cx: curCx, cz: curCz };

        const { nextMap, activeChunks: nextChunks, newlyExploredKeys } = computeHysteresisChunks(
          curCx,
          curCz,
          mountedMapRef.current,
          viewDistance,
          worldType,
          worldSize
        );
        mountedMapRef.current = nextMap;
        setActiveChunks(nextChunks);

        if (newlyExploredKeys.length > 0) {
          onChunksExploredRef.current?.(newlyExploredKeys);
        }
      }
    }
  });

  return (
    <group name="chunk-manager">
      {activeChunks.map(({ key, cx, cz }) => (
        <TerrainChunk
          key={key}
          chunkX={cx}
          chunkZ={cz}
          worldType={worldType}
          worldSize={worldSize}
          seed={seed}
          terrainMod={terrainMods?.[key]?.terrainMod}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onClick={onClick}
        />
      ))}
    </group>
  );
});
