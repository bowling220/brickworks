"use client";

import { useRef, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  BrickData,
  getBrickFootprint,
  getWorldPositionFromGrid,
  STUD_PITCH,
  VERTICAL_UNIT_HEIGHT,
} from "./GridSystem";
import { BRICK_CATALOG } from "./BrickCatalog";
import { WorldType, WorldSize, ChunkTerrainMod } from "./WorldStorage";
import { getModifiedTerrainHeight } from "./TerrainGenerator";

export interface MobileWalkInput {
  moveX: number; // -1 to 1 (strafe left/right)
  moveZ: number; // -1 to 1 (forward/back)
  lookDeltaX: number; // horizontal rotation delta
  lookDeltaY: number; // vertical rotation delta
  jumpRequested: boolean;
}

export type WalkHeightPreset = "minifig" | "normal" | "tall";

export const WALK_HEIGHT_CONFIG: Record<WalkHeightPreset, { eyeHeight: number; playerHeight: number }> = {
  minifig: { eyeHeight: 2.4, playerHeight: 2.65 },
  normal: { eyeHeight: 3.5, playerHeight: 3.75 },
  tall: { eyeHeight: 5.0, playerHeight: 5.3 },
};

export const DEFAULT_WALK_HEIGHT_PRESET: WalkHeightPreset = "normal";

interface WalkControllerProps {
  isActive: boolean;
  placedBricks: BrickData[];
  worldType?: WorldType;
  worldSize?: WorldSize;
  seed?: number;
  terrainMods?: Record<string, { terrainMod?: ChunkTerrainMod }>;
  initialSpawnPos?: [number, number, number];
  initialSpawnYaw?: number;
  lastSafePos?: [number, number, number];
  homeSpawnPos?: [number, number, number];
  onSafePositionChange?: (pos: [number, number, number]) => void;
  teleportTarget?: [number, number, number] | null;
  onTeleportComplete?: () => void;
  onExitWalk?: () => void;
  mobileInput?: MobileWalkInput;
  onPointerLockChange?: (isLocked: boolean) => void;
  heightPreset?: WalkHeightPreset;
  onCycleHeightPreset?: () => void;
  onPlayerPositionChange?: (pos: [number, number, number], yaw: number) => void;
}

interface BrickAABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
}

const PLAYER_RADIUS = 0.35; // Player collision radius in world units (~0.44 studs)
const STEP_HEIGHT = 0.45; // Max obstacle step-up height (allows stepping up 1 plate / 1 brick)
const WALK_SPEED = 6.2;
const SPRINT_SPEED = 9.8;
const JUMP_IMPULSE = 6.4;
const GRAVITY = -16.0;

export function WalkController({
  isActive,
  placedBricks,
  worldType = "island",
  worldSize = "small",
  seed = 12345,
  terrainMods,
  initialSpawnPos = [0, 0, 11.2],
  initialSpawnYaw = Math.PI,
  lastSafePos,
  homeSpawnPos,
  onSafePositionChange,
  teleportTarget,
  onTeleportComplete,
  onExitWalk,
  mobileInput,
  onPointerLockChange,
  heightPreset = DEFAULT_WALK_HEIGHT_PRESET,
  onCycleHeightPreset,
  onPlayerPositionChange,
}: WalkControllerProps) {
  const { gl } = useThree();

  const currentHeightConfig = WALK_HEIGHT_CONFIG[heightPreset || DEFAULT_WALK_HEIGHT_PRESET];
  const { eyeHeight, playerHeight } = currentHeightConfig;

  // Player physics state
  const feetPos = useRef(new THREE.Vector3(...initialSpawnPos));
  const velocityY = useRef(0);
  const isGrounded = useRef(true);
  const yaw = useRef(initialSpawnYaw);
  const pitch = useRef(0);
  const smoothedCamY = useRef(initialSpawnPos[1] + eyeHeight);

  // Input tracking
  const keysDown = useRef<Record<string, boolean>>({});
  const isPointerLocked = useRef(false);
  const isMouseDown = useRef(false);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);

  // Initialize spawn position on enter
  const prevActiveRef = useRef(false);
  useEffect(() => {
    if (isActive && !prevActiveRef.current) {
      feetPos.current.set(initialSpawnPos[0], initialSpawnPos[1], initialSpawnPos[2]);
      velocityY.current = 0;
      isGrounded.current = true;
      yaw.current = initialSpawnYaw;
      pitch.current = 0;
      smoothedCamY.current = initialSpawnPos[1] + eyeHeight;
    }
    prevActiveRef.current = isActive;
  }, [isActive, initialSpawnPos, initialSpawnYaw, eyeHeight]);

  // Dual Mouse Look: Pointer Lock + Drag-to-Look Fallback
  useEffect(() => {
    if (!isActive) return;

    const dom = gl.domElement;

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === dom;
      isPointerLocked.current = locked;
      onPointerLockChange?.(locked);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDown.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };

        if (!isPointerLocked.current) {
          try {
            const p = dom.requestPointerLock?.();
            if (p && typeof (p as Promise<void>).catch === "function") {
              (p as Promise<void>).catch(() => {});
            }
          } catch {
            // Pointer lock not permitted
          }
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDown.current = false;
        lastMousePos.current = null;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const sensitivity = 0.0022;

      if (isPointerLocked.current) {
        yaw.current -= e.movementX * sensitivity;
        pitch.current = Math.max(-1.42, Math.min(1.42, pitch.current - e.movementY * sensitivity));
        return;
      }

      if (isMouseDown.current) {
        let dx = 0;
        let dy = 0;

        if (e.movementX !== undefined && Math.abs(e.movementX) < 150) {
          dx = e.movementX;
          dy = e.movementY;
        } else if (lastMousePos.current) {
          dx = e.clientX - lastMousePos.current.x;
          dy = e.clientY - lastMousePos.current.y;
        }

        yaw.current -= dx * sensitivity;
        pitch.current = Math.max(-1.42, Math.min(1.42, pitch.current - dy * sensitivity));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
    };

    document.addEventListener("pointerlockchange", handlePointerLockChange);
    dom.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      dom.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
      if (document.pointerLockElement === dom) {
        document.exitPointerLock?.();
      }
      isMouseDown.current = false;
      lastMousePos.current = null;
    };
  }, [gl.domElement, isActive, onPointerLockChange]);

  // Keyboard listeners
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      keysDown.current[e.code] = true;

      if (e.code === "Escape") {
        onExitWalk?.();
      }
      if (e.code === "KeyH") {
        onCycleHeightPreset?.();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDown.current[e.code] = false;
    };

    const handleBlur = () => {
      keysDown.current = {};
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      keysDown.current = {};
    };
  }, [isActive, onExitWalk, onCycleHeightPreset]);

  // Pre-computed brick bounding boxes for collision
  const brickBoxes = useRef<BrickAABB[]>([]);
  useEffect(() => {
    const boxes: BrickAABB[] = [];
    for (const b of placedBricks) {
      const def = BRICK_CATALOG[b.type];
      const world = getWorldPositionFromGrid(b.gridX, b.gridY, b.gridZ, b.rotation, b.type);
      const fp = getBrickFootprint(b.type, b.rotation);
      const halfW = (fp.widthStuds * STUD_PITCH) / 2;
      const halfL = (fp.lengthStuds * STUD_PITCH) / 2;
      const halfH = (fp.heightUnits * VERTICAL_UNIT_HEIGHT) / 2;

      if (def?.walkCollisionType === "doorway" || def?.walkCollisionType === "arch") {
        const postThickness = 0.4;
        const lintelHeight = 0.35;
        const isOrientedAlongX = fp.widthStuds > fp.lengthStuds;

        if (isOrientedAlongX) {
          // Width is larger (along X axis)
          // Left post
          boxes.push({
            minX: world[0] - halfW,
            maxX: world[0] - halfW + postThickness,
            minZ: world[2] - halfL,
            maxZ: world[2] + halfL,
            minY: world[1] - halfH,
            maxY: world[1] + halfH,
          });
          // Right post
          boxes.push({
            minX: world[0] + halfW - postThickness,
            maxX: world[0] + halfW,
            minZ: world[2] - halfL,
            maxZ: world[2] + halfL,
            minY: world[1] - halfH,
            maxY: world[1] + halfH,
          });
          // Top lintel
          boxes.push({
            minX: world[0] - halfW,
            maxX: world[0] + halfW,
            minZ: world[2] - halfL,
            maxZ: world[2] + halfL,
            minY: world[1] + halfH - lintelHeight,
            maxY: world[1] + halfH,
          });
        } else {
          // Length is larger (along Z axis)
          // Left post
          boxes.push({
            minX: world[0] - halfW,
            maxX: world[0] + halfW,
            minZ: world[2] - halfL,
            maxZ: world[2] - halfL + postThickness,
            minY: world[1] - halfH,
            maxY: world[1] + halfH,
          });
          // Right post
          boxes.push({
            minX: world[0] - halfW,
            maxX: world[0] + halfW,
            minZ: world[2] + halfL - postThickness,
            maxZ: world[2] + halfL,
            minY: world[1] - halfH,
            maxY: world[1] + halfH,
          });
          // Top lintel
          boxes.push({
            minX: world[0] - halfW,
            maxX: world[0] + halfW,
            minZ: world[2] - halfL,
            maxZ: world[2] + halfL,
            minY: world[1] + halfH - lintelHeight,
            maxY: world[1] + halfH,
          });
        }
      } else {
        boxes.push({
          minX: world[0] - halfW,
          maxX: world[0] + halfW,
          minZ: world[2] - halfL,
          maxZ: world[2] + halfL,
          minY: world[1] - halfH,
          maxY: world[1] + halfH,
        });
      }
    }
    brickBoxes.current = boxes;
  }, [placedBricks]);

  // Check collision with brick bounding boxes
  const checkHorizontalCollision = useCallback((candidateX: number, candidateZ: number, currentY: number): boolean => {
    for (const box of brickBoxes.current) {
      if (
        Math.abs(box.minX - candidateX) > 3.0 ||
        Math.abs(box.minZ - candidateZ) > 3.0
      ) {
        continue;
      }

      const overlapsX = candidateX + PLAYER_RADIUS > box.minX && candidateX - PLAYER_RADIUS < box.maxX;
      const overlapsZ = candidateZ + PLAYER_RADIUS > box.minZ && candidateZ - PLAYER_RADIUS < box.maxZ;

      if (overlapsX && overlapsZ) {
        if (box.maxY > currentY + STEP_HEIGHT && box.minY < currentY + playerHeight) {
          return true;
        }
      }
    }
    return false;
  }, [playerHeight]);

  // Ground elevation resolver blending terrain elevation + placed bricks
  // Ground elevation resolver blending terrain elevation (with modifications) + placed bricks
  const resolveGroundHeight = useCallback((x: number, z: number, currentY: number): number => {
    const terrainH = getModifiedTerrainHeight(worldType, worldSize, seed, x, z, terrainMods);
    let groundY = terrainH;

    for (const box of brickBoxes.current) {
      if (
        x + PLAYER_RADIUS * 0.7 > box.minX &&
        x - PLAYER_RADIUS * 0.7 < box.maxX &&
        z + PLAYER_RADIUS * 0.7 > box.minZ &&
        z - PLAYER_RADIUS * 0.7 < box.maxZ
      ) {
        if (box.maxY <= currentY + STEP_HEIGHT + 0.1) {
          if (box.maxY > groundY) {
            groundY = box.maxY;
          }
        }
      }
    }

    return groundY;
  }, [seed, terrainMods, worldSize, worldType]);

  // Position reporting timer refs
  const posReportTimer = useRef(0);
  const safePosTimer = useRef(0);

  // Main physics loop
  useFrame((state, delta) => {
    if (!isActive) return;

    const dt = Math.min(delta, 0.05);

    // 0. Handle Teleport Request (Fast Travel, Respawn, or Unstuck)
    if (teleportTarget) {
      const targetX = teleportTarget[0];
      const targetZ = teleportTarget[2];
      const groundAtTarget = resolveGroundHeight(targetX, targetZ, teleportTarget[1]);
      const safeY = Math.max(groundAtTarget, teleportTarget[1]);

      feetPos.current.set(targetX, safeY, targetZ);
      velocityY.current = 0;
      isGrounded.current = true;
      smoothedCamY.current = safeY + eyeHeight;
      onTeleportComplete?.();
      return;
    }

    // 1. Process Mobile Look
    if (mobileInput) {
      if (mobileInput.lookDeltaX !== 0) {
        yaw.current -= mobileInput.lookDeltaX * 0.003;
      }
      if (mobileInput.lookDeltaY !== 0) {
        pitch.current = Math.max(-1.42, Math.min(1.42, pitch.current - mobileInput.lookDeltaY * 0.003));
      }
    }

    // 2. Compute Direction
    let forward = 0;
    let strafe = 0;

    if (keysDown.current["KeyW"] || keysDown.current["ArrowUp"]) forward += 1;
    if (keysDown.current["KeyS"] || keysDown.current["ArrowDown"]) forward -= 1;
    if (keysDown.current["KeyA"] || keysDown.current["ArrowLeft"]) strafe -= 1;
    if (keysDown.current["KeyD"] || keysDown.current["ArrowRight"]) strafe += 1;

    if (mobileInput) {
      forward += mobileInput.moveZ;
      strafe += mobileInput.moveX;
    }

    const isSprint = keysDown.current["ShiftLeft"] || keysDown.current["ShiftRight"];
    const speed = isSprint ? SPRINT_SPEED : WALK_SPEED;

    const length = Math.hypot(forward, strafe);
    if (length > 0) {
      const normF = forward / Math.max(1, length);
      const normS = strafe / Math.max(1, length);

      const sinY = Math.sin(yaw.current);
      const cosY = Math.cos(yaw.current);

      const moveX = (-sinY * normF + cosY * normS) * speed * dt;
      const moveZ = (-cosY * normF - sinY * normS) * speed * dt;

      const candidateX = feetPos.current.x + moveX;
      if (!checkHorizontalCollision(candidateX, feetPos.current.z, feetPos.current.y)) {
        feetPos.current.x = candidateX;
      }

      const candidateZ = feetPos.current.z + moveZ;
      if (!checkHorizontalCollision(feetPos.current.x, candidateZ, feetPos.current.y)) {
        feetPos.current.z = candidateZ;
      }
    }

    // 3. Resolve Ground & Step Height
    const groundY = resolveGroundHeight(feetPos.current.x, feetPos.current.z, feetPos.current.y);

    // 4. Handle Jump & Gravity
    const jumpPressed = keysDown.current["Space"] || mobileInput?.jumpRequested;
    if (jumpPressed && isGrounded.current) {
      velocityY.current = JUMP_IMPULSE;
      isGrounded.current = false;
    }

    if (!isGrounded.current) {
      velocityY.current += GRAVITY * dt;
      feetPos.current.y += velocityY.current * dt;

      // Check landing
      if (feetPos.current.y <= groundY) {
        feetPos.current.y = groundY;
        velocityY.current = 0;
        isGrounded.current = true;
      }
    } else {
      // Step snapping when grounded
      if (Math.abs(feetPos.current.y - groundY) <= STEP_HEIGHT + 0.1) {
        feetPos.current.y = THREE.MathUtils.lerp(feetPos.current.y, groundY, Math.min(1, dt * 20));
      } else if (feetPos.current.y > groundY + 0.05) {
        isGrounded.current = false; // Walking off ledge
      }
    }

    // 5. Track Grounded Safe Position (every 1.0s)
    if (isGrounded.current && groundY > -10) {
      safePosTimer.current += dt;
      if (safePosTimer.current > 1.0) {
        safePosTimer.current = 0;
        onSafePositionChange?.([feetPos.current.x, feetPos.current.y, feetPos.current.z]);
      }
    }

    // 6. Void Fallback (Respawn if fallen below threshold: 1. safe pos, 2. home spawn, 3. world spawn)
    if (feetPos.current.y < -18) {
      const target = lastSafePos || homeSpawnPos || initialSpawnPos || [0, 0.5, 0];
      const targetLandY = resolveGroundHeight(target[0], target[2], target[1]);
      const safeY = Math.max(targetLandY, target[1]);

      feetPos.current.set(target[0], safeY, target[2]);
      velocityY.current = 0;
      isGrounded.current = true;
      smoothedCamY.current = safeY + eyeHeight;
    }

    // 7. Camera Transform Update
    const targetCamY = feetPos.current.y + eyeHeight;
    smoothedCamY.current = THREE.MathUtils.lerp(smoothedCamY.current, targetCamY, Math.min(1, dt * 14));

    state.camera.position.set(feetPos.current.x, smoothedCamY.current, feetPos.current.z);

    // Spherical look rotation
    const lookX = -Math.sin(yaw.current) * Math.cos(pitch.current);
    const lookY = Math.sin(pitch.current);
    const lookZ = -Math.cos(yaw.current) * Math.cos(pitch.current);

    state.camera.lookAt(
      feetPos.current.x + lookX,
      smoothedCamY.current + lookY,
      feetPos.current.z + lookZ
    );

    // 8. Periodic Player Position Reporting (for persistence)
    posReportTimer.current += dt;
    if (posReportTimer.current > 0.8) {
      posReportTimer.current = 0;
      onPlayerPositionChange?.(
        [feetPos.current.x, feetPos.current.y, feetPos.current.z],
        yaw.current
      );
    }
  });

  return null;
}
