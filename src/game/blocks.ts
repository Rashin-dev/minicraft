// Block registry
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, GRAVEL: 6,
  LOG: 7, LEAVES: 8, PLANKS: 9, GLASS: 10, BRICK: 11, WATER: 12,
  BEDROCK: 13, COAL_ORE: 14, IRON_ORE: 15, GOLD_ORE: 16, DIAMOND_ORE: 17,
  TORCH: 18, FLOWER_RED: 19, FLOWER_YELLOW: 20, TALLGRASS: 21, CACTUS: 22,
  SNOW: 23, TNT: 24,
  WOOL_RED: 25, WOOL_BLUE: 26, WOOL_YELLOW: 27, WOOL_GREEN: 28,
  CRAFTING: 29, GLOWSTONE: 30, OBSIDIAN: 31, BOOKSHELF: 32, ICE: 33, MOSS: 34,
  SLAB: 35,           // bottom-half slab
  VSLAB_X0: 36, VSLAB_X1: 37, VSLAB_Z0: 38, VSLAB_Z1: 39, // vertical slabs (the half they occupy)
} as const;

export interface BlockDef {
  name: string;
  top: string; side: string; bottom?: string;
  solid: boolean;        // has collision
  opaque: boolean;       // fully occludes neighbor faces
  liquid?: boolean;
  cross?: boolean;       // crossed-quad plant rendering
  torchLike?: boolean;   // small box rendering
  light?: number;        // emitted light 0-15
  lightColor?: [number, number, number];
  slab?: 'bottom' | 'x0' | 'x1' | 'z0' | 'z1';
  transparent?: boolean; // sees through partially (glass/leaves/water)
  breakTime?: number;    // seconds to break (0 = instant)
  iconTile?: string;
}

const D = (def: Partial<BlockDef> & Pick<BlockDef, 'name' | 'top' | 'side'>): BlockDef => ({
  solid: true, opaque: true, breakTime: 0.6, ...def,
});

export const BLOCKS: Record<number, BlockDef> = {
  [B.GRASS]: D({ name: 'Grass Block', top: 'grass_top', side: 'grass_side', bottom: 'dirt' }),
  [B.DIRT]: D({ name: 'Dirt', top: 'dirt', side: 'dirt', breakTime: 0.4 }),
  [B.STONE]: D({ name: 'Stone', top: 'stone', side: 'stone', breakTime: 1.2 }),
  [B.COBBLE]: D({ name: 'Cobblestone', top: 'cobble', side: 'cobble', breakTime: 1.2 }),
  [B.SAND]: D({ name: 'Sand', top: 'sand', side: 'sand', breakTime: 0.4 }),
  [B.GRAVEL]: D({ name: 'Gravel', top: 'gravel', side: 'gravel', breakTime: 0.4 }),
  [B.LOG]: D({ name: 'Oak Log', top: 'log_top', side: 'log_side', bottom: 'log_top', breakTime: 0.9 }),
  [B.LEAVES]: D({ name: 'Leaves', top: 'leaves', side: 'leaves', opaque: false, transparent: true, breakTime: 0.2 }),
  [B.PLANKS]: D({ name: 'Oak Planks', top: 'planks', side: 'planks', breakTime: 0.9 }),
  [B.GLASS]: D({ name: 'Glass', top: 'glass', side: 'glass', opaque: false, transparent: true, breakTime: 0.3 }),
  [B.BRICK]: D({ name: 'Bricks', top: 'brick', side: 'brick', breakTime: 1.2 }),
  [B.WATER]: D({ name: 'Water', top: 'water', side: 'water', solid: false, opaque: false, liquid: true, transparent: true, breakTime: 0 }),
  [B.BEDROCK]: D({ name: 'Bedrock', top: 'bedrock', side: 'bedrock', breakTime: Infinity }),
  [B.COAL_ORE]: D({ name: 'Coal Ore', top: 'coal_ore', side: 'coal_ore', breakTime: 1.4 }),
  [B.IRON_ORE]: D({ name: 'Iron Ore', top: 'iron_ore', side: 'iron_ore', breakTime: 1.4 }),
  [B.GOLD_ORE]: D({ name: 'Gold Ore', top: 'gold_ore', side: 'gold_ore', breakTime: 1.4 }),
  [B.DIAMOND_ORE]: D({ name: 'Diamond Ore', top: 'diamond_ore', side: 'diamond_ore', breakTime: 1.6 }),
  [B.TORCH]: D({ name: 'Torch', top: 'torch', side: 'torch', solid: false, opaque: false, torchLike: true, light: 14, lightColor: [1, 0.75, 0.4], breakTime: 0.05 }),
  [B.FLOWER_RED]: D({ name: 'Poppy', top: 'flower_red', side: 'flower_red', solid: false, opaque: false, cross: true, breakTime: 0.05 }),
  [B.FLOWER_YELLOW]: D({ name: 'Dandelion', top: 'flower_yellow', side: 'flower_yellow', solid: false, opaque: false, cross: true, breakTime: 0.05 }),
  [B.TALLGRASS]: D({ name: 'Tall Grass', top: 'grass_plant', side: 'grass_plant', solid: false, opaque: false, cross: true, breakTime: 0.05 }),
  [B.CACTUS]: D({ name: 'Cactus', top: 'cactus', side: 'cactus', breakTime: 0.5 }),
  [B.SNOW]: D({ name: 'Snowy Grass', top: 'snow', side: 'snow_side', bottom: 'dirt' }),
  [B.TNT]: D({ name: 'TNT', top: 'tnt_top', side: 'tnt', bottom: 'tnt_top', breakTime: 0.1 }),
  [B.WOOL_RED]: D({ name: 'Red Wool', top: 'wool_red', side: 'wool_red', breakTime: 0.5 }),
  [B.WOOL_BLUE]: D({ name: 'Blue Wool', top: 'wool_blue', side: 'wool_blue', breakTime: 0.5 }),
  [B.WOOL_YELLOW]: D({ name: 'Yellow Wool', top: 'wool_yellow', side: 'wool_yellow', breakTime: 0.5 }),
  [B.WOOL_GREEN]: D({ name: 'Green Wool', top: 'wool_green', side: 'wool_green', breakTime: 0.5 }),
  [B.CRAFTING]: D({ name: 'Crafting Table', top: 'crafting', side: 'crafting', breakTime: 0.8 }),
  [B.GLOWSTONE]: D({ name: 'Glowstone', top: 'glowstone', side: 'glowstone', light: 15, lightColor: [1, 0.85, 0.55], breakTime: 0.5 }),
  [B.OBSIDIAN]: D({ name: 'Obsidian', top: 'obsidian', side: 'obsidian', breakTime: 3 }),
  [B.BOOKSHELF]: D({ name: 'Bookshelf', top: 'planks', side: 'bookshelf', bottom: 'planks', breakTime: 0.8 }),
  [B.ICE]: D({ name: 'Ice', top: 'ice', side: 'ice', opaque: false, transparent: true, breakTime: 0.5 }),
  [B.MOSS]: D({ name: 'Mossy Cobble', top: 'moss_stone', side: 'moss_stone', breakTime: 1.2 }),
  [B.SLAB]: D({ name: 'Oak Slab', top: 'planks', side: 'planks', slab: 'bottom', breakTime: 0.9 }),
  [B.VSLAB_X0]: D({ name: 'Vertical Slab', top: 'planks', side: 'planks', slab: 'x0', breakTime: 0.9, opaque: false }),
  [B.VSLAB_X1]: D({ name: 'Vertical Slab', top: 'planks', side: 'planks', slab: 'x1', breakTime: 0.9, opaque: false }),
  [B.VSLAB_Z0]: D({ name: 'Vertical Slab', top: 'planks', side: 'planks', slab: 'z0', breakTime: 0.9, opaque: false }),
  [B.VSLAB_Z1]: D({ name: 'Vertical Slab', top: 'planks', side: 'planks', slab: 'z1', breakTime: 0.9, opaque: false }),
};

export function blockDef(id: number): BlockDef | null { return BLOCKS[id] ?? null; }
export function isOpaque(id: number): boolean { const d = BLOCKS[id]; return !!d && d.opaque; }
export function isSolid(id: number): boolean { const d = BLOCKS[id]; return !!d && d.solid; }
export function isLiquid(id: number): boolean { const d = BLOCKS[id]; return !!d && !!d.liquid; }

export const HOTBAR_DEFAULT = [
  B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.LEAVES, B.GLASS, B.TORCH,
];

export const ALL_PLACEABLE = [
  B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.MOSS, B.SAND, B.GRAVEL, B.LOG, B.PLANKS, B.LEAVES,
  B.GLASS, B.BRICK, B.SNOW, B.CACTUS, B.ICE, B.WOOL_RED, B.WOOL_BLUE, B.WOOL_YELLOW, B.WOOL_GREEN,
  B.CRAFTING, B.BOOKSHELF, B.GLOWSTONE, B.OBSIDIAN, B.TORCH, B.FLOWER_RED, B.FLOWER_YELLOW,
  B.TALLGRASS, B.SLAB, B.VSLAB_X0, B.TNT, B.WATER, B.BEDROCK,
  B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE,
];
