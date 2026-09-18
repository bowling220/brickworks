"use client";

import { useMemo, useRef, useEffect, useCallback, memo } from "react";
import * as THREE from "three";
import { BrickTypeId } from "./BrickCatalog";
import { getWorldPositionFromGrid } from "./GridSystem";
import { getBrickGeometry } from "./BrickGeometryCache";
import { GhostBrickItem } from "./GroupGhost";

interface BlueprintGhostRendererProps {
  bricks: GhostBrickItem[];
  isValid: boolean;
  visible: boolean;
}

interface InstancedGhostBatchProps {
  type: BrickTypeId;
  color: string;
  bricks: GhostBrickItem[];
  isValid: boolean;
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
 * Material cache for ghost preview materials (translucent, emissive)
 */
const ghostMaterialCache = new Map<string, THREE.MeshPhysicalMaterial>();

function getGhostMaterial(color: string, isValid: boolean): THREE.MeshPhysicalMaterial {
  const key = `${color}|${isValid ? "v" : "i"}`;
  let mat = ghostMaterialCache.get(key);
  if (mat) return mat;

  const ghostColor = isValid ? color : "#ff1122";
  const ghostOpacity = isValid ? 0.6 : 0.42;

  mat = new THREE.MeshPhysicalMaterial({
    color: ghostColor,
    transparent: true,
    opacity: ghostOpacity,
    roughness: 0.2,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    emissive: new THREE.Color(ghostColor),
    emissiveIntensity: isValid ? 0.35 : 0.65,
    depthWrite: false,
    side: THREE.FrontSide,
  });

  ghostMaterialCache.set(key, mat);
  return mat;
}

/**
 * Renders a single instanced batch of ghost bricks with same (type, color)
 */
const InstancedGhostBatch = memo(function InstancedGhostBatch({
  type,
  bricks,
  isValid,
}: InstancedGhostBatchProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => getBrickGeometry(type), [type]);

  // Use actual brick color for valid, red for invalid
  const material = useMemo(() => {
    const refColor = bricks.length > 0 ? bricks[0].color : "#0a7cf5";
    return getGhostMaterial(refColor, isValid);
  }, [bricks, isValid]);

  const applyMatrices = useCallback(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const count = bricks.length;
    mesh.count = count;

    for (let i = 0; i < count; i++) {
      const b = bricks[i];
      const [wx, wy, wz] = getWorldPositionFromGrid(b.gridX, b.gridY, b.gridZ, b.rotation, b.type);

      scratchPos.set(wx, wy + 0.02, wz);
      const quat = getRotationQuat(b.rotation);
      scratchMatrix.compose(scratchPos, quat, scratchScale);

      mesh.setMatrixAt(i, scratchMatrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  }, [bricks]);

  useEffect(() => {
    applyMatrices();
  }, [applyMatrices]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, Math.max(bricks.length, 1)]}
      renderOrder={999}
      frustumCulled={false}
    />
  );
});

/**
 * High-performance instanced ghost renderer for large Blueprint previews (100+ bricks).
 * Groups ghost bricks by (type, color) and renders each group as a single InstancedMesh
 * with translucent emissive materials.
 */
export const BlueprintGhostRenderer = memo(function BlueprintGhostRenderer({
  bricks,
  isValid,
  visible,
}: BlueprintGhostRendererProps) {
  // Partition bricks by (type, color) for instanced batching
  const groups = useMemo(() => {
    if (!visible || bricks.length === 0) return [];
    const map = new Map<string, { type: BrickTypeId; color: string; bricks: GhostBrickItem[] }>();

    for (const b of bricks) {
      const groupKey = `${b.type}|${b.color.toLowerCase()}`;
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
  }, [bricks, visible]);

  if (!visible || bricks.length === 0 || groups.length === 0) return null;

  return (
    <group name="blueprint-ghost-renderer">
      {groups.map(({ key, type, color, bricks: groupBricks }) => (
        <InstancedGhostBatch
          key={key}
          type={type}
          color={color}
          bricks={groupBricks}
          isValid={isValid}
        />
      ))}
    </group>
  );
});
