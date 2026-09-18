import { WorldType, WorldSize, ChunkTerrainMod } from "./WorldStorage";
import { STUD_PITCH, VERTICAL_UNIT_HEIGHT, CHUNK_SIZE } from "./GridSystem";

export const WATER_LEVEL = -1.2; // World Y units for water bodies

// World dimensions in studs
export const WORLD_SIZE_STUDS: Record<WorldType, Record<WorldSize, number>> = {
  island: {
    small: 64,
    medium: 128,
    large: 256,
    huge: 512,
    massive: 512,
    expanding: 512,
  },
  flat: {
    small: 128,
    medium: 256,
    large: 512,
    massive: 1024,
    huge: 512,
    expanding: Infinity,
  },
  natural: {
    small: 128,
    medium: 256,
    large: 512,
    huge: 512,
    massive: 1024,
    expanding: Infinity,
  },
};

/**
 * High quality deterministic seeded PRNG (Mulberry32)
 */
export function createPRNG(seed: number) {
  let s = Math.abs(seed | 0) + 1;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 2D Seeded Simplex Noise implementation
 */
export class SeededNoise2D {
  private perm: Uint8Array = new Uint8Array(512);

  constructor(seed: number) {
    const prng = createPRNG(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const r = Math.floor(prng() * (i + 1));
      const tmp = p[i];
      p[i] = p[r];
      p[r] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  // 2D Simplex Noise
  noise2D(xin: number, yin: number): number {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

    let n0 = 0;
    let n1 = 0;
    let n2 = 0;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1 = 0;
    let j1 = 0;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.perm[ii + this.perm[jj]] % 12;
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;

    const grad3 = [
      [1, 1], [-1, 1], [1, -1], [-1, -1],
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1],
    ];

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2);
    }

    return 70.0 * (n0 + n1 + n2);
  }

  // Multi-octave fractal noise
  fractal2D(x: number, y: number, octaves = 3, persistence = 0.5, lacunarity = 2.0): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }
}

// Noise instance cache per seed
const noiseCache = new Map<number, SeededNoise2D>();
export function getNoiseInstance(seed: number): SeededNoise2D {
  let inst = noiseCache.get(seed);
  if (!inst) {
    inst = new SeededNoise2D(seed);
    noiseCache.set(seed, inst);
  }
  return inst;
}

export interface TerrainSample {
  heightWorld: number; // Continuous world Y
  heightGridZ: number; // Discrete integer gridZ vertical layer
  surfaceType: "grass" | "soil" | "rock" | "water" | "sand" | "void";
  isVoid: boolean;
  undersideY?: number; // Lowest rock point for floating island underbelly
  slope: number; // Surface steepness gradient
}

/**
 * Samples the procedural terrain at continuous world coordinates (worldX, worldZ)
 */
export function sampleTerrain(
  worldType: WorldType,
  worldSize: WorldSize,
  seed: number,
  worldX: number,
  worldZ: number
): TerrainSample {
  const noise = getNoiseInstance(seed);
  const sizeStuds = WORLD_SIZE_STUDS[worldType][worldSize];
  const halfWidth = (sizeStuds * STUD_PITCH) / 2;

  // 1. FLOATING ISLAND
  if (worldType === "island") {
    const dist = Math.hypot(worldX, worldZ);
    const angle = Math.atan2(worldZ, worldX);

    // Organic perimeter with dual-frequency coastline noise
    const coastNoise =
      noise.noise2D(Math.cos(angle) * 1.8 + seed * 0.001, Math.sin(angle) * 1.8) * 0.16 +
      noise.noise2D(Math.cos(angle) * 4.2, Math.sin(angle) * 4.2) * 0.08;

    const baseRadius = halfWidth * 0.88;
    const boundaryRadius = baseRadius * (1.0 + coastNoise);

    // Outside island bounds is sky/void
    if (dist > boundaryRadius) {
      return {
        heightWorld: -999,
        heightGridZ: -1,
        surfaceType: "void",
        isVoid: true,
        slope: 0,
      };
    }

    const edgeFactor = Math.max(0, 1.0 - dist / boundaryRadius);

    // Surface elevation: gentle central plateau with subtle rolling hills
    const hillNoise = noise.fractal2D(worldX * 0.035, worldZ * 0.035, 2, 0.45);
    const topY = Math.pow(edgeFactor, 0.38) * (hillNoise * 1.4 + 0.35);

    // Stepped bottom tapering into natural rock cone
    const bottomNoise = noise.noise2D(worldX * 0.06, worldZ * 0.06) * 0.25 + 1.0;
    const undersideY = -0.5 - Math.pow(edgeFactor, 0.55) * (baseRadius * 0.28 + 3.2) * bottomNoise;

    const gridZ = Math.max(0, Math.round(topY / VERTICAL_UNIT_HEIGHT));
    const surfaceType = edgeFactor < 0.12 ? "rock" : edgeFactor < 0.25 ? "soil" : "grass";

    return {
      heightWorld: topY,
      heightGridZ: gridZ,
      surfaceType,
      isVoid: false,
      undersideY,
      slope: 1.0 - edgeFactor,
    };
  }

  // 2. FLAT WORLD
  if (worldType === "flat") {
    // Finite boundary check if not expanding
    if (Number.isFinite(halfWidth)) {
      if (Math.abs(worldX) > halfWidth || Math.abs(worldZ) > halfWidth) {
        return {
          heightWorld: -999,
          heightGridZ: -1,
          surfaceType: "void",
          isVoid: true,
          slope: 0,
        };
      }
    }

    return {
      heightWorld: 0,
      heightGridZ: 0,
      surfaceType: "grass",
      isVoid: false,
      slope: 0,
    };
  }

  // 3. NATURAL WORLD
  if (worldType === "natural") {
    // Finite boundary check if not expanding
    if (Number.isFinite(halfWidth)) {
      if (Math.abs(worldX) > halfWidth || Math.abs(worldZ) > halfWidth) {
        return {
          heightWorld: -999,
          heightGridZ: -1,
          surfaceType: "void",
          isVoid: true,
          slope: 0,
        };
      }
    }

    // Multi-octave natural terrain: broad rolling hills + detail undulations
    const broad = noise.fractal2D(worldX * 0.012, worldZ * 0.012, 3, 0.5, 2.1);
    const detail = noise.noise2D(worldX * 0.045, worldZ * 0.045) * 0.75;
    
    // Near world center (spawn), keep terrain gently elevated and safe
    const distCenter = Math.hypot(worldX, worldZ);
    const spawnFlatten = Math.min(1.0, distCenter / 25.0);

    const rawHeight = (broad * 6.5 + detail) * spawnFlatten;

    // Stylized plateau quantization for subtle stepped brick look
    const quantized = Math.round(rawHeight / (VERTICAL_UNIT_HEIGHT * 3)) * (VERTICAL_UNIT_HEIGHT * 3);
    const finalHeight = rawHeight * 0.65 + quantized * 0.35;

    const isWater = finalHeight < WATER_LEVEL;
    const surfaceType = isWater
      ? "water"
      : finalHeight < WATER_LEVEL + 0.4
      ? "sand"
      : Math.abs(broad) > 0.6
      ? "rock"
      : "grass";

    const gridZ = Math.round(finalHeight / VERTICAL_UNIT_HEIGHT);

    return {
      heightWorld: isWater ? WATER_LEVEL : finalHeight,
      heightGridZ: isWater ? Math.round(WATER_LEVEL / VERTICAL_UNIT_HEIGHT) : gridZ,
      surfaceType,
      isVoid: false,
      slope: Math.abs(broad),
    };
  }

  return {
    heightWorld: 0,
    heightGridZ: 0,
    surfaceType: "grass",
    isVoid: false,
    slope: 0,
  };
}

/**
 * Fast helper to query quantized vertical unit gridZ for brick placement at (gridX, gridY)
 */
export function getTerrainHeightGrid(
  worldType: WorldType,
  worldSize: WorldSize,
  seed: number,
  gridX: number,
  gridY: number
): number {
  const worldX = (gridX + 0.5) * STUD_PITCH;
  const worldZ = (gridY + 0.5) * STUD_PITCH;
  const sample = sampleTerrain(worldType, worldSize, seed, worldX, worldZ);
  return sample.isVoid ? -999 : sample.heightGridZ;
}

/**
 * Fast helper to query continuous terrain height in world units at (worldX, worldZ)
 */
export function getTerrainHeightContinuous(
  worldType: WorldType,
  worldSize: WorldSize,
  seed: number,
  worldX: number,
  worldZ: number
): number {
  const sample = sampleTerrain(worldType, worldSize, seed, worldX, worldZ);
  return sample.isVoid ? -999 : sample.heightWorld;
}

/**
 * Samples terrain height taking into account any custom chunk terrain modifications
 */
export function getModifiedTerrainHeight(
  worldType: WorldType,
  worldSize: WorldSize,
  seed: number,
  worldX: number,
  worldZ: number,
  chunks?: Record<string, { terrainMod?: ChunkTerrainMod }>
): number {
  const baseSample = sampleTerrain(worldType, worldSize, seed, worldX, worldZ);
  if (baseSample.isVoid) return -999;
  if (!chunks) return baseSample.heightWorld;

  const chunkSpan = CHUNK_SIZE * STUD_PITCH;
  const chunkX = Math.floor(worldX / chunkSpan);
  const chunkZ = Math.floor(worldZ / chunkSpan);
  const chunkKey = `${chunkX},${chunkZ}`;
  const mod = chunks[chunkKey]?.terrainMod;

  if (!mod?.heights || Object.keys(mod.heights).length === 0) {
    return baseSample.heightWorld;
  }

  const res = 8;
  const step = chunkSpan / res;
  const lx = worldX - chunkX * chunkSpan;
  const lz = worldZ - chunkZ * chunkSpan;

  const fx = Math.max(0, Math.min(res - 1e-4, lx / step));
  const fz = Math.max(0, Math.min(res - 1e-4, lz / step));

  const ix0 = Math.floor(fx);
  const iz0 = Math.floor(fz);
  const ix1 = Math.min(res, ix0 + 1);
  const iz1 = Math.min(res, iz0 + 1);

  const tx = fx - ix0;
  const tz = fz - iz0;

  const getH = (ix: number, iz: number) => {
    const idx = iz * (res + 1) + ix;
    const h = mod.heights?.[idx];
    if (h !== undefined) return h;
    const wx = chunkX * chunkSpan + ix * step;
    const wz = chunkZ * chunkSpan + iz * step;
    const s = sampleTerrain(worldType, worldSize, seed, wx, wz);
    return s.isVoid ? baseSample.heightWorld : s.heightWorld;
  };

  const h00 = getH(ix0, iz0);
  const h10 = getH(ix1, iz0);
  const h01 = getH(ix0, iz1);
  const h11 = getH(ix1, iz1);

  const h0 = h00 * (1 - tx) + h10 * tx;
  const h1 = h01 * (1 - tx) + h11 * tx;

  return h0 * (1 - tz) + h1 * tz;
}

export interface ChunkDecoration {
  type: "pine" | "oak" | "rock";
  worldX: number;
  worldY: number;
  worldZ: number;
  scale: number;
  rotationY: number;
}

/**
 * Generates deterministic environment scenery (trees, rocks) for a 16x16 chunk
 */
export function generateChunkDecorations(
  worldType: WorldType,
  worldSize: WorldSize,
  seed: number,
  chunkX: number,
  chunkZ: number,
  chunkSize = 16
): ChunkDecoration[] {
  // Flat worlds do not spawn natural trees to maintain a clean building canvas
  if (worldType === "flat") return [];

  const chunkSeed = Math.sin(chunkX * 374761393 + chunkZ * 668265263 + seed) * 100000;
  const prng = createPRNG(Math.floor(Math.abs(chunkSeed)));

  const count = Math.floor(prng() * 3) + 1; // 1 to 3 items per chunk
  const decors: ChunkDecoration[] = [];

  const chunkMinX = chunkX * chunkSize * STUD_PITCH;
  const chunkMinZ = chunkZ * chunkSize * STUD_PITCH;
  const chunkSpan = chunkSize * STUD_PITCH;

  for (let i = 0; i < count; i++) {
    const rx = prng() * (chunkSpan - 2.4) + 1.2;
    const rz = prng() * (chunkSpan - 2.4) + 1.2;
    const wx = chunkMinX + rx;
    const wz = chunkMinZ + rz;

    const sample = sampleTerrain(worldType, worldSize, seed, wx, wz);

    // Trees & rocks require solid ground, gentle slope, and not underwater or in void
    if (sample.isVoid || sample.heightWorld <= WATER_LEVEL + 0.1 || sample.slope > 0.45) {
      continue;
    }

    // Keep clear zone near spawn center (0, 0)
    if (Math.hypot(wx, wz) < 5.0) {
      continue;
    }

    const pick = prng();
    const type: "pine" | "oak" | "rock" = pick < 0.45 ? "pine" : pick < 0.8 ? "oak" : "rock";
    const scale = 0.65 + prng() * 0.4;
    const rotationY = prng() * Math.PI * 2;

    decors.push({
      type,
      worldX: wx,
      worldY: sample.heightWorld,
      worldZ: wz,
      scale,
      rotationY,
    });
  }

  return decors;
}
