import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BRICK_CATALOG, BrickDefinition, BrickTypeId } from "./BrickCatalog";
import { STUD_PITCH, VERTICAL_UNIT_HEIGHT } from "./GridSystem";

const geometryCache = new Map<BrickTypeId, THREE.BufferGeometry>();
const wireframeBoxCache = new Map<string, THREE.BufferGeometry>();

/**
 * Creates standard beveled brick or plate geometry with top studs
 */
function createStandardGeometry(def: BrickDefinition): THREE.BufferGeometry {
  const brickWidth = def.widthStuds * STUD_PITCH;
  const brickLength = def.lengthStuds * STUD_PITCH;
  const brickHeight = def.heightUnits * VERTICAL_UNIT_HEIGHT;
  const bevelRadius = Math.min(0.06, brickHeight * 0.2);

  const body = new RoundedBoxGeometry(brickWidth, brickHeight, brickLength, 2, bevelRadius);
  const studGeometries: THREE.BufferGeometry[] = [];
  const halfWidth = brickWidth / 2;
  const halfLength = brickLength / 2;

  if (def.hasTopStuds) {
    for (let xIdx = 0; xIdx < def.widthStuds; xIdx++) {
      const sx = -halfWidth + (xIdx + 0.5) * STUD_PITCH;
      for (let yIdx = 0; yIdx < def.lengthStuds; yIdx++) {
        const sz = -halfLength + (yIdx + 0.5) * STUD_PITCH;
        const stud = new THREE.CylinderGeometry(0.22, 0.23, 0.16, 14).toNonIndexed();
        stud.translate(sx, brickHeight / 2 + 0.08, sz);
        studGeometries.push(stud);
      }
    }
  }

  const merged = BufferGeometryUtils.mergeGeometries([body, ...studGeometries], false);
  body.dispose();
  for (const s of studGeometries) s.dispose();

  if (!merged) return new THREE.BoxGeometry(brickWidth, brickHeight, brickLength);

  const indexed = BufferGeometryUtils.mergeVertices(merged);
  merged.dispose();
  indexed.computeVertexNormals();
  return indexed;
}

/**
 * Creates smooth-top tile geometry (no studs, glossy rounded bevel)
 */
function createTileGeometry(def: BrickDefinition): THREE.BufferGeometry {
  const brickWidth = def.widthStuds * STUD_PITCH;
  const brickLength = def.lengthStuds * STUD_PITCH;
  const brickHeight = def.heightUnits * VERTICAL_UNIT_HEIGHT;
  const bevelRadius = Math.min(0.04, brickHeight * 0.15);

  const body = new RoundedBoxGeometry(brickWidth, brickHeight, brickLength, 2, bevelRadius);
  const indexed = BufferGeometryUtils.mergeVertices(body.toNonIndexed());
  body.dispose();
  indexed.computeVertexNormals();
  return indexed;
}

/**
 * Creates procedural 45° or 33° slope roof wedge geometry
 */
function createSlopeGeometry(def: BrickDefinition): THREE.BufferGeometry {
  const w = def.widthStuds * STUD_PITCH;
  const l = def.lengthStuds * STUD_PITCH;
  const h = def.heightUnits * VERTICAL_UNIT_HEIGHT;
  const baseH = VERTICAL_UNIT_HEIGHT; // base lip thickness

  // Extrude 2D slope profile along width (X axis)
  const shape = new THREE.Shape();
  const halfL = l / 2;
  const halfH = h / 2;

  // Profile in (Z, Y)
  // Low end at +halfL, high end at -halfL
  shape.moveTo(-halfL, -halfH);
  shape.lineTo(halfL, -halfH);
  shape.lineTo(halfL, -halfH + baseH * 0.5);
  shape.lineTo(-halfL + 0.4 * STUD_PITCH, halfH);
  shape.lineTo(-halfL, halfH);
  shape.closePath();

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: w,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  };

  const slopeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  // Center along X and rotate to align with world axes
  slopeGeo.rotateY(Math.PI / 2);
  slopeGeo.translate(0, 0, 0);

  const indexed = BufferGeometryUtils.mergeVertices(slopeGeo);
  slopeGeo.dispose();
  indexed.computeVertexNormals();
  return indexed;
}

/**
 * Creates inverted slope geometry (overhang wedge)
 */
function createInvertedSlopeGeometry(def: BrickDefinition): THREE.BufferGeometry {
  const w = def.widthStuds * STUD_PITCH;
  const l = def.lengthStuds * STUD_PITCH;
  const h = def.heightUnits * VERTICAL_UNIT_HEIGHT;

  const shape = new THREE.Shape();
  const halfL = l / 2;
  const halfH = h / 2;

  shape.moveTo(-halfL, -halfH);
  shape.lineTo(0, -halfH);
  shape.lineTo(halfL, halfH);
  shape.lineTo(-halfL, halfH);
  shape.closePath();

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: w,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  };

  const slopeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  slopeGeo.rotateY(Math.PI / 2);

  // Add top studs
  const studGeometries: THREE.BufferGeometry[] = [];
  const halfW = w / 2;
  for (let xIdx = 0; xIdx < def.widthStuds; xIdx++) {
    const sx = -halfW + (xIdx + 0.5) * STUD_PITCH;
    for (let yIdx = 0; yIdx < def.lengthStuds; yIdx++) {
      const sz = -halfL + (yIdx + 0.5) * STUD_PITCH;
      const stud = new THREE.CylinderGeometry(0.22, 0.23, 0.16, 14).toNonIndexed();
      stud.translate(sx, halfH + 0.08, sz);
      studGeometries.push(stud);
    }
  }

  const merged = BufferGeometryUtils.mergeGeometries([slopeGeo, ...studGeometries], false);
  slopeGeo.dispose();
  for (const s of studGeometries) s.dispose();

  if (!merged) return new THREE.BoxGeometry(w, h, l);

  const indexed = BufferGeometryUtils.mergeVertices(merged);
  merged.dispose();
  indexed.computeVertexNormals();
  return indexed;
}

/**
 * Creates window geometry with frame and glass pane
 */
function createWindowGeometry(def: BrickDefinition): THREE.BufferGeometry {
  const w = def.widthStuds * STUD_PITCH;
  const l = def.lengthStuds * STUD_PITCH;
  const h = def.heightUnits * VERTICAL_UNIT_HEIGHT;
  const frameThick = 0.14;
  const halfW = w / 2;
  const halfL = l / 2;
  const halfH = h / 2;

  // Frame parts
  const sill = new THREE.BoxGeometry(w, frameThick * 2, l);
  sill.translate(0, -halfH + frameThick, 0);

  const lintel = new THREE.BoxGeometry(w, frameThick * 2, l);
  lintel.translate(0, halfH - frameThick, 0);

  const postL = new THREE.BoxGeometry(w, h, frameThick * 2);
  postL.translate(0, 0, -halfL + frameThick);

  const postR = new THREE.BoxGeometry(w, h, frameThick * 2);
  postR.translate(0, 0, halfL - frameThick);

  // Studs on lintel
  const studs: THREE.BufferGeometry[] = [];
  for (let xIdx = 0; xIdx < def.widthStuds; xIdx++) {
    const sx = -halfW + (xIdx + 0.5) * STUD_PITCH;
    for (let yIdx = 0; yIdx < def.lengthStuds; yIdx++) {
      const sz = -halfL + (yIdx + 0.5) * STUD_PITCH;
      const stud = new THREE.CylinderGeometry(0.22, 0.23, 0.16, 14).toNonIndexed();
      stud.translate(sx, halfH + 0.08, sz);
      studs.push(stud);
    }
  }

  // Glass pane
  const glassW = w * 0.2;
  const glassH = h - frameThick * 4;
  const glassL = l - frameThick * 4;
  const glass = new THREE.BoxGeometry(glassW, glassH, glassL);

  const frameMerged = BufferGeometryUtils.mergeGeometries([sill, lintel, postL, postR, ...studs], false);
  sill.dispose();
  lintel.dispose();
  postL.dispose();
  postR.dispose();
  for (const s of studs) s.dispose();

  if (!frameMerged) return new THREE.BoxGeometry(w, h, l);

  // Combine frame (group 0) + glass (group 1)
  const combined = BufferGeometryUtils.mergeGeometries([frameMerged, glass], true);
  frameMerged.dispose();
  glass.dispose();

  if (!combined) return new THREE.BoxGeometry(w, h, l);

  const indexed = BufferGeometryUtils.mergeVertices(combined);
  combined.dispose();
  indexed.computeVertexNormals();
  return indexed;
}

/**
 * Creates doorway / arch door frame geometry
 */
function createDoorFrameGeometry(def: BrickDefinition): THREE.BufferGeometry {
  const w = def.widthStuds * STUD_PITCH;
  const l = def.lengthStuds * STUD_PITCH;
  const h = def.heightUnits * VERTICAL_UNIT_HEIGHT;
  const postThick = 0.5 * STUD_PITCH;
  const headerH = VERTICAL_UNIT_HEIGHT * 2;
  const halfW = w / 2;
  const halfL = l / 2;
  const halfH = h / 2;

  const postL = new THREE.BoxGeometry(w, h - headerH, postThick);
  postL.translate(0, -halfH + (h - headerH) / 2, -halfL + postThick / 2);

  const postR = new THREE.BoxGeometry(w, h - headerH, postThick);
  postR.translate(0, -halfH + (h - headerH) / 2, halfL - postThick / 2);

  const header = new THREE.BoxGeometry(w, headerH, l);
  header.translate(0, halfH - headerH / 2, 0);

  // Top studs
  const studs: THREE.BufferGeometry[] = [];
  for (let xIdx = 0; xIdx < def.widthStuds; xIdx++) {
    const sx = -halfW + (xIdx + 0.5) * STUD_PITCH;
    for (let yIdx = 0; yIdx < def.lengthStuds; yIdx++) {
      const sz = -halfL + (yIdx + 0.5) * STUD_PITCH;
      const stud = new THREE.CylinderGeometry(0.22, 0.23, 0.16, 14).toNonIndexed();
      stud.translate(sx, halfH + 0.08, sz);
      studs.push(stud);
    }
  }

  const merged = BufferGeometryUtils.mergeGeometries([postL, postR, header, ...studs], false);
  postL.dispose();
  postR.dispose();
  header.dispose();
  for (const s of studs) s.dispose();

  if (!merged) return new THREE.BoxGeometry(w, h, l);

  const indexed = BufferGeometryUtils.mergeVertices(merged);
  merged.dispose();
  indexed.computeVertexNormals();
  return indexed;
}

/**
 * Creates 1x4 arch geometry with curved underside
 */
function createArchGeometry(def: BrickDefinition): THREE.BufferGeometry {
  const w = def.widthStuds * STUD_PITCH;
  const l = def.lengthStuds * STUD_PITCH;
  const h = def.heightUnits * VERTICAL_UNIT_HEIGHT;
  const halfW = w / 2;
  const halfL = l / 2;
  const halfH = h / 2;

  // Arch 2D cross section along Z-Y
  const shape = new THREE.Shape();
  shape.moveTo(-halfL, -halfH);
  shape.lineTo(-halfL + 0.6 * STUD_PITCH, -halfH);
  shape.absarc(0, -halfH, halfL - 0.6 * STUD_PITCH, Math.PI, 0, false);
  shape.lineTo(halfL, -halfH);
  shape.lineTo(halfL, halfH);
  shape.lineTo(-halfL, halfH);
  shape.closePath();

  const archGeo = new THREE.ExtrudeGeometry(shape, {
    depth: w,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  archGeo.rotateY(Math.PI / 2);

  // Top studs
  const studs: THREE.BufferGeometry[] = [];
  for (let xIdx = 0; xIdx < def.widthStuds; xIdx++) {
    const sx = -halfW + (xIdx + 0.5) * STUD_PITCH;
    for (let yIdx = 0; yIdx < def.lengthStuds; yIdx++) {
      const sz = -halfL + (yIdx + 0.5) * STUD_PITCH;
      const stud = new THREE.CylinderGeometry(0.22, 0.23, 0.16, 14).toNonIndexed();
      stud.translate(sx, halfH + 0.08, sz);
      studs.push(stud);
    }
  }

  const merged = BufferGeometryUtils.mergeGeometries([archGeo, ...studs], false);
  archGeo.dispose();
  for (const s of studs) s.dispose();

  if (!merged) return new THREE.BoxGeometry(w, h, l);

  const indexed = BufferGeometryUtils.mergeVertices(merged);
  merged.dispose();
  indexed.computeVertexNormals();
  return indexed;
}

/**
 * Creates classical cylindrical column geometry
 */
function createColumnGeometry(def: BrickDefinition): THREE.BufferGeometry {
  const w = def.widthStuds * STUD_PITCH;
  const l = def.lengthStuds * STUD_PITCH;
  const h = def.heightUnits * VERTICAL_UNIT_HEIGHT;
  const capH = VERTICAL_UNIT_HEIGHT * 0.8;
  const halfH = h / 2;

  const base = new THREE.BoxGeometry(w * 0.95, capH, l * 0.95);
  base.translate(0, -halfH + capH / 2, 0);

  const shaft = new THREE.CylinderGeometry(w * 0.42, w * 0.42, h - capH * 2, 16);
  shaft.translate(0, 0, 0);

  const capital = new THREE.BoxGeometry(w * 0.95, capH, l * 0.95);
  capital.translate(0, halfH - capH / 2, 0);

  const stud = new THREE.CylinderGeometry(0.22, 0.23, 0.16, 14);
  stud.translate(0, halfH + 0.08, 0);

  const merged = BufferGeometryUtils.mergeGeometries([base, shaft, capital, stud], false);
  base.dispose();
  shaft.dispose();
  capital.dispose();
  stud.dispose();

  if (!merged) return new THREE.BoxGeometry(w, h, l);

  const indexed = BufferGeometryUtils.mergeVertices(merged);
  merged.dispose();
  indexed.computeVertexNormals();
  return indexed;
}

/**
 * Creates decorative props (plant pot, bench, lamp post, cone, sign, fence)
 */
function createPropGeometry(def: BrickDefinition): THREE.BufferGeometry {
  const w = def.widthStuds * STUD_PITCH;
  const l = def.lengthStuds * STUD_PITCH;
  const h = def.heightUnits * VERTICAL_UNIT_HEIGHT;
  const halfH = h / 2;

  if (def.geometryType === "plant_pot") {
    const pot = new THREE.CylinderGeometry(0.32, 0.24, h * 0.7, 16);
    pot.translate(0, -halfH + (h * 0.7) / 2, 0);
    const plant = new THREE.DodecahedronGeometry(0.28);
    plant.translate(0, halfH - 0.15, 0);
    const merged = BufferGeometryUtils.mergeGeometries([pot, plant], false);
    pot.dispose();
    plant.dispose();
    if (merged) {
      const idx = BufferGeometryUtils.mergeVertices(merged);
      merged.dispose();
      idx.computeVertexNormals();
      return idx;
    }
  }

  if (def.geometryType === "road_cone") {
    const base = new THREE.BoxGeometry(w * 0.9, 0.08, l * 0.9);
    base.translate(0, -halfH + 0.04, 0);
    const cone = new THREE.ConeGeometry(0.28, h - 0.08, 16);
    cone.translate(0, -halfH + 0.04 + (h - 0.08) / 2, 0);
    const merged = BufferGeometryUtils.mergeGeometries([base, cone], false);
    base.dispose();
    cone.dispose();
    if (merged) {
      const idx = BufferGeometryUtils.mergeVertices(merged);
      merged.dispose();
      idx.computeVertexNormals();
      return idx;
    }
  }

  if (def.geometryType === "bench") {
    const slat1 = new THREE.BoxGeometry(w * 0.35, 0.08, l * 0.9);
    slat1.translate(-w * 0.2, 0, 0);
    const slat2 = new THREE.BoxGeometry(w * 0.35, 0.08, l * 0.9);
    slat2.translate(w * 0.2, 0, 0);
    const legL = new THREE.BoxGeometry(w * 0.8, halfH, 0.1);
    legL.translate(0, -halfH / 2, -l * 0.38);
    const legR = new THREE.BoxGeometry(w * 0.8, halfH, 0.1);
    legR.translate(0, -halfH / 2, l * 0.38);
    const merged = BufferGeometryUtils.mergeGeometries([slat1, slat2, legL, legR], false);
    slat1.dispose();
    slat2.dispose();
    legL.dispose();
    legR.dispose();
    if (merged) {
      const idx = BufferGeometryUtils.mergeVertices(merged);
      merged.dispose();
      idx.computeVertexNormals();
      return idx;
    }
  }

  if (def.geometryType === "lamp_post") {
    const base = new THREE.CylinderGeometry(0.25, 0.32, 0.3, 14);
    base.translate(0, -halfH + 0.15, 0);
    const pole = new THREE.CylinderGeometry(0.08, 0.1, h - 0.8, 12);
    pole.translate(0, -halfH + (h - 0.8) / 2 + 0.3, 0);
    const lantern = new THREE.OctahedronGeometry(0.24);
    lantern.translate(0, halfH - 0.2, 0);
    const merged = BufferGeometryUtils.mergeGeometries([base, pole, lantern], false);
    base.dispose();
    pole.dispose();
    lantern.dispose();
    if (merged) {
      const idx = BufferGeometryUtils.mergeVertices(merged);
      merged.dispose();
      idx.computeVertexNormals();
      return idx;
    }
  }

  if (def.geometryType === "fence" || def.geometryType === "railing") {
    const postCount = 4;
    const parts: THREE.BufferGeometry[] = [];
    const railTop = new THREE.BoxGeometry(0.12, 0.1, l);
    railTop.translate(0, halfH - 0.05, 0);
    parts.push(railTop);

    const railBot = new THREE.BoxGeometry(0.12, 0.08, l);
    railBot.translate(0, -halfH + 0.08, 0);
    parts.push(railBot);

    for (let i = 0; i < postCount; i++) {
      const post = new THREE.BoxGeometry(0.14, h, 0.14);
      const pz = -l / 2 + (i / (postCount - 1)) * l;
      post.translate(0, 0, pz);
      parts.push(post);
    }
    const merged = BufferGeometryUtils.mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (merged) {
      const idx = BufferGeometryUtils.mergeVertices(merged);
      merged.dispose();
      idx.computeVertexNormals();
      return idx;
    }
  }

  // Fallback prop
  return new THREE.BoxGeometry(w, h, l);
}

/**
 * Creates procedural geometry based on part definition and category
 */
function createBrickGeometry(type: BrickTypeId): THREE.BufferGeometry {
  const def = BRICK_CATALOG[type] || BRICK_CATALOG.brick_2x4;

  switch (def.geometryType) {
    case "tile":
    case "road_tile":
      return createTileGeometry(def);
    case "slope":
      return createSlopeGeometry(def);
    case "slope_inv":
      return createInvertedSlopeGeometry(def);
    case "window":
      return createWindowGeometry(def);
    case "door_frame":
      return createDoorFrameGeometry(def);
    case "arch":
      return createArchGeometry(def);
    case "column":
      return createColumnGeometry(def);
    case "fence":
    case "railing":
    case "plant_pot":
    case "bench":
    case "lamp_post":
    case "road_cone":
    case "sign_post":
      return createPropGeometry(def);
    case "standard":
    default:
      return createStandardGeometry(def);
  }
}

/**
 * Retrieves cached geometry for a brick type. Instantiates and caches on first query.
 */
export function getBrickGeometry(type: BrickTypeId): THREE.BufferGeometry {
  let geo = geometryCache.get(type);
  if (!geo) {
    geo = createBrickGeometry(type);
    geometryCache.set(type, geo);
  }
  return geo;
}

/**
 * Retrieves a cached wireframe box geometry sized for a specific footprint
 */
export function getWireframeBoxGeometry(
  widthStuds: number,
  lengthStuds: number,
  heightUnits: number,
  padding = 0.05
): THREE.BufferGeometry {
  const key = `${widthStuds}x${lengthStuds}x${heightUnits}_${padding}`;
  let geo = wireframeBoxCache.get(key);
  if (!geo) {
    const w = widthStuds * STUD_PITCH + padding;
    const l = lengthStuds * STUD_PITCH + padding;
    const h = heightUnits * VERTICAL_UNIT_HEIGHT + padding;
    geo = new THREE.BoxGeometry(w, h, l);
    wireframeBoxCache.set(key, geo);
  }
  return geo;
}

/**
 * Clears and disposes all globally cached geometries (only when shutting down engine)
 */
export function disposeGeometryCache(): void {
  for (const geo of geometryCache.values()) {
    geo.dispose();
  }
  geometryCache.clear();

  for (const geo of wireframeBoxCache.values()) {
    geo.dispose();
  }
  wireframeBoxCache.clear();
}
