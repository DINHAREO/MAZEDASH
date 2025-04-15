import { World, BlockType } from 'hytopia';

// Fixed seed for consistent block selection
let blockSeed = 54321; // Different seed than maze generator for variety

/**
 * Simple seeded random number generator for consistent block selection
 * @returns A number between 0 and 1 (like Math.random)
 */
function seedRandomBlock(): number {
  const x = Math.sin(blockSeed++) * 10000;
  return x - Math.floor(x);
}

// Block type IDs (must be between 100 and 255)
export const MAZE_FLOOR_BLOCK_ID = 101;

// Wall block type IDs - one for each texture
export const MAZE_WALL_DRAGONS_STONE_ID = 100;
export const MAZE_WALL_GHOST_DIRT_ID = 102;
export const MAZE_WALL_VOID_SAND_ID = 103;
export const MAZE_WALL_INFECTED_SHADOWROCK_ID = 104;

// Array of all wall block IDs for easy random selection
export const MAZE_WALL_BLOCK_IDS = [
  MAZE_WALL_DRAGONS_STONE_ID,
  MAZE_WALL_GHOST_DIRT_ID,
  MAZE_WALL_VOID_SAND_ID,
  MAZE_WALL_INFECTED_SHADOWROCK_ID
];

/**
 * Returns a deterministic wall block ID from the available wall blocks
 * using a seeded random function for consistency
 * @returns A consistently selected wall block ID based on seed
 */
export function getRandomWallBlockId(): number {
  // Reset seed every 1000 calls to create some patterns in the walls
  if (blockSeed % 1000 === 0) {
    blockSeed = 54321;
  }
  const randomIndex = Math.floor(seedRandomBlock() * MAZE_WALL_BLOCK_IDS.length);
  // Ensure we never return an undefined value by clamping the index
  return MAZE_WALL_BLOCK_IDS[randomIndex % MAZE_WALL_BLOCK_IDS.length] || MAZE_WALL_DRAGONS_STONE_ID;
}

/**
 * Registers all block types needed for the maze
 * @param world The Hytopia world instance
 */
export function registerMazeBlocks(world: World) {
  console.log("Registering maze block types...");
  
  // Register the wall block types with different textures
  world.blockTypeRegistry.registerGenericBlockType({
    id: MAZE_WALL_DRAGONS_STONE_ID,
    textureUri: 'blocks/dragons-stone.png',
    name: 'Dragon Stone Wall',
  });
  
  world.blockTypeRegistry.registerGenericBlockType({
    id: MAZE_WALL_GHOST_DIRT_ID,
    textureUri: 'blocks/ghost-dirt.png',
    name: 'Ghost Dirt Wall',
  });
  
  world.blockTypeRegistry.registerGenericBlockType({
    id: MAZE_WALL_VOID_SAND_ID,
    textureUri: 'blocks/void-sand.png',
    name: 'Void Sand Wall',
  });
  
  world.blockTypeRegistry.registerGenericBlockType({
    id: MAZE_WALL_INFECTED_SHADOWROCK_ID,
    textureUri: 'blocks/infected-shadowrock.png',
    name: 'Infected Shadowrock Wall',
  });
  
  // Register the floor block type
  world.blockTypeRegistry.registerGenericBlockType({
    id: MAZE_FLOOR_BLOCK_ID,
    textureUri: 'blocks/grass', // Using grass texture for the floor
    name: 'Maze Floor',
  });
  
  console.log("Block types registered successfully!");
} 