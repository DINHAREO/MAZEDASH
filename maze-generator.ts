import { World } from 'hytopia';
import { 
  MAZE_FLOOR_BLOCK_ID, 
  getRandomWallBlockId
} from './block-registry';

// Constants for maze dimensions - increased to create a 200x200 block maze
const MAZE_SIZE = 50; // 200x200 blocks in total (each cell is 4x4 blocks)
const PATH_WIDTH = 4;
const WALL_HEIGHT = 7;
const FLOOR_BLOCK_ID = MAZE_FLOOR_BLOCK_ID; // Use our registered floor block type

// Platform dimensions
const PLATFORM_WIDTH = 10;
const PLATFORM_DEPTH = 10;

// Fixed seed for consistent maze generation
const FIXED_SEED = 12345; // You can change this number to get different maze patterns
let currentSeed = FIXED_SEED;

/**
 * Simple seeded random number generator
 * @returns A number between 0 and 1 (like Math.random)
 */
function seedRandom(): number {
  const x = Math.sin(currentSeed++) * 10000;
  return x - Math.floor(x);
}

// Cell object for maze generation
interface Cell {
  x: number;
  y: number;
  visited: boolean;
  walls: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
}

// Direction vectors with explicit typing
interface Direction {
  x: number;
  y: number;
  wall: 'top' | 'right' | 'bottom' | 'left';
  opposite: 'top' | 'right' | 'bottom' | 'left';
}

const DIRECTIONS: Direction[] = [
  { x: 0, y: -1, wall: 'top', opposite: 'bottom' }, // Top
  { x: 1, y: 0, wall: 'right', opposite: 'left' }, // Right
  { x: 0, y: 1, wall: 'bottom', opposite: 'top' }, // Bottom
  { x: -1, y: 0, wall: 'left', opposite: 'right' } // Left
];

// Type for wall directions
type WallDirection = 'top' | 'right' | 'bottom' | 'left';

export class MazeGenerator {
  private grid: Cell[][] = [];
  private entrance: { x: number; y: number } = { x: 0, y: 0 };
  private exit: { x: number; y: number } = { x: 0, y: 0 };
  private entranceWorldPosition: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 }; // Add explicit storage for world position
  
  constructor() {
    // Initialize the grid
    this.initializeGrid();
    // Reset seed for consistent generation
    currentSeed = FIXED_SEED;
  }

  private initializeGrid(): void {
    // Create a grid of cells using a type-safe approach
    this.grid = Array.from({ length: MAZE_SIZE }, (_, y) => 
      Array.from({ length: MAZE_SIZE }, (_, x) => ({
        x,
        y,
        visited: false,
        walls: {
          top: true,
          right: true,
          bottom: true,
          left: true
        }
      }))
    );
  }

  /**
   * Generate a randomized maze with a guaranteed path from entrance to exit
   * Uses a fixed seed for consistent generation
   */
  public generateMaze(): void {
    console.log("Generating seeded maze with seed:", FIXED_SEED);
    
    // Reset seed for consistent generation
    currentSeed = FIXED_SEED;
    
    // Set a fixed entrance in the middle of the top row
    const startX = Math.floor(MAZE_SIZE / 2);
    const startY = 0;
    
    // Set entrance
    this.entrance = { x: startX, y: startY };
    
    // Reset all cells to unvisited state with all walls
    this.initializeGrid();
    
    // Ensure the entrance has no top wall
    if (startY >= 0 && startY < MAZE_SIZE && startX >= 0 && startX < MAZE_SIZE) {
      const cell = this.grid[startY]?.[startX];
      if (cell) {
        cell.walls.top = false;
      }
    }
    
    // Select an exit position in the middle of the bottom row
    const exitX = Math.floor(MAZE_SIZE / 2);
    const exitY = MAZE_SIZE - 1;
    this.exit = { x: exitX, y: exitY };
    
    // Generate the maze using depth-first search algorithm
    this.depthFirstSearch(startX, startY);
    
    // Ensure the exit has no bottom wall
    if (exitY >= 0 && exitY < MAZE_SIZE && exitX >= 0 && exitX < MAZE_SIZE) {
      const cell = this.grid[exitY]?.[exitX];
      if (cell) {
        cell.walls.bottom = false;
      }
    }
    
    // Add some extra paths to make the maze less predictable
    this.addExtraConnections();
    
    console.log("Seeded maze generation complete!");
  }

  /**
   * Generate the maze using seeded depth-first search (DFS) algorithm
   * This guarantees the same maze will be generated each time with our fixed seed
   */
  private depthFirstSearch(startX: number, startY: number): void {
    // Stack to keep track of cells to visit
    const stack: [number, number][] = [];
    
    // Start at the given position
    let x = startX;
    let y = startY;
    
    // Skip if not a valid cell
    if (!this.isValidCell(x, y)) return;
    
    // Mark current cell as visited
    const startCell = this.grid[y]?.[x];
    if (startCell) {
      startCell.visited = true;
    } else {
      return; // Exit if the start cell doesn't exist
    }
    
    // Push the starting cell onto the stack
    stack.push([x, y]);
    
    // While there are cells in the stack
    while (stack.length > 0) {
      // Get the current cell from the top of the stack
      const currentCell = stack[stack.length - 1];
      if (!currentCell) break;
      
      [x, y] = currentCell;
      
      // Find unvisited neighbors
      const neighbors: { x: number; y: number; dirIndex: number }[] = [];
      
      // Check each direction
      for (let dirIndex = 0; dirIndex < DIRECTIONS.length; dirIndex++) {
        const dir = DIRECTIONS[dirIndex];
        if (!dir) continue; // Skip if direction is undefined
        
        const newX = x + dir.x;
        const newY = y + dir.y;
        
        // If the new position is valid and unvisited
        if (this.isValidCell(newX, newY)) {
          const neighborCell = this.grid[newY]?.[newX];
          if (neighborCell && !neighborCell.visited) {
            neighbors.push({ x: newX, y: newY, dirIndex });
          }
        }
      }
      
      // If we have unvisited neighbors
      if (neighbors.length > 0) {
        // Choose a neighbor using our seeded random function
        const neighborIndex = Math.floor(seedRandom() * neighbors.length);
        const neighbor = neighbors[neighborIndex];
        
        if (!neighbor) continue; // Skip if neighbor is undefined
        
        // Get the direction
        const dir = DIRECTIONS[neighbor.dirIndex];
        if (!dir) continue; // Skip if direction is undefined
        
        // Get the current cell and neighbor cell
        const currentCellObj = this.grid[y]?.[x];
        const neighborCellObj = this.grid[neighbor.y]?.[neighbor.x];
        
        // Skip if either cell is undefined
        if (!currentCellObj || !neighborCellObj) continue;
        
        // Remove walls between current cell and chosen neighbor
        // Remove current cell's wall
        currentCellObj.walls[dir.wall] = false;
        
        // Remove neighbor's wall
        neighborCellObj.walls[dir.opposite] = false;
        
        // Mark the neighbor as visited
        neighborCellObj.visited = true;
        
        // Push the neighbor onto the stack
        stack.push([neighbor.x, neighbor.y]);
      } else {
        // Backtrack
        stack.pop();
      }
      
      // Ensure there's a path to the exit
      if (stack.length === 0 && !this.hasPathToExit()) {
        // If we don't have a path to the exit, connect to it
        this.connectToExit();
      }
    }
  }
  
  /**
   * Check if there's a path to the exit
   */
  private hasPathToExit(): boolean {
    if (this.isValidCell(this.exit.x, this.exit.y)) {
      const exitCell = this.grid[this.exit.y]?.[this.exit.x];
      return exitCell ? exitCell.visited : false;
    }
    return false;
  }
  
  /**
   * Connect to the exit if there's no path
   */
  private connectToExit(): void {
    // Find the visited cell closest to the exit
    let closestCell: { x: number; y: number; distance: number } | null = null;
    
    for (let y = 0; y < MAZE_SIZE; y++) {
      for (let x = 0; x < MAZE_SIZE; x++) {
        const cell = this.isValidCell(x, y) ? this.grid[y]?.[x] : null;
        if (cell && cell.visited) {
          // Calculate Manhattan distance to exit
          const distance = Math.abs(x - this.exit.x) + Math.abs(y - this.exit.y);
          
          if (closestCell === null || distance < closestCell.distance) {
            closestCell = { x, y, distance };
          }
        }
      }
    }
    
    // If we found a closest cell, connect it to the exit
    if (closestCell) {
      // Create a path from the closest cell to the exit
      this.createPathToExit(closestCell.x, closestCell.y);
    }
  }
  
  /**
   * Create a path from the given position to the exit
   */
  private createPathToExit(x: number, y: number): void {
    let currentX = x;
    let currentY = y;
    
    // While we haven't reached the exit
    while (currentX !== this.exit.x || currentY !== this.exit.y) {
      // Mark the current cell as visited
      const currentCell = this.isValidCell(currentX, currentY) ? this.grid[currentY]?.[currentX] : null;
      if (currentCell) {
        currentCell.visited = true;
      } else {
        break; // Exit if we hit an invalid cell
      }
      
      // Choose direction based on which gets us closer to the exit
      const xDiff = this.exit.x - currentX;
      const yDiff = this.exit.y - currentY;
      
      // Prioritize vertical movement unless we're already vertically aligned
      if (Math.abs(yDiff) > 0) {
        // Move down if exit is below
        if (yDiff > 0) {
          // Check if next cell is valid
          const nextCell = this.isValidCell(currentX, currentY + 1) ? this.grid[currentY + 1]?.[currentX] : null;
          const currentCellObj = currentCell;
          
          if (currentCellObj && nextCell) {
            // Remove bottom wall
            currentCellObj.walls.bottom = false;
            // Remove top wall of cell below
            nextCell.walls.top = false;
            currentY++;
          } else {
            break;
          }
        } else {
          // Move up if exit is above
          // Check if next cell is valid
          const nextCell = this.isValidCell(currentX, currentY - 1) ? this.grid[currentY - 1]?.[currentX] : null;
          const currentCellObj = currentCell;
          
          if (currentCellObj && nextCell) {
            // Remove top wall
            currentCellObj.walls.top = false;
            // Remove bottom wall of cell above
            nextCell.walls.bottom = false;
            currentY--;
          } else {
            break;
          }
        }
      } else if (Math.abs(xDiff) > 0) {
        // Move right if exit is to the right
        if (xDiff > 0) {
          // Check if next cell is valid
          const nextCell = this.isValidCell(currentX + 1, currentY) ? this.grid[currentY]?.[currentX + 1] : null;
          const currentCellObj = currentCell;
          
          if (currentCellObj && nextCell) {
            // Remove right wall
            currentCellObj.walls.right = false;
            // Remove left wall of cell to the right
            nextCell.walls.left = false;
            currentX++;
          } else {
            break;
          }
        } else {
          // Move left if exit is to the left
          // Check if next cell is valid
          const nextCell = this.isValidCell(currentX - 1, currentY) ? this.grid[currentY]?.[currentX - 1] : null;
          const currentCellObj = currentCell;
          
          if (currentCellObj && nextCell) {
            // Remove left wall
            currentCellObj.walls.left = false;
            // Remove right wall of cell to the left
            nextCell.walls.right = false;
            currentX--;
          } else {
            break;
          }
        }
      } else {
        // We've reached the exit's coordinates
        break;
      }
    }
    
    // Mark the exit as visited
    const exitCell = this.isValidCell(this.exit.x, this.exit.y) ? this.grid[this.exit.y]?.[this.exit.x] : null;
    if (exitCell) {
      exitCell.visited = true;
    }
  }
  
  /**
   * Add extra connections to make the maze less predictable
   * This creates loops in the maze, making it more interesting
   */
  private addExtraConnections(): void {
    // Add some random connections (about 10% of cells)
    const totalCells = MAZE_SIZE * MAZE_SIZE;
    const connectionsToAdd = Math.floor(totalCells * 0.1);
    
    for (let i = 0; i < connectionsToAdd; i++) {
      const x = Math.floor(seedRandom() * MAZE_SIZE);
      const y = Math.floor(seedRandom() * MAZE_SIZE);
      
      // Skip if not a valid cell
      if (!this.isValidCell(x, y)) continue;
      
      // Pick a random direction
      const dirIndex = Math.floor(seedRandom() * DIRECTIONS.length);
      const dir = DIRECTIONS[dirIndex];
      
      if (!dir) continue; // Skip if direction is undefined
      
      const nextX = x + dir.x;
      const nextY = y + dir.y;
      
      // If next cell is valid, remove walls between cells
      if (this.isValidCell(nextX, nextY)) {
        const currentCell = this.grid[y]?.[x];
        const nextCell = this.grid[nextY]?.[nextX];
        
        if (currentCell && nextCell) {
          // Remove the walls
          currentCell.walls[dir.wall] = false;
          nextCell.walls[dir.opposite] = false;
        }
      }
    }
  }

  private isValidCell(x: number, y: number): boolean {
    return x >= 0 && x < MAZE_SIZE && y >= 0 && y < MAZE_SIZE;
  }

  public buildMaze(world: World): void {
    console.log("Building maze...");
    
    // Set the entrance world position y-coordinate
    this.entranceWorldPosition.y = 1; // Default height for ground level
    
    // Create the base plate including entrance and exit platforms
    this.buildBasePlate(world);
    
    // Build the maze walls
    this.buildWalls(world);
    
    console.log("Maze built successfully!");
    console.log(`Entrance world position: (${this.entranceWorldPosition.x}, ${this.entranceWorldPosition.y}, ${this.entranceWorldPosition.z})`);
    console.log(`Exit at: (${this.exit.x * PATH_WIDTH}, ${this.entranceWorldPosition.y}, ${MAZE_SIZE * PATH_WIDTH + PLATFORM_DEPTH / 2})`);
  }

  private buildBasePlate(world: World): void {
    const totalSize = MAZE_SIZE * PATH_WIDTH;
    
    // Create a base plate with our registered floor block for the main maze
    for (let x = 0; x < totalSize; x++) {
      for (let z = 0; z < totalSize; z++) {
        world.chunkLattice.setBlock({ x, y: 0, z }, FLOOR_BLOCK_ID);
      }
    }
    
    // Build entrance platform (outside the top of the maze)
    const entranceX = this.entrance.x * PATH_WIDTH;
    const halfPlatformWidth = PLATFORM_WIDTH / 2;
    
    // Calculate the platform bounds centered on the entrance
    const entrancePlatformStartX = Math.max(0, entranceX - halfPlatformWidth);
    const entrancePlatformEndX = Math.min(totalSize, entranceX + PATH_WIDTH + halfPlatformWidth);
    
    // Build entrance platform
    for (let x = entrancePlatformStartX; x < entrancePlatformEndX; x++) {
      for (let z = -PLATFORM_DEPTH; z < 0; z++) {
        world.chunkLattice.setBlock({ x, y: 0, z }, FLOOR_BLOCK_ID);
      }
    }
    
    // Build exit platform (outside the bottom of the maze)
    const exitX = this.exit.x * PATH_WIDTH;
    
    // Calculate the platform bounds centered on the exit
    const exitPlatformStartX = Math.max(0, exitX - halfPlatformWidth);
    const exitPlatformEndX = Math.min(totalSize, exitX + PATH_WIDTH + halfPlatformWidth);
    
    // Build exit platform
    for (let x = exitPlatformStartX; x < exitPlatformEndX; x++) {
      for (let z = totalSize; z < totalSize + PLATFORM_DEPTH; z++) {
        world.chunkLattice.setBlock({ x, y: 0, z }, FLOOR_BLOCK_ID);
      }
    }
  }

  private buildWalls(world: World): void {
    // For each cell in the grid
    for (let gridY = 0; gridY < MAZE_SIZE; gridY++) {
      for (let gridX = 0; gridX < MAZE_SIZE; gridX++) {
        // Skip if cell is invalid
        if (!this.isValidCell(gridX, gridY)) continue;
        
        const cell = this.grid[gridY]?.[gridX];
        if (!cell) continue; // Skip if cell is undefined
        
        // Calculate the world coordinates
        const baseX = gridX * PATH_WIDTH;
        const baseZ = gridY * PATH_WIDTH;
        
        // Build walls if they exist
        if (cell.walls.top) {
          for (let x = 0; x < PATH_WIDTH; x++) {
            for (let y = 1; y <= WALL_HEIGHT; y++) {
              // Get a random wall block ID for each block
              const blockId = getRandomWallBlockId();
              world.chunkLattice.setBlock({ x: baseX + x, y, z: baseZ }, blockId);
            }
          }
        }
        
        if (cell.walls.right) {
          for (let z = 0; z < PATH_WIDTH; z++) {
            for (let y = 1; y <= WALL_HEIGHT; y++) {
              // Get a random wall block ID for each block
              const blockId = getRandomWallBlockId();
              world.chunkLattice.setBlock({ x: baseX + PATH_WIDTH, y, z: baseZ + z }, blockId);
            }
          }
        }
        
        if (cell.walls.bottom) {
          for (let x = 0; x < PATH_WIDTH; x++) {
            for (let y = 1; y <= WALL_HEIGHT; y++) {
              // Get a random wall block ID for each block
              const blockId = getRandomWallBlockId();
              world.chunkLattice.setBlock({ x: baseX + x, y, z: baseZ + PATH_WIDTH }, blockId);
            }
          }
        }
        
        if (cell.walls.left) {
          for (let z = 0; z < PATH_WIDTH; z++) {
            for (let y = 1; y <= WALL_HEIGHT; y++) {
              // Get a random wall block ID for each block
              const blockId = getRandomWallBlockId();
              world.chunkLattice.setBlock({ x: baseX, y, z: baseZ + z }, blockId);
            }
          }
        }
      }
    }
  }

  // Create a maze with a simple pattern of paths
  createPatternMaze() {
    // Create a simple pattern with a guaranteed path from entrance to exit
    const entranceCol = Math.floor(MAZE_SIZE / 2);
    const exitCol = Math.floor(MAZE_SIZE / 2);
    
    // Create a zig-zag pattern down the center
    let currentCol = entranceCol;
    
    for (let row = 0; row < MAZE_SIZE - 1; row++) {
      const currentCell = this.grid[row]?.[currentCol];
      if (!currentCell) continue;
      
      // Mark as visited
      currentCell.visited = true;
      
      // Determine which direction to go next (zig-zag pattern)
      const nextCol = row % 2 === 0 ? 
        Math.min(currentCol + 1, MAZE_SIZE - 1) : 
        Math.max(currentCol - 1, 0);
      
      // Connect to the next cell
      if (nextCol > currentCol) {
        // Remove right wall of current and left wall of next
        currentCell.walls.right = false;
        const nextCell = this.grid[row]?.[nextCol];
        if (nextCell) {
          nextCell.walls.left = false;
        }
      } else if (nextCol < currentCol) {
        // Remove left wall of current and right wall of next
        currentCell.walls.left = false;
        const nextCell = this.grid[row]?.[nextCol];
        if (nextCell) {
          nextCell.walls.right = false;
        }
      }
      
      // Always remove the bottom wall to create a path down
      currentCell.walls.bottom = false;
      
      // The cell below should have its top wall removed
      const cellBelow = this.grid[row + 1]?.[currentCol];
      if (cellBelow) {
        cellBelow.walls.top = false;
      }
      
      currentCol = nextCol;
    }
    
    // Ensure the exit cell connects to the final path
    const lastRow = MAZE_SIZE - 1;
    if (currentCol !== exitCol && this.grid[lastRow]) {
      // Connect the final path to the exit horizontally
      const direction = currentCol < exitCol ? 1 : -1;
      
      for (let col = currentCol; col !== exitCol; col += direction) {
        const currentCell = this.grid[lastRow]?.[col];
        if (!currentCell) continue;
        
        currentCell.visited = true;
        
        if (direction > 0) {
          // Moving right
          currentCell.walls.right = false;
          const nextCell = this.grid[lastRow]?.[col + direction];
          if (nextCell) {
            nextCell.walls.left = false;
          }
        } else {
          // Moving left
          currentCell.walls.left = false;
          const nextCell = this.grid[lastRow]?.[col + direction];
          if (nextCell) {
            nextCell.walls.right = false;
          }
        }
      }
    }
  }

  // Add random paths to make the maze more interesting
  addRandomPaths(count: number) {
    for (let i = 0; i < count; i++) {
      const row = Math.floor(Math.random() * (MAZE_SIZE - 1));
      const col = Math.floor(Math.random() * (MAZE_SIZE - 1));
      
      const cell = this.grid[row]?.[col];
      if (!cell) continue;
      
      // Randomly remove a wall
      const wallToRemove = Math.floor(Math.random() * 4);
      
      if (wallToRemove === 0 && row > 0) {
        // Remove top wall
        cell.walls.top = false;
        const cellAbove = this.grid[row - 1]?.[col];
        if (cellAbove) {
          cellAbove.walls.bottom = false;
        }
      } else if (wallToRemove === 1 && col < MAZE_SIZE - 1) {
        // Remove right wall
        cell.walls.right = false;
        const cellRight = this.grid[row]?.[col + 1];
        if (cellRight) {
          cellRight.walls.left = false;
        }
      } else if (wallToRemove === 2 && row < MAZE_SIZE - 1) {
        // Remove bottom wall
        cell.walls.bottom = false;
        const cellBelow = this.grid[row + 1]?.[col];
        if (cellBelow) {
          cellBelow.walls.top = false;
        }
      } else if (wallToRemove === 3 && col > 0) {
        // Remove left wall
        cell.walls.left = false;
        const cellLeft = this.grid[row]?.[col - 1];
        if (cellLeft) {
          cellLeft.walls.left = false;
        }
      }
    }
  }

  public getEntrance(): { x: number; y: number; z: number } {
    // Store the entrance world position for later reference
    this.entranceWorldPosition = {
      x: this.entrance.x * PATH_WIDTH + PATH_WIDTH / 2,
      y: 1, // Default height
      z: -PLATFORM_DEPTH / 2 // Position in the middle of the entrance platform
    };
    return this.entranceWorldPosition;
  }

  public getExit(): { x: number; y: number; z: number } {
    return {
      x: this.exit.x * PATH_WIDTH + PATH_WIDTH / 2,
      y: 1,
      z: MAZE_SIZE * PATH_WIDTH + PLATFORM_DEPTH / 2 // Position in the middle of the exit platform
    };
  }

  /**
   * Check if a world position is on a walkable path
   * @param worldX X coordinate in world space
   * @param worldY Y coordinate in world space (not used, included for completeness)
   * @param worldZ Z coordinate in world space
   * @returns True if the position is on a walkable path, false otherwise
   */
  public isWalkablePath(worldX: number, worldY: number, worldZ: number): boolean {
    // Ignore Y coordinate as it doesn't affect path validity
    
    // Skip if it's on entrance or exit platform
    if (worldZ < 0 || worldZ >= MAZE_SIZE * PATH_WIDTH) {
      // On platforms - these are always walkable
      return true;
    }
    
    // Convert world coordinates to grid coordinates
    const gridX = Math.floor(worldX / PATH_WIDTH);
    const gridZ = Math.floor(worldZ / PATH_WIDTH);
    
    // Check if this is a valid cell and whether it's walkable
    return this.isValidCell(gridX, gridZ) && this.isWalkableCell(gridX, gridZ);
  }
  
  /**
   * Check if a grid cell is walkable (not a wall)
   * @param gridX X coordinate in grid space
   * @param gridZ Z coordinate in grid space
   * @returns True if the cell is walkable, false otherwise
   */
  private isWalkableCell(gridX: number, gridZ: number): boolean {
    // Use the existing grid information to determine if this is a path
    // A cell is walkable if it's been visited during maze generation
    const cell = this.grid[gridZ]?.[gridX];
    return cell?.visited || false;
  }
  
  /**
   * Get the center coordinates of a specific grid cell
   * @param gridX X coordinate in grid space
   * @param gridZ Z coordinate in grid space
   * @returns Object with x, y, z coordinates for the center of the cell
   */
  public getCellCenter(gridX: number, gridZ: number): {x: number, y: number, z: number} {
    return {
      x: gridX * PATH_WIDTH + PATH_WIDTH/2,
      y: this.entranceWorldPosition.y + 1.0, // Use the actual world position height
      z: gridZ * PATH_WIDTH + PATH_WIDTH/2
    };
  }
  
  /**
   * Get all walkable cell coordinates in the maze
   * @returns Array of objects with x, z grid coordinates of walkable cells
   */
  public getAllWalkableCells(): Array<{x: number, z: number}> {
    const walkableCells = [];
    
    for (let z = 0; z < MAZE_SIZE; z++) {
      for (let x = 0; x < MAZE_SIZE; x++) {
        if (this.isWalkableCell(x, z)) {
          walkableCells.push({x, z});
        }
      }
    }
    
    return walkableCells;
  }
  
  /**
   * Get a 2D array representing the maze layout
   * @returns 2D boolean array where true = walkable path, false = wall
   */
  public getMazeLayout(): boolean[][] {
    return this.grid.map(row => 
      row.map(cell => cell.visited)
    );
  }
  
  /**
   * Get a random walkable position in the maze
   * Useful for randomly placing items that are guaranteed to be on paths
   * @param excludeRadius Exclude cells within this radius of entrance and exit
   * @returns Object with x, y, z world coordinates of a random walkable position
   */
  public getRandomWalkablePosition(excludeRadius: number = 2): {x: number, y: number, z: number} | null {
    // Get all walkable cells
    const walkableCells = this.getAllWalkableCells();
    
    if (walkableCells.length === 0) {
      return null;
    }
    
    // Filter out cells near entrance and exit if requested
    let eligibleCells = walkableCells;
    if (excludeRadius > 0) {
      eligibleCells = walkableCells.filter(cell => {
        // Check distance from entrance
        const distFromEntrance = Math.abs(cell.x - this.entrance.x) + Math.abs(cell.z - this.entrance.y);
        // Check distance from exit
        const distFromExit = Math.abs(cell.x - this.exit.x) + Math.abs(cell.z - this.exit.y);
        
        return distFromEntrance > excludeRadius && distFromExit > excludeRadius;
      });
    }
    
    // If no eligible cells remain, use all walkable cells
    if (eligibleCells.length === 0) {
      eligibleCells = walkableCells;
    }
    
    // Ensure there are cells to pick from
    if (eligibleCells.length === 0) {
      return null;
    }
    
    // Pick a random cell with safe bounds checking
    const randomIndex = Math.min(Math.floor(seedRandom() * eligibleCells.length), eligibleCells.length - 1);
    const randomCell = eligibleCells[randomIndex];
    
    // Verify that we have a valid cell
    if (!randomCell) {
      console.error('Failed to get a random walkable cell despite precautions');
      return null;
    }
    
    // Convert to world coordinates (cell center)
    return this.getCellCenter(randomCell.x, randomCell.z);
  }
}