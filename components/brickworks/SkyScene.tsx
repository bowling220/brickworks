"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, RoundedBox } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

function Cloud({ position, scale = 1, speed = 0.12 }: { position: [number, number, number]; scale?: number; speed?: number }) {
  const ref = useRef<THREE.Group>(null);
  const start = position[0];
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.position.x += delta * speed;
    if (ref.current.position.x > 12) ref.current.position.x = -12 + (start % 2);
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      {([[-1.25, 0, 0, 1.05], [-0.35, 0.3, 0, 1.35], [0.7, 0.08, 0, 1.05], [1.45, -0.08, 0, 0.72]] as const).map(([x, y, z, s], index) => (
        <mesh key={index} position={[x, y, z]} scale={s}>
          <sphereGeometry args={[0.65, 20, 16]} />
          <meshStandardMaterial color="#ffffff" roughness={0.82} transparent opacity={0.86} />
        </mesh>
      ))}
    </group>
  );
}

function Tree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.24, 0]}><boxGeometry args={[0.2, 0.55, 0.2]} /><meshStandardMaterial color="#7d4a2e" roughness={0.8} /></mesh>
      <mesh position={[0, 0.65, 0]}><boxGeometry args={[0.58, 0.5, 0.58]} /><meshStandardMaterial color="#38bd4f" roughness={0.65} /></mesh>
      <mesh position={[0.05, 0.98, -0.02]}><boxGeometry args={[0.38, 0.28, 0.38]} /><meshStandardMaterial color="#58da61" roughness={0.65} /></mesh>
    </group>
  );
}

function Island({ position, scale = 1, accent = "#4fcc57" }: { position: [number, number, number]; scale?: number; accent?: string }) {
  return (
    <Float speed={0.7} rotationIntensity={0.08} floatIntensity={0.35} floatingRange={[-0.12, 0.12]}>
      <group position={position} scale={scale}>
        <RoundedBox args={[3.2, 0.55, 2.2]} radius={0.2} smoothness={2} position={[0, 0.15, 0]}><meshStandardMaterial color={accent} roughness={0.66} /></RoundedBox>
        <RoundedBox args={[2.95, 0.55, 1.95]} radius={0.18} smoothness={2} position={[0, -0.27, 0]}><meshStandardMaterial color="#8f5637" roughness={0.8} /></RoundedBox>
        <mesh position={[0, -0.92, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[1.35, 1.6, 4]} /><meshStandardMaterial color="#6c5660" roughness={0.9} /></mesh>
        <Tree position={[-0.65, 0.55, -0.25]} /><Tree position={[0.52, 0.53, -0.35]} />
        <mesh position={[0.08, 0.62, 0.2]}><boxGeometry args={[0.8, 0.42, 0.65]} /><meshStandardMaterial color="#ffd345" roughness={0.65} /></mesh>
      </group>
    </Float>
  );
}

function FlyingBrick({ position, color, scale = 1 }: { position: [number, number, number]; color: string; scale?: number }) {
  const studs = useMemo(() => [[-0.33, 0.23], [0.33, 0.23], [-0.33, -0.23], [0.33, -0.23]], []);
  return (
    <Float speed={1.25} rotationIntensity={0.45} floatIntensity={0.65}>
      <group position={position} scale={scale} rotation={[0.3, -0.4, 0.16]}>
        <RoundedBox args={[1.35, 0.62, 0.8]} radius={0.11} smoothness={3}><meshStandardMaterial color={color} roughness={0.3} metalness={0.04} /></RoundedBox>
        {studs.map(([x, z], index) => <mesh key={index} position={[x, 0.38, z]}><cylinderGeometry args={[0.16, 0.16, 0.18, 24]} /><meshStandardMaterial color={color} roughness={0.25} /></mesh>)}
      </group>
    </Float>
  );
}

function World() {
  return (
    <>
      <color attach="background" args={["#64bdff"]} /><fog attach="fog" args={["#bfe7ff", 10, 23]} />
      <ambientLight intensity={1.55} /><directionalLight position={[6, 8, 7]} intensity={3.2} color="#fff3d7" /><directionalLight position={[-8, 2, 3]} intensity={0.8} color="#8ed5ff" />
      <Cloud position={[-8, 4.5, -6]} scale={1.1} /><Cloud position={[2, 4.1, -8]} scale={0.72} speed={0.08} /><Cloud position={[-4, -3.7, -2]} scale={1.8} speed={0.045} /><Cloud position={[5.5, -3.2, -4]} scale={1.6} speed={0.06} /><Cloud position={[8, 1.7, -7]} scale={0.9} speed={0.09} />
      <Island position={[-6.4, 0.15, -2]} scale={0.9} /><Island position={[6.2, 1.5, -3.3]} scale={0.68} accent="#55ce62" /><Island position={[-4.3, 4, -7]} scale={0.38} accent="#42c85f" /><Island position={[3.9, -2.5, -6]} scale={0.48} accent="#4ac95b" />
      <FlyingBrick position={[-5.2, -2.7, 1]} color="#ff4248" scale={0.85} /><FlyingBrick position={[5.3, -1.9, 0]} color="#187ff0" scale={0.78} /><FlyingBrick position={[3.8, 3.6, -2]} color="#ffd02c" scale={0.48} />
    </>
  );
}

export function SkyScene() {
  return <div className="sky-scene" aria-hidden="true"><Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 12], fov: 48 }} gl={{ antialias: true, powerPreference: "high-performance" }}><Suspense fallback={null}><World /></Suspense></Canvas></div>;
}
