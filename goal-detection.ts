import {
  Collider,
  ColliderShape,
  Entity,
  Light,
  PlayerEntity,
  World,
} from 'hytopia';
import type { EntityOptions, Vector3Like } from 'hytopia';

export class GoalDetector {
  private world: World;
  private goalPosition: Vector3Like;
  private detectionRadius: number = 5;
  private goalEntity: Entity | null = null;
  private goalLight: Light | null = null;
  
  // Callback that can be set externally to handle goal reached events
  public onPlayerReachedGoal: ((playerEntity: PlayerEntity) => void) | null = null;

  constructor(world: World, exitPosition: Vector3Like) {
    this.world = world;
    this.goalPosition = exitPosition;
    this.createGoalEntity();
    
    // Log that the goal detector was created
    console.log(`Goal detector created at position (${exitPosition.x}, ${exitPosition.y}, ${exitPosition.z}) with detection radius ${this.detectionRadius}`);
  }

  private createGoalEntity(): void {
    // Create a visible goal marker
    this.goalEntity = new Entity({
      name: 'Goal',
      modelUri: 'models/misc/range-indicator-dot-green.gltf',
      modelScale: 3,
      opacity: 0.8,
      rigidBodyOptions: {
        // Add more detailed rigid body options for better collision detection
        colliders: [
          {
            shape: ColliderShape.BALL,
            radius: this.detectionRadius,
            isSensor: true, // Very important to ensure this is a sensor
            // This callback is fired when an entity enters the goal area
            onCollision: (other: unknown, started: boolean) => {
              console.log(`Goal collision detected with entity: ${other && (other as any).name ? (other as any).name : 'unknown'}, started: ${started}`);
              
              // Check if the entity is a player
              if (started && other instanceof PlayerEntity) {
                console.log(`Player ${other.player.username} entered the goal area`);
                this.handlePlayerReachedGoal(other);
              }
            }
          }
        ]
      }
    });

    // Place the entity at goal position, but elevate it a bit for better visibility
    const spawnPosition = {
      x: this.goalPosition.x,
      y: this.goalPosition.y + 2, // Raise it a bit for visibility
      z: this.goalPosition.z
    };

    this.goalEntity.spawn(this.world, spawnPosition);
    console.log(`Goal entity placed at: (${spawnPosition.x}, ${spawnPosition.y}, ${spawnPosition.z})`);
    
    // Create a standalone sensor for better collision detection
    // This will create a redundant trigger in case the entity sensor doesn't work
    const goalSensor = new Collider({
      shape: ColliderShape.BALL,
      radius: this.detectionRadius + 2, // Even larger for redundancy
      relativePosition: spawnPosition,
      isSensor: true,
      onCollision: (other: unknown, started: boolean) => {
        console.log(`Goal sensor collision detected with entity: ${other && (other as any).name ? (other as any).name : 'unknown'}, started: ${started}`);
              
        // Check if the entity is a player
        if (started && other instanceof PlayerEntity) {
          console.log(`Player ${other.player.username} entered the goal sensor area`);
          this.handlePlayerReachedGoal(other);
        }
      }
    });
    
    // Add the collider to the simulation
    goalSensor.addToSimulation(this.world.simulation);
    console.log("Additional goal sensor created for redundancy");
    
    // Create a point light at the goal position
    this.goalLight = new Light({
      attachedToEntity: this.goalEntity, // Attach light to the goal entity
      color: { r: 0, g: 255, b: 0 }, // Green light
      intensity: 5, // Bright intensity
      offset: { x: 0, y: 0.5, z: 0 }, // Slight offset above the entity
    });
    
    // Spawn the light
    this.goalLight.spawn(this.world);
    console.log('Goal light created and attached to goal entity');
  }

  // Make this method public so it can be called from outside
  public handlePlayerReachedGoal(playerEntity: PlayerEntity): void {
    console.log(`Goal reached by player: ${playerEntity.player.username}`);
    
    // Send a message to the player
    this.world.chatManager.sendPlayerMessage(
      playerEntity.player,
      'Congratulations! You reached the exit!',
      '00FF00'
    );

    // Send a broadcast message to all players
    this.world.chatManager.sendBroadcastMessage(
      `${playerEntity.player.username} reached the exit!`,
      '00FF00'
    );

    // Call the external callback if it exists
    if (this.onPlayerReachedGoal) {
      console.log('Calling onPlayerReachedGoal callback');
      this.onPlayerReachedGoal(playerEntity);
    } else {
      console.log('Warning: onPlayerReachedGoal callback is not set');
    }

    // You could add more celebration effects here
    // Like fireworks, sounds, etc.
  }

  // Cleanup method if needed
  public cleanup(): void {
    // Clean up the light if it exists
    if (this.goalLight) {
      this.goalLight.despawn();
      this.goalLight = null;
    }
    
    // Clean up the entity if it exists
    if (this.goalEntity && this.goalEntity.isSpawned) {
      this.goalEntity.despawn();
      this.goalEntity = null;
    }
  }
} 