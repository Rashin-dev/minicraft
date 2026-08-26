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
} as const;

// Non-block items start at 100
export const IT = {
  STICK: 100, COAL: 101, IRON_CHUNK: 102, GOLD_CHUNK: 103, DIAMOND: 104,
  APPLE: 105, PORKCHOP: 106, BEEF: 107, GUNPOWDER: 108,
  WOOD_PICKAXE: 110, STONE_PICKAXE: 111, IRON_PICKAXE: 112, DIAMOND_PICKAXE: 113,
  WOOD_AXE: 114, STONE_AXE: 115, IRON_AXE: 116, DIAMOND_AXE: 117,
  WOOD_SHOVEL: 118, STONE_SHOVEL: 119, IRON_SHOVEL: 120, DIAMOND_SHOVEL: 121,
  WOOD_SWORD: 122, STONE_SWORD: 123, IRON_SWORD: 124, DIAMOND_SWORD: 125,
} as const;

export type ToolType = 'pickaxe' | 'axe' | 'shovel' | 'sword';

export interface BlockDef {
  name: string;
  top: string; side: string; bottom?: string;
  solid: boolean;
  opaque: boolean;
  liquid?: boolean;
  cross?: boolean;
  torchLike?: boolean;
  light?: number;
  lightColor?: [number, number, number];
  slab?: 'bottom' | 'x0' | 'x1' | 'z0' | 'z1';
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
  fuel?: boolean;
}

const D = (def: Partial<BlockDef> & Pick<BlockDef, 'name' | 'top' | 'side'>): BlockDef => ({
  solid: true, opaque: true, breakTime: 0.6, ...def,
});

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
  if (id < 100) return BLOCKS[id] ?? null;
  return ITEMS[id] ?? null;
}
export function itemName(id: number): string {
  const d = defOf(id);
  return d ? d.name : '???';
}
export function blockDef(id: number): BlockDef | null { return id < 100 ? (BLOCKS[id] ?? null) : null; }
export function itemDef(id: number): ItemDef | null { return id >= 100 ? (ITEMS[id] ?? null) : null; }
export function isOpaque(id: number): boolean { const d = BLOCKS[id]; return !!d && d.opaque; }
export function isSolid(id: number): boolean { const d = BLOCKS[id]; return !!d && d.solid; }
export function isLiquid(id: number): boolean { const d = BLOCKS[id]; return !!d && !!d.liquid; }
export function isItem(id: number): boolean { return id >= 100; }

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
];

export const CREATIVE_ITEMS: number[] = [
  IT.APPLE, IT.PORKCHOP, IT.BEEF,
  IT.WOOD_PICKAXE, IT.STONE_PICKAXE, IT.IRON_PICKAXE, IT.DIAMOND_PICKAXE,
  IT.WOOD_AXE, IT.STONE_AXE, IT.IRON_AXE, IT.DIAMOND_AXE,
  IT.WOOD_SHOVEL, IT.STONE_SHOVEL, IT.IRON_SHOVEL, IT.DIAMOND_SHOVEL,
  IT.WOOD_SWORD, IT.STONE_SWORD, IT.IRON_SWORD, IT.DIAMOND_SWORD,
];
