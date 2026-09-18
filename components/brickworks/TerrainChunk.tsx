"use client";

import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WorldType, WorldSize, ChunkTerrainMod } from "./WorldStorage";
import {
  sampleTerrain,
  generateChunkDecorations,
  WATER_LEVEL,
} from "./TerrainGenerator";
import { CHUNK_SIZE, STUD_PITCH } from "./GridSystem";
import { WaterMesh } from "./WaterMesh";

interface TerrainChunkProps {
  chunkX: number;
  chunkZ: number;
  worldType: WorldType;
  worldSize: WorldSize;
  seed: number;
  terrainMod?: ChunkTerrainMod;
  onPointerMove?: (e: { point: THREE.Vector3; normal: THREE.Vector3 }) => void;
  onPointerLeave?: () => void;
  onClick?: (e: { point: THREE.Vector3; normal: THREE.Vector3 }) => void;
}

const COLOR_GRASS = new THREE.Color("#36cf5a");
const COLOR_GRASS_ALT = new THREE.Color("#2dbb4f");
const COLOR_SOIL = new THREE.Color("#7a4a25");
const COLOR_ROCK = new THREE.Color("#525e6e");
const COLOR_SAND = new THREE.Color("#d8be6c");

export function TerrainChunk({
  chunkX,
  chunkZ,
  worldType,
  worldSize,
  seed,
  terrainMod,
  onPointerMove,
  onPointerLeave,
  onClick,
}: TerrainChunkProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const chunkOriginX = chunkX * CHUNK_SIZE * STUD_PITCH;
  const chunkOriginZ = chunkZ * CHUNK_SIZE * STUD_PITCH;

  // Generate chunk terrain geometry
  const { geometry, isAllVoid, hasWater } = useMemo(() => {
    const res = 8; // 8x8 quads per 16-stud chunk (ample detail, fast generation)
    const step = (CHUNK_SIZE * STUD_PITCH) / res;
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    let voidCount = 0;
    const totalVerts = (res + 1) * (res + 1);
    let anyWater = false;

    // Grid heights and void status cache
    const gridData: Array<{
      x: number;
      y: number;
      z: number;
      isVoid: boolean;
      color: THREE.Color;
      undersideY: number;
    }> = [];

    for (let iz = 0; iz <= res; iz++) {
      for (let ix = 0; ix <= res; ix++) {
        const vertIndex = iz * (res + 1) + ix;
        const lx = ix * step;
        const lz = iz * step;
        const wx = chunkOriginX + lx;
        const wz = chunkOriginZ + lz;

        const sample = sampleTerrain(worldType, worldSize, seed, wx, wz);

        if (sample.isVoid) {
          voidCount++;
          gridData.push({
            x: lx,
            y: -999,
            z: lz,
            isVoid: true,
            color: COLOR_ROCK,
            undersideY: -999,
          });
          continue;
        }

        const modifiedHeight = terrainMod?.heights?.[vertIndex];
        const finalHeight = modifiedHeight !== undefined ? modifiedHeight : sample.heightWorld;

        if (sample.surfaceType === "water" || finalHeight <= WATER_LEVEL + 0.05) {
          anyWater = true;
        }

        const effectiveMaterial = terrainMod?.materials?.[vertIndex] || sample.surfaceType;
        let c = COLOR_GRASS;
        if (effectiveMaterial === "rock") {
          c = COLOR_ROCK;
        } else if (effectiveMaterial === "soil") {
          c = COLOR_SOIL;
        } else if (effectiveMaterial === "sand") {
          c = COLOR_SAND;
        } else if ((ix + iz) % 2 === 0) {
          c = COLOR_GRASS_ALT;
        }

        gridData.push({
          x: lx,
          y: finalHeight,
          z: lz,
          isVoid: false,
          color: c,
          undersideY: sample.undersideY ?? -1.5,
        });
      }
    }

    // Entire chunk is outside island / bounds
    if (voidCount === totalVerts) {
      return { geometry: null, isAllVoid: true, hasWater: false };
    }

    // Build top surface quads
    const getIdx = (ix: number, iz: number) => iz * (res + 1) + ix;

    for (let iz = 0; iz < res; iz++) {
      for (let ix = 0; ix < res; ix++) {
        const i0 = getIdx(ix, iz);
        const i1 = getIdx(ix + 1, iz);
        const i2 = getIdx(ix, iz + 1);
        const i3 = getIdx(ix + 1, iz + 1);

        const d0 = gridData[i0];
        const d1 = gridData[i1];
        const d2 = gridData[i2];
        const d3 = gridData[i3];

        if (d0.isVoid || d1.isVoid || d2.isVoid || d3.isVoid) {
          continue;
        }

        const baseV = vertices.length / 3;

        // Tri 1: 0 - 2 - 1
        vertices.push(d0.x, d0.y, d0.z);
        colors.push(d0.color.r, d0.color.g, d0.color.b);

        vertices.push(d2.x, d2.y, d2.z);
        colors.push(d2.color.r, d2.color.g, d2.color.b);

        vertices.push(d1.x, d1.y, d1.z);
        colors.push(d1.color.r, d1.color.g, d1.color.b);

        // Tri 2: 1 - 2 - 3
        vertices.push(d1.x, d1.y, d1.z);
        colors.push(d1.color.r, d1.color.g, d1.color.b);

        vertices.push(d2.x, d2.y, d2.z);
        colors.push(d2.color.r, d2.color.g, d2.color.b);

        vertices.push(d3.x, d3.y, d3.z);
        colors.push(d3.color.r, d3.color.g, d3.color.b);

        indices.push(baseV, baseV + 1, baseV + 2, baseV + 3, baseV + 4, baseV + 5);

        // For floating islands: generate tapering rocky underside
        if (worldType === "island") {
          const underBaseV = vertices.length / 3;
          // Bottom face connecting to underside rock
          vertices.push(d0.x, d0.undersideY, d0.z);
          colors.push(COLOR_ROCK.r, COLOR_ROCK.g, COLOR_ROCK.b);

          vertices.push(d1.x, d1.undersideY, d1.z);
          colors.push(COLOR_ROCK.r, COLOR_ROCK.g, COLOR_ROCK.b);

          vertices.push(d2.x, d2.undersideY, d2.z);
          colors.push(COLOR_ROCK.r, COLOR_ROCK.g, COLOR_ROCK.b);

          vertices.push(d3.x, d3.undersideY, d3.z);
          colors.push(COLOR_ROCK.r, COLOR_ROCK.g, COLOR_ROCK.b);

          indices.push(
            underBaseV,
            underBaseV + 1,
            underBaseV + 2,
            underBaseV + 2,
            underBaseV + 1,
            underBaseV + 3
          );
        }
      }
    }

    if (vertices.length === 0) {
      return { geometry: null, isAllVoid: true, hasWater: false };
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    // Synchronize border vertex normals via continuous central-difference gradient
    // to eliminate normal shading seams under directional sunlight across chunk boundaries.
    const normalAttr = geo.getAttribute("normal");
    const posAttr = geo.getAttribute("position");
    const eps = 0.1;
    const chunkSpan = CHUNK_SIZE * STUD_PITCH;

    for (let i = 0; i < posAttr.count; i++) {
      const lx = posAttr.getX(i);
      const ly = posAttr.getY(i);
      const lz = posAttr.getZ(i);

      // Identify chunk boundary vertices on the upper terrain surface
      const isBorder =
        Math.abs(lx) < 0.001 ||
        Math.abs(lx - chunkSpan) < 0.001 ||
        Math.abs(lz) < 0.001 ||
        Math.abs(lz - chunkSpan) < 0.001;

      if (isBorder && ly > -1.0) {
        const wx = chunkOriginX + lx;
        const wz = chunkOriginZ + lz;

        const hR = sampleTerrain(worldType, worldSize, seed, wx + eps, wz).heightWorld;
        const hL = sampleTerrain(worldType, worldSize, seed, wx - eps, wz).heightWorld;
        const hD = sampleTerrain(worldType, worldSize, seed, wx, wz + eps).heightWorld;
        const hU = sampleTerrain(worldType, worldSize, seed, wx, wz - eps).heightWorld;

        const dX = (hR - hL) / (2 * eps);
        const dZ = (hD - hU) / (2 * eps);
        const len = Math.sqrt(dX * dX + 1.0 + dZ * dZ);

        normalAttr.setXYZ(i, -dX / len, 1.0 / len, -dZ / len);
      }
    }
    normalAttr.needsUpdate = true;

    return { geometry: geo, isAllVoid: false, hasWater: anyWater };
  }, [chunkOriginX, chunkOriginZ, seed, terrainMod, worldSize, worldType]);

  // Scenery decorations (trees, rocks)
  const decorations = useMemo(() => {
    if (isAllVoid) return [];
    return generateChunkDecorations(worldType, worldSize, seed, chunkX, chunkZ);
  }, [chunkX, chunkZ, isAllVoid, seed, worldSize, worldType]);

  // Clean disposal on unmount to prevent WebGL memory leaks
  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (isAllVoid || !geometry) {
    return null;
  }

  const chunkSpan = CHUNK_SIZE * STUD_PITCH;

  return (
    <group position={[chunkOriginX, 0, chunkOriginZ]}>
      {/* Terrain Mesh Surface */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        receiveShadow
        castShadow
        onPointerMove={(e) => {
          e.stopPropagation();
          if (e.point) {
            onPointerMove?.({
              point: e.point,
              normal: e.face?.normal || new THREE.Vector3(0, 1, 0),
            });
          }
        }}
        onPointerLeave={() => {
          onPointerLeave?.();
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (e.point) {
            onClick?.({
              point: e.point,
              normal: e.face?.normal || new THREE.Vector3(0, 1, 0),
            });
          }
        }}
      >
        <meshStandardMaterial
          vertexColors
          roughness={0.7}
          metalness={0.04}
          flatShading={worldType === "natural"}
        />
      </mesh>

      {/* Animated Water Surface for chunks containing lakes/valleys */}
      {hasWater && worldType === "natural" && (
        <WaterMesh
          size={chunkSpan}
          position={[chunkSpan / 2, WATER_LEVEL - 0.04, chunkSpan / 2]}
        />
      )}

      {/* Deterministic Vegetation & Scenery */}
      {decorations.map((item, idx) => {
        const localX = item.worldX - chunkOriginX;
        const localZ = item.worldZ - chunkOriginZ;

        if (item.type === "rock") {
          return (
            <mesh
              key={idx}
              position={[localX, item.worldY + 0.25, localZ]}
              rotation={[0, item.rotationY, 0]}
              scale={item.scale}
              castShadow
              receiveShadow
            >
              <dodecahedronGeometry args={[0.42, 0]} />
              <meshStandardMaterial color="#687584" roughness={0.9} />
            </mesh>
          );
        }

        // Stylized block tree with gentle wind sway
        return (
          <WindSwayTree
            key={idx}
            item={item}
            localX={localX}
            localZ={localZ}
          />
        );
      })}
    </group>
  );
}

function WindSwayTree({
  item,
  localX,
  localZ,
}: {
  item: { type: "pine" | "oak" | "rock"; worldX: number; worldY: number; worldZ: number; scale: number; rotationY: number };
  localX: number;
  localZ: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const isPine = item.type === "pine";

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    // Gentle natural sinusoidal sway with spatial phase offset
    groupRef.current.rotation.z = Math.sin(t * 1.8 + localX * 0.4 + localZ * 0.3) * 0.025;
    groupRef.current.rotation.x = Math.cos(t * 1.4 + localX * 0.3) * 0.015;
  });

  return (
    <group
      ref={groupRef}
      position={[localX, item.worldY, localZ]}
      rotation={[0, item.rotationY, 0]}
      scale={item.scale}
    >
      {/* Trunk */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.26, 0.9, 0.26]} />
        <meshStandardMaterial color="#683d20" roughness={0.85} />
      </mesh>
      {/* Foliage */}
      {isPine ? (
        <>
          <mesh position={[0, 1.05, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.05, 0.52, 1.05]} />
            <meshStandardMaterial color="#1a8434" roughness={0.65} />
          </mesh>
          <mesh position={[0, 1.48, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.78, 0.45, 0.78]} />
            <meshStandardMaterial color="#23a442" roughness={0.65} />
          </mesh>
          <mesh position={[0, 1.86, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.48, 0.38, 0.48]} />
            <meshStandardMaterial color="#35c858" roughness={0.65} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 1.15, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.95, 1.2]} />
            <meshStandardMaterial color="#20b540" roughness={0.65} />
          </mesh>
          <mesh position={[0.1, 1.68, -0.05]} castShadow receiveShadow>
            <boxGeometry args={[0.82, 0.5, 0.82]} />
            <meshStandardMaterial color="#3de262" roughness={0.65} />
          </mesh>
        </>
      )}
    </group>
  );
}
