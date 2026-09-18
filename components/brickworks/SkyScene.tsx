"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, RoundedBox } from "@react-three/drei";
import { Component, type ReactNode, Suspense, useEffect, useMemo, useRef, useState, memo } from "react";
import * as THREE from "three";
import { HeroIslandWithLogo } from "./BrickworksLogo3D";
import { BuildScene, BuildSceneHandle } from "./BuildScene";
import { BuildCamera, GameMode, EditorMode } from "./BuildCamera";
import { BrickData, BrickRotation } from "./GridSystem";
import { WalkController, MobileWalkInput, WalkHeightPreset } from "./WalkController";
import { WorldType, WorldSize, ChunkTerrainMod } from "./WorldStorage";
import { TerrainBrushConfig } from "./TerrainBrush";
import { BuildTool } from "./BuildUI";
import { EnvironmentLighting } from "./EnvironmentLighting";
import { DynamicSky } from "./DynamicSky";
import { WeatherController } from "./WeatherController";
import {
  WorldEnvironmentState,
  GraphicsQuality,
  getDefaultWorldEnvironment,
} from "./WorldEnvironment";
import { getAudioManager } from "./AudioManager";
import { WATER_LEVEL } from "./TerrainGenerator";

/**
 * Procedural stylized block tree (pine or leafy oak)
 */
function BlockTree({ position, variant = "pine", scale = 1 }: { position: [number, number, number]; variant?: "pine" | "oak"; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.24, 0.7, 0.24]} />
        <meshStandardMaterial color="#6e3f22" roughness={0.85} />
      </mesh>
      {variant === "pine" ? (
        <>
          <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.9, 0.45, 0.9]} />
            <meshStandardMaterial color="#1e8a38" roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.15, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.68, 0.4, 0.68]} />
            <meshStandardMaterial color="#26a845" roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.48, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.42, 0.36, 0.42]} />
            <meshStandardMaterial color="#3cd660" roughness={0.6} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.05, 0.85, 1.05]} />
            <meshStandardMaterial color="#22b542" roughness={0.62} />
          </mesh>
          <mesh position={[0.1, 1.42, -0.05]} castShadow receiveShadow>
            <boxGeometry args={[0.7, 0.42, 0.7]} />
            <meshStandardMaterial color="#3de262" roughness={0.62} />
          </mesh>
        </>
      )}
    </group>
  );
}

/**
 * Volumetric stylized cloud with clusters of rounded spheres
 */
function VolumetricCloud({
  position,
  scale = 1,
  speed = 0.12,
  wrapWidth = 36,
  opacity = 0.94,
}: {
  position: [number, number, number];
  scale?: number;
  speed?: number;
  wrapWidth?: number;
  opacity?: number;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.position.x += delta * speed;
    const half = wrapWidth / 2;
    if (ref.current.position.x > half) {
      ref.current.position.x = -half;
    }
  });

  const puffs = useMemo(() => [
    { pos: [0, 0.1, 0] as [number, number, number], s: 1.4 },
    { pos: [-0.95, -0.15, 0.2] as [number, number, number], s: 1.15 },
    { pos: [0.95, -0.1, -0.1] as [number, number, number], s: 1.2 },
    { pos: [-1.8, -0.32, 0] as [number, number, number], s: 0.85 },
    { pos: [1.8, -0.28, 0.1] as [number, number, number], s: 0.9 },
    { pos: [-0.4, 0.55, -0.1] as [number, number, number], s: 1.05 },
    { pos: [0.55, 0.48, 0.15] as [number, number, number], s: 1.0 },
  ], []);

  return (
    <group ref={ref} position={position} scale={scale}>
      {puffs.map((puff, idx) => (
        <mesh key={idx} position={puff.pos} scale={puff.s}>
          <sphereGeometry args={[0.72, 16, 14]} />
          <meshStandardMaterial
            color="#ffffff"
            roughness={0.75}
            transparent
            opacity={opacity}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Floating toy brick drifting gently
 */
function FloatingBrick({
  position,
  color,
  scale = 1,
  type = "2x4",
  rotSpeed = [0.2, 0.3, 0.15],
  floatIntensity = 0.5,
}: {
  position: [number, number, number];
  color: string;
  scale?: number;
  type?: "2x4" | "2x2";
  rotSpeed?: [number, number, number];
  floatIntensity?: number;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const is2x4 = type === "2x4";
  const width = is2x4 ? 1.45 : 0.85;
  const depth = 0.85;
  const height = 0.65;

  const studs = useMemo(() => {
    if (is2x4) {
      return [
        [-0.45, -0.22], [-0.15, -0.22], [0.15, -0.22], [0.45, -0.22],
        [-0.45, 0.22], [-0.15, 0.22], [0.15, 0.22], [0.45, 0.22],
      ];
    }
    return [
      [-0.22, -0.22], [0.22, -0.22],
      [-0.22, 0.22], [0.22, 0.22],
    ];
  }, [is2x4]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += delta * rotSpeed[0];
    meshRef.current.rotation.y += delta * rotSpeed[1];
    meshRef.current.rotation.z += delta * rotSpeed[2];
  });

  return (
    <Float speed={1.1} rotationIntensity={0.2} floatIntensity={floatIntensity}>
      <group position={position} scale={scale}>
        <group ref={meshRef}>
          <RoundedBox args={[width, height, depth]} radius={0.08} smoothness={3} castShadow receiveShadow>
            <meshPhysicalMaterial
              color={color}
              roughness={0.18}
              metalness={0.02}
              clearcoat={0.9}
              clearcoatRoughness={0.12}
            />
          </RoundedBox>
          {studs.map(([sx, sz], i) => (
            <mesh key={i} position={[sx, height / 2 + 0.08, sz]} castShadow receiveShadow>
              <cylinderGeometry args={[0.13, 0.135, 0.16, 20]} />
              <meshPhysicalMaterial
                color={color}
                roughness={0.18}
                clearcoat={0.9}
                clearcoatRoughness={0.12}
              />
            </mesh>
          ))}
        </group>
      </group>
    </Float>
  );
}

function CastleIsland({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <Float speed={0.65} rotationIntensity={0.05} floatIntensity={0.25}>
      <group position={position} scale={scale}>
        <RoundedBox args={[4.5, 0.6, 3.2]} radius={0.2} smoothness={2} position={[0, 0.1, 0]}>
          <meshStandardMaterial color="#32bf4d" roughness={0.6} />
        </RoundedBox>
        <RoundedBox args={[4.1, 0.6, 2.8]} radius={0.18} smoothness={2} position={[0, -0.4, 0]}>
          <meshStandardMaterial color="#7a4b2a" roughness={0.88} />
        </RoundedBox>
        <mesh position={[0, -1.5, 0]} rotation={[0, Math.PI / 4, Math.PI]}>
          <coneGeometry args={[1.8, 2.2, 5]} />
          <meshStandardMaterial color="#414b58" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.9, -0.2]} castShadow receiveShadow>
          <boxGeometry args={[1.6, 1.2, 1.4]} />
          <meshStandardMaterial color="#b3c2d4" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.6, -0.2]}>
          <boxGeometry args={[1.75, 0.22, 1.55]} />
          <meshStandardMaterial color="#97a9be" roughness={0.7} />
        </mesh>
        {[-0.95, 0.95].map((tx, idx) => (
          <group key={idx} position={[tx, 1.05, -0.2]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.34, 0.38, 1.6, 16]} />
              <meshStandardMaterial color="#9cb0c7" roughness={0.72} />
            </mesh>
            <mesh position={[0, 1.15, 0]} castShadow>
              <coneGeometry args={[0.48, 0.85, 16]} />
              <meshStandardMaterial color="#e63946" roughness={0.4} />
            </mesh>
            <mesh position={[0, 1.65, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 0.3, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.08, 1.72, 0]}>
              <boxGeometry args={[0.16, 0.1, 0.02]} />
              <meshBasicMaterial color="#ffd13b" />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.55, 0.52]}>
          <boxGeometry args={[0.5, 0.65, 0.1]} />
          <meshStandardMaterial color="#2d3748" roughness={0.9} />
        </mesh>
        <BlockTree position={[-1.6, 0.45, 0.8]} scale={0.7} variant="pine" />
        <BlockTree position={[1.5, 0.45, 0.6]} scale={0.75} variant="oak" />
      </group>
    </Float>
  );
}

function LighthouseIsland({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const beaconRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!beaconRef.current) return;
    const t = clock.getElapsedTime();
    beaconRef.current.intensity = 3 + Math.sin(t * 3.5) * 1.5;
  });

  return (
    <Float speed={0.7} rotationIntensity={0.06} floatIntensity={0.3}>
      <group position={position} scale={scale}>
        <RoundedBox args={[3.6, 0.6, 2.8]} radius={0.2} smoothness={2} position={[0, 0.1, 0]}>
          <meshStandardMaterial color="#2cb847" roughness={0.62} />
        </RoundedBox>
        <RoundedBox args={[3.2, 0.65, 2.5]} radius={0.18} smoothness={2} position={[0, -0.45, 0]}>
          <meshStandardMaterial color="#734526" roughness={0.88} />
        </RoundedBox>
        <mesh position={[0, -1.6, 0]} rotation={[0, Math.PI / 4, Math.PI]}>
          <coneGeometry args={[1.5, 2.0, 5]} />
          <meshStandardMaterial color="#3a4350" roughness={0.95} />
        </mesh>
        <group position={[0.4, 0.4, -0.2]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <cylinderGeometry args={[0.5, 0.58, 0.4, 16]} />
            <meshStandardMaterial color="#515d6d" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.65, 0]} castShadow>
            <cylinderGeometry args={[0.44, 0.49, 0.5, 16]} />
            <meshStandardMaterial color="#ff3842" roughness={0.35} />
          </mesh>
          <mesh position={[0, 1.15, 0]} castShadow>
            <cylinderGeometry args={[0.39, 0.44, 0.5, 16]} />
            <meshStandardMaterial color="#f7fafc" roughness={0.35} />
          </mesh>
          <mesh position={[0, 1.65, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.39, 0.5, 16]} />
            <meshStandardMaterial color="#ff3842" roughness={0.35} />
          </mesh>
          <mesh position={[0, 2.15, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.34, 0.5, 16]} />
            <meshStandardMaterial color="#f7fafc" roughness={0.35} />
          </mesh>
          <mesh position={[0, 2.52, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.28, 16]} />
            <meshStandardMaterial color="#ffea78" roughness={0.1} emissive="#ffea78" emissiveIntensity={0.8} />
          </mesh>
          <pointLight ref={beaconRef} color="#fff1a8" distance={10} position={[0, 2.52, 0]} />
          <mesh position={[0, 2.74, 0]}>
            <sphereGeometry args={[0.32, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#1e2530" roughness={0.4} />
          </mesh>
        </group>
        <mesh position={[-0.8, 0.6, 0.2]} castShadow receiveShadow>
          <boxGeometry args={[0.85, 0.65, 0.7]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.5} />
        </mesh>
        <mesh position={[-0.8, 1.05, 0.2]} castShadow>
          <coneGeometry args={[0.65, 0.45, 4]} />
          <meshStandardMaterial color="#d94b38" roughness={0.5} />
        </mesh>
        <BlockTree position={[-1.2, 0.45, -0.6]} scale={0.65} variant="pine" />
      </group>
    </Float>
  );
}

function WaterfallIsland({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const fallRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!fallRef.current) return;
    const t = clock.getElapsedTime();
    fallRef.current.position.y = Math.sin(t * 3.0) * 0.03;
  });

  return (
    <Float speed={0.8} rotationIntensity={0.06} floatIntensity={0.32}>
      <group position={position} scale={scale}>
        <RoundedBox args={[4.2, 0.65, 2.8]} radius={0.2} smoothness={2} position={[0, 0.15, 0]}>
          <meshStandardMaterial color="#2ec24a" roughness={0.55} />
        </RoundedBox>
        <RoundedBox args={[3.8, 0.7, 2.4]} radius={0.18} smoothness={2} position={[0, -0.45, 0]}>
          <meshStandardMaterial color="#7c4826" roughness={0.88} />
        </RoundedBox>
        <mesh position={[0, -1.8, 0]} rotation={[0, Math.PI / 4, Math.PI]}>
          <coneGeometry args={[1.7, 2.3, 5]} />
          <meshStandardMaterial color="#3d4754" roughness={0.95} />
        </mesh>
        <mesh position={[0.2, 0.49, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.75, 1.4]} />
          <meshStandardMaterial color="#4ec9ff" roughness={0.1} transparent opacity={0.9} />
        </mesh>
        <group ref={fallRef} position={[0.2, -0.65, 1.35]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.65, 0.9, 0.22]} />
            <meshStandardMaterial color="#68d5ff" roughness={0.12} transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, -0.3, 0.08]}>
            <boxGeometry args={[0.55, 1.1, 0.2]} />
            <meshStandardMaterial color="#93e4ff" roughness={0.1} transparent opacity={0.78} />
          </mesh>
          <mesh position={[0, -1.2, 0.16]}>
            <boxGeometry args={[0.45, 1.0, 0.18]} />
            <meshStandardMaterial color="#c2f2ff" roughness={0.1} transparent opacity={0.7} />
          </mesh>
          {[-0.2, 0.2].map((mx, mi) => (
            <mesh key={mi} position={[mx, -1.8, 0.22]} scale={0.35}>
              <sphereGeometry args={[0.65, 12, 10]} />
              <meshStandardMaterial color="#ffffff" roughness={0.8} transparent opacity={0.65} />
            </mesh>
          ))}
        </group>
        <BlockTree position={[-1.3, 0.5, 0.3]} scale={0.75} variant="pine" />
        <BlockTree position={[-0.8, 0.5, -0.6]} scale={0.65} variant="pine" />
        <BlockTree position={[1.4, 0.5, -0.4]} scale={0.7} variant="oak" />
      </group>
    </Float>
  );
}

function StoneArchIsland({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <Float speed={0.75} rotationIntensity={0.07} floatIntensity={0.3}>
      <group position={position} scale={scale}>
        <RoundedBox args={[3.8, 0.6, 2.4]} radius={0.18} smoothness={2} position={[0, 0.1, 0]}>
          <meshStandardMaterial color="#2cb847" roughness={0.6} />
        </RoundedBox>
        <RoundedBox args={[3.4, 0.65, 2.1]} radius={0.16} smoothness={2} position={[0, -0.45, 0]}>
          <meshStandardMaterial color="#774526" roughness={0.88} />
        </RoundedBox>
        <mesh position={[0, -1.55, 0]} rotation={[0, Math.PI / 4, Math.PI]}>
          <coneGeometry args={[1.4, 1.9, 5]} />
          <meshStandardMaterial color="#3e4856" roughness={0.95} />
        </mesh>
        <group position={[0, 0.4, 0]}>
          <mesh position={[-0.8, 0.55, 0]} castShadow>
            <boxGeometry args={[0.42, 1.1, 0.42]} />
            <meshStandardMaterial color="#8896a6" roughness={0.75} />
          </mesh>
          <mesh position={[0.8, 0.55, 0]} castShadow>
            <boxGeometry args={[0.42, 1.1, 0.42]} />
            <meshStandardMaterial color="#8896a6" roughness={0.75} />
          </mesh>
          <mesh position={[0, 1.15, 0]} castShadow>
            <boxGeometry args={[2.08, 0.35, 0.48]} />
            <meshStandardMaterial color="#99a8b8" roughness={0.72} />
          </mesh>
        </group>
        <BlockTree position={[-1.3, 0.42, 0.4]} scale={0.65} variant="oak" />
        <BlockTree position={[1.2, 0.42, -0.3]} scale={0.7} variant="pine" />
      </group>
    </Float>
  );
}

function TinyIsland({ position, scale = 1, accent = "#2eb849" }: { position: [number, number, number]; scale?: number; accent?: string }) {
  return (
    <Float speed={0.6} rotationIntensity={0.04} floatIntensity={0.2}>
      <group position={position} scale={scale}>
        <RoundedBox args={[2.2, 0.4, 1.6]} radius={0.12} smoothness={2} position={[0, 0.05, 0]}>
          <meshStandardMaterial color={accent} roughness={0.6} />
        </RoundedBox>
        <mesh position={[0, -0.85, 0]} rotation={[0, Math.PI / 4, Math.PI]}>
          <coneGeometry args={[0.9, 1.4, 4]} />
          <meshStandardMaterial color="#4a5563" roughness={0.95} />
        </mesh>
        <BlockTree position={[0, 0.28, 0]} scale={0.7} variant="pine" />
      </group>
    </Float>
  );
}

/**
 * Responsive Hero Scaler: dynamically scales the central hero island
 */
function HeroAnchor({ reducedMotion, mode }: { reducedMotion: boolean; mode: GameMode }) {
  const { viewport } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  const heroScale = useMemo(() => {
    const maxAllowedWidth = Math.min(viewport.width * 0.68, viewport.height * 1.12);
    const scale = maxAllowedWidth / 11.5;
    return Math.min(0.85, Math.max(0.36, scale));
  }, [viewport.width, viewport.height]);

  // Smoothly move the hero logo out of frame during transition to build mode
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    let targetY = 0;
    if (mode === "home") {
      targetY = 0;
    } else if (mode === "transitioning-to-build" || mode === "build") {
      targetY = 16.0; // Float upward out of view
    } else if (mode === "transitioning-to-home") {
      targetY = 0; // Float back down into position
    }

    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, delta * 3.2);
  });

  const isVisible = mode !== "build";

  return (
    <group ref={groupRef} visible={isVisible} scale={heroScale}>
      <HeroIslandWithLogo reducedMotion={reducedMotion} />
      {/* Decorative floating bricks that frame the logo exclusively in Home Mode */}
      <FloatingBrick position={[-4.6, -1.8, 2.8]} color="#ff333a" type="2x4" scale={0.9} rotSpeed={[0.3, 0.4, 0.2]} />
      <FloatingBrick position={[4.6, 2.0, 2.6]} color="#ffc400" type="2x2" scale={0.8} rotSpeed={[0.25, -0.35, 0.18]} />
      <FloatingBrick position={[2.8, 2.8, -3.2]} color="#0a7cf5" type="2x4" scale={0.65} rotSpeed={[-0.2, 0.3, -0.15]} />
      <FloatingBrick position={[-3.8, 3.4, -4.5]} color="#22c55e" type="2x2" scale={0.6} rotSpeed={[0.2, -0.25, 0.3]} />
      <FloatingBrick position={[-3.2, -3.2, -2.5]} color="#ff6a00" type="2x4" scale={0.7} rotSpeed={[0.15, 0.35, -0.2]} />
    </group>
  );
}

/**
 * Animated Transition Wrapper for the Build Mode Area
 */
function BuildAreaAnchor({
  mode,
  buildSceneRef,
  onSelectBrick,
  onRotationChange,
  onTypeChange,
  onColorChange,
  onBrickPlacedSound,
  onDebugUpdate,
  onHistoryChange,
  onMoveModeChange,
  onSelectionChange,
  onBoxSelectChange,
  isMultiSelectMode,
  onBricksChange,
  editorMode,
  worldType = "island",
  worldSize = "small",
  seed = 12345,
  viewDistance = "medium",
  focusPosition = [0, 0, 0],
  terrainBrushConfig,
  terrainMods,
  onTerrainChange,
  onChunksExplored,
  onBlueprintStateChange,
  buildTool,
  onBuildToolChange,
  onLineToolStateChange,
  onAreaToolStateChange,
}: {
  mode: GameMode;
  buildSceneRef?: React.RefObject<BuildSceneHandle | null>;
  onSelectBrick?: (brick: BrickData | null) => void;
  onRotationChange?: (rotation: BrickRotation) => void;
  onTypeChange?: (type: import("./BrickCatalog").BrickTypeId) => void;
  onColorChange?: (color: string) => void;
  onBrickPlacedSound?: (brick: BrickData) => void;
  onDebugUpdate?: (info: import("./BuildScene").BuildDebugInfo) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onMoveModeChange?: (isMoving: boolean) => void;
  onSelectionChange?: (selectedIds: string[], selectedBricks: BrickData[]) => void;
  onBoxSelectChange?: (isBoxSelecting: boolean, rect: { x: number; y: number; width: number; height: number } | null) => void;
  isMultiSelectMode?: boolean;
  onBricksChange?: (bricks: BrickData[]) => void;
  editorMode?: EditorMode;
  buildTool?: BuildTool;
  onBuildToolChange?: (tool: BuildTool) => void;
  onLineToolStateChange?: (step: "start" | "end" | null, count: number) => void;
  onAreaToolStateChange?: (step: "start" | "end" | null, count: number) => void;
  worldType?: WorldType;
  worldSize?: WorldSize;
  seed?: number;
  viewDistance?: "low" | "medium" | "high";
  focusPosition?: [number, number, number];
  terrainBrushConfig?: TerrainBrushConfig;
  terrainMods?: Record<string, { terrainMod?: ChunkTerrainMod }>;
  onTerrainChange?: (modifiedChunks: Record<string, ChunkTerrainMod>, affectedChunkKeys: string[]) => void;
  onChunksExplored?: (chunkKeys: string[]) => void;
  onBlueprintStateChange?: (state: import("./BuildScene").BlueprintPlacementState) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    let targetY = -22.0;
    if (mode === "build") {
      targetY = 0.0;
    } else if (mode === "transitioning-to-build") {
      targetY = 0.0;
    } else if (mode === "transitioning-to-home" || mode === "home") {
      targetY = -22.0;
    }

    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, delta * 3.5);
  });

  const isVisible = mode !== "home";

  return (
    <group ref={groupRef} position={[0, -22.0, 0]} visible={isVisible}>
      <BuildScene
        ref={buildSceneRef}
        onSelectBrick={onSelectBrick}
        onSelectionChange={onSelectionChange}
        onRotationChange={onRotationChange}
        onTypeChange={onTypeChange}
        onColorChange={onColorChange}
        onBrickPlacedSound={onBrickPlacedSound}
        onDebugUpdate={onDebugUpdate}
        onHistoryChange={onHistoryChange}
        onMoveModeChange={onMoveModeChange}
        onBoxSelectChange={onBoxSelectChange}
        isMultiSelectMode={isMultiSelectMode}
        onBricksChange={onBricksChange}
        editorMode={editorMode}
        buildTool={buildTool}
        onBuildToolChange={onBuildToolChange}
        onLineToolStateChange={onLineToolStateChange}
        onAreaToolStateChange={onAreaToolStateChange}
        worldType={worldType}
        worldSize={worldSize}
        seed={seed}
        viewDistance={viewDistance}
        focusPosition={focusPosition}
        terrainBrushConfig={terrainBrushConfig}
        terrainMods={terrainMods}
        onTerrainChange={onTerrainChange}
        onChunksExplored={onChunksExplored}
        onBlueprintStateChange={onBlueprintStateChange}
      />
    </group>
  );
}

function WaterProximityTracker({ mode }: { mode: GameMode }) {
  const { camera } = useThree();
  const lastCheck = useRef(0);

  useFrame(() => {
    if (mode === "home") {
      getAudioManager().updateWaterProximity(999);
      return;
    }
    const now = performance.now();
    if (now - lastCheck.current < 250) return; // 4 Hz throttle
    lastCheck.current = now;

    const distToWaterPlane = Math.abs(camera.position.y - WATER_LEVEL);
    getAudioManager().updateWaterProximity(distToWaterPlane);
  });

  return null;
}

function EnvironmentTicker({
  onAdvanceEnvironment,
  mode,
}: {
  onAdvanceEnvironment?: (delta: number) => void;
  mode: GameMode;
}) {
  useFrame((_, delta) => {
    if (mode === "home") return;
    onAdvanceEnvironment?.(delta);
  });
  return null;
}

/**
 * Complete 3D World Scene
 */
function World({
  mode,
  onTransitionComplete,
  reducedMotion,
  buildSceneRef,
  onSelectBrick,
  onRotationChange,
  onTypeChange,
  onColorChange,
  onBrickPlacedSound,
  onDebugUpdate,
  onHistoryChange,
  onMoveModeChange,
  onSelectionChange,
  onBoxSelectChange,
  isMultiSelectMode,
  isBoxSelecting,
  onBricksChange,
  editorMode = "build",
  buildTool,
  onBuildToolChange,
  onLineToolStateChange,
  onAreaToolStateChange,
  placedBricks = [],
  onExitWalk,
  mobileWalkInput,
  onPointerLockChange,
  walkHeightPreset,
  onCycleHeightPreset,
  recenterTrigger,
  worldType = "island",
  worldSize = "small",
  seed = 12345,
  viewDistance = "medium",
  playerSpawn = [0, 0, 11.2],
  lastPlayerPosition,
  lastPlayerYaw,
  onPlayerPositionChange,
  terrainBrushConfig,
  terrainMods,
  onTerrainChange,
  onChunksExplored,
  onBlueprintStateChange,
  lastSafePos,
  homeSpawnPos,
  onSafePositionChange,
  teleportTarget,
  onTeleportComplete,
  environment,
  graphicsQuality = "medium",
  reducedLightningFlash = false,
  lightningFlashActive = false,
  onLightningEvent,
  onFlashVisual,
  onAdvanceEnvironment,
}: {
  mode: GameMode;
  onTransitionComplete?: () => void;
  reducedMotion: boolean;
  buildSceneRef?: React.RefObject<BuildSceneHandle | null>;
  onSelectBrick?: (brick: BrickData | null) => void;
  onRotationChange?: (rotation: BrickRotation) => void;
  onTypeChange?: (type: import("./BrickCatalog").BrickTypeId) => void;
  onColorChange?: (color: string) => void;
  onBrickPlacedSound?: (brick: BrickData) => void;
  onDebugUpdate?: (info: import("./BuildScene").BuildDebugInfo) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onMoveModeChange?: (isMoving: boolean) => void;
  onSelectionChange?: (selectedIds: string[], selectedBricks: BrickData[]) => void;
  onBoxSelectChange?: (isBoxSelecting: boolean, rect: { x: number; y: number; width: number; height: number } | null) => void;
  isMultiSelectMode?: boolean;
  isBoxSelecting?: boolean;
  onBricksChange?: (bricks: BrickData[]) => void;
  editorMode?: EditorMode;
  buildTool?: BuildTool;
  onBuildToolChange?: (tool: BuildTool) => void;
  onLineToolStateChange?: (step: "start" | "end" | null, count: number) => void;
  onAreaToolStateChange?: (step: "start" | "end" | null, count: number) => void;
  placedBricks?: BrickData[];
  onExitWalk?: () => void;
  mobileWalkInput?: MobileWalkInput;
  onPointerLockChange?: (isLocked: boolean) => void;
  walkHeightPreset?: WalkHeightPreset;
  onCycleHeightPreset?: () => void;
  recenterTrigger?: number;
  worldType?: WorldType;
  worldSize?: WorldSize;
  seed?: number;
  viewDistance?: "low" | "medium" | "high";
  playerSpawn?: [number, number, number];
  lastPlayerPosition?: [number, number, number];
  lastPlayerYaw?: number;
  onPlayerPositionChange?: (pos: [number, number, number], yaw: number) => void;
  terrainBrushConfig?: TerrainBrushConfig;
  terrainMods?: Record<string, { terrainMod?: ChunkTerrainMod }>;
  onTerrainChange?: (modifiedChunks: Record<string, ChunkTerrainMod>, affectedChunkKeys: string[]) => void;
  onChunksExplored?: (chunkKeys: string[]) => void;
  onBlueprintStateChange?: (state: import("./BuildScene").BlueprintPlacementState) => void;
  lastSafePos?: [number, number, number];
  homeSpawnPos?: [number, number, number];
  onSafePositionChange?: (pos: [number, number, number]) => void;
  teleportTarget?: [number, number, number] | null;
  onTeleportComplete?: () => void;
  environment?: WorldEnvironmentState;
  graphicsQuality?: GraphicsQuality;
  reducedLightningFlash?: boolean;
  lightningFlashActive?: boolean;
  onLightningEvent?: (delayMs: number, intensity: number) => void;
  onFlashVisual?: () => void;
  onAdvanceEnvironment?: (delta: number) => void;
}) {
  const effectiveEnv = useMemo(() => {
    return environment || getDefaultWorldEnvironment();
  }, [environment]);

  return (
    <>
      <BuildCamera
        mode={mode}
        editorMode={editorMode}
        onTransitionComplete={onTransitionComplete}
        reducedMotion={reducedMotion}
        controlsEnabled={!isBoxSelecting && editorMode !== "walk"}
        recenterTrigger={recenterTrigger}
        focusTarget={lastPlayerPosition || playerSpawn}
      />

      {/* First-Person Walk Controller at Human Scale */}
      {mode === "build" && (
        <WalkController
          isActive={editorMode === "walk"}
          placedBricks={placedBricks}
          worldType={worldType}
          worldSize={worldSize}
          seed={seed}
          initialSpawnPos={lastPlayerPosition || playerSpawn}
          initialSpawnYaw={lastPlayerYaw ?? Math.PI}
          onExitWalk={onExitWalk}
          mobileInput={mobileWalkInput}
          onPointerLockChange={onPointerLockChange}
          heightPreset={walkHeightPreset}
          onCycleHeightPreset={onCycleHeightPreset}
          onPlayerPositionChange={onPlayerPositionChange}
          terrainMods={terrainMods}
          lastSafePos={lastSafePos}
          homeSpawnPos={homeSpawnPos}
          onSafePositionChange={onSafePositionChange}
          teleportTarget={teleportTarget}
          onTeleportComplete={onTeleportComplete}
        />
      )}

      {/* Dynamic Authoritative Lighting, Atmospheric Fog & Sun/Moon Rays */}
      <EnvironmentLighting
        environment={effectiveEnv}
        graphicsQuality={graphicsQuality}
        isHomeMode={mode === "home"}
        lightningFlashActive={lightningFlashActive}
        reducedMotion={reducedMotion}
        viewDistance={viewDistance}
      />

      {/* Dynamic Procedural Celestial Sky (Sun Disc, Moon, 750 Stars, Wind-drifting Clouds) */}
      <DynamicSky
        environment={effectiveEnv}
        cloudDetail={graphicsQuality}
        isHomeMode={mode === "home"}
      />

      {/* Camera-Tracking GPU Weather Particles & Storm Thunder System */}
      <WeatherController
        environment={effectiveEnv}
        graphicsQuality={graphicsQuality}
        reducedMotion={reducedMotion || reducedLightningFlash}
        onLightningEvent={onLightningEvent}
        onFlashVisual={onFlashVisual}
      />

      {/* Water Proximity Audio Sensor & Time Advance Ticker */}
      <WaterProximityTracker mode={mode} />
      <EnvironmentTicker onAdvanceEnvironment={onAdvanceEnvironment} mode={mode} />

      {/* HERO CENTERPIECE: BRICKWORKS + Compact Floating Island */}
      <HeroAnchor reducedMotion={reducedMotion} mode={mode} />

      {/* BUILD MODE ARENA: Procedural Terrain Chunks & Bricks */}
      <BuildAreaAnchor
        mode={mode}
        buildSceneRef={buildSceneRef}
        onSelectBrick={onSelectBrick}
        onSelectionChange={onSelectionChange}
        onRotationChange={onRotationChange}
        onTypeChange={onTypeChange}
        onColorChange={onColorChange}
        onBrickPlacedSound={onBrickPlacedSound}
        onDebugUpdate={onDebugUpdate}
        onHistoryChange={onHistoryChange}
        onMoveModeChange={onMoveModeChange}
        onBoxSelectChange={onBoxSelectChange}
        isMultiSelectMode={isMultiSelectMode}
        onBricksChange={onBricksChange}
        editorMode={editorMode}
        buildTool={buildTool}
        onBuildToolChange={onBuildToolChange}
        onLineToolStateChange={onLineToolStateChange}
        onAreaToolStateChange={onAreaToolStateChange}
        worldType={worldType}
        worldSize={worldSize}
        seed={seed}
        viewDistance={viewDistance}
        focusPosition={lastPlayerPosition || playerSpawn}
        terrainBrushConfig={terrainBrushConfig}
        terrainMods={terrainMods}
        onTerrainChange={onTerrainChange}
        onChunksExplored={onChunksExplored}
        onBlueprintStateChange={onBlueprintStateChange}
      />

      {/* LAYERED DISTANT BACKGROUND ISLANDS (Strictly outside the 32x32 orbit volume) */}
      <CastleIsland position={[-20.0, 5.5, -28]} scale={0.72} />
      <LighthouseIsland position={[21.0, 4.5, -26]} scale={0.68} />
      <WaterfallIsland position={[-23.0, -3.5, -22]} scale={0.82} />
      <StoneArchIsland position={[23.0, -4.0, -24]} scale={0.78} />
      <TinyIsland position={[-14.5, 9.0, -34]} scale={0.52} accent="#2ec54d" />
      <TinyIsland position={[16.0, 8.5, -32]} scale={0.55} accent="#34cc55" />
      <TinyIsland position={[0.2, -9.0, -30]} scale={0.65} accent="#26b843" />

      {/* STYLIZED VOLUMETRIC CLOUDS (Positioned outside the 32x32 Build Area Clear Zone) */}
      <VolumetricCloud position={[-26.0, -5.5, 14]} scale={1.8} speed={0.05} opacity={0.75} />
      <VolumetricCloud position={[28.0, 7.0, 12]} scale={1.7} speed={0.06} opacity={0.8} />
      <VolumetricCloud position={[-28.0, 5.0, -18]} scale={2.2} speed={0.06} />
      <VolumetricCloud position={[28.0, 3.0, -18]} scale={2.3} speed={0.055} />
      <VolumetricCloud position={[0, 18.0, -34]} scale={2.5} speed={0.05} />
      <VolumetricCloud position={[-34, 11.0, -42]} scale={3.6} speed={0.035} opacity={0.92} />
      <VolumetricCloud position={[32, 9.0, -44]} scale={3.8} speed={0.03} opacity={0.92} />
      <VolumetricCloud position={[-18, -14.0, -34]} scale={3.2} speed={0.04} opacity={0.88} />
      <VolumetricCloud position={[20, -15.0, -36]} scale={3.3} speed={0.038} opacity={0.88} />

      {/* DISTANT DECORATIVE SKY BRICKS (Strictly outside the 32x32 Build Area Clear Zone) */}
      <FloatingBrick position={[-26.0, 18.0, -32.0]} color="#ff333a" type="2x4" scale={1.2} rotSpeed={[0.15, 0.25, 0.1]} />
      <FloatingBrick position={[26.0, 17.0, -30.0]} color="#ffc400" type="2x2" scale={1.0} rotSpeed={[0.2, -0.2, 0.12]} />
      <FloatingBrick position={[-22.0, 20.0, -36.0]} color="#0a7cf5" type="2x4" scale={1.1} rotSpeed={[-0.1, 0.2, -0.1]} />
      <FloatingBrick position={[22.0, 16.0, -28.0]} color="#22c55e" type="2x2" scale={0.9} rotSpeed={[0.15, -0.15, 0.2]} />
    </>
  );
}

class SkyErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface SkySceneProps {
  mode?: GameMode;
  onTransitionComplete?: () => void;
  buildSceneRef?: React.RefObject<BuildSceneHandle | null>;
  onSelectBrick?: (brick: BrickData | null) => void;
  onRotationChange?: (rotation: BrickRotation) => void;
  onTypeChange?: (type: import("./BrickCatalog").BrickTypeId) => void;
  onColorChange?: (color: string) => void;
  onBrickPlacedSound?: (brick: BrickData) => void;
  onDebugUpdate?: (info: import("./BuildScene").BuildDebugInfo) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onMoveModeChange?: (isMoving: boolean) => void;
  onSelectionChange?: (selectedIds: string[], selectedBricks: BrickData[]) => void;
  onBoxSelectChange?: (isBoxSelecting: boolean, rect: { x: number; y: number; width: number; height: number } | null) => void;
  isMultiSelectMode?: boolean;
  isBoxSelecting?: boolean;
  onBricksChange?: (bricks: BrickData[]) => void;
  editorMode?: EditorMode;
  buildTool?: BuildTool;
  onBuildToolChange?: (tool: BuildTool) => void;
  onLineToolStateChange?: (step: "start" | "end" | null, count: number) => void;
  onAreaToolStateChange?: (step: "start" | "end" | null, count: number) => void;
  placedBricks?: BrickData[];
  onExitWalk?: () => void;
  mobileWalkInput?: MobileWalkInput;
  onPointerLockChange?: (isLocked: boolean) => void;
  walkHeightPreset?: WalkHeightPreset;
  onCycleHeightPreset?: () => void;
  recenterTrigger?: number;
  worldType?: WorldType;
  worldSize?: WorldSize;
  seed?: number;
  viewDistance?: "low" | "medium" | "high";
  playerSpawn?: [number, number, number];
  lastPlayerPosition?: [number, number, number];
  lastPlayerYaw?: number;
  onPlayerPositionChange?: (pos: [number, number, number], yaw: number) => void;
  terrainBrushConfig?: TerrainBrushConfig;
  terrainMods?: Record<string, { terrainMod?: ChunkTerrainMod }>;
  onTerrainChange?: (modifiedChunks: Record<string, ChunkTerrainMod>, affectedChunkKeys: string[]) => void;
  onChunksExplored?: (chunkKeys: string[]) => void;
  onBlueprintStateChange?: (state: import("./BuildScene").BlueprintPlacementState) => void;
  lastSafePos?: [number, number, number];
  homeSpawnPos?: [number, number, number];
  onSafePositionChange?: (pos: [number, number, number]) => void;
  teleportTarget?: [number, number, number] | null;
  onTeleportComplete?: () => void;
  environment?: WorldEnvironmentState;
  graphicsQuality?: GraphicsQuality;
  reducedLightningFlash?: boolean;
  lightningFlashActive?: boolean;
  onLightningEvent?: (delayMs: number, intensity: number) => void;
  onFlashVisual?: () => void;
  onAdvanceEnvironment?: (delta: number) => void;
}

function SkySceneInner({
  mode = "home",
  onTransitionComplete,
  buildSceneRef,
  onSelectBrick,
  onRotationChange,
  onTypeChange,
  onColorChange,
  onBrickPlacedSound,
  onDebugUpdate,
  onHistoryChange,
  onMoveModeChange,
  onSelectionChange,
  onBoxSelectChange,
  isMultiSelectMode,
  isBoxSelecting,
  onBricksChange,
  editorMode = "build",
  buildTool,
  onBuildToolChange,
  onLineToolStateChange,
  onAreaToolStateChange,
  placedBricks = [],
  onExitWalk,
  mobileWalkInput,
  onPointerLockChange,
  walkHeightPreset,
  onCycleHeightPreset,
  recenterTrigger,
  worldType = "island",
  worldSize = "small",
  seed = 12345,
  viewDistance = "medium",
  playerSpawn = [0, 0, 11.2],
  lastPlayerPosition,
  lastPlayerYaw,
  onPlayerPositionChange,
  terrainBrushConfig,
  terrainMods,
  onTerrainChange,
  onChunksExplored,
  onBlueprintStateChange,
  lastSafePos,
  homeSpawnPos,
  onSafePositionChange,
  teleportTarget,
  onTeleportComplete,
  environment,
  graphicsQuality,
  reducedLightningFlash,
  lightningFlashActive,
  onLightningEvent,
  onFlashVisual,
  onAdvanceEnvironment,
}: SkySceneProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => setReducedMotion(mediaQuery.matches);
    syncMotionPreference();
    mediaQuery.addEventListener("change", syncMotionPreference);
    return () => mediaQuery.removeEventListener("change", syncMotionPreference);
  }, []);

  return (
    <div className="sky-scene" aria-hidden={mode === "home" ? "true" : undefined} suppressHydrationWarning>
      <SkyErrorBoundary fallback={<div className="sky-gradient-fallback" />}>
        <Canvas
          shadows
          dpr={[1, 1.6]}
          camera={{ position: [0, 0.4, 13.5], fov: 44, near: 0.1, far: 350 }}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.15,
          }}
        >
          <Suspense fallback={null}>
            <World
              mode={mode}
              onTransitionComplete={onTransitionComplete}
              reducedMotion={reducedMotion}
              buildSceneRef={buildSceneRef}
              onSelectBrick={onSelectBrick}
              onRotationChange={onRotationChange}
              onBrickPlacedSound={onBrickPlacedSound}
              onTypeChange={onTypeChange}
              onColorChange={onColorChange}
              onDebugUpdate={onDebugUpdate}
              onHistoryChange={onHistoryChange}
              onMoveModeChange={onMoveModeChange}
              onSelectionChange={onSelectionChange}
              onBoxSelectChange={onBoxSelectChange}
              isMultiSelectMode={isMultiSelectMode}
              isBoxSelecting={isBoxSelecting}
              onBricksChange={onBricksChange}
              editorMode={editorMode}
              buildTool={buildTool}
              onBuildToolChange={onBuildToolChange}
              onLineToolStateChange={onLineToolStateChange}
              onAreaToolStateChange={onAreaToolStateChange}
              placedBricks={placedBricks}
              onExitWalk={onExitWalk}
              mobileWalkInput={mobileWalkInput}
              onPointerLockChange={onPointerLockChange}
              walkHeightPreset={walkHeightPreset}
              onCycleHeightPreset={onCycleHeightPreset}
              recenterTrigger={recenterTrigger}
              worldType={worldType}
              worldSize={worldSize}
              seed={seed}
              viewDistance={viewDistance}
              playerSpawn={playerSpawn}
              lastPlayerPosition={lastPlayerPosition}
              lastPlayerYaw={lastPlayerYaw}
              onPlayerPositionChange={onPlayerPositionChange}
              terrainBrushConfig={terrainBrushConfig}
              terrainMods={terrainMods}
              onTerrainChange={onTerrainChange}
              onChunksExplored={onChunksExplored}
              onBlueprintStateChange={onBlueprintStateChange}
              lastSafePos={lastSafePos}
              homeSpawnPos={homeSpawnPos}
              onSafePositionChange={onSafePositionChange}
              teleportTarget={teleportTarget}
              onTeleportComplete={onTeleportComplete}
              environment={environment}
              graphicsQuality={graphicsQuality}
              reducedLightningFlash={reducedLightningFlash}
              lightningFlashActive={lightningFlashActive}
              onLightningEvent={onLightningEvent}
              onFlashVisual={onFlashVisual}
              onAdvanceEnvironment={onAdvanceEnvironment}
            />
          </Suspense>
        </Canvas>
      </SkyErrorBoundary>
    </div>
  );
}

export const SkyScene = memo(SkySceneInner);
