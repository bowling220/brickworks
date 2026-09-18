import * as THREE from "three";

const materialCache = new Map<string, THREE.MeshPhysicalMaterial>();
let validGhostMaterial: THREE.MeshPhysicalMaterial | null = null;
let invalidGhostMaterial: THREE.MeshPhysicalMaterial | null = null;
let selectionWireframeMaterial: THREE.MeshBasicMaterial | null = null;
let moveOriginWireframeMaterial: THREE.MeshBasicMaterial | null = null;
let sharedGlassMaterial: THREE.MeshPhysicalMaterial | null = null;

/**
 * Normalizes hex colors to lowercase standard format
 */
function normalizeColor(hex: string): string {
  if (!hex.startsWith("#")) return `#${hex.toLowerCase()}`;
  return hex.toLowerCase();
}

/**
 * Retrieves a cached glossy toy-plastic material for a given color hex.
 */
export function getBrickMaterial(color: string): THREE.MeshPhysicalMaterial {
  const normColor = normalizeColor(color);
  let mat = materialCache.get(normColor);
  if (!mat) {
    mat = new THREE.MeshPhysicalMaterial({
      color: normColor,
      roughness: 0.16,
      metalness: 0.02,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.95,
    });
    materialCache.set(normColor, mat);
  }
  return mat;
}

/**
 * Shared transparent glass material for windows and architectural panes
 */
export function getGlassMaterial(): THREE.MeshPhysicalMaterial {
  if (!sharedGlassMaterial) {
    sharedGlassMaterial = new THREE.MeshPhysicalMaterial({
      color: "#cce5ff",
      transparent: true,
      opacity: 0.42,
      roughness: 0.05,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      depthWrite: false,
    });
  }
  return sharedGlassMaterial;
}

/**
 * Shared translucent preview ghost material for single brick or large blueprint structures
 */
export function getGhostMaterial(isValid: boolean): THREE.MeshPhysicalMaterial {
  if (isValid) {
    if (!validGhostMaterial) {
      validGhostMaterial = new THREE.MeshPhysicalMaterial({
        color: "#00e1d9",
        roughness: 0.2,
        metalness: 0.05,
        clearcoat: 0.9,
        transparent: true,
        opacity: 0.58,
        emissive: new THREE.Color("#00b4c8"),
        emissiveIntensity: 0.25,
      });
    }
    return validGhostMaterial;
  } else {
    if (!invalidGhostMaterial) {
      invalidGhostMaterial = new THREE.MeshPhysicalMaterial({
        color: "#ff2a3b",
        roughness: 0.25,
        metalness: 0.05,
        clearcoat: 0.9,
        transparent: true,
        opacity: 0.68,
        emissive: new THREE.Color("#dd0018"),
        emissiveIntensity: 0.38,
      });
    }
    return invalidGhostMaterial;
  }
}

/**
 * Shared selection bounding wireframe box material
 */
export function getSelectionWireframeMaterial(): THREE.MeshBasicMaterial {
  if (!selectionWireframeMaterial) {
    selectionWireframeMaterial = new THREE.MeshBasicMaterial({
      color: "#ffe866",
      wireframe: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
  }
  return selectionWireframeMaterial;
}

/**
 * Shared faint wireframe material showing original locations during Move mode
 */
export function getMoveOriginWireframeMaterial(): THREE.MeshBasicMaterial {
  if (!moveOriginWireframeMaterial) {
    moveOriginWireframeMaterial = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
  }
  return moveOriginWireframeMaterial;
}

/**
 * Dispose all cached materials (when shutting down or reloading WebGL context)
 */
export function disposeMaterialCache(): void {
  for (const mat of materialCache.values()) {
    mat.dispose();
  }
  materialCache.clear();

  validGhostMaterial?.dispose();
  validGhostMaterial = null;
  invalidGhostMaterial?.dispose();
  invalidGhostMaterial = null;

  selectionWireframeMaterial?.dispose();
  selectionWireframeMaterial = null;
  moveOriginWireframeMaterial?.dispose();
  moveOriginWireframeMaterial = null;

  sharedGlassMaterial?.dispose();
  sharedGlassMaterial = null;
}
