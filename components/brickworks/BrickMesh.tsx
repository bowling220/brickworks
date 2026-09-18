"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  BrickData,
  getWorldPositionFromGrid,
  getBrickFootprint,
  STUD_PITCH,
  VERTICAL_UNIT_HEIGHT,
} from "./GridSystem";

interface BrickMeshProps {
  data: BrickData;
  isSelected?: boolean;
  isNew?: boolean;
  isMovingOrigin?: boolean;
  animKey?: number | string;
  onSelect?: (id: string, e?: { shiftKey?: boolean }) => void;
  onPointerMove?: (e: { point: THREE.Vector3; normal: THREE.Vector3; brick: BrickData }) => void;
}

export function BrickMesh({
  data,
  isSelected = false,
  isNew = false,
  isMovingOrigin = false,
  animKey,
  onSelect,
  onPointerMove,
}: BrickMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [settleProgress, setSettleProgress] = useState(isNew ? 0 : 1);
  const prevAnimKeyRef = useRef(animKey);

  // Trigger brief snap settle animation when animKey changes
  useEffect(() => {
    if (animKey !== undefined && animKey !== prevAnimKeyRef.current) {
      prevAnimKeyRef.current = animKey;
      setSettleProgress(0);
    }
  }, [animKey]);

  // Derive world position from grid coordinates
  const worldPos = useMemo(() => {
    return getWorldPositionFromGrid(data.gridX, data.gridY, data.gridZ, data.rotation, data.type);
  }, [data.gridX, data.gridY, data.gridZ, data.rotation, data.type]);

  const { widthStuds, lengthStuds, heightUnits } = useMemo(() => {
    return getBrickFootprint(data.type, data.rotation);
  }, [data.type, data.rotation]);

  const brickWidth = widthStuds * STUD_PITCH;
  const brickLength = lengthStuds * STUD_PITCH;
  const brickHeight = heightUnits * VERTICAL_UNIT_HEIGHT;
  const bevelRadius = Math.min(0.06, brickHeight * 0.2);

  // Settle animation: drops 0.15 units into resting layer over ~140ms
  useFrame((_, delta) => {
    if (settleProgress < 1) {
      setSettleProgress((p) => Math.min(1, p + delta * 7.5));
    }
  });

  const settleOffset = (1 - settleProgress) * 0.15;

  // Automatically generate grid of studs based on widthStuds × lengthStuds
  const studPositions = useMemo(() => {
    const list: [number, number][] = [];
    const halfWidth = brickWidth / 2;
    const halfLength = brickLength / 2;

    for (let xIdx = 0; xIdx < widthStuds; xIdx++) {
      const x = -halfWidth + (xIdx + 0.5) * STUD_PITCH;
      for (let yIdx = 0; yIdx < lengthStuds; yIdx++) {
        const z = -halfLength + (yIdx + 0.5) * STUD_PITCH;
        list.push([x, z]);
      }
    }
    return list;
  }, [brickWidth, brickLength, widthStuds, lengthStuds]);

  const brickColor = data.color || "#e62b32";

  return (
    <group
      ref={groupRef}
      position={[worldPos[0], worldPos[1] + settleOffset, worldPos[2]]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(data.id, { shiftKey: e.shiftKey });
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        if (e.point && e.face?.normal) {
          onPointerMove?.({
            point: e.point,
            normal: e.face.normal,
            brick: data,
          });
        }
      }}
    >
      {/* Procedural molded plastic brick body with rounded beveled edges */}
      <RoundedBox
        args={[brickWidth, brickHeight, brickLength]}
        radius={bevelRadius}
        smoothness={3}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color={brickColor}
          roughness={0.16}
          metalness={0.02}
          clearcoat={1.0}
          clearcoatRoughness={0.08}
          reflectivity={0.95}
          emissive={isSelected && !isMovingOrigin ? "#ffe866" : "#000000"}
          emissiveIntensity={isSelected && !isMovingOrigin ? 0.22 : 0}
          transparent={isMovingOrigin}
          opacity={isMovingOrigin ? 0.22 : 1.0}
        />
      </RoundedBox>

      {/* Procedural studs distributed across top surface */}
      {studPositions.map(([sx, sz], i) => (
        <mesh
          key={i}
          position={[sx, brickHeight / 2 + 0.08, sz]}
          castShadow={!isMovingOrigin}
          receiveShadow={!isMovingOrigin}
        >
          <cylinderGeometry args={[0.22, 0.23, 0.16, 20]} />
          <meshPhysicalMaterial
            color={brickColor}
            roughness={0.16}
            clearcoat={1.0}
            clearcoatRoughness={0.08}
            emissive={isSelected && !isMovingOrigin ? "#ffe866" : "#000000"}
            emissiveIntensity={isSelected && !isMovingOrigin ? 0.22 : 0}
            transparent={isMovingOrigin}
            opacity={isMovingOrigin ? 0.22 : 1.0}
          />
        </mesh>
      ))}

      {/* Visual selection outline when selected */}
      {isSelected && !isMovingOrigin && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[brickWidth + 0.05, brickHeight + 0.05, brickLength + 0.05]} />
          <meshBasicMaterial color="#ffe866" wireframe transparent opacity={0.75} />
        </mesh>
      )}

      {/* Faint wireframe marker showing original location during Move mode */}
      {isMovingOrigin && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[brickWidth + 0.02, brickHeight + 0.02, brickLength + 0.02]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.4} />
        </mesh>
      )}
    </group>
  );
}
