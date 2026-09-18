"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  WorldEnvironmentState,
  getSunPosition,
  getMoonPosition,
  getSkyAtmosphereColors,
  GraphicsQuality,
} from "./WorldEnvironment";

export interface EnvironmentLightingProps {
  environment: WorldEnvironmentState;
  graphicsQuality?: GraphicsQuality;
  isHomeMode?: boolean;
  lightningFlashActive?: boolean;
  reducedMotion?: boolean;
  viewDistance?: "low" | "medium" | "high";
}

/**
 * Authoritative Environment Lighting Controller
 * Coordinates sun, moon, ambient, hemisphere, fog, and lightning flash without conflicts.
 */
export function EnvironmentLighting({
  environment,
  graphicsQuality = "medium",
  isHomeMode = false,
  lightningFlashActive = false,
  reducedMotion = false,
  viewDistance = "medium",
}: EnvironmentLightingProps) {
  const { scene } = useThree();

  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const moonLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);

  // Compute target atmospheric lighting values
  const atmosphere = useMemo(() => {
    return getSkyAtmosphereColors(
      environment.timeOfDay,
      environment.weatherType,
      environment.weatherIntensity
    );
  }, [environment.timeOfDay, environment.weatherIntensity, environment.weatherType]);

  const sunPos = useMemo(() => {
    return getSunPosition(environment.timeOfDay, 45);
  }, [environment.timeOfDay]);

  const moonPos = useMemo(() => {
    return getMoonPosition(environment.timeOfDay, 45);
  }, [environment.timeOfDay]);

  // Shadow map resolutions tuned by graphics quality
  const shadowResolution = useMemo(() => {
    if (graphicsQuality === "low") return 1024;
    return 2048;
  }, [graphicsQuality]);

  const shadowFrustum = useMemo(() => {
    if (graphicsQuality === "low") return 22;
    if (graphicsQuality === "high") return 42;
    return 30;
  }, [graphicsQuality]);

  // Lightning flash transient boost (exponential decay)
  const flashIntensityRef = useRef(0);
  useEffect(() => {
    if (lightningFlashActive && !reducedMotion) {
      flashIntensityRef.current = 4.2;
    }
  }, [lightningFlashActive, reducedMotion]);

  useFrame((_, delta) => {
    // Smooth flash decay
    if (flashIntensityRef.current > 0.01) {
      flashIntensityRef.current = THREE.MathUtils.damp(flashIntensityRef.current, 0, 14, delta);
    } else {
      flashIntensityRef.current = 0;
    }

    const flash = flashIntensityRef.current;

    // 1. Sun light lerping
    if (sunLightRef.current) {
      sunLightRef.current.position.set(sunPos[0], Math.max(1, sunPos[1]), sunPos[2]);
      sunLightRef.current.color.set(atmosphere.sunColor);
      sunLightRef.current.intensity = THREE.MathUtils.lerp(
        sunLightRef.current.intensity,
        atmosphere.sunIntensity,
        delta * 3.5
      );
    }

    // 2. Moon light lerping
    if (moonLightRef.current) {
      moonLightRef.current.position.set(moonPos[0], Math.max(2, moonPos[1]), moonPos[2]);
      moonLightRef.current.color.set(atmosphere.moonColor);
      moonLightRef.current.intensity = THREE.MathUtils.lerp(
        moonLightRef.current.intensity,
        atmosphere.moonIntensity,
        delta * 3.5
      );
    }

    // 3. Ambient light (with lightning flash boost)
    if (ambientLightRef.current) {
      ambientLightRef.current.color.set(atmosphere.ambientColor);
      const targetAmbient = atmosphere.ambientIntensity + flash * 0.8;
      ambientLightRef.current.intensity = THREE.MathUtils.lerp(
        ambientLightRef.current.intensity,
        targetAmbient,
        delta * 8.0
      );
    }

    // 4. Hemisphere light (sky vs ground bounce)
    if (hemiLightRef.current) {
      hemiLightRef.current.color.set(atmosphere.ambientColor);
      hemiLightRef.current.groundColor.set(atmosphere.isNight ? "#0d1b2e" : "#294d75");
      hemiLightRef.current.intensity = THREE.MathUtils.lerp(
        hemiLightRef.current.intensity,
        atmosphere.isNight ? 0.65 : 1.35 + flash * 0.4,
        delta * 4.0
      );
    }
  });

  // Dynamic Fog parameters
  const fogRange = useMemo(() => {
    if (isHomeMode) return { near: 16, far: 48 };
    const baseNear = viewDistance === "low" ? 30 : viewDistance === "high" ? 85 : 55;
    const baseFar = viewDistance === "low" ? 85 : viewDistance === "high" ? 220 : 145;

    // Weather reduces fog distance
    if (environment.weatherType === "rain") {
      return { near: Math.round(baseNear * 0.65), far: Math.round(baseFar * 0.7) };
    }
    if (environment.weatherType === "storm") {
      return { near: Math.round(baseNear * 0.5), far: Math.round(baseFar * 0.55) };
    }
    return { near: baseNear, far: baseFar };
  }, [environment.weatherType, isHomeMode, viewDistance]);

  return (
    <>
      {/* Background color & atmospheric horizon fog */}
      <color attach="background" args={[atmosphere.skyColor]} />
      <fog attach="fog" args={[atmosphere.fogColor, fogRange.near, fogRange.far]} />

      {/* Global Ambient Fill Light */}
      <ambientLight ref={ambientLightRef} intensity={atmosphere.ambientIntensity} color={atmosphere.ambientColor} />

      {/* Soft Hemisphere Ambient Bounce */}
      <hemisphereLight
        ref={hemiLightRef}
        args={[atmosphere.ambientColor, atmosphere.isNight ? "#0d1b2e" : "#294d75", 1.35]}
      />

      {/* Primary Key Sunlight */}
      <directionalLight
        ref={sunLightRef}
        castShadow={graphicsQuality !== "low"}
        position={sunPos}
        intensity={atmosphere.sunIntensity}
        color={atmosphere.sunColor}
        shadow-mapSize-width={shadowResolution}
        shadow-mapSize-height={shadowResolution}
        shadow-camera-left={-shadowFrustum}
        shadow-camera-right={shadowFrustum}
        shadow-camera-top={shadowFrustum}
        shadow-camera-bottom={-shadowFrustum}
        shadow-camera-near={0.5}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
      />

      {/* Cool Secondary Moonlight */}
      <directionalLight
        ref={moonLightRef}
        castShadow={false}
        position={moonPos}
        intensity={atmosphere.moonIntensity}
        color={atmosphere.moonColor}
      />
    </>
  );
}
