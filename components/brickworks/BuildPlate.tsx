"use client";

import { useMemo, useRef, useLayoutEffect } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { BASEPLATE_STUDS, STUD_PITCH, BASEPLATE_HALF_WIDTH } from "./GridSystem";

interface BuildPlateProps {
  onPointerMove: (e: { point: THREE.Vector3; normal?: THREE.Vector3 }) => void;
  onPointerLeave?: () => void;
  onClick: (e: { point: THREE.Vector3; normal?: THREE.Vector3 }) => void;
}

export function BuildPlate({ onPointerMove, onPointerLeave, onClick }: BuildPlateProps) {
  const instancedStudsRef = useRef<THREE.InstancedMesh>(null);

  const plateWidth = BASEPLATE_STUDS * STUD_PITCH; // 25.6
  const plateThickness = 0.5;

  // Pre-calculate all 1024 stud transform matrices for single-draw-call rendering
  const studMatrices = useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    const halfPitch = STUD_PITCH / 2;

    for (let gx = 0; gx < BASEPLATE_STUDS; gx++) {
      for (let gz = 0; gz < BASEPLATE_STUDS; gz++) {
        const x = -BASEPLATE_HALF_WIDTH + gx * STUD_PITCH + halfPitch;
        const z = -BASEPLATE_HALF_WIDTH + gz * STUD_PITCH + halfPitch;
        const y = 0.08; // slightly protruding from plate top

        dummy.position.set(x, y, z);
        dummy.updateMatrix();
        matrices.push(dummy.matrix.clone());
      }
    }
    return matrices;
  }, []);

  useLayoutEffect(() => {
    if (!instancedStudsRef.current) return;
    studMatrices.forEach((matrix, index) => {
      instancedStudsRef.current?.setMatrixAt(index, matrix);
    });
    instancedStudsRef.current.instanceMatrix.needsUpdate = true;
  }, [studMatrices]);

  return (
    <group position={[0, 0, 0]}>
      {/* Molded plastic main baseplate slab */}
      <RoundedBox
        args={[plateWidth, plateThickness, plateWidth]}
        radius={0.14}
        smoothness={3}
        position={[0, -plateThickness / 2, 0]}
        receiveShadow
        castShadow
        onPointerMove={(e) => {
          e.stopPropagation();
          if (e.point) {
            onPointerMove({
              point: e.point,
              normal: e.face?.normal || new THREE.Vector3(0, 1, 0),
            });
          }
        }}
        onPointerLeave={(e) => {
          e.stopPropagation();
          onPointerLeave?.();
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (e.point) {
            onClick({
              point: e.point,
              normal: e.face?.normal || new THREE.Vector3(0, 1, 0),
            });
          }
        }}
      >
        <meshPhysicalMaterial
          color="#2fa845"
          roughness={0.4}
          metalness={0.02}
          clearcoat={0.3}
          clearcoatRoughness={0.2}
        />
      </RoundedBox>

      {/* Instanced 1024 studs - 1 single draw call for 60+ FPS performance */}
      <instancedMesh
        ref={instancedStudsRef}
        args={[undefined, undefined, BASEPLATE_STUDS * BASEPLATE_STUDS]}
        receiveShadow
        castShadow
      >
        <cylinderGeometry args={[0.22, 0.23, 0.16, 20]} />
        <meshPhysicalMaterial
          color="#2fa845"
          roughness={0.36}
          metalness={0.02}
          clearcoat={0.3}
        />
      </instancedMesh>

      {/* Chunky stepped foundation platform beneath the baseplate */}
      <RoundedBox
        args={[plateWidth + 1.2, 0.8, plateWidth + 1.2]}
        radius={0.18}
        smoothness={2}
        position={[0, -plateThickness - 0.4, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color="#6a4325" roughness={0.9} />
      </RoundedBox>

      {/* Deep irregular rocky underside for the building island */}
      <mesh position={[0, -plateThickness - 3.8, 0]} rotation={[0, Math.PI / 4, Math.PI]} receiveShadow castShadow>
        <coneGeometry args={[16.5, 6.0, 6]} />
        <meshStandardMaterial color="#363e48" roughness={0.95} />
      </mesh>
    </group>
  );
}
