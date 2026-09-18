"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { getWorldPositionFromGrid, BrickRotation } from "./GridSystem";
import { BrickTypeId } from "./BrickCatalog";
import { getBrickGeometry } from "./BrickGeometryCache";

export interface GhostBrickItem {
  id?: string;
  type: BrickTypeId;
  color: string;
  gridX: number;
  gridY: number;
  gridZ: number;
  rotation: BrickRotation;
}

export interface GroupGhostProps {
  bricks: GhostBrickItem[];
  isValid: boolean;
  reason?: string;
  visible: boolean;
}

function SingleGroupGhostBrick({
  brick,
  isGroupValid,
}: {
  brick: GhostBrickItem;
  isGroupValid: boolean;
}) {
  const worldPos = useMemo(() => {
    return getWorldPositionFromGrid(brick.gridX, brick.gridY, brick.gridZ, brick.rotation, brick.type);
  }, [brick.gridX, brick.gridY, brick.gridZ, brick.rotation, brick.type]);

  const geometry = useMemo(() => getBrickGeometry(brick.type), [brick.type]);

  const ghostColor = isGroupValid ? (brick.color || "#0a7cf5") : "#ff1122";
  const ghostOpacity = isGroupValid ? 0.62 : 0.45;

  const material = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: ghostColor,
      transparent: true,
      opacity: ghostOpacity,
      roughness: 0.2,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      emissive: new THREE.Color(ghostColor),
      emissiveIntensity: isGroupValid ? 0.35 : 0.65,
      depthWrite: false,
    });
  }, [ghostColor, ghostOpacity, isGroupValid]);

  const rotRad = (brick.rotation * Math.PI) / 180;
  const displayY = worldPos[1] + 0.02;

  return (
    <group position={[worldPos[0], displayY, worldPos[2]]}>
      <mesh
        geometry={geometry}
        material={material}
        rotation={[0, rotRad, 0]}
        renderOrder={999}
      />
    </group>
  );
}

export function GroupGhost({
  bricks,
  isValid,
  visible,
}: GroupGhostProps) {
  if (!visible || bricks.length === 0) return null;

  return (
    <group name="group-ghost">
      {bricks.map((brick, idx) => (
        <SingleGroupGhostBrick
          key={brick.id || `group-ghost-${idx}`}
          brick={brick}
          isGroupValid={isValid}
        />
      ))}
    </group>
  );
}
