"use client";

import { useMemo } from "react";
import * as THREE from "three";
import {
  getWorldPositionFromGrid,
  STUD_PITCH,
  VERTICAL_UNIT_HEIGHT,
  getBrickFootprint,
} from "./GridSystem";
import { BrickTypeId } from "./BrickCatalog";
import { getBrickGeometry } from "./BrickGeometryCache";

interface GhostBrickProps {
  type: BrickTypeId;
  color: string;
  gridX: number;
  gridY: number;
  gridZ: number;
  rotation: number;
  isValid: boolean;
  reason?: string;
  visible: boolean;
}

export function GhostBrick({
  type,
  color,
  gridX,
  gridY,
  gridZ,
  rotation,
  isValid,
  visible,
}: GhostBrickProps) {
  const worldPos = useMemo(() => {
    return getWorldPositionFromGrid(gridX, gridY, gridZ, rotation, type);
  }, [gridX, gridY, gridZ, rotation, type]);

  const geometry = useMemo(() => getBrickGeometry(type), [type]);

  const ghostColor = isValid ? color : "#ff1122";
  const ghostOpacity = isValid ? 0.62 : 0.45;

  const material = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: ghostColor,
      transparent: true,
      opacity: ghostOpacity,
      roughness: 0.2,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      emissive: new THREE.Color(ghostColor),
      emissiveIntensity: isValid ? 0.35 : 0.65,
      depthWrite: false,
    });
  }, [ghostColor, ghostOpacity, isValid]);

  const { widthStuds, lengthStuds, heightUnits } = useMemo(() => {
    return getBrickFootprint(type, rotation);
  }, [type, rotation]);

  const wireGeo = useMemo(() => {
    const w = widthStuds * STUD_PITCH + 0.04;
    const l = lengthStuds * STUD_PITCH + 0.04;
    const h = heightUnits * VERTICAL_UNIT_HEIGHT + 0.04;
    return new THREE.BoxGeometry(w, h, l);
  }, [widthStuds, lengthStuds, heightUnits]);

  if (!visible) return null;

  const rotRad = (rotation * Math.PI) / 180;
  const displayY = worldPos[1] + 0.02;

  return (
    <group position={[worldPos[0], displayY, worldPos[2]]}>
      <mesh
        geometry={geometry}
        material={material}
        rotation={[0, rotRad, 0]}
        renderOrder={999}
      />
      {/* Subtle outline box */}
      <mesh geometry={wireGeo}>
        <meshBasicMaterial
          color={isValid ? "#ffffff" : "#ff4444"}
          wireframe
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
