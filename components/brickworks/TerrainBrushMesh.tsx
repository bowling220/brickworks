"use client";

import { useMemo } from "react";
import * as THREE from "three";
import {
  TerrainTool,
  BRUSH_SIZE_CONFIG,
  TerrainBrushConfig,
} from "./TerrainBrush";

interface TerrainBrushMeshProps {
  position: [number, number, number];
  config: TerrainBrushConfig;
}

const TOOL_COLORS: Record<TerrainTool, string> = {
  raise: "#f59e0b",   // Amber
  lower: "#06b6d4",   // Cyan
  flatten: "#a855f7", // Purple
  smooth: "#10b981",  // Emerald
  paint: "#ec4899",   // Fallback
};

const PAINT_COLORS: Record<string, string> = {
  grass: "#22c55e",
  soil: "#854d0e",
  dirt: "#854d0e",
  rock: "#64748b",
  stone: "#64748b",
  sand: "#eab308",
};

export function TerrainBrushMesh({ position, config }: TerrainBrushMeshProps) {
  const radius = typeof config.size === "number" ? config.size : BRUSH_SIZE_CONFIG[config.sizePreset || "medium"].radius;

  const activeColor = useMemo(() => {
    if (config.tool === "paint") {
      const mat = config.material || config.paintMaterial || "grass";
      return PAINT_COLORS[mat] || "#ec4899";
    }
    return TOOL_COLORS[config.tool] || "#ffffff";
  }, [config.tool, config.material, config.paintMaterial]);

  return (
    <group position={[position[0], position[1] + 0.08, position[2]]}>
      {/* Outer Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.08, radius + 0.08, 64]} />
        <meshBasicMaterial
          color={activeColor}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Inner Translucent Fill */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius - 0.08, 48]} />
        <meshBasicMaterial
          color={activeColor}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Center Target Dot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
