"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { WorldEnvironmentState, GraphicsQuality } from "./WorldEnvironment";

export interface WeatherControllerProps {
  environment: WorldEnvironmentState;
  graphicsQuality?: GraphicsQuality;
  reducedMotion?: boolean;
  onLightningEvent?: (delayMs: number, intensity: number) => void;
  onFlashVisual?: () => void;
}

/**
 * Camera-following GPU Rain Particle System
 * Particles wrap dynamically inside a cylinder volume tracking the player camera.
 * Never performs Raycasts or blocks editor inputs.
 */
export function WeatherController({
  environment,
  graphicsQuality = "medium",
  reducedMotion = false,
  onLightningEvent,
  onFlashVisual,
}: WeatherControllerProps) {
  const { camera } = useThree();
  const pointsRef = useRef<THREE.Points>(null);
  const rainGeoRef = useRef<THREE.BufferGeometry>(null);

  const isRaining = environment.weatherType === "rain" || environment.weatherType === "storm";

  // Particle count tuned by graphics quality & storm severity
  const dropCount = useMemo(() => {
    if (!isRaining) return 0;
    const base = graphicsQuality === "low" ? 900 : graphicsQuality === "high" ? 3200 : 1800;
    return environment.weatherType === "storm" ? Math.round(base * 1.5) : base;
  }, [environment.weatherType, graphicsQuality, isRaining]);

  // Generate initial rain particle positions
  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(dropCount * 3);
    const vel = new Float32Array(dropCount);
    const radius = 26;
    const height = 24;

    for (let i = 0; i < dropCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = Math.random() * height;
      pos[i * 3 + 2] = Math.sin(angle) * r;

      vel[i] = 22.0 + Math.random() * 12.0; // fall speed
    }

    return [pos, vel];
  }, [dropCount]);

  useEffect(() => {
    return () => {
      rainGeoRef.current?.dispose();
    };
  }, []);

  // Lightning cycle state
  const nextLightningTimeRef = useRef(performance.now() + 15000);

  useFrame((_, delta) => {
    if (!isRaining || dropCount === 0 || !pointsRef.current || !rainGeoRef.current) return;

    const posAttr = rainGeoRef.current.getAttribute("position") as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;

    const camX = camera.position.x;
    const camY = camera.position.y;
    const camZ = camera.position.z;

    const windX = Math.cos(environment.windDirection) * environment.windStrength * 5.5;
    const windZ = Math.sin(environment.windDirection) * environment.windStrength * 5.5;

    const radius = 26;
    const height = 24;

    for (let i = 0; i < dropCount; i++) {
      const idx = i * 3;
      // Fall downward
      posArray[idx + 1] -= velocities[i] * delta;
      // Slant with wind
      posArray[idx] += windX * delta;
      posArray[idx + 2] += windZ * delta;

      // Wrap vertically relative to camera
      if (posArray[idx + 1] < camY - 6) {
        posArray[idx + 1] = camY + height - 2;
        // Re-randomize radial position around camera
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius;
        posArray[idx] = camX + Math.cos(angle) * r;
        posArray[idx + 2] = camZ + Math.sin(angle) * r;
      }

      // Wrap horizontally if camera moved far
      const dx = posArray[idx] - camX;
      const dz = posArray[idx + 2] - camZ;
      if (dx * dx + dz * dz > radius * radius) {
        posArray[idx] = camX - dx * 0.9;
        posArray[idx + 2] = camZ - dz * 0.9;
      }
    }

    posAttr.needsUpdate = true;

    // Storm lightning evaluation
    if (environment.weatherType === "storm") {
      const now = performance.now();
      if (now > nextLightningTimeRef.current) {
        // Schedule next strike in 14 - 26 seconds
        nextLightningTimeRef.current = now + 14000 + Math.random() * 12000;

        // Visual flash trigger
        onFlashVisual?.();

        // Delayed thunder: simulated distance 300m - 1200m -> 0.8s - 3.2s delay
        const delayMs = Math.round(800 + Math.random() * 2400);
        const intensity = 0.6 + Math.random() * 0.4;
        onLightningEvent?.(delayMs, intensity);
      }
    }
  });

  if (!isRaining || dropCount === 0) {
    return null;
  }

  return (
    <points ref={pointsRef} raycast={() => null}>
      <bufferGeometry ref={rainGeoRef}>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={dropCount}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.16}
        color={environment.weatherType === "storm" ? "#a8c0d6" : "#cfe5ff"}
        transparent
        opacity={0.68}
        blending={THREE.NormalBlending}
        depthWrite={false}
      />
    </points>
  );
}
