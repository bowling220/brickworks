"use client";

import React, { useMemo, useRef, useEffect, useCallback, memo } from "react";
import { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { BrickData, getWorldPositionFromGrid, getChunkKey } from "./GridSystem";
import { BrickTypeId } from "./BrickCatalog";
import { getBrickGeometry } from "./BrickGeometryCache";
import { getBrickMaterial, getGlassMaterial } from "./BrickMaterialCache";
import { globalBrickAnimationManager } from "./BrickAnimationManager";

interface ChunkBrickRendererProps {
  bricks: BrickData[];
  movingOriginSet?: Set<string>;
  onSelect?: (brickId: string, e?: { shiftKey?: boolean }) => void;
  onPointerMove?: (e: { point: THREE.Vector3; normal: THREE.Vector3; brick: BrickData }) => void;
}

interface InstancedGroupProps {
  groupKey: string;
  type: BrickTypeId;
  color: string;
  bricks: BrickData[];
  onSelect?: (brickId: string, e?: { shiftKey?: boolean }) => void;
  onPointerMove?: (e: { point: THREE.Vector3; normal: THREE.Vector3; brick: BrickData }) => void;
}

const scratchMatrix = new THREE.Matrix4();
const scratchPos = new THREE.Vector3();
const scratchScale = new THREE.Vector3(1, 1, 1);
const yAxis = new THREE.Vector3(0, 1, 0);
const quatRot0 = new THREE.Quaternion().setFromAxisAngle(yAxis, 0);
const quatRot90 = new THREE.Quaternion().setFromAxisAngle(yAxis, Math.PI / 2);
const quatRot180 = new THREE.Quaternion().setFromAxisAngle(yAxis, Math.PI);
const quatRot270 = new THREE.Quaternion().setFromAxisAngle(yAxis, (3 * Math.PI) / 2);

function getRotationQuat(rotation: number): THREE.Quaternion {
  if (rotation === 90) return quatRot90;
  if (rotation === 180) return quatRot180;
  if (rotation === 270) return quatRot270;
  return quatRot0;
}

/**
 * Renders a single instanced batch of identical (type, color) bricks within a chunk
 */
const InstancedBrickBatch = memo(function InstancedBrickBatch({
  type,
  color,
  bricks,
  onSelect,
  onPointerMove,
}: InstancedGroupProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => getBrickGeometry(type), [type]);
  const material = useMemo(() => {
    if (type.startsWith("window_")) {
      return [getBrickMaterial(color), getGlassMaterial()];
    }
    return getBrickMaterial(color);
  }, [color, type]);

  // Keep a ref of current bricks for instant lookup in event handlers
  const bricksRef = useRef(bricks);
  useEffect(() => {
    bricksRef.current = bricks;
  }, [bricks]);

  // Build and upload instance transform matrices
  const applyMatrices = useCallback(
    (yOffsets?: Map<string, number>) => {
      const mesh = meshRef.current;
      if (!mesh) return;

      const count = bricks.length;
      mesh.count = count;

      for (let i = 0; i < count; i++) {
        const b = bricks[i];
        const [wx, wy, wz] = getWorldPositionFromGrid(b.gridX, b.gridY, b.gridZ, b.rotation, b.type);
        const yOff = yOffsets?.get(b.id) ?? 0;

        scratchPos.set(wx, wy + yOff, wz);
        const quat = getRotationQuat(b.rotation);
        scratchMatrix.compose(scratchPos, quat, scratchScale);

        mesh.setMatrixAt(i, scratchMatrix);
      }

      mesh.instanceMatrix.needsUpdate = true;
    },
    [bricks]
  );

  // Initial and on-change matrix upload
  useEffect(() => {
    applyMatrices();
  }, [applyMatrices]);

  // Listen to centralized animation manager for settling drops
  useEffect(() => {
    const unsub = globalBrickAnimationManager.subscribe((offsets) => {
      // Check if any brick in this batch is currently settling
      let hasSettling = false;
      for (const b of bricks) {
        if (offsets.has(b.id)) {
          hasSettling = true;
          break;
        }
      }
      if (hasSettling || offsets.size === 0) {
        applyMatrices(offsets);
      }
    });
    return unsub;
  }, [applyMatrices, bricks]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const instanceId = e.instanceId;
      if (instanceId !== undefined && instanceId < bricksRef.current.length) {
        const brick = bricksRef.current[instanceId];
        onSelect?.(brick.id, { shiftKey: e.shiftKey });
      }
    },
    [onSelect]
  );

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const instanceId = e.instanceId;
      if (instanceId !== undefined && instanceId < bricksRef.current.length) {
        const brick = bricksRef.current[instanceId];
        if (e.point && e.face?.normal) {
          onPointerMove?.({
            point: e.point,
            normal: e.face.normal,
            brick,
          });
        }
      }
    },
    [onPointerMove]
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, Math.max(bricks.length, 1)]}
      castShadow
      receiveShadow
      onClick={handleClick}
      onPointerMove={handlePointerMove}
    />
  );
});

/**
 * Top-level chunk-partitioned instanced brick renderer
 */
export function ChunkBrickRenderer({
  bricks,
  movingOriginSet,
  onSelect,
  onPointerMove,
}: ChunkBrickRendererProps) {
  // Partition bricks by chunk and (type, color) group
  const groups = useMemo(() => {
    const map = new Map<string, { type: BrickTypeId; color: string; bricks: BrickData[] }>();

    for (const b of bricks) {
      // If brick is a moving origin, skip its main solid render (it renders as wireframe)
      if (movingOriginSet && movingOriginSet.has(b.id)) {
        continue;
      }

      const chunk = getChunkKey(b.gridX, b.gridY);
      const groupKey = `${chunk}|${b.type}|${b.color.toLowerCase()}`;

      let group = map.get(groupKey);
      if (!group) {
        group = { type: b.type, color: b.color, bricks: [] };
        map.set(groupKey, group);
      }
      group.bricks.push(b);
    }

    return Array.from(map.entries()).map(([key, data]) => ({
      key,
      ...data,
    }));
  }, [bricks, movingOriginSet]);

  return (
    <group name="chunk-brick-renderer">
      {groups.map(({ key, type, color, bricks: groupBricks }) => (
        <InstancedBrickBatch
          key={key}
          groupKey={key}
          type={type}
          color={color}
          bricks={groupBricks}
          onSelect={onSelect}
          onPointerMove={onPointerMove}
        />
      ))}
    </group>
  );
}
