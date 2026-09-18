"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  WorldEnvironmentState,
  getSunPosition,
  getMoonPosition,
  getSkyAtmosphereColors,
} from "./WorldEnvironment";

export interface DynamicSkyProps {
  environment: WorldEnvironmentState;
  cloudDetail?: "low" | "medium" | "high";
  isHomeMode?: boolean;
}

/**
 * Procedural Celestial Starfield using allocation-free THREE.Points
 */
function ProceduralStarfield({ opacity }: { opacity: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);

  const [geometry, count] = useMemo(() => {
    const starCount = 750;
    const positions = new Float32Array(starCount * 3);
    const radius = 180;

    for (let i = 0; i < starCount; i++) {
      // Upper hemisphere distribution
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0); // uniform sphere

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = Math.abs(radius * Math.cos(phi)) + 12; // keep above horizon
      const z = radius * Math.sin(phi) * Math.sin(theta);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return [geo, starCount];
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    // Gentle twinkling variation
    const t = clock.getElapsedTime();
    const twinkle = Math.sin(t * 1.8) * 0.12;
    materialRef.current.opacity = THREE.MathUtils.clamp(opacity + twinkle, 0, 1);
  });

  return (
    <points ref={pointsRef} geometry={geometry} visible={opacity > 0.01}>
      <pointsMaterial
        ref={materialRef}
        size={1.8}
        sizeAttenuation={false}
        color="#ffffff"
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </points>
  );
}

/**
 * Procedural stylized volumetric cloud cluster drifting with global wind
 */
function WindDriftCloudCluster({
  basePosition,
  scale = 1.0,
  speed = 0.08,
  windDirection,
  windStrength,
  color = "#ffffff",
  opacity = 0.9,
  cloudiness = 0.5,
}: {
  basePosition: [number, number, number];
  scale?: number;
  speed?: number;
  windDirection: number;
  windStrength: number;
  color?: string;
  opacity?: number;
  cloudiness?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const posRef = useRef<[number, number, number]>([...basePosition]);

  // Procedural cloud puff spheres
  const puffs = useMemo(
    () => [
      { pos: [0, 0.2, 0] as [number, number, number], s: 1.5 },
      { pos: [-1.2, -0.15, 0.3] as [number, number, number], s: 1.25 },
      { pos: [1.2, -0.1, -0.2] as [number, number, number], s: 1.3 },
      { pos: [-2.1, -0.35, 0] as [number, number, number], s: 0.95 },
      { pos: [2.1, -0.3, 0.15] as [number, number, number], s: 1.0 },
      { pos: [-0.5, 0.7, -0.1] as [number, number, number], s: 1.15 },
      { pos: [0.6, 0.65, 0.2] as [number, number, number], s: 1.1 },
    ],
    []
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Wind vector velocity
    const windSpeed = (speed + windStrength * 0.15) * delta * 18.0;
    const dx = Math.cos(windDirection) * windSpeed;
    const dz = Math.sin(windDirection) * windSpeed;

    posRef.current[0] += dx;
    posRef.current[2] += dz;

    // Wrap around bounds (80m radius boundary)
    const bound = 90;
    if (posRef.current[0] > bound) posRef.current[0] = -bound;
    if (posRef.current[0] < -bound) posRef.current[0] = bound;
    if (posRef.current[2] > bound) posRef.current[2] = -bound;
    if (posRef.current[2] < -bound) posRef.current[2] = bound;

    groupRef.current.position.set(posRef.current[0], posRef.current[1], posRef.current[2]);
  });

  const effectiveScale = scale * (0.7 + cloudiness * 0.6);

  return (
    <group ref={groupRef} position={basePosition} scale={effectiveScale}>
      {puffs.map((puff, idx) => (
        <mesh key={idx} position={puff.pos} scale={puff.s}>
          <sphereGeometry args={[0.8, 14, 12]} />
          <meshStandardMaterial
            color={color}
            roughness={0.75}
            transparent
            opacity={opacity * (0.6 + cloudiness * 0.4)}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Dynamic 3D Sky Container: Celestial Sun & Moon Discs, Stars, and Moving Clouds
 */
export function DynamicSky({
  environment,
  cloudDetail = "medium",
  isHomeMode = false,
}: DynamicSkyProps) {
  const sunMeshRef = useRef<THREE.Group>(null);
  const moonMeshRef = useRef<THREE.Group>(null);

  const atmosphere = useMemo(() => {
    return getSkyAtmosphereColors(
      environment.timeOfDay,
      environment.weatherType,
      environment.weatherIntensity
    );
  }, [environment.timeOfDay, environment.weatherIntensity, environment.weatherType]);

  const sunPos = useMemo(() => getSunPosition(environment.timeOfDay, 55), [environment.timeOfDay]);
  const moonPos = useMemo(() => getMoonPosition(environment.timeOfDay, 55), [environment.timeOfDay]);

  useFrame(() => {
    if (sunMeshRef.current) {
      sunMeshRef.current.position.set(sunPos[0], sunPos[1], sunPos[2]);
      sunMeshRef.current.visible = sunPos[1] > -5;
    }
    if (moonMeshRef.current) {
      moonMeshRef.current.position.set(moonPos[0], moonPos[1], moonPos[2]);
      moonMeshRef.current.visible = moonPos[1] > -5;
    }
  });

  // Cloud tint based on twilight and rain
  const cloudColor = useMemo(() => {
    if (atmosphere.isSunset) return "#ffd4b8";
    if (atmosphere.isSunrise) return "#ffe8cf";
    if (environment.weatherType === "storm") return "#465261";
    if (environment.weatherType === "rain") return "#718296";
    if (atmosphere.isNight) return "#1e2c40";
    return "#ffffff";
  }, [atmosphere.isNight, atmosphere.isSunrise, atmosphere.isSunset, environment.weatherType]);

  const cloudCount = cloudDetail === "low" ? 4 : cloudDetail === "high" ? 10 : 7;

  // Stable cloud cluster coordinates
  const cloudConfigs = useMemo(() => {
    const list = [
      { pos: [-32, 22, -18] as [number, number, number], scale: 2.4, speed: 0.05 },
      { pos: [34, 25, 20] as [number, number, number], scale: 2.6, speed: 0.06 },
      { pos: [-18, 28, 38] as [number, number, number], scale: 2.2, speed: 0.04 },
      { pos: [22, 26, -34] as [number, number, number], scale: 2.8, speed: 0.055 },
      { pos: [0, 32, -45] as [number, number, number], scale: 3.2, speed: 0.045 },
      { pos: [-42, 24, 28] as [number, number, number], scale: 2.5, speed: 0.065 },
      { pos: [45, 27, -22] as [number, number, number], scale: 2.7, speed: 0.05 },
      { pos: [-12, 34, -50] as [number, number, number], scale: 3.5, speed: 0.035 },
      { pos: [38, 23, 42] as [number, number, number], scale: 2.9, speed: 0.048 },
      { pos: [-28, 29, -40] as [number, number, number], scale: 3.0, speed: 0.052 },
    ];
    return list.slice(0, cloudCount);
  }, [cloudCount]);

  return (
    <group>
      {/* Procedural Starfield */}
      <ProceduralStarfield opacity={atmosphere.starOpacity} />

      {/* Stylized Sun Disc & Glow */}
      <group ref={sunMeshRef}>
        <mesh>
          <sphereGeometry args={[2.8, 24, 20]} />
          <meshBasicMaterial color={atmosphere.sunColor} />
        </mesh>
        {/* Soft Corona Ring */}
        <mesh scale={1.35}>
          <ringGeometry args={[2.8, 4.4, 28]} />
          <meshBasicMaterial
            color={atmosphere.sunColor}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Stylized Moon Disc & Glow */}
      <group ref={moonMeshRef}>
        <mesh>
          <sphereGeometry args={[2.2, 24, 20]} />
          <meshStandardMaterial
            color="#e8f2ff"
            emissive="#b8d7ff"
            emissiveIntensity={0.65}
            roughness={0.4}
          />
        </mesh>
        {/* Subtle Moon Halo */}
        <mesh scale={1.4}>
          <ringGeometry args={[2.2, 3.8, 28]} />
          <meshBasicMaterial
            color="#a8d0ff"
            transparent
            opacity={0.25}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Dynamic Moving Clouds Layer */}
      {cloudConfigs.map((c, idx) => (
        <WindDriftCloudCluster
          key={idx}
          basePosition={c.pos}
          scale={c.scale}
          speed={c.speed}
          windDirection={environment.windDirection}
          windStrength={environment.windStrength}
          color={cloudColor}
          cloudiness={environment.cloudiness}
        />
      ))}
    </group>
  );
}
