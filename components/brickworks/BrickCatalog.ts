export type BrickCategory =
  | "brick"
  | "plate"
  | "tile"
  | "slope"
  | "architecture"
  | "decorative"
  | "road";

export type BrickGeometryType =
  | "standard"
  | "tile"
  | "slope"
  | "slope_inv"
  | "window"
  | "door_frame"
  | "arch"
  | "column"
  | "fence"
  | "railing"
  | "plant_pot"
  | "bench"
  | "lamp_post"
  | "road_cone"
  | "sign_post"
  | "road_tile";

export type WalkCollisionType =
  | "solid"
  | "doorway"
  | "arch"
  | "railing"
  | "passable";

export type BrickTypeId =
  // Standard Bricks
  | "brick_1x1"
  | "brick_1x2"
  | "brick_1x3"
  | "brick_1x4"
  | "brick_1x6"
  | "brick_2x2"
  | "brick_2x3"
  | "brick_2x4"
  | "brick_2x6"
  | "brick_2x8"
  // Plates
  | "plate_1x1"
  | "plate_1x2"
  | "plate_1x3"
  | "plate_1x4"
  | "plate_1x6"
  | "plate_2x2"
  | "plate_2x3"
  | "plate_2x4"
  | "plate_2x6"
  | "plate_2x8"
  // Tiles (Smooth top, 1 height unit)
  | "tile_1x1"
  | "tile_1x2"
  | "tile_1x4"
  | "tile_2x2"
  | "tile_2x4"
  // Slopes (3 height units)
  | "slope_1x2"
  | "slope_1x3"
  | "slope_2x2"
  | "slope_2x3"
  | "slope_2x4"
  | "slope_1x2_inv"
  // Architecture
  | "window_1x2"
  | "window_1x4"
  | "door_frame_1x4"
  | "arch_1x4"
  | "column_1x1"
  | "fence_1x4"
  | "railing_1x4"
  // Decorative Props
  | "plant_pot"
  | "bench_1x4"
  | "lamp_post"
  | "road_cone"
  | "sign_post"
  // Road Tiles
  | "road_tile_1x4"
  | "road_tile_2x4"
  | "road_tile_4x4";

export interface BrickDefinition {
  id: BrickTypeId;
  name: string;
  label: string;
  widthStuds: number;  // studs along local X
  lengthStuds: number; // studs along local Y
  heightUnits: number; // 3 for standard bricks (0.96m), 1 for plates/tiles (0.32m), 6 for door/lamp
  category: BrickCategory;
  geometryType: BrickGeometryType;
  hasTopStuds: boolean;
  walkCollisionType: WalkCollisionType;
  shortcut?: string;
  tags: string[];
}

export interface BrickColor {
  id: string;
  name: string;
  hex: string;
}

export const BRICK_CATALOG: Record<BrickTypeId, BrickDefinition> = {
  // ─── Standard Bricks ──────────────────────────────────────────────
  brick_1x1: {
    id: "brick_1x1",
    name: "1 × 1 Brick",
    label: "1×1",
    widthStuds: 1,
    lengthStuds: 1,
    heightUnits: 3,
    category: "brick",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    shortcut: "1",
    tags: ["brick", "1x1", "small", "cube", "standard"],
  },
  brick_1x2: {
    id: "brick_1x2",
    name: "1 × 2 Brick",
    label: "1×2",
    widthStuds: 1,
    lengthStuds: 2,
    heightUnits: 3,
    category: "brick",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    shortcut: "2",
    tags: ["brick", "1x2", "wall", "standard"],
  },
  brick_1x3: {
    id: "brick_1x3",
    name: "1 × 3 Brick",
    label: "1×3",
    widthStuds: 1,
    lengthStuds: 3,
    heightUnits: 3,
    category: "brick",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["brick", "1x3", "wall", "standard"],
  },
  brick_1x4: {
    id: "brick_1x4",
    name: "1 × 4 Brick",
    label: "1×4",
    widthStuds: 1,
    lengthStuds: 4,
    heightUnits: 3,
    category: "brick",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    shortcut: "3",
    tags: ["brick", "1x4", "wall", "beam", "standard"],
  },
  brick_1x6: {
    id: "brick_1x6",
    name: "1 × 6 Brick",
    label: "1×6",
    widthStuds: 1,
    lengthStuds: 6,
    heightUnits: 3,
    category: "brick",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["brick", "1x6", "wall", "long", "beam", "standard"],
  },
  brick_2x2: {
    id: "brick_2x2",
    name: "2 × 2 Brick",
    label: "2×2",
    widthStuds: 2,
    lengthStuds: 2,
    heightUnits: 3,
    category: "brick",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    shortcut: "4",
    tags: ["brick", "2x2", "square", "pillar", "standard"],
  },
  brick_2x3: {
    id: "brick_2x3",
    name: "2 × 3 Brick",
    label: "2×3",
    widthStuds: 2,
    lengthStuds: 3,
    heightUnits: 3,
    category: "brick",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["brick", "2x3", "standard"],
  },
  brick_2x4: {
    id: "brick_2x4",
    name: "2 × 4 Brick",
    label: "2×4",
    widthStuds: 2,
    lengthStuds: 4,
    heightUnits: 3,
    category: "brick",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    shortcut: "5",
    tags: ["brick", "2x4", "classic", "standard"],
  },
  brick_2x6: {
    id: "brick_2x6",
    name: "2 × 6 Brick",
    label: "2×6",
    widthStuds: 2,
    lengthStuds: 6,
    heightUnits: 3,
    category: "brick",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["brick", "2x6", "large", "foundation", "standard"],
  },
  brick_2x8: {
    id: "brick_2x8",
    name: "2 × 8 Brick",
    label: "2×8",
    widthStuds: 2,
    lengthStuds: 8,
    heightUnits: 3,
    category: "brick",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["brick", "2x8", "large", "beam", "foundation", "standard"],
  },

  // ─── Plates ───────────────────────────────────────────────────────
  plate_1x1: {
    id: "plate_1x1",
    name: "1 × 1 Plate",
    label: "1×1 Pl",
    widthStuds: 1,
    lengthStuds: 1,
    heightUnits: 1,
    category: "plate",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["plate", "1x1", "thin", "small"],
  },
  plate_1x2: {
    id: "plate_1x2",
    name: "1 × 2 Plate",
    label: "1×2 Pl",
    widthStuds: 1,
    lengthStuds: 2,
    heightUnits: 1,
    category: "plate",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["plate", "1x2", "thin"],
  },
  plate_1x3: {
    id: "plate_1x3",
    name: "1 × 3 Plate",
    label: "1×3 Pl",
    widthStuds: 1,
    lengthStuds: 3,
    heightUnits: 1,
    category: "plate",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["plate", "1x3", "thin"],
  },
  plate_1x4: {
    id: "plate_1x4",
    name: "1 × 4 Plate",
    label: "1×4 Pl",
    widthStuds: 1,
    lengthStuds: 4,
    heightUnits: 1,
    category: "plate",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["plate", "1x4", "thin", "strip"],
  },
  plate_1x6: {
    id: "plate_1x6",
    name: "1 × 6 Plate",
    label: "1×6 Pl",
    widthStuds: 1,
    lengthStuds: 6,
    heightUnits: 1,
    category: "plate",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["plate", "1x6", "thin", "long"],
  },
  plate_2x2: {
    id: "plate_2x2",
    name: "2 × 2 Plate",
    label: "2×2 Pl",
    widthStuds: 2,
    lengthStuds: 2,
    heightUnits: 1,
    category: "plate",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["plate", "2x2", "thin", "square"],
  },
  plate_2x3: {
    id: "plate_2x3",
    name: "2 × 3 Plate",
    label: "2×3 Pl",
    widthStuds: 2,
    lengthStuds: 3,
    heightUnits: 1,
    category: "plate",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["plate", "2x3", "thin"],
  },
  plate_2x4: {
    id: "plate_2x4",
    name: "2 × 4 Plate",
    label: "2×4 Pl",
    widthStuds: 2,
    lengthStuds: 4,
    heightUnits: 1,
    category: "plate",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["plate", "2x4", "thin", "flat"],
  },
  plate_2x6: {
    id: "plate_2x6",
    name: "2 × 6 Plate",
    label: "2×6 Pl",
    widthStuds: 2,
    lengthStuds: 6,
    heightUnits: 1,
    category: "plate",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["plate", "2x6", "thin", "base"],
  },
  plate_2x8: {
    id: "plate_2x8",
    name: "2 × 8 Plate",
    label: "2×8 Pl",
    widthStuds: 2,
    lengthStuds: 8,
    heightUnits: 1,
    category: "plate",
    geometryType: "standard",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["plate", "2x8", "thin", "large", "foundation"],
  },

  // ─── Tiles (Smooth studless top) ──────────────────────────────────
  tile_1x1: {
    id: "tile_1x1",
    name: "1 × 1 Tile",
    label: "1×1 Tl",
    widthStuds: 1,
    lengthStuds: 1,
    heightUnits: 1,
    category: "tile",
    geometryType: "tile",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["tile", "1x1", "smooth", "floor", "finish"],
  },
  tile_1x2: {
    id: "tile_1x2",
    name: "1 × 2 Tile",
    label: "1×2 Tl",
    widthStuds: 1,
    lengthStuds: 2,
    heightUnits: 1,
    category: "tile",
    geometryType: "tile",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["tile", "1x2", "smooth", "floor", "finish"],
  },
  tile_1x4: {
    id: "tile_1x4",
    name: "1 × 4 Tile",
    label: "1×4 Tl",
    widthStuds: 1,
    lengthStuds: 4,
    heightUnits: 1,
    category: "tile",
    geometryType: "tile",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["tile", "1x4", "smooth", "floor", "strip"],
  },
  tile_2x2: {
    id: "tile_2x2",
    name: "2 × 2 Tile",
    label: "2×2 Tl",
    widthStuds: 2,
    lengthStuds: 2,
    heightUnits: 1,
    category: "tile",
    geometryType: "tile",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["tile", "2x2", "smooth", "floor", "square"],
  },
  tile_2x4: {
    id: "tile_2x4",
    name: "2 × 4 Tile",
    label: "2×4 Tl",
    widthStuds: 2,
    lengthStuds: 4,
    heightUnits: 1,
    category: "tile",
    geometryType: "tile",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["tile", "2x4", "smooth", "floor", "sidewalk"],
  },

  // ─── Slopes ───────────────────────────────────────────────────────
  slope_1x2: {
    id: "slope_1x2",
    name: "1 × 2 Slope (45°)",
    label: "1×2 Sl",
    widthStuds: 1,
    lengthStuds: 2,
    heightUnits: 3,
    category: "slope",
    geometryType: "slope",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["slope", "1x2", "roof", "angle", "ramp"],
  },
  slope_1x3: {
    id: "slope_1x3",
    name: "1 × 3 Slope (33°)",
    label: "1×3 Sl",
    widthStuds: 1,
    lengthStuds: 3,
    heightUnits: 3,
    category: "slope",
    geometryType: "slope",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["slope", "1x3", "roof", "angle", "shallow"],
  },
  slope_2x2: {
    id: "slope_2x2",
    name: "2 × 2 Slope (45°)",
    label: "2×2 Sl",
    widthStuds: 2,
    lengthStuds: 2,
    heightUnits: 3,
    category: "slope",
    geometryType: "slope",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["slope", "2x2", "roof", "angle", "wedge"],
  },
  slope_2x3: {
    id: "slope_2x3",
    name: "2 × 3 Slope (33°)",
    label: "2×3 Sl",
    widthStuds: 2,
    lengthStuds: 3,
    heightUnits: 3,
    category: "slope",
    geometryType: "slope",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["slope", "2x3", "roof", "angle"],
  },
  slope_2x4: {
    id: "slope_2x4",
    name: "2 × 4 Slope (45°)",
    label: "2×4 Sl",
    widthStuds: 2,
    lengthStuds: 4,
    heightUnits: 3,
    category: "slope",
    geometryType: "slope",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["slope", "2x4", "roof", "large", "wedge"],
  },
  slope_1x2_inv: {
    id: "slope_1x2_inv",
    name: "1 × 2 Inverted Slope",
    label: "1×2 Inv",
    widthStuds: 1,
    lengthStuds: 2,
    heightUnits: 3,
    category: "slope",
    geometryType: "slope_inv",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["slope", "inverted", "1x2", "overhang", "hull"],
  },

  // ─── Architecture ─────────────────────────────────────────────────
  window_1x2: {
    id: "window_1x2",
    name: "1 × 2 Window",
    label: "1×2 Win",
    widthStuds: 1,
    lengthStuds: 2,
    heightUnits: 6, // 2 bricks tall
    category: "architecture",
    geometryType: "window",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["window", "glass", "house", "building", "transparent"],
  },
  window_1x4: {
    id: "window_1x4",
    name: "1 × 4 Window Pane",
    label: "1×4 Win",
    widthStuds: 1,
    lengthStuds: 4,
    heightUnits: 6, // 2 bricks tall
    category: "architecture",
    geometryType: "window",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["window", "glass", "panoramic", "large", "facade", "transparent"],
  },
  door_frame_1x4: {
    id: "door_frame_1x4",
    name: "1 × 4 Door Frame",
    label: "1×4 Door",
    widthStuds: 1,
    lengthStuds: 4,
    heightUnits: 9, // 3 bricks tall
    category: "architecture",
    geometryType: "door_frame",
    hasTopStuds: true,
    walkCollisionType: "doorway",
    tags: ["door", "entrance", "frame", "portal", "doorway"],
  },
  arch_1x4: {
    id: "arch_1x4",
    name: "1 × 4 Arch",
    label: "1×4 Arch",
    widthStuds: 1,
    lengthStuds: 4,
    heightUnits: 4,
    category: "architecture",
    geometryType: "arch",
    hasTopStuds: true,
    walkCollisionType: "arch",
    tags: ["arch", "bridge", "castle", "curved", "doorway"],
  },
  column_1x1: {
    id: "column_1x1",
    name: "1 × 1 Round Column",
    label: "1×1 Col",
    widthStuds: 1,
    lengthStuds: 1,
    heightUnits: 6,
    category: "architecture",
    geometryType: "column",
    hasTopStuds: true,
    walkCollisionType: "solid",
    tags: ["column", "pillar", "round", "temple", "support"],
  },
  fence_1x4: {
    id: "fence_1x4",
    name: "1 × 4 Fence",
    label: "1×4 Fnc",
    widthStuds: 1,
    lengthStuds: 4,
    heightUnits: 3,
    category: "architecture",
    geometryType: "fence",
    hasTopStuds: false,
    walkCollisionType: "railing",
    tags: ["fence", "barrier", "picket", "boundary"],
  },
  railing_1x4: {
    id: "railing_1x4",
    name: "1 × 4 Railing",
    label: "1×4 Rail",
    widthStuds: 1,
    lengthStuds: 4,
    heightUnits: 3,
    category: "architecture",
    geometryType: "railing",
    hasTopStuds: false,
    walkCollisionType: "railing",
    tags: ["railing", "balcony", "guardrail", "stairs"],
  },

  // ─── Decorative Props ─────────────────────────────────────────────
  plant_pot: {
    id: "plant_pot",
    name: "Plant Pot",
    label: "Pot",
    widthStuds: 1,
    lengthStuds: 1,
    heightUnits: 3,
    category: "decorative",
    geometryType: "plant_pot",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["plant", "pot", "flower", "greenery", "nature", "decoration"],
  },
  bench_1x4: {
    id: "bench_1x4",
    name: "Park Bench",
    label: "Bench",
    widthStuds: 1,
    lengthStuds: 4,
    heightUnits: 2,
    category: "decorative",
    geometryType: "bench",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["bench", "seat", "park", "furniture", "street"],
  },
  lamp_post: {
    id: "lamp_post",
    name: "Street Lamp Post",
    label: "Lamp",
    widthStuds: 1,
    lengthStuds: 1,
    heightUnits: 9,
    category: "decorative",
    geometryType: "lamp_post",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["lamp", "light", "street", "lantern", "city"],
  },
  road_cone: {
    id: "road_cone",
    name: "Traffic Cone",
    label: "Cone",
    widthStuds: 1,
    lengthStuds: 1,
    heightUnits: 3,
    category: "decorative",
    geometryType: "road_cone",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["cone", "traffic", "road", "safety", "orange"],
  },
  sign_post: {
    id: "sign_post",
    name: "Sign Post",
    label: "Sign",
    widthStuds: 1,
    lengthStuds: 1,
    heightUnits: 6,
    category: "decorative",
    geometryType: "sign_post",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["sign", "post", "street", "traffic", "marker"],
  },

  // ─── Road Tiles ───────────────────────────────────────────────────
  road_tile_1x4: {
    id: "road_tile_1x4",
    name: "1 × 4 Road Tile",
    label: "1×4 Rd",
    widthStuds: 1,
    lengthStuds: 4,
    heightUnits: 1,
    category: "road",
    geometryType: "road_tile",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["road", "tile", "street", "asphalt", "lane"],
  },
  road_tile_2x4: {
    id: "road_tile_2x4",
    name: "2 × 4 Road Tile",
    label: "2×4 Rd",
    widthStuds: 2,
    lengthStuds: 4,
    heightUnits: 1,
    category: "road",
    geometryType: "road_tile",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["road", "tile", "street", "asphalt", "lane", "highway"],
  },
  road_tile_4x4: {
    id: "road_tile_4x4",
    name: "4 × 4 Road Slab",
    label: "4×4 Rd",
    widthStuds: 4,
    lengthStuds: 4,
    heightUnits: 1,
    category: "road",
    geometryType: "road_tile",
    hasTopStuds: false,
    walkCollisionType: "solid",
    tags: ["road", "slab", "intersection", "asphalt", "square"],
  },
};

export const BRICK_LIST: BrickDefinition[] = Object.values(BRICK_CATALOG);

export const BRICK_CATEGORIES: { id: BrickCategory; name: string; icon?: string }[] = [
  { id: "brick", name: "Bricks" },
  { id: "plate", name: "Plates" },
  { id: "tile", name: "Tiles" },
  { id: "slope", name: "Slopes" },
  { id: "architecture", name: "Architecture" },
  { id: "decorative", name: "Decorative" },
  { id: "road", name: "Roads" },
];

export const COLOR_PALETTE: BrickColor[] = [
  { id: "red", name: "Red", hex: "#e62b32" },
  { id: "blue", name: "Blue", hex: "#1b75d0" },
  { id: "yellow", name: "Yellow", hex: "#f6be1a" },
  { id: "green", name: "Green", hex: "#2ea342" },
  { id: "white", name: "White", hex: "#f0f2f5" },
  { id: "black", name: "Black", hex: "#24272c" },
  { id: "light_gray", name: "Light Gray", hex: "#9aa5b1" },
  { id: "dark_gray", name: "Dark Gray", hex: "#4b5563" },
  { id: "brown", name: "Brown", hex: "#78350f" },
  { id: "tan", name: "Tan / Sand", hex: "#d4a373" },
  { id: "orange", name: "Orange", hex: "#ea580c" },
  { id: "trans_blue", name: "Trans Blue", hex: "#38bdf8" },
];

export const DEFAULT_BRICK_TYPE: BrickTypeId = "brick_2x4";
export const DEFAULT_BRICK_COLOR = COLOR_PALETTE[0].hex; // Red
