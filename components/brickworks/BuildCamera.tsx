"use client";

import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";

export type GameMode = "home" | "transitioning-to-build" | "build" | "transitioning-to-home";
export type EditorMode = "build" | "select" | "terrain" | "walk";

interface BuildCameraProps {
  mode: GameMode;
  editorMode?: EditorMode;
  onTransitionComplete?: () => void;
  reducedMotion?: boolean;
  controlsEnabled?: boolean;
  recenterTrigger?: number;
  focusTarget?: [number, number, number];
}

// Camera coordinates
const HOME_CAM_POS = new THREE.Vector3(0, 0.4, 13.5);
const HOME_LOOK_AT = new THREE.Vector3(0, 0.5, 0);

// Default Build Mode perspective
const BUILD_CAM_OFFSET = new THREE.Vector3(0, 16.5, 20.5);

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function BuildCamera({
  mode,
  editorMode = "build",
  onTransitionComplete,
  reducedMotion = false,
  controlsEnabled = true,
  recenterTrigger = 0,
  focusTarget = [0, 0.4, 0],
}: BuildCameraProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const transitionProgress = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const startLookAt = useRef(new THREE.Vector3());
  const currentLookAt = useRef(new THREE.Vector3());
  const targetBuildCamRef = useRef(new THREE.Vector3());

  // Controller isolation: disable OrbitControls while terrain sculpting is active
  const [isTerrainSculpting, setIsTerrainSculpting] = useState(false);
  useEffect(() => {
    const handleSculptStart = () => setIsTerrainSculpting(true);
    const handleSculptEnd = () => setIsTerrainSculpting(false);
    window.addEventListener("brickworks-terrain-sculpt-start", handleSculptStart);
    window.addEventListener("brickworks-terrain-sculpt-end", handleSculptEnd);
    return () => {
      window.removeEventListener("brickworks-terrain-sculpt-start", handleSculptStart);
      window.removeEventListener("brickworks-terrain-sculpt-end", handleSculptEnd);
    };
  }, []);

  const currentFocus = useRef(new THREE.Vector3(...focusTarget));
  useEffect(() => {
    currentFocus.current.set(...focusTarget);
  }, [focusTarget]);

  // Stored Orbit view state for restoring after Walk Mode
  const savedOrbitCamPos = useRef(new THREE.Vector3().copy(BUILD_CAM_OFFSET));
  const savedOrbitTarget = useRef(new THREE.Vector3(...focusTarget));
  const prevEditorModeRef = useRef<EditorMode>(editorMode);
  const [isRestoringOrbit, setIsRestoringOrbit] = useState(false);
  const restoreProgress = useRef(0);
  const restoreStartPos = useRef(new THREE.Vector3());
  const restoreStartLookAt = useRef(new THREE.Vector3());

  // Smooth recenter to local build perspective
  const [isRecentering, setIsRecentering] = useState(false);
  const recenterProgress = useRef(0);
  const recenterStartPos = useRef(new THREE.Vector3());
  const recenterStartLookAt = useRef(new THREE.Vector3());
  const prevRecenterTrigger = useRef(recenterTrigger);

  useEffect(() => {
    if (recenterTrigger && recenterTrigger !== prevRecenterTrigger.current) {
      if (mode === "build" && controlsRef.current) {
        recenterStartPos.current.copy(controlsRef.current.object.position);
        recenterStartLookAt.current.copy(controlsRef.current.target);
        recenterProgress.current = 0;
        setIsRecentering(true);
      }
      prevRecenterTrigger.current = recenterTrigger;
    }
  }, [recenterTrigger, mode]);

  // Detect transitions between Walk and Orbit modes
  useEffect(() => {
    if (mode !== "build") return;

    if (editorMode === "walk" && prevEditorModeRef.current !== "walk") {
      if (controlsRef.current) {
        savedOrbitCamPos.current.copy(controlsRef.current.object.position);
        savedOrbitTarget.current.copy(controlsRef.current.target);
      }
      setIsRestoringOrbit(false);
    } else if (editorMode !== "walk" && prevEditorModeRef.current === "walk") {
      if (controlsRef.current) {
        restoreStartPos.current.copy(controlsRef.current.object.position);
        const persCam = controlsRef.current.object as THREE.PerspectiveCamera;
        const dir = new THREE.Vector3();
        persCam.getWorldDirection(dir);
        restoreStartLookAt.current.copy(controlsRef.current.object.position).addScaledVector(dir, 10);
        restoreProgress.current = 0;
        setIsRestoringOrbit(true);
      }
    }
    prevEditorModeRef.current = editorMode;
  }, [editorMode, mode]);

  // Set up transition start points
  useEffect(() => {
    if (mode === "transitioning-to-build") {
      transitionProgress.current = 0;
      startPos.current.copy(HOME_CAM_POS);
      startLookAt.current.copy(HOME_LOOK_AT);
    } else if (mode === "transitioning-to-home") {
      transitionProgress.current = 0;
      if (controlsRef.current) {
        startPos.current.copy(controlsRef.current.object.position);
        startLookAt.current.copy(controlsRef.current.target);
      } else {
        startPos.current.copy(currentFocus.current).add(BUILD_CAM_OFFSET);
        startLookAt.current.copy(currentFocus.current);
      }
    }
  }, [mode]);

  useFrame((state, delta) => {
    const camera = state.camera;

    // 1. Home Menu Mode: subtle pointer parallax & idle float
    if (mode === "home") {
      if (!reducedMotion) {
        const t = state.clock.getElapsedTime();
        const targetX = state.pointer.x * 0.2;
        const targetY = 0.4 + state.pointer.y * 0.18 + Math.sin(t * 0.6) * 0.05;
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.04);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.04);
      } else {
        camera.position.set(0, 0.4, 13.5);
      }
      camera.lookAt(0, 0.5, 0);
      return;
    }

    const targetBuildCam = targetBuildCamRef.current.copy(currentFocus.current).add(BUILD_CAM_OFFSET);

    // 2. Transitioning to Build Mode (~1.3 seconds)
    if (mode === "transitioning-to-build") {
      transitionProgress.current = Math.min(1, transitionProgress.current + delta * 0.8);
      const eased = easeInOutCubic(transitionProgress.current);

      camera.position.lerpVectors(startPos.current, targetBuildCam, eased);
      currentLookAt.current.lerpVectors(startLookAt.current, currentFocus.current, eased);
      camera.lookAt(currentLookAt.current);

      if (transitionProgress.current >= 1) {
        if (controlsRef.current) {
          controlsRef.current.target.copy(currentFocus.current);
          controlsRef.current.update();
        }
        onTransitionComplete?.();
      }
      return;
    }

    // 3. Transitioning back to Home Menu (~1.1 seconds)
    if (mode === "transitioning-to-home") {
      transitionProgress.current = Math.min(1, transitionProgress.current + delta * 0.95);
      const eased = easeInOutCubic(transitionProgress.current);

      camera.position.lerpVectors(startPos.current, HOME_CAM_POS, eased);
      currentLookAt.current.lerpVectors(startLookAt.current, HOME_LOOK_AT, eased);
      camera.lookAt(currentLookAt.current);

      if (transitionProgress.current >= 1) {
        onTransitionComplete?.();
      }
      return;
    }

    // 4. In Walk Mode, smoothly widen FOV to 70°
    if (mode === "build" && editorMode === "walk") {
      const persCam = camera as THREE.PerspectiveCamera;
      if (persCam && persCam.isPerspectiveCamera && Math.abs(persCam.fov - 70) > 0.05) {
        persCam.fov = THREE.MathUtils.lerp(persCam.fov, 70, Math.min(1, delta * 10));
        persCam.updateProjectionMatrix();
      }
      return;
    }

    // 5. Restoring Orbit view after leaving Walk Mode (~0.6s)
    if (mode === "build" && isRestoringOrbit) {
      restoreProgress.current = Math.min(1, restoreProgress.current + delta * 1.8);
      const eased = easeInOutCubic(restoreProgress.current);

      camera.position.lerpVectors(restoreStartPos.current, savedOrbitCamPos.current, eased);
      currentLookAt.current.lerpVectors(restoreStartLookAt.current, savedOrbitTarget.current, eased);
      camera.lookAt(currentLookAt.current);

      const persCam = camera as THREE.PerspectiveCamera;
      if (persCam && persCam.isPerspectiveCamera) {
        persCam.fov = THREE.MathUtils.lerp(70, 44, eased);
        persCam.updateProjectionMatrix();
      }

      if (restoreProgress.current >= 1) {
        setIsRestoringOrbit(false);
        if (persCam && persCam.isPerspectiveCamera) {
          persCam.fov = 44;
          persCam.updateProjectionMatrix();
        }
        if (controlsRef.current) {
          controlsRef.current.target.copy(savedOrbitTarget.current);
          controlsRef.current.update();
        }
      }
      return;
    }

    // 6. Smooth recentering to local building area (~0.5s)
    if (mode === "build" && isRecentering) {
      recenterProgress.current = Math.min(1, recenterProgress.current + delta * 2.2);
      const eased = easeInOutCubic(recenterProgress.current);

      camera.position.lerpVectors(recenterStartPos.current, targetBuildCam, eased);
      currentLookAt.current.lerpVectors(recenterStartLookAt.current, currentFocus.current, eased);
      camera.lookAt(currentLookAt.current);

      if (recenterProgress.current >= 1) {
        setIsRecentering(false);
        if (controlsRef.current) {
          controlsRef.current.target.copy(currentFocus.current);
          controlsRef.current.update();
        }
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={
        mode === "build" &&
        editorMode !== "walk" &&
        !isRestoringOrbit &&
        !isRecentering &&
        controlsEnabled &&
        !isTerrainSculpting
      }
      mouseButtons={{
        LEFT: editorMode === "terrain" ? (-1 as unknown as THREE.MOUSE) : THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: editorMode === "terrain" ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
      }}
      enableDamping
      dampingFactor={0.06}
      minDistance={2.5}
      maxDistance={65} // Local building scale clamp: prevents accidentally zooming out into space
      screenSpacePanning={true}
      maxPolarAngle={Math.PI / 2 - 0.02}
      minPolarAngle={0.05}
    />
  );
}
