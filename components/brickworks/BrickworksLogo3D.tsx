"use client";

import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { Component, type ReactNode, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import helvetikerBold from "three/examples/fonts/helvetiker_bold.typeface.json";

export interface LetterConfig {
  character: string;
  color: string;
  x: number;
  y: number;
  z: number;
  rotZ: number;
  rotY: number;
  studs: number[];
}

export const logoFont = new FontLoader().parse(helvetikerBold);

export const letters: readonly LetterConfig[] = [
  { character: "B", color: "#ff333a", x: -5.48, y: 0.06, z: 0.08, rotZ: 0.035, rotY: -0.04, studs: [0.32, 0.74] },
  { character: "R", color: "#ff9d00", x: -4.38, y: -0.03, z: -0.05, rotZ: -0.025, rotY: 0.03, studs: [0.3, 0.7] },
  { character: "I", color: "#0088ff", x: -3.28, y: 0.05, z: 0.06, rotZ: 0.03, rotY: -0.03, studs: [0.5] },
  { character: "C", color: "#22c55e", x: -2.48, y: -0.04, z: -0.06, rotZ: -0.03, rotY: 0.04, studs: [0.3, 0.72] },
  { character: "K", color: "#ff6a00", x: -1.36, y: 0.03, z: 0.06, rotZ: 0.02, rotY: -0.03, studs: [0.28, 0.72] },
  { character: "W", color: "#0a7cf5", x: -0.13, y: -0.04, z: -0.04, rotZ: -0.02, rotY: 0.03, studs: [0.25, 0.5, 0.75] },
  { character: "O", color: "#ffc400", x: 1.32, y: 0.05, z: 0.08, rotZ: 0.03, rotY: -0.04, studs: [0.32, 0.68] },
  { character: "R", color: "#ff333a", x: 2.44, y: -0.03, z: -0.05, rotZ: -0.02, rotY: 0.025, studs: [0.3, 0.7] },
  { character: "K", color: "#22c55e", x: 3.52, y: 0.04, z: 0.06, rotZ: 0.025, rotY: -0.03, studs: [0.28, 0.72] },
  { character: "S", color: "#0088ff", x: 4.57, y: -0.03, z: 0.02, rotZ: -0.025, rotY: 0.035, studs: [0.32, 0.68] },
] as const;

/**
 * Chunky molded-plastic letter with deep extrusion, smooth bevels,
 * vibrant gloss, and toy stud highlights.
 */
export function ChunkyLetter({ config }: { config: LetterConfig }) {
  const { character, color, x, y, z, rotZ, rotY, studs } = config;

  const geometry = useMemo(() => new TextGeometry(character, {
    font: logoFont,
    size: 1.48,
    depth: 0.95, // substantially deeper extrusion
    curveSegments: 10,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.09,
    bevelSegments: 5,
  }), [character]);

  const letterWidth = useMemo(() => {
    geometry.computeBoundingBox();
    return geometry.boundingBox ? geometry.boundingBox.max.x - geometry.boundingBox.min.x : 0.9;
  }, [geometry]);

  const sideColor = useMemo(() => new THREE.Color(color).multiplyScalar(0.72), [color]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group
      position={[x, y, z]}
      rotation={[0, rotY, rotZ]}
    >
      {/* Molded plastic letter with dual material (gloss front face + rich glossy side) */}
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          attach="material-0"
          color={color}
          roughness={0.14}
          metalness={0.02}
          clearcoat={1.0}
          clearcoatRoughness={0.08}
          reflectivity={0.95}
        />
        <meshPhysicalMaterial
          attach="material-1"
          color={sideColor}
          roughness={0.22}
          metalness={0.01}
          clearcoat={0.8}
          clearcoatRoughness={0.15}
        />
      </mesh>

      {/* Chunky toy studs on the top face */}
      {studs.map((ratio, sIdx) => {
        const studX = letterWidth * ratio;
        return (
          <group key={sIdx} position={[studX, 1.58, 0.48]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.16, 0.17, 0.22, 24]} />
              <meshPhysicalMaterial
                color={color}
                roughness={0.15}
                clearcoat={1.0}
                clearcoatRoughness={0.08}
              />
            </mesh>
            {/* Gloss rim highlight disc on top of stud */}
            <mesh position={[0, 0.115, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.13, 24]} />
              <meshBasicMaterial
                color={new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.28)}
                transparent
                opacity={0.65}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/**
 * Compact floating island directly underneath the BRICKWORKS logo:
 * - Dimensional green grass/brick top layer with toy studs
 * - Stepped brown dirt blocks
 * - Deep irregular stone/rock underside with shadow depth
 */
export function CompactHeroIsland() {
  // Stepped dirt block variations centered symmetrically around 0
  const dirtBlocks = useMemo(() => [
    { pos: [-4.5, -0.42, 0.6] as [number, number, number], size: [1.3, 0.55, 1.1] as [number, number, number], color: "#7c4a2a" },
    { pos: [-3.0, -0.48, -0.5] as [number, number, number], size: [1.4, 0.65, 1.2] as [number, number, number], color: "#8b5330" },
    { pos: [-1.5, -0.44, 0.7] as [number, number, number], size: [1.5, 0.58, 1.0] as [number, number, number], color: "#6e3f22" },
    { pos: [0.0, -0.52, -0.6] as [number, number, number], size: [1.6, 0.7, 1.3] as [number, number, number], color: "#824c2b" },
    { pos: [1.5, -0.46, 0.7] as [number, number, number], size: [1.5, 0.58, 1.0] as [number, number, number], color: "#784627" },
    { pos: [3.0, -0.5, -0.5] as [number, number, number], size: [1.4, 0.66, 1.2] as [number, number, number], color: "#8d5532" },
    { pos: [4.5, -0.44, 0.6] as [number, number, number], size: [1.3, 0.56, 1.1] as [number, number, number], color: "#704123" },
  ], []);

  // Irregular rocky underside blocks tapering downward centered around 0
  const rockBlocks = useMemo(() => [
    { pos: [-3.6, -0.95, 0.1] as [number, number, number], size: [1.8, 0.8, 1.6] as [number, number, number], rot: 0.05, color: "#5a6676" },
    { pos: [-1.8, -1.15, -0.2] as [number, number, number], size: [2.1, 1.0, 1.8] as [number, number, number], rot: -0.06, color: "#4f5a69" },
    { pos: [0.0, -1.35, 0.2] as [number, number, number], size: [2.4, 1.1, 2.0] as [number, number, number], rot: 0.04, color: "#434d5a" },
    { pos: [1.8, -1.1, -0.2] as [number, number, number], size: [2.1, 1.0, 1.8] as [number, number, number], rot: -0.05, color: "#54606f" },
    { pos: [3.6, -0.92, 0.1] as [number, number, number], size: [1.8, 0.8, 1.6] as [number, number, number], rot: 0.07, color: "#5f6c7d" },
    // Lower taper point
    { pos: [-1.0, -1.85, 0.1] as [number, number, number], size: [1.5, 0.9, 1.4] as [number, number, number], rot: 0.08, color: "#373e49" },
    { pos: [1.0, -1.95, -0.1] as [number, number, number], size: [1.5, 0.9, 1.4] as [number, number, number], rot: -0.08, color: "#323943" },
    { pos: [0.0, -2.55, 0.0] as [number, number, number], size: [1.2, 0.9, 1.1] as [number, number, number], rot: 0.05, color: "#282d36" },
  ], []);

  // Grass studs on top of the island surface
  const grassStuds = useMemo(() => {
    const list: [number, number][] = [];
    for (let x = -5.1; x <= 5.1; x += 0.85) {
      for (let z = -1.1; z <= 1.1; z += 0.75) {
        list.push([x, z]);
      }
    }
    return list;
  }, []);

  return (
    <group position={[0, -0.85, 0]} rotation={[-0.015, 0, 0]}>
      {/* Main vibrant green grass top slab */}
      <RoundedBox args={[11.6, 0.38, 2.8]} radius={0.16} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial color="#2ec748" roughness={0.48} metalness={0.02} />
      </RoundedBox>

      {/* Grass edge extension slabs for natural stepped block silhouette */}
      <RoundedBox args={[3.2, 0.26, 0.6]} radius={0.1} smoothness={2} position={[-3.0, -0.15, 1.3]} castShadow receiveShadow>
        <meshStandardMaterial color="#28ba41" roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[3.2, 0.26, 0.6]} radius={0.1} smoothness={2} position={[3.0, -0.15, 1.3]} castShadow receiveShadow>
        <meshStandardMaterial color="#28ba41" roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[2.8, 0.24, 0.5]} radius={0.1} smoothness={2} position={[0, -0.16, -1.35]} castShadow receiveShadow>
        <meshStandardMaterial color="#24aa3b" roughness={0.52} />
      </RoundedBox>

      {/* Grid of toy studs across the grass surface */}
      {grassStuds.map(([gx, gz], idx) => (
        <mesh key={idx} position={[gx, 0.23, gz]} castShadow receiveShadow>
          <cylinderGeometry args={[0.11, 0.115, 0.1, 16]} />
          <meshStandardMaterial color="#2ec748" roughness={0.45} />
        </mesh>
      ))}

      {/* Exposed brown dirt layer */}
      {dirtBlocks.map((block, idx) => (
        <RoundedBox
          key={`dirt-${idx}`}
          args={block.size}
          radius={0.08}
          smoothness={2}
          position={block.pos}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={block.color} roughness={0.88} />
        </RoundedBox>
      ))}

      {/* Tapered irregular stone/rock underside with deep contrasting shadows */}
      {rockBlocks.map((rock, idx) => (
        <RoundedBox
          key={`rock-${idx}`}
          args={rock.size}
          radius={0.1}
          smoothness={2}
          position={rock.pos}
          rotation={[rock.rot, rock.rot * 1.5, -rock.rot]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={rock.color} roughness={0.92} metalness={0.05} />
        </RoundedBox>
      ))}

      {/* Inverted rocky base tip */}
      <mesh position={[0, -2.85, 0]} rotation={[0, Math.PI / 4, Math.PI]} castShadow receiveShadow>
        <coneGeometry args={[0.95, 1.4, 5]} />
        <meshStandardMaterial color="#23272e" roughness={0.95} />
      </mesh>

      {/* Accent mini block flowers on the grass corners */}
      <group position={[-5.0, 0.26, 0.9]}>
        <mesh position={[0, 0.08, 0]}><boxGeometry args={[0.12, 0.16, 0.12]} /><meshStandardMaterial color="#1a8a2d" /></mesh>
        <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.26, 0.16, 0.26]} /><meshStandardMaterial color="#ffdd33" roughness={0.2} /></mesh>
      </group>
      <group position={[5.0, 0.26, 0.8]}>
        <mesh position={[0, 0.08, 0]}><boxGeometry args={[0.12, 0.16, 0.12]} /><meshStandardMaterial color="#1a8a2d" /></mesh>
        <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.26, 0.16, 0.26]} /><meshStandardMaterial color="#ff3355" roughness={0.2} /></mesh>
      </group>
    </group>
  );
}

/**
 * Hero centerpiece group: chunky BRICKWORKS logo mounted onto the compact floating island.
 * Features gentle vertical floating and calm playful sway.
 */
export function HeroIslandWithLogo({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const rootGroup = useRef<THREE.Group>(null);
  const logoGroup = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.getElapsedTime();

    // Gentle vertical float for the entire hero island
    if (rootGroup.current) {
      rootGroup.current.position.y = Math.sin(t * 0.78) * 0.12;
      rootGroup.current.rotation.z = Math.sin(t * 0.42) * 0.012;
      rootGroup.current.rotation.x = 0.04 + Math.cos(t * 0.5) * 0.01;
    }

    // Extremely subtle independent sway for the logo
    if (logoGroup.current) {
      logoGroup.current.rotation.y = -0.05 + Math.sin(t * 0.6) * 0.02;
    }
  });

  return (
    <group ref={rootGroup} position={[0, 0.85, 0]}>
      <CompactHeroIsland />
      <group ref={logoGroup} position={[0, 0.1, 0]}>
        {letters.map((cfg) => (
          <ChunkyLetter key={cfg.character + cfg.x} config={cfg} />
        ))}
      </group>
    </group>
  );
}

export function FlatLogoFallback() {
  return (
    <h1 className="brick-logo-fallback" aria-label="BRICKWORKS">
      {letters.map(({ character, color }, index) => (
        <span key={`${character}-${index}`} style={{ color }}>{character}</span>
      ))}
    </h1>
  );
}

export class LogoErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Accessibility fallback / container for BRICKWORKS logo
 */
export function BrickworksLogo3D() {
  return (
    <div className="logo-wrap" aria-hidden="true">
      <LogoErrorBoundary fallback={<FlatLogoFallback />}>
        <FlatLogoFallback />
      </LogoErrorBoundary>
      <span id="brickworks-title" className="sr-only">BRICKWORKS</span>
    </div>
  );
}
