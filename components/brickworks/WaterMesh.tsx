"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WorldEnvironmentState, getSunPosition } from "./WorldEnvironment";

export interface WaterMeshProps {
  size: number;
  position: [number, number, number];
  environment?: WorldEnvironmentState;
}

/**
 * Animated High-Performance Water Surface
 * Uses procedural wave vertex displacement, Fresnel edge coloring, and dynamic sun highlights.
 * Configured with raycast={() => null} so it never blocks building, selection, or terraforming.
 */
export function WaterMesh({ size, position, environment }: WaterMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const sunPos = useMemo(() => {
    return getSunPosition(environment?.timeOfDay ?? 12.0, 50);
  }, [environment?.timeOfDay]);

  // Custom stylized water shader
  const uniforms = useMemo(() => {
    return {
      uTime: { value: 0 },
      uSunPos: { value: new THREE.Vector3(sunPos[0], sunPos[1], sunPos[2]) },
      uDeepColor: { value: new THREE.Color("#0c56a3") },
      uSurfaceColor: { value: new THREE.Color("#4ab8ff") },
      uFoamColor: { value: new THREE.Color("#dcf4ff") },
      uOpacity: { value: 0.82 },
    };
  }, []);

  const vertexShader = `
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Gentle double-frequency sine wave ripples
      float wave1 = sin(pos.x * 0.85 + uTime * 2.2) * cos(pos.y * 0.85 + uTime * 1.8) * 0.045;
      float wave2 = sin(pos.x * 1.7 - uTime * 3.0) * cos(pos.y * 1.7 + uTime * 2.4) * 0.02;
      pos.z += wave1 + wave2;

      vNormal = normalize(vec3(
        -cos(pos.x * 0.85 + uTime * 2.2) * 0.045,
        -cos(pos.y * 0.85 + uTime * 1.8) * 0.045,
        1.0
      ));

      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = `
    uniform vec3 uSunPos;
    uniform vec3 uDeepColor;
    uniform vec3 uSurfaceColor;
    uniform vec3 uFoamColor;
    uniform float uOpacity;

    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      vec3 normal = normalize(vNormal);

      // Fresnel reflection approximation
      float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
      vec3 waterColor = mix(uDeepColor, uSurfaceColor, fresnel * 0.8);

      // Sun specular glint
      vec3 sunDir = normalize(uSunPos);
      vec3 halfDir = normalize(sunDir + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 32.0) * 0.65;
      if (sunDir.y < 0.0) spec = 0.0;

      vec3 finalColor = waterColor + uFoamColor * spec;
      gl_FragColor = vec4(finalColor, uOpacity);
    }
  `;

  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    materialRef.current.uniforms.uSunPos.value.set(sunPos[0], sunPos[1], sunPos[2]);
  });

  useEffect(() => {
    return () => {
      materialRef.current?.dispose();
    };
  }, []);

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={() => null} // Never blocks brick building or terrain clicks!
    >
      <planeGeometry args={[size, size, 16, 16]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
