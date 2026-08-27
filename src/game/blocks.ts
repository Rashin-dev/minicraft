// Block + item registry
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, GRAVEL: 6,
  LOG: 7, LEAVES: 8, PLANKS: 9, GLASS: 10, BRICK: 11, WATER: 12,
  BEDROCK: 13, COAL_ORE: 14, IRON_ORE: 15, GOLD_ORE: 16, DIAMOND_ORE: 17,
  TORCH: 18, FLOWER_RED: 19, FLOWER_YELLOW: 20, TALLGRASS: 21, CACTUS: 22,
  SNOW: 23, TNT: 24,
  WOOL_RED: 25, WOOL_BLUE: 26, WOOL_YELLOW: 27, WOOL_GREEN: 28,
  CRAFTING: 29, GLOWSTONE: 30, OBSIDIAN: 31, BOOKSHELF: 32, ICE: 33, MOSS: 34,
  SLAB: 35,
  VSLAB_X0: 36, VSLAB_X1: 37, VSLAB_Z0: 38, VSLAB_Z1: 39,
  CHERRY_LOG: 40, CHERRY_LEAVES: 41,
  BIRCH_LOG: 42, BIRCH_LEAVES: 43,
  SPRUCE_LOG: 44, SPRUCE_LEAVES: 45,
  AMETHYST: 46, LANTERN: 47, SANDSTONE: 48, SNOW_BLOCK: 49, MOSS_BLOCK: 50,
  WOOL_WHITE: 51, WOOL_BLACK: 52, STONE_BRICKS: 53,
  DIAMOND_BLOCK: 54, GOLD_BLOCK: 55, IRON_BLOCK: 56,
  LAVA: 57, BED: 58, FLOWER_PINK: 59, DEAD_BUSH: 60,
  STAIRS_PLANKS_N: 61, STAIRS_PLANKS_E: 62, STAIRS_PLANKS_S: 63, STAIRS_PLANKS_W: 64,
  STAIRS_COBBLE_N: 65, STAIRS_COBBLE_E: 66, STAIRS_COBBLE_S: 67, STAIRS_COBBLE_W: 68,
  STAIRS_BRICK_N: 69, STAIRS_BRICK_E: 70, STAIRS_BRICK_S: 71, STAIRS_BRICK_W: 72,
  STAIRS_SANDSTONE_N: 73, STAIRS_SANDSTONE_E: 74, STAIRS_SANDSTONE_S: 75, STAIRS_SANDSTONE_W: 76,
  FENCE: 77,
  DOOR_L_N: 78, DOOR_L_E: 79, DOOR_L_S: 80, DOOR_L_W: 81, DOOR_U: 82,
  DOOR_OPEN_L_N: 83, DOOR_OPEN_L_E: 84, DOOR_OPEN_L_S: 85, DOOR_OPEN_L_W: 86, DOOR_OPEN_U: 87,
  TRAPDOOR: 88, TRAPDOOR_OPEN: 89,
  CHEST: 90, FURNACE: 91, FURNACE_LIT: 92,
  LADDER_N: 93, LADDER_E: 94, LADDER_S: 95, LADDER_W: 96,
  FARMLAND: 97, WHEAT_YOUNG: 98, WHEAT_MATURE: 99,
  // modern families (151+ to avoid IT overlap, blockDef uses map lookup)
  CONCRETE_WHITE: 151, CONCRETE_RED: 152, CONCRETE_BLUE: 153, CONCRETE_BLACK: 154, CONCRETE_GREEN: 155, CONCRETE_YELLOW: 156,
  TERRACOTTA: 157, TERRACOTTA_RED: 158, TERRACOTTA_BLUE: 159,
  COPPER_BLOCK: 160, CUT_COPPER: 161, EXPOSED_COPPER: 162, WEATHERED_COPPER: 163, OXIDIZED_COPPER: 164,
  DEEPSLATE: 165, COBBLED_DEEPSLATE: 166, DEEPSLATE_BRICKS: 167, DEEPSLATE_TILES: 168,
  TINTED_GLASS: 169, ENCHANTING_TABLE: 170,
} as const;

// Non-block items start at 100 (new items at 200+ to avoid B overlap)
export const IT = {
  STICK: 100, COAL: 101, IRON_CHUNK: 102, GOLD_CHUNK: 103, DIAMOND: 104,
  APPLE: 105, PORKCHOP: 106, BEEF: 107, GUNPOWDER: 108,
  WOOD_PICKAXE: 110, STONE_PICKAXE: 111, IRON_PICKAXE: 112, DIAMOND_PICKAXE: 113,
  WOOD_AXE: 114, STONE_AXE: 115, IRON_AXE: 116, DIAMOND_AXE: 117,
  WOOD_SHOVEL: 118, STONE_SHOVEL: 119, IRON_SHOVEL: 120, DIAMOND_SHOVEL: 121,
  WOOD_SWORD: 122, STONE_SWORD: 123, IRON_SWORD: 124, DIAMOND_SWORD: 125,
  FLINT: 126, FEATHER: 127, BUCKET: 128, WATER_BUCKET: 129, LAVA_BUCKET: 130,
  BOW: 131, ARROW: 132, WHEAT_SEEDS: 133, WHEAT: 134, BREAD: 135,
  WOOD_HOE: 136, STONE_HOE: 137, IRON_HOE: 138, DIAMOND_HOE: 139,
  IRON_HELMET: 140, IRON_CHESTPLATE: 141, IRON_LEGGINGS: 142, IRON_BOOTS: 143,
  DIA_HELMET: 144, DIA_CHESTPLATE: 145, DIA_LEGGINGS: 146, DIA_BOOTS: 147,
  EMERALD: 148, COOKED_PORKCHOP: 149, COOKED_STEAK: 150,
  SHIELD: 200, XP_BOTTLE: 201, ENCHANTED_BOOK: 202,
} as const;

export type ToolType = 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hoe';

export interface BlockDef {
  name: string;
  top: string; side: string; bottom?: string; front?: string; xm?: string;
  solid: boolean;
  opaque: boolean;
  liquid?: boolean;
  cross?: boolean;
  torchLike?: boolean;
  light?: number;
  lightColor?: [number, number, number];
  slab?: 'bottom' | 'x0' | 'x1' | 'z0' | 'z1';
  shape?: string;          // stairs_N.., fence, door_*, trapdoor, ladder_*, chest, farmland
  transparent?: boolean;
  breakTime?: number;   // base seconds with bare hand
  tool?: ToolType;      // tool that speeds it up
  drop?: number | null; // item/block id dropped (default: itself)
  climbable?: boolean;
}

export interface ItemDef {
  name: string;
  tool?: { type: ToolType; tier: number; speed: number; damage: number };
  food?: number; // hunger restored
  fuel?: boolean; // seconds of furnace burn (multiplied)
  armor?: { slot: 0 | 1 | 2 | 3; defense: number };
  projectile?: boolean;
  shield?: boolean;
}

type TileSet = { all?: string; top?: string; bottom?: string; front?: string; xm?: string };
type RawBlockDef = Partial<BlockDef> & { tiles?: TileSet; name: string };
const D = (raw: RawBlockDef): BlockDef => {
  const def = { solid: true, opaque: true, breakTime: 0.6, ...raw } as BlockDef & { tiles?: TileSet };
  const t = raw.tiles;
  if (t) {
    def.top = def.top ?? t.top ?? t.all ?? 'stone';
    def.side = def.side ?? t.all ?? 'stone';
    def.bottom = def.bottom ?? t.bottom ?? t.all ?? def.side;
  }
  // strip tiles before returning
  const { tiles: _tiles, ...blockDef } = def as BlockDef & { tiles?: TileSet };
  void _tiles;
  return blockDef as BlockDef;
};

export const BLOCKS: Record<number, BlockDef> = {
  [B.GRASS]: D({ name: 'Grass Block', top: 'grass_top', side: 'grass_side', bottom: 'dirt', breakTime: 0.5, tool: 'shovel', drop: B.DIRT }),
  [B.DIRT]: D({ name: 'Dirt', top: 'dirt', side: 'dirt', breakTime: 0.4, tool: 'shovel' }),
  [B.STONE]: D({ name: 'Stone', top: 'stone', side: 'stone', breakTime: 1.6, tool: 'pickaxe', drop: B.COBBLE }),
  [B.COBBLE]: D({ name: 'Cobblestone', top: 'cobble', side: 'cobble', breakTime: 1.7, tool: 'pickaxe' }),
  [B.SAND]: D({ name: 'Sand', top: 'sand', side: 'sand', breakTime: 0.4, tool: 'shovel' }),
  [B.GRAVEL]: D({ name: 'Gravel', top: 'gravel', side: 'gravel', breakTime: 0.45, tool: 'shovel' }),
  [B.LOG]: D({ name: 'Oak Log', top: 'log_top', side: 'log_side', bottom: 'log_top', breakTime: 1.4, tool: 'axe' }),
  [B.LEAVES]: D({ name: 'Oak Leaves', top: 'leaves', side: 'leaves', opaque: false, transparent: true, breakTime: 0.25, drop: null }),
  [B.PLANKS]: D({ name: 'Oak Planks', top: 'planks', side: 'planks', breakTime: 1.2, tool: 'axe' }),
  [B.GLASS]: D({ name: 'Glass', top: 'glass', side: 'glass', opaque: false, transparent: true, breakTime: 0.3, drop: null }),
  [B.BRICK]: D({ name: 'Bricks', top: 'brick', side: 'brick', breakTime: 1.7, tool: 'pickaxe' }),
  [B.WATER]: D({ name: 'Water', top: 'water', side: 'water', solid: false, opaque: false, liquid: true, transparent: true, breakTime: 0, drop: null }),
  [B.BEDROCK]: D({ name: 'Bedrock', top: 'bedrock', side: 'bedrock', breakTime: Infinity }),
  [B.COAL_ORE]: D({ name: 'Coal Ore', top: 'coal_ore', side: 'coal_ore', breakTime: 2.2, tool: 'pickaxe', drop: IT.COAL }),
  [B.IRON_ORE]: D({ name: 'Iron Ore', top: 'iron_ore', side: 'iron_ore', breakTime: 2.6, tool: 'pickaxe', drop: IT.IRON_CHUNK }),
  [B.GOLD_ORE]: D({ name: 'Gold Ore', top: 'gold_ore', side: 'gold_ore', breakTime: 2.6, tool: 'pickaxe', drop: IT.GOLD_CHUNK }),
  [B.DIAMOND_ORE]: D({ name: 'Diamond Ore', top: 'diamond_ore', side: 'diamond_ore', breakTime: 3.2, tool: 'pickaxe', drop: IT.DIAMOND }),
  [B.TORCH]: D({ name: 'Torch', top: 'torch', side: 'torch', solid: false, opaque: false, torchLike: true, light: 14, lightColor: [1.0, 0.78, 0.45], breakTime: 0.05 }),
  [B.FLOWER_RED]: D({ name: 'Poppy', top: 'flower_red', side: 'flower_red', solid: false, opaque: false, cross: true, breakTime: 0.05 }),
  [B.FLOWER_YELLOW]: D({ name: 'Dandelion', top: 'flower_yellow', side: 'flower_yellow', solid: false, opaque: false, cross: true, breakTime: 0.05 }),
  [B.TALLGRASS]: D({ name: 'Tall Grass', top: 'grass_plant', side: 'grass_plant', solid: false, opaque: false, cross: true, breakTime: 0.05, drop: null }),
  [B.CACTUS]: D({ name: 'Cactus', top: 'cactus_top', side: 'cactus', bottom: 'cactus_top', breakTime: 0.5 }),
  [B.SNOW]: D({ name: 'Snowy Grass', top: 'snow', side: 'snow_side', bottom: 'dirt', breakTime: 0.5, tool: 'shovel', drop: B.DIRT }),
  [B.TNT]: D({ name: 'TNT', top: 'tnt_top', side: 'tnt', bottom: 'tnt_top', breakTime: 0.1 }),
  [B.WOOL_RED]: D({ name: 'Red Wool', top: 'wool_red', side: 'wool_red', breakTime: 0.6 }),
  [B.WOOL_BLUE]: D({ name: 'Blue Wool', top: 'wool_blue', side: 'wool_blue', breakTime: 0.6 }),
  [B.WOOL_YELLOW]: D({ name: 'Yellow Wool', top: 'wool_yellow', side: 'wool_yellow', breakTime: 0.6 }),
  [B.WOOL_GREEN]: D({ name: 'Green Wool', top: 'wool_green', side: 'wool_green', breakTime: 0.6 }),
  [B.CRAFTING]: D({ name: 'Crafting Table', top: 'crafting_top', side: 'crafting', bottom: 'planks', breakTime: 1.0, tool: 'axe' }),
  [B.GLOWSTONE]: D({ name: 'Glowstone', top: 'glowstone', side: 'glowstone', light: 15, lightColor: [1.0, 0.86, 0.55], breakTime: 0.5 }),
  [B.OBSIDIAN]: D({ name: 'Obsidian', top: 'obsidian', side: 'obsidian', breakTime: 6, tool: 'pickaxe' }),
  [B.BOOKSHELF]: D({ name: 'Bookshelf', top: 'planks', side: 'bookshelf', bottom: 'planks', breakTime: 1.0, tool: 'axe' }),
  [B.ICE]: D({ name: 'Ice', top: 'ice', side: 'ice', opaque: false, transparent: true, breakTime: 0.5, tool: 'pickaxe', drop: null }),
  [B.MOSS]: D({ name: 'Mossy Cobble', top: 'moss_stone', side: 'moss_stone', breakTime: 1.7, tool: 'pickaxe' }),
  [B.SLAB]: D({ name: 'Oak Slab', top: 'planks', side: 'planks', slab: 'bottom', breakTime: 1.2, tool: 'axe' }),
  [B.VSLAB_X0]: D({ name: 'Vertical Slab', top: 'planks', side: 'planks', slab: 'x0', breakTime: 1.2, tool: 'axe', opaque: false }),
  [B.VSLAB_X1]: D({ name: 'Vertical Slab', top: 'planks', side: 'planks', slab: 'x1', breakTime: 1.2, tool: 'axe', opaque: false }),
  [B.VSLAB_Z0]: D({ name: 'Vertical Slab', top: 'planks', side: 'planks', slab: 'z0', breakTime: 1.2, tool: 'axe', opaque: false }),
  [B.VSLAB_Z1]: D({ name: 'Vertical Slab', top: 'planks', side: 'planks', slab: 'z1', breakTime: 1.2, tool: 'axe', opaque: false }),
  [B.CHERRY_LOG]: D({ name: 'Cherry Log', top: 'cherry_log_top', side: 'cherry_log', bottom: 'cherry_log_top', breakTime: 1.4, tool: 'axe' }),
  [B.CHERRY_LEAVES]: D({ name: 'Cherry Blossom', top: 'cherry_leaves', side: 'cherry_leaves', opaque: false, transparent: true, breakTime: 0.25, drop: null }),
  [B.BIRCH_LOG]: D({ name: 'Birch Log', top: 'birch_log_top', side: 'birch_log', bottom: 'birch_log_top', breakTime: 1.4, tool: 'axe' }),
  [B.BIRCH_LEAVES]: D({ name: 'Birch Leaves', top: 'birch_leaves', side: 'birch_leaves', opaque: false, transparent: true, breakTime: 0.25, drop: null }),
  [B.SPRUCE_LOG]: D({ name: 'Spruce Log', top: 'spruce_log_top', side: 'spruce_log', bottom: 'spruce_log_top', breakTime: 1.4, tool: 'axe' }),
  [B.SPRUCE_LEAVES]: D({ name: 'Spruce Needles', top: 'spruce_leaves', side: 'spruce_leaves', opaque: false, transparent: true, breakTime: 0.25, drop: null }),
  [B.AMETHYST]: D({ name: 'Amethyst Cluster', top: 'amethyst', side: 'amethyst', solid: false, opaque: false, torchLike: true, light: 9, lightColor: [0.65, 0.4, 1.0], breakTime: 0.8, tool: 'pickaxe' }),
  [B.LANTERN]: D({ name: 'Lantern', top: 'lantern', side: 'lantern', solid: false, opaque: false, torchLike: true, light: 15, lightColor: [1.0, 0.8, 0.5], breakTime: 0.6, tool: 'pickaxe' }),
  [B.SANDSTONE]: D({ name: 'Sandstone', top: 'sandstone_top', side: 'sandstone', bottom: 'sandstone_top', breakTime: 1.4, tool: 'pickaxe' }),
  [B.SNOW_BLOCK]: D({ name: 'Snow Block', top: 'snow', side: 'snow', breakTime: 0.4, tool: 'shovel' }),
  [B.MOSS_BLOCK]: D({ name: 'Moss Block', top: 'moss_block', side: 'moss_block', breakTime: 0.4, tool: 'axe' }),
  [B.WOOL_WHITE]: D({ name: 'White Wool', top: 'wool_white', side: 'wool_white', breakTime: 0.6 }),
  [B.WOOL_BLACK]: D({ name: 'Black Wool', top: 'wool_black', side: 'wool_black', breakTime: 0.6 }),
  [B.STONE_BRICKS]: D({ name: 'Stone Bricks', top: 'stone_bricks', side: 'stone_bricks', breakTime: 1.8, tool: 'pickaxe' }),
  [B.DIAMOND_BLOCK]: D({ name: 'Diamond Block', top: 'diamond_block', side: 'diamond_block', breakTime: 3.5, tool: 'pickaxe' }),
  [B.GOLD_BLOCK]: D({ name: 'Gold Block', top: 'gold_block', side: 'gold_block', breakTime: 3, tool: 'pickaxe' }),
  [B.IRON_BLOCK]: D({ name: 'Iron Block', top: 'iron_block', side: 'iron_block', breakTime: 3.2, tool: 'pickaxe' }),
  [B.LAVA]: D({ name: 'Lava', top: 'lava', side: 'lava', solid: false, opaque: false, liquid: true, transparent: true, light: 15, lightColor: [1.0, 0.55, 0.15], breakTime: 0, drop: null }),
  [B.BED]: D({ name: 'Bed', top: 'bed_top', side: 'bed_side', bottom: 'planks', slab: 'bottom', breakTime: 0.4 }),
  [B.FLOWER_PINK]: D({ name: 'Pink Petals', top: 'flower_pink', side: 'flower_pink', solid: false, opaque: false, cross: true, breakTime: 0.05 }),
  [B.DEAD_BUSH]: D({ name: 'Dead Bush', top: 'dead_bush', side: 'dead_bush', solid: false, opaque: false, cross: true, breakTime: 0.05, drop: null }),
};

const NEW_BLOCK_DEFS: Record<number, BlockDef> = {
  [B.STAIRS_PLANKS_N]: D({ name: 'Oak Stairs', solid: true, opaque: false, tiles: { all: 'planks', bottom: 'planks' }, shape: 'stairs_N', drop: B.PLANKS }),
  [B.STAIRS_PLANKS_E]: D({ name: 'Oak Stairs', solid: true, opaque: false, tiles: { all: 'planks', bottom: 'planks' }, shape: 'stairs_E', drop: B.PLANKS }),
  [B.STAIRS_PLANKS_S]: D({ name: 'Oak Stairs', solid: true, opaque: false, tiles: { all: 'planks', bottom: 'planks' }, shape: 'stairs_S', drop: B.PLANKS }),
  [B.STAIRS_PLANKS_W]: D({ name: 'Oak Stairs', solid: true, opaque: false, tiles: { all: 'planks', bottom: 'planks' }, shape: 'stairs_W', drop: B.PLANKS }),
  [B.STAIRS_COBBLE_N]: D({ name: 'Cobble Stairs', solid: true, opaque: false, tiles: { all: 'cobblestone', bottom: 'cobblestone' }, shape: 'stairs_N', drop: B.COBBLE }),
  [B.STAIRS_COBBLE_E]: D({ name: 'Cobble Stairs', solid: true, opaque: false, tiles: { all: 'cobblestone', bottom: 'cobblestone' }, shape: 'stairs_E', drop: B.COBBLE }),
  [B.STAIRS_COBBLE_S]: D({ name: 'Cobble Stairs', solid: true, opaque: false, tiles: { all: 'cobblestone', bottom: 'cobblestone' }, shape: 'stairs_S', drop: B.COBBLE }),
  [B.STAIRS_COBBLE_W]: D({ name: 'Cobble Stairs', solid: true, opaque: false, tiles: { all: 'cobblestone', bottom: 'cobblestone' }, shape: 'stairs_W', drop: B.COBBLE }),
  [B.STAIRS_BRICK_N]: D({ name: 'Brick Stairs', solid: true, opaque: false, tiles: { all: 'brick', bottom: 'brick' }, shape: 'stairs_N', drop: B.BRICK }),
  [B.STAIRS_BRICK_E]: D({ name: 'Brick Stairs', solid: true, opaque: false, tiles: { all: 'brick', bottom: 'brick' }, shape: 'stairs_E', drop: B.BRICK }),
  [B.STAIRS_BRICK_S]: D({ name: 'Brick Stairs', solid: true, opaque: false, tiles: { all: 'brick', bottom: 'brick' }, shape: 'stairs_S', drop: B.BRICK }),
  [B.STAIRS_BRICK_W]: D({ name: 'Brick Stairs', solid: true, opaque: false, tiles: { all: 'brick', bottom: 'brick' }, shape: 'stairs_W', drop: B.BRICK }),
  [B.STAIRS_SANDSTONE_N]: D({ name: 'Sandstone Stairs', solid: true, opaque: false, tiles: { all: 'sandstone', top: 'sandstone_top', bottom: 'sandstone' }, shape: 'stairs_N', drop: B.SANDSTONE }),
  [B.STAIRS_SANDSTONE_E]: D({ name: 'Sandstone Stairs', solid: true, opaque: false, tiles: { all: 'sandstone', top: 'sandstone_top', bottom: 'sandstone' }, shape: 'stairs_E', drop: B.SANDSTONE }),
  [B.STAIRS_SANDSTONE_S]: D({ name: 'Sandstone Stairs', solid: true, opaque: false, tiles: { all: 'sandstone', top: 'sandstone_top', bottom: 'sandstone' }, shape: 'stairs_S', drop: B.SANDSTONE }),
  [B.STAIRS_SANDSTONE_W]: D({ name: 'Sandstone Stairs', solid: true, opaque: false, tiles: { all: 'sandstone', top: 'sandstone_top', bottom: 'sandstone' }, shape: 'stairs_W', drop: B.SANDSTONE }),
  [B.FENCE]: D({ name: 'Oak Fence', solid: true, opaque: false, transparent: true, tiles: { all: 'planks' }, shape: 'fence', drop: B.PLANKS }),
  [B.DOOR_L_N]: D({ name: 'Oak Door', solid: true, opaque: false, transparent: true, tiles: { all: 'planks' }, shape: 'door_N', drop: B.PLANKS }),
  [B.DOOR_L_E]: D({ name: 'Oak Door', solid: true, opaque: false, transparent: true, tiles: { all: 'planks' }, shape: 'door_E', drop: B.PLANKS }),
  [B.DOOR_L_S]: D({ name: 'Oak Door', solid: true, opaque: false, transparent: true, tiles: { all: 'planks' }, shape: 'door_S', drop: B.PLANKS }),
  [B.DOOR_L_W]: D({ name: 'Oak Door', solid: true, opaque: false, transparent: true, tiles: { all: 'planks' }, shape: 'door_W', drop: B.PLANKS }),
  [B.DOOR_U]: D({ name: 'Oak Door', solid: true, opaque: false, transparent: true, tiles: { all: 'planks' }, shape: 'door_U', drop: B.PLANKS }),
  [B.DOOR_OPEN_L_N]: D({ name: 'Oak Door', solid: true, opaque: false, transparent: true, tiles: { all: 'planks' }, shape: 'door_open_N', drop: B.PLANKS }),
  [B.DOOR_OPEN_L_E]: D({ name: 'Oak Door', solid: true, opaque: false, transparent: true, tiles: { all: 'planks' }, shape: 'door_open_E', drop: B.PLANKS }),
  [B.DOOR_OPEN_L_S]: D({ name: 'Oak Door', solid: true, opaque: false, transparent: true, tiles: { all: 'planks' }, shape: 'door_open_S', drop: B.PLANKS }),
  [B.DOOR_OPEN_L_W]: D({ name: 'Oak Door', solid: true, opaque: false, transparent: true, tiles: { all: 'planks' }, shape: 'door_open_W', drop: B.PLANKS }),
  [B.DOOR_OPEN_U]: D({ name: 'Oak Door', solid: true, opaque: false, transparent: true, tiles: { all: 'planks' }, shape: 'door_open_U', drop: B.PLANKS }),
  [B.TRAPDOOR]: D({ name: 'Trapdoor', solid: true, opaque: false, transparent: true, tiles: { all: 'trapdoor' }, shape: 'trapdoor', drop: B.PLANKS }),
  [B.TRAPDOOR_OPEN]: D({ name: 'Trapdoor', solid: true, opaque: false, transparent: true, tiles: { all: 'trapdoor' }, shape: 'trapdoor_open', drop: B.PLANKS }),
  [B.CHEST]: D({ name: 'Chest', solid: true, opaque: false, transparent: true, tiles: { all: 'chest_side', top: 'chest_top', bottom: 'chest_top', front: 'chest_front', xm: 'chest_front' }, shape: 'chest', drop: B.CHEST }),
  [B.FURNACE]: D({ name: 'Furnace', solid: true, opaque: true, tiles: { all: 'furnace_side', top: 'furnace_top', bottom: 'furnace_top', front: 'furnace_front', xm: 'furnace_front' }, drop: B.FURNACE }),
  [B.FURNACE_LIT]: D({ name: 'Furnace', solid: true, opaque: true, tiles: { all: 'furnace_side', top: 'furnace_top', bottom: 'furnace_top', front: 'furnace_front_lit', xm: 'furnace_front_lit' }, drop: B.FURNACE }),
  [B.LADDER_N]: D({ name: 'Ladder', solid: false, opaque: false, transparent: true, tiles: { all: 'ladder' }, shape: 'ladder_N', drop: B.LADDER_N }),
  [B.LADDER_E]: D({ name: 'Ladder', solid: false, opaque: false, transparent: true, tiles: { all: 'ladder' }, shape: 'ladder_E', drop: B.LADDER_E }),
  [B.LADDER_S]: D({ name: 'Ladder', solid: false, opaque: false, transparent: true, tiles: { all: 'ladder' }, shape: 'ladder_S', drop: B.LADDER_S }),
  [B.LADDER_W]: D({ name: 'Ladder', solid: false, opaque: false, transparent: true, tiles: { all: 'ladder' }, shape: 'ladder_W', drop: B.LADDER_W }),
  [B.FARMLAND]: D({ name: 'Farmland', solid: true, opaque: true, tiles: { all: 'dirt', top: 'farmland' }, drop: B.DIRT }),
  [B.WHEAT_YOUNG]: D({ name: 'Wheat', solid: false, opaque: false, transparent: true, tiles: { all: 'wheat' }, shape: 'crop', drop: IT.WHEAT_SEEDS }),
  [B.WHEAT_MATURE]: D({ name: 'Wheat', solid: false, opaque: false, transparent: true, tiles: { all: 'wheat' }, shape: 'crop', drop: IT.WHEAT }),
};
Object.assign(BLOCKS, NEW_BLOCK_DEFS);
const NEW2: Record<number, BlockDef> = {
  [B.CONCRETE_WHITE]: D({ name: 'White Concrete', top: 'concrete_white', side: 'concrete_white', breakTime: 1.2, tool: 'pickaxe' }),
  [B.CONCRETE_RED]: D({ name: 'Red Concrete', top: 'concrete_red', side: 'concrete_red', breakTime: 1.2, tool: 'pickaxe' }),
  [B.CONCRETE_BLUE]: D({ name: 'Blue Concrete', top: 'concrete_blue', side: 'concrete_blue', breakTime: 1.2, tool: 'pickaxe' }),
  [B.CONCRETE_BLACK]: D({ name: 'Black Concrete', top: 'concrete_black', side: 'concrete_black', breakTime: 1.2, tool: 'pickaxe' }),
  [B.CONCRETE_GREEN]: D({ name: 'Green Concrete', top: 'concrete_green', side: 'concrete_green', breakTime: 1.2, tool: 'pickaxe' }),
  [B.CONCRETE_YELLOW]: D({ name: 'Yellow Concrete', top: 'concrete_yellow', side: 'concrete_yellow', breakTime: 1.2, tool: 'pickaxe' }),
  [B.TERRACOTTA]: D({ name: 'Terracotta', top: 'terracotta', side: 'terracotta', breakTime: 1.4, tool: 'pickaxe' }),
  [B.TERRACOTTA_RED]: D({ name: 'Red Terracotta', top: 'terracotta_red', side: 'terracotta_red', breakTime: 1.4, tool: 'pickaxe' }),
  [B.TERRACOTTA_BLUE]: D({ name: 'Blue Terracotta', top: 'terracotta_blue', side: 'terracotta_blue', breakTime: 1.4, tool: 'pickaxe' }),
  [B.COPPER_BLOCK]: D({ name: 'Copper Block', top: 'copper', side: 'copper', breakTime: 1.8, tool: 'pickaxe' }),
  [B.CUT_COPPER]: D({ name: 'Cut Copper', top: 'cut_copper', side: 'cut_copper', breakTime: 1.8, tool: 'pickaxe' }),
  [B.EXPOSED_COPPER]: D({ name: 'Exposed Copper', top: 'exposed_copper', side: 'exposed_copper', breakTime: 1.8, tool: 'pickaxe' }),
  [B.WEATHERED_COPPER]: D({ name: 'Weathered Copper', top: 'weathered_copper', side: 'weathered_copper', breakTime: 1.8, tool: 'pickaxe' }),
  [B.OXIDIZED_COPPER]: D({ name: 'Oxidized Copper', top: 'oxidized_copper', side: 'oxidized_copper', breakTime: 1.8, tool: 'pickaxe' }),
  [B.DEEPSLATE]: D({ name: 'Deepslate', top: 'deepslate', side: 'deepslate', breakTime: 2.2, tool: 'pickaxe' }),
  [B.COBBLED_DEEPSLATE]: D({ name: 'Cobbled Deepslate', top: 'cobbled_deepslate', side: 'cobbled_deepslate', breakTime: 2.2, tool: 'pickaxe' }),
  [B.DEEPSLATE_BRICKS]: D({ name: 'Deepslate Bricks', top: 'deepslate_bricks', side: 'deepslate_bricks', breakTime: 2.4, tool: 'pickaxe' }),
  [B.DEEPSLATE_TILES]: D({ name: 'Deepslate Tiles', top: 'deepslate_tiles', side: 'deepslate_tiles', breakTime: 2.4, tool: 'pickaxe' }),
  [B.TINTED_GLASS]: D({ name: 'Tinted Glass', top: 'tinted_glass', side: 'tinted_glass', opaque: false, transparent: true, breakTime: 0.3, drop: null }),
  [B.ENCHANTING_TABLE]: D({ name: 'Enchanting Table', top: 'enchant_top', side: 'enchant_side', bottom: 'obsidian', breakTime: 2.5, tool: 'pickaxe' }),
};
Object.assign(BLOCKS, NEW2);

export const ITEMS: Record<number, ItemDef> = {
  [IT.STICK]: { name: 'Stick', fuel: true },
  [IT.COAL]: { name: 'Coal', fuel: true },
  [IT.IRON_CHUNK]: { name: 'Iron Chunk' },
  [IT.GOLD_CHUNK]: { name: 'Gold Chunk' },
  [IT.DIAMOND]: { name: 'Diamond' },
  [IT.APPLE]: { name: 'Apple', food: 4 },
  [IT.PORKCHOP]: { name: 'Porkchop', food: 7 },
  [IT.BEEF]: { name: 'Steak', food: 8 },
  [IT.GUNPOWDER]: { name: 'Gunpowder' },
};
const TIERS: [string, number, number, number][] = [
  ['Wooden', 1, 2.2, 4], ['Stone', 2, 4, 5], ['Iron', 3, 6, 6], ['Diamond', 4, 9, 7],
];
const TOOL_TYPES: [ToolType, string][] = [['pickaxe', 'Pickaxe'], ['axe', 'Axe'], ['shovel', 'Shovel'], ['sword', 'Sword']];
let tid = 0;
for (const [type, tname] of TOOL_TYPES) {
  for (const [mat, tier, speed, dmg] of TIERS) {
    const id = 110 + tid++;
    ITEMS[id] = { name: `${mat} ${tname}`, tool: { type, tier, speed: type === 'sword' ? 1.2 : speed, damage: type === 'sword' ? dmg : 2 } };
  }
}

export function defOf(id: number): BlockDef | ItemDef | null {
  return (BLOCKS[id] as BlockDef | undefined) ?? (ITEMS[id] as ItemDef | undefined) ?? null;
}
export function itemName(id: number): string {
  const d = defOf(id);
  return d ? d.name : '???';
}
export function blockDef(id: number): BlockDef | null { return (BLOCKS[id] as BlockDef | undefined) ?? null; }
export function itemDef(id: number): ItemDef | null { return (ITEMS[id] as ItemDef | undefined) ?? null; }
export function isOpaque(id: number): boolean { const d = BLOCKS[id]; return !!d && d.opaque; }
export function isSolid(id: number): boolean {
  if (id === B.DOOR_OPEN_L_N || id === B.DOOR_OPEN_L_E || id === B.DOOR_OPEN_L_S || id === B.DOOR_OPEN_L_W || id === B.DOOR_OPEN_U) return false;
  const d = BLOCKS[id]; return !!d && d.solid;
}
export function isClimbable(id: number): boolean {
  return id === B.LADDER_N || id === B.LADDER_E || id === B.LADDER_S || id === B.LADDER_W;
}
export function isDoorOpen(id: number): boolean {
  return id === B.DOOR_OPEN_L_N || id === B.DOOR_OPEN_L_E || id === B.DOOR_OPEN_L_S || id === B.DOOR_OPEN_L_W || id === B.DOOR_OPEN_U;
}
export function isLiquid(id: number): boolean { const d = BLOCKS[id]; return !!d && !!d.liquid; }
export function isItem(id: number): boolean { return !!(ITEMS[id] as ItemDef | undefined); }

const NEW_ITEM_DEFS: Record<number, ItemDef> = {
  [IT.FLINT]: { name: 'Flint' },
  [IT.FEATHER]: { name: 'Feather' },
  [IT.BUCKET]: { name: 'Bucket' },
  [IT.WATER_BUCKET]: { name: 'Water Bucket' },
  [IT.LAVA_BUCKET]: { name: 'Lava Bucket' },
  [IT.BOW]: { name: 'Bow', projectile: true },
  [IT.ARROW]: { name: 'Arrow', projectile: true },
  [IT.WHEAT_SEEDS]: { name: 'Wheat Seeds' },
  [IT.WHEAT]: { name: 'Wheat' },
  [IT.BREAD]: { name: 'Bread', food: 5 },
  [IT.WOOD_HOE]: { name: 'Wooden Hoe', tool: { type: 'hoe', tier: 0, speed: 2, damage: 1 } },
  [IT.STONE_HOE]: { name: 'Stone Hoe', tool: { type: 'hoe', tier: 1, speed: 4, damage: 1 } },
  [IT.IRON_HOE]: { name: 'Iron Hoe', tool: { type: 'hoe', tier: 2, speed: 6, damage: 1 } },
  [IT.DIAMOND_HOE]: { name: 'Diamond Hoe', tool: { type: 'hoe', tier: 3, speed: 8, damage: 1 } },
  [IT.IRON_HELMET]: { name: 'Iron Helmet', armor: { slot: 0, defense: 2 } },
  [IT.IRON_CHESTPLATE]: { name: 'Iron Chestplate', armor: { slot: 1, defense: 5 } },
  [IT.IRON_LEGGINGS]: { name: 'Iron Leggings', armor: { slot: 2, defense: 4 } },
  [IT.IRON_BOOTS]: { name: 'Iron Boots', armor: { slot: 3, defense: 2 } },
  [IT.DIA_HELMET]: { name: 'Diamond Helmet', armor: { slot: 0, defense: 3 } },
  [IT.DIA_CHESTPLATE]: { name: 'Diamond Chestplate', armor: { slot: 1, defense: 8 } },
  [IT.DIA_LEGGINGS]: { name: 'Diamond Leggings', armor: { slot: 2, defense: 6 } },
  [IT.DIA_BOOTS]: { name: 'Diamond Boots', armor: { slot: 3, defense: 3 } },
  [IT.EMERALD]: { name: 'Emerald' },
  [IT.COOKED_PORKCHOP]: { name: 'Cooked Porkchop', food: 8 },
  [IT.COOKED_STEAK]: { name: 'Cooked Steak', food: 8 },
  [IT.SHIELD]: { name: 'Shield', shield: true },
  [IT.XP_BOTTLE]: { name: 'Bottle o’ Enchanting' },
  [IT.ENCHANTED_BOOK]: { name: 'Enchanted Book' },
};
Object.assign(ITEMS, NEW_ITEM_DEFS);

export const HOTBAR_DEFAULT = [
  B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.LEAVES, B.GLASS, B.TORCH,
];

export const CREATIVE_BLOCKS: number[] = [
  B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.MOSS, B.SAND, B.SANDSTONE, B.GRAVEL,
  B.LOG, B.PLANKS, B.LEAVES, B.BIRCH_LOG, B.BIRCH_LEAVES, B.SPRUCE_LOG, B.SPRUCE_LEAVES,
  B.CHERRY_LOG, B.CHERRY_LEAVES, B.MOSS_BLOCK,
  B.GLASS, B.BRICK, B.STONE_BRICKS, B.SNOW_BLOCK, B.SNOW, B.ICE, B.CACTUS, B.DEAD_BUSH,
  B.WOOL_WHITE, B.WOOL_RED, B.WOOL_YELLOW, B.WOOL_GREEN, B.WOOL_BLUE, B.WOOL_BLACK,
  B.CRAFTING, B.BOOKSHELF, B.GLOWSTONE, B.LANTERN, B.OBSIDIAN, B.TNT, B.BED,
  B.TORCH, B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_PINK, B.TALLGRASS,
  B.SLAB, B.VSLAB_X0, B.DIAMOND_BLOCK, B.GOLD_BLOCK, B.IRON_BLOCK, B.AMETHYST,
  B.WATER, B.LAVA, B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.BEDROCK,
  B.STAIRS_PLANKS_N, B.STAIRS_COBBLE_N, B.STAIRS_BRICK_N, B.STAIRS_SANDSTONE_N,
  B.FENCE, B.DOOR_L_N, B.TRAPDOOR, B.CHEST, B.FURNACE, B.LADDER_N, B.FARMLAND, B.WHEAT_MATURE,
  B.CONCRETE_WHITE, B.CONCRETE_RED, B.CONCRETE_BLUE, B.CONCRETE_BLACK, B.TERRACOTTA, B.TERRACOTTA_RED,
  B.COPPER_BLOCK, B.CUT_COPPER, B.EXPOSED_COPPER, B.WEATHERED_COPPER, B.OXIDIZED_COPPER,
  B.DEEPSLATE, B.COBBLED_DEEPSLATE, B.DEEPSLATE_BRICKS, B.DEEPSLATE_TILES, B.TINTED_GLASS, B.ENCHANTING_TABLE,
];

export const CREATIVE_ITEMS: number[] = [
  IT.APPLE, IT.PORKCHOP, IT.BEEF, IT.COOKED_PORKCHOP, IT.COOKED_STEAK, IT.BREAD, IT.WHEAT, IT.WHEAT_SEEDS, IT.FLINT, IT.FEATHER, IT.EMERALD,
  IT.WOOD_PICKAXE, IT.STONE_PICKAXE, IT.IRON_PICKAXE, IT.DIAMOND_PICKAXE,
  IT.WOOD_AXE, IT.STONE_AXE, IT.IRON_AXE, IT.DIAMOND_AXE,
  IT.WOOD_SHOVEL, IT.STONE_SHOVEL, IT.IRON_SHOVEL, IT.DIAMOND_SHOVEL,
  IT.WOOD_SWORD, IT.STONE_SWORD, IT.IRON_SWORD, IT.DIAMOND_SWORD,
  IT.WOOD_HOE, IT.STONE_HOE, IT.IRON_HOE, IT.DIAMOND_HOE,
  IT.IRON_HELMET, IT.IRON_CHESTPLATE, IT.IRON_LEGGINGS, IT.IRON_BOOTS,
  IT.DIA_HELMET, IT.DIA_CHESTPLATE, IT.DIA_LEGGINGS, IT.DIA_BOOTS,
  IT.BUCKET, IT.WATER_BUCKET, IT.LAVA_BUCKET, IT.BOW, IT.ARROW, IT.SHIELD, IT.XP_BOTTLE, IT.ENCHANTED_BOOK,
];
