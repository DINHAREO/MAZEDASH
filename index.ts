/**
 * Maze Dash Game
 * 
 * A game where players navigate through a randomly generated maze
 * trying to find their way from the entrance to the exit.
 */

import {
  World, 
  startServer,
  PlayerEvent,
  PlayerEntity,
  PlayerCamera,
  PlayerCameraMode,
  Entity,
  Audio,
  Vector3,
  Player,
  BaseEntityControllerEvent,
  Collider,
  ColliderShape,
  Light,
  PlayerUIEvent,
  EntityEvent,
  RigidBodyType,
  WorldEvent,
  CollisionGroup,
  Block,
  BlockType
} from 'hytopia';
import type { PlayerInput, Vector3Like } from 'hytopia';
import { MazeGenerator } from './maze-generator';
import { GoalDetector } from './goal-detection';
import { registerMazeBlocks } from './block-registry';

// Leaderboard entry structure
interface LeaderboardEntry {
  username: string;
  time: number; // Store time in milliseconds for accurate sorting
}

// Constants for the game
const OXYGEN_PENALTY_ON_ZOMBIE_HIT = 30; // 30 seconds penalty when hit by zombie
const MAX_ZOMBIES = 100; // Maximum number of zombies to spawn - increased from 50 to 100
const ZOMBIE_SPAWN_EXCLUSION_RADIUS = 3; // Don't spawn zombies near entrance/exit
const ZOMBIE_DETECTION_RANGE = 20; // How far zombies can detect players
const ZOMBIE_SPEED = 2; // Movement speed of zombies
const ZOMBIE_DAMAGE_COOLDOWN = 1000; // Cooldown between zombie attacks (ms) - reduced from 3000 to 1000
const ZOMBIE_DAMAGE_SECONDS = 5; // Damage seconds when hit by zombie - reduced from 30 to 5

// Timer state
interface PlayerTimerState {
  isRunning: boolean;
  startTime: number | null; // Can be null when not started
  endTime: number | null;
  bestTime: number | null;
  countdownActive?: boolean; // Flag for the new oxygen countdown
  timeRemaining: number;
  oxygenTimer: number;
  awaitingStart: boolean; // NEW: Flag to indicate player is at welcome screen
}

// Start the game server
const server = startServer((world) => {
  // console.log("Server started! Ready to receive players..."); // Keep initial server start log

  // Array to track all potions in the game
  const potions: Array<{
    entity: Entity;
    position: { x: number; y: number; z: number };
    active: boolean;
  }> = [];

  // Leaderboard data (persistent for server lifetime)
  let leaderboardTimes: LeaderboardEntry[] = [];

  // Configure lighting for a sunset atmosphere
  // Set ambient light to a warm orange-gold tone
  world.setAmbientLightColor({ r: 255, g: 180, b: 120 });
  world.setAmbientLightIntensity(0.85);
  
  // Set directional light to a golden sunset color
  world.setDirectionalLightColor({ r: 255, g: 190, b: 140 });
  world.setDirectionalLightIntensity(0.6);
  
  // The skybox will automatically be loaded from assets/cubemaps/skybox

  // Register our custom block types first
  registerMazeBlocks(world);

  // Generate and build the maze
  // console.log('Generating maze...');
  const mazeGenerator = new MazeGenerator();
  mazeGenerator.generateMaze();
  mazeGenerator.buildMaze(world);
  
  const entrance = mazeGenerator.getEntrance();
  const exit = mazeGenerator.getExit();
  
  // console.log(`Maze built with entrance at: (${entrance.x}, ${entrance.y}, ${entrance.z})`);
  // console.log(`Maze exit at: (${exit.x}, ${exit.y}, ${exit.z})`);

  // Create goal detector at the exit position
  const goalDetector = new GoalDetector(world, exit);

  // Place potions in the maze
  placeWaterPotion(world, entrance);
  placeEntrancePotion(world, entrance);

  // Place 150 additional random potions throughout the maze (increased from 48)
  placeRandomPotions(world, mazeGenerator, 150);

  // Test the path verification system by placing a random potion
  placeRandomPotion(world, mazeGenerator);

  // Store player timer data
  const playerTimers = new Map<string, PlayerTimerState>();
  // Store all connected players
  const connectedPlayers = new Set<Player>();
  // Store player start order count and assigned bonuses for multiplayer fairness
  let playersStartedCount = 0;
  const playerStartingBonuses = new Map<string, number>(); // Map<playerId, bonusSeconds>

  // // Create start sensor at the entrance (REMOVED - Game now starts via UI button)
  // createStartSensor(world, entrance, playerTimers);
  
  // Add subtle atmospheric lighting in the maze
  createAtmosphericLighting(world, entrance, exit);
  
  // Store background music reference so it can be stopped on death
  let gameBackgroundMusic: Audio | null = null;
  // Track which track was played last to ensure we shuffle properly
  let lastTrackNumber: number = 0;
  
  /**
   * Force stop all background music
   * Properly manages audio cleanup according to Hytopia SDK best practices
   */
  function forceStopAllMusic() {
    // console.log("Attempting to force stop all music...");
    
    if (gameBackgroundMusic) {
      const musicRef = gameBackgroundMusic;
      // console.log("Found existing music reference to stop.");
      gameBackgroundMusic = null;
      // console.log("Cleared global music reference.");

      try {
        // Try setting volume to 0 first for immediate silence
        // console.log("Setting volume to 0...");
        musicRef.setVolume(0);
        // console.log("Volume set to 0.");

        // Then try pausing
        // console.log("Pausing audio...");
        musicRef.pause();
        // console.log("Pause command sent.");
        
      } catch (e) {
        console.error("Error during music stop/pause:", e);
      }
    } else {
      // console.log("No existing music reference found to stop.");
    }
    // console.log("Finished force stop attempt.");
  }

  /**
   * Play background music for the maze game
   * Following Hytopia Audio Rules for ambient background music
   */
  function playBackgroundMusic() {
    // console.log("Playing background music - following Hytopia Audio Rules");
    
    forceStopAllMusic();
    
    // Select a track different from the last one played
    let trackNumber: number;
    if (lastTrackNumber === 0) {
      // First play - randomly select track 1 or 2
      trackNumber = Math.random() < 0.5 ? 1 : 2;
    } else {
      // Always play the opposite track from the last one
      trackNumber = lastTrackNumber === 1 ? 2 : 1;
    }
    
    // Update the last track played
    lastTrackNumber = trackNumber;
    
    const trackUri = `audio/music/MAZEDASH${trackNumber}.mp3`;
    // console.log(`Selected background track: ${trackUri} (timestamp: ${Date.now()})`);
    
    try {
      // console.log(`Creating background music with track ${trackNumber}`);
      
      gameBackgroundMusic = new Audio({
        uri: trackUri,
        volume: 0.075, // Reduced volume
        loop: true  // Background music should loop
      });
      
      if (gameBackgroundMusic) {
        gameBackgroundMusic.play(world, true); // Force playback
        // console.log(`Now playing background music (track ${trackNumber}): ${trackUri}`);
      } else {
        console.error("Failed to create background music reference");
      }
    } catch (e) {
      console.error("Error starting background music:", e);
    }
  }

  // Start playing background music immediately when server starts
  // This follows the Hytopia Audio Rules example for ambient audio
  // Adding a delay to ensure the world is ready for audio playback
  // console.log("Scheduling initial background music start");
  setTimeout(() => {
    // console.log("Executing delayed initial background music start");
    playBackgroundMusic();
  }, 1500);
  
  /**
   * Start the oxygen countdown timer for a player
   */
  function startOxygenCountdown(player: Player, timerState: PlayerTimerState): void {
    // console.log(`Starting oxygen countdown for player: ${player.username}`);
    
    // Set countdown active flag
    timerState.countdownActive = true;
    timerState.oxygenTimer = 10; // Initialize with 10 seconds
    
    // Signal UI to start countdown - let the client handle the actual timer
    player.ui.sendData({
      type: 'start-countdown',
      initialTime: timerState.oxygenTimer // Send initial time to UI
    });
    
    // We no longer use server-side timeouts for oxygen depletion
    // The client will notify us when the timer reaches zero
  }
  
  // Update UI timers for players
  setInterval(() => {
    for (const player of connectedPlayers) {
      const timerState = playerTimers.get(player.id);
      
      if (timerState && timerState.isRunning) {
        const currentTime = Date.now();
        const elapsedTime = currentTime - (timerState.startTime || 0);
        
        // Update UI with time if we had UI
        // In simplified version, we'll just log it
        if (elapsedTime % 5000 < 100) { // Log roughly every 5 seconds
          // console.log(`Player ${player.username} time: ${(elapsedTime/1000).toFixed(1)}s`);
        }
      }
    }
  }, 100); // Update every 100ms

  // Start playing background music immediately on server start
  // console.log("Starting initial background music on server start");
  setTimeout(() => {
    playBackgroundMusic(); // Delayed initial start to ensure world is ready
  }, 2000); // Give the world time to initialize
  
  // Add a finish event handler to stop the timer and oxygen countdown
  goalDetector.onPlayerReachedGoal = (playerEntity: PlayerEntity) => {
    // console.log(`Goal reached callback triggered for player: ${playerEntity.player.username}`);
    
    // Stop the timer
    const player = playerEntity.player;
    const timerState = playerTimers.get(player.id);
    
    if (timerState && timerState.isRunning && timerState.startTime !== null) {
      // console.log(`Stopping timer for player: ${player.username}`);
      const timeTaken = Date.now() - timerState.startTime;
      timerState.endTime = Date.now();
      timerState.isRunning = false;
      
      // Stop the oxygen countdown
      timerState.countdownActive = false;
      player.ui.sendData({
        type: 'stop-countdown'
      });
      
      // Update best time if this is better
      if (timerState.bestTime === null || timeTaken < timerState.bestTime) {
        timerState.bestTime = timeTaken;
      }
      
      // Announce completion time
      const seconds = (timeTaken / 1000).toFixed(2);
      world.chatManager.sendBroadcastMessage(
        `${player.username} completed the maze in ${seconds} seconds!`,
        '00FF00'
      );
      
      // Format best time in seconds with 2 decimal places
      const bestTimeSeconds = timerState.bestTime ? 
          (timerState.bestTime / 1000).toFixed(2) : 
          seconds; // Use current time if no best time
      
      // Send win screen data to the client
      player.ui.sendData({
        type: 'player-won',
        completionTime: seconds,
        bestTime: bestTimeSeconds
      });
      
      // Add a celebratory effect
      const audio = new Audio({
        uri: 'audio/sfx/misc/MazeComplete.mp3',
        volume: 1,
        loop: false,
        position: playerEntity.position
      });
      audio.play(world);
      
      // console.log(`Timer stopped for player: ${player.username}, time: ${seconds} seconds`);

      // --- Leaderboard Update Logic ---
      // console.log("Updating leaderboard...");
      leaderboardTimes.push({ username: player.username, time: timeTaken });
      leaderboardTimes.sort((a, b) => a.time - b.time);
      leaderboardTimes = leaderboardTimes.slice(0, 10);
      // console.log("Leaderboard updated:", leaderboardTimes);
      broadcastLeaderboardUpdate();
      // --- End Leaderboard Update Logic ---
    } else {
      // console.log(`Timer was not running for player: ${player.username} or timer state not found`);
    }
  };

  /**
   * Handle player death and show death screen
   */
  function handlePlayerDeath(player: Player): void {
    // console.log(`Handling death for player: ${player.username}. Current time: ${Date.now()}`);
    
    // Get the timer state
    const timerState = playerTimers.get(player.id);
    if (!timerState) {
      // console.warn(`No timer state found for dying player ${player.username}`);
      return;
    }
    
    // Update timer state
    timerState.countdownActive = false;
    timerState.isRunning = false;
    
    // Show death overlay
    player.ui.sendData({
      type: 'player-died'
    });
    
    // Tell the client to stop the timer
    player.ui.sendData({
      type: 'stop-countdown'
    });
    
    // Get player entity
    const playerEntity = world.entityManager.getPlayerEntitiesByPlayer(player)[0];
    if (playerEntity) {
      // Optional: Play death animation
      playerEntity.startModelOneshotAnimations(['die']);
    }
  }
  
  /**
   * Respawn player at start location
   */
  function respawnPlayer(player: Player): void {
    // console.log(`[Respawn] Called for player: ${player.username}`); // DEBUG -> REMOVE
    // console.log(`Respawning player: ${player.username}`);
    
    // Reset timer state
    const timerState = playerTimers.get(player.id);
    if (timerState) {
      timerState.isRunning = false;
      timerState.startTime = null;
      timerState.endTime = null;
      timerState.countdownActive = false;
      timerState.awaitingStart = true; // Ensure player goes back to welcome state
      // console.log(`Timer state reset for player: ${player.username}`);
    }
    
    // Make sure all music is stopped first
    forceStopAllMusic();
    
    // Get player entity
    const playerEntity = world.entityManager.getPlayerEntitiesByPlayer(player)[0];
    if (playerEntity) {
      // console.log(`Found player entity for respawn: ${playerEntity.id}`);
      
      // Reset animations first
      playerEntity.stopModelAnimations(['walk', 'run', 'die']);
      playerEntity.startModelLoopedAnimations(['idle']);
      
      // Teleport back to spawn immediately
      playerEntity.setPosition({
        x: entrance.x,
        y: entrance.y + 1.5,
        z: entrance.z
      });
      // console.log(`Teleported player ${player.username} to entrance`);
    } else {
      console.warn(`No player entity found for ${player.username} during respawn`);
    }
    
    // Signal the UI to reset the timer
    player.ui.sendData({
      type: 'reset-timer'
    });
    // console.log(`Sent reset-timer signal to UI for player: ${player.username}`);

    // Also tell the UI to show the welcome screen again
    player.ui.sendData({
        type: 'show-welcome'
    });
    // console.log(`Sent show-welcome signal to UI for player: ${player.username} after respawn`);
    
    // Start new background music (after a brief pause to ensure old music is fully stopped)
    // console.log("Scheduling background music start after respawn");
    setTimeout(() => {
      // console.log("Executing delayed music start after respawn");
      playBackgroundMusic();
    }, 1500);
    
    // Clean up entities
    
    // Respawn potions - first clean up existing ones
    /* // REMOVED FOR MULTIPLAYER - Respawn should not reset shared entities
    for (const potion of potions) {
      if (potion.entity && potion.entity.isSpawned) {
        potion.entity.despawn();
      }
    }
    
    // Clear the potions array
    potions.length = 0;
    */
    
    // Clean up all existing zombies first
    /* // REMOVED FOR MULTIPLAYER
    const zombieEntities = world.entityManager.getEntitiesByTag("zombie");
    if (zombieEntities.length > 0) {
      // console.log(`Cleaning up ${zombieEntities.length} existing zombies before respawning`);
      zombieEntities.forEach((zombie) => {
        if (zombie.isSpawned) {
          zombie.despawn();
        }
      });
    }
    */
    
    // Respawn all potions with increased count
    /* // REMOVED FOR MULTIPLAYER
    placeWaterPotion(world, entrance);
    placeEntrancePotion(world, entrance);
    placeRandomPotions(world, mazeGenerator, 150);
    */
    
    // Respawn zombies throughout the maze
    /* // REMOVED FOR MULTIPLAYER - Zombies are spawned once at server start
    spawnZombies(world, mazeGenerator, playerTimers);
    */
    
    // Notify player of respawn
    world.chatManager.sendPlayerMessage(
      player,
      'You have been respawned at the starting point. Try again!',
      'FF9900'
    );
  }
  
  // Handle player events
  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    // console.log(`Player joined: ${player.username}`);
    
    // Check if we already have players connected
    const existingPlayerCount = connectedPlayers.size;
    // console.log(`Existing player count: ${existingPlayerCount}`);
    
    // Check if this player is already connected (this shouldn't happen, but let's check)
    const isAlreadyConnected = connectedPlayers.has(player);
    if (isAlreadyConnected) {
      // console.log(`Player ${player.username} is already connected. Skipping entity creation.`);
      return;
    }
    
    // For debugging: log all current player entities
    const playerEntities = world.entityManager.getAllPlayerEntities();
    // console.log(`Current player entities in world: ${playerEntities.length}`);
    playerEntities.forEach((entity: PlayerEntity) => {
      // console.log(`  - Player entity: ${entity.name}, id: ${entity.id}`);
    });
    
    // Clean up any orphaned player entities before adding a new player
    // This ensures we don't have leftover entities from previous sessions
    // NOTE: In multiplayer, we need to be careful here. We only want to clean up
    // entities potentially associated with THIS joining player if they somehow left
    // an orphaned entity behind, not *all* player entities. For simplicity now,
    // let's comment out this broad cleanup as it's risky in multiplayer.
    /*
    if (playerEntities.length > 0) {
      // console.log(`Cleaning up ${playerEntities.length} orphaned player entities before adding new player`);
      playerEntities.forEach((entity: PlayerEntity) => {
        if (entity.isSpawned) {
          entity.despawn();
          // console.log(`Despawned orphaned player entity: ${entity.name}, id: ${entity.id}`);
        }
      });
    }
    */
    
    // Enforce single-player mode by disconnecting any new players if someone is already playing
    // REMOVED FOR MULTIPLAYER
    /*
    if (existingPlayerCount > 0) {
      // console.log(`Game already has ${existingPlayerCount} players. Rejecting new player ${player.username}`);
      player.disconnect();
      return;
    }
    */
    
    // Add the player to connected players set
    connectedPlayers.add(player);
    // console.log(`Added player ${player.username} to connectedPlayers. Total: ${connectedPlayers.size}`); // Added log
    
    // Initialize timer state for this player
    playerTimers.set(player.id, {
      isRunning: false,
      startTime: null,
      endTime: null,
      bestTime: null,
      countdownActive: false,
      timeRemaining: 0, 
      oxygenTimer: 10, // Start with 10 seconds of oxygen
      awaitingStart: true, // Player starts at the welcome screen
    });
    
    // Load the custom UI
    player.ui.load('ui/maze-timer.html');
    
    // Tell UI to show the welcome screen (in case it was hidden previously)
    // Add a slight delay to ensure UI is loaded before sending data
    setTimeout(() => {
      player.ui.sendData({
        type: 'show-welcome'
      });
      // console.log(`Sent show-welcome to player ${player.username}`);
      
      // Also send the current leaderboard to the joining player
      // console.log(`Sending current leaderboard to player ${player.username}`);
      player.ui.sendData({ 
        type: 'leaderboard-update', 
        times: leaderboardTimes 
      });
    }, 500); // Delay to ensure UI is ready
    
    // Set up UI data handler for player restart requests
    player.ui.on(PlayerUIEvent.DATA, ({ data }) => {
      // More detailed logging for UI messages
      // console.log(`[UI Data Received] Player: ${player.username}, Message Type: ${data?.type}, Full Data:`, JSON.stringify(data));
      
      if (data.type === 'player-restart') {
        // console.log(`[UI Handler] Player ${player.username} requested restart via UI message.`);
        
        // Reset the player timer
        const timerState = playerTimers.get(player.id);
        if (timerState) {
          timerState.isRunning = false;
          timerState.startTime = null;
          timerState.endTime = null;
          timerState.countdownActive = false;
          // console.log(`Reset timer state for player ${player.username}`);
        }
        
        // Get the player entity and respawn
        const playerEntity = world.entityManager.getPlayerEntitiesByPlayer(player)[0];
        if (playerEntity) {
          // console.log(`Found player entity for ${player.username}, calling respawnPlayer`);
          respawnPlayer(player);
        } else {
          // console.warn(`No player entity found for ${player.username} during restart, attempting to create a new one`);
          // Attempt to create a new player entity at the entrance
          const newPlayerEntity = new PlayerEntity({
            player,
            name: player.username,
            modelUri: 'models/players/player.gltf',
            modelLoopedAnimations: ['idle'],
            modelScale: 0.5
          });
          
          // Spawn at entrance
          newPlayerEntity.spawn(world, {
            x: entrance.x,
            y: entrance.y + 1.5,
            z: entrance.z
          });
          
          // console.log(`Created and spawned new player entity for ${player.username} at entrance`);
          
          // Send reset signal to UI
          player.ui.sendData({
            type: 'reset-timer'
          });
        }
      } else if (data.type === 'player-quit') {
        // console.log(`Player ${player.username} requested quit`);
        player.disconnect();
      } else if (data.type === 'oxygen-depleted') {
        // console.log(`Player ${player.username} has run out of oxygen (client timer expired)`);
        
        // Force stop background music using the correct function
        // console.log("Calling forceStopAllMusic from oxygen-depleted event");
        forceStopAllMusic(); 
        
        // Get the timer state
        const timerState = playerTimers.get(player.id);
        if (timerState && timerState.countdownActive) {
          // Play death sound when oxygen depletes
          const playerEntity = world.entityManager.getPlayerEntitiesByPlayer(player)[0];
          
          // Play death sound
          new Audio({
            uri: 'audio/sfx/player/DEATH.mp3',
            volume: 1,
            attachedToEntity: playerEntity, // Attach to player for spatial audio
            referenceDistance: 30 // Make sure it's heard well
          }).play(world);
          
          // Player has died from lack of oxygen
          handlePlayerDeath(player);
        }
      }
    });
    
    // Set spawn position at the entrance
    const spawnPosition = {
      x: entrance.x,
      y: entrance.y + 1.5, // Slightly higher off the ground
      z: entrance.z
    };
    
    // Create a player entity
    const playerEntity = new PlayerEntity({
      player,
      name: player.username,
      modelUri: 'models/players/player.gltf',
      modelLoopedAnimations: ['idle'],
      modelScale: 0.5
    });
    
    // Spawn the player at the maze entrance - simplified approach
    playerEntity.spawn(world, spawnPosition);
    // console.log(`Spawned player entity for ${player.username} at (${spawnPosition.x}, ${spawnPosition.y}, ${spawnPosition.z})`);
    
    // Calculate the direction vector that points into the maze
    // This ensures the player is facing the maze entrance
    const directionToMazeCenter = {
      x: exit.x - entrance.x,
      y: 0,
      z: exit.z - entrance.z
    };
    
    // Normalize the direction vector
    const length = Math.sqrt(directionToMazeCenter.x * directionToMazeCenter.x + directionToMazeCenter.z * directionToMazeCenter.z);
    if (length > 0) {
      directionToMazeCenter.x /= length;
      directionToMazeCenter.z /= length;
    }
    
    // Make the player face the maze entrance
    // For a simple rotation, calculate yaw (rotation around Y axis)
    const yaw = Math.atan2(directionToMazeCenter.x, directionToMazeCenter.z);
    const halfYaw = yaw / 2;
    const rotation = {
      x: 0,
      y: Math.sin(halfYaw), // Y component of quaternion
      z: 0,
      w: Math.cos(halfYaw)  // W component of quaternion
    };
    
    // Set the player's initial rotation to face the maze
    playerEntity.setRotation(rotation);
    
    // Set up player animations AND INPUT HANDLING based on movement
    playerEntity.controller?.on(BaseEntityControllerEvent.TICK_WITH_PLAYER_INPUT, ({ entity, input }) => {
      const { w, a, s, d, sh, sp } = input; // Added sp for spacebar
      const isMoving = w || a || s || d;
      const isRunning = isMoving && sh;
      
      // Get player timer state
      const timerState = playerTimers.get(player.id);

      // --- REMOVE DEBUG LOGGING for Spacebar Restart ---
      // if (timerState) { ... } else { ... }

      // --- Game Start Logic (Spacebar press) ---
      if (timerState && timerState.awaitingStart && sp) {
        // console.log(`[Spacebar Start] Detected for player: ${player.username}. Starting game...`); // DEBUG -> REMOVE
        // console.log(`Player ${player.username} pressed Spacebar to start.`);
        timerState.awaitingStart = false; // Mark as no longer awaiting start
        
        // Start the game timer logic
        timerState.isRunning = true;
        timerState.startTime = Date.now();
        timerState.endTime = null;
        
        // Start the oxygen countdown via UI message
        startOxygenCountdown(player, timerState);

        // --- NEW: Apply Multiplayer Starting Bonus on First Start ---
        if (!playerStartingBonuses.has(player.id)) {
          playersStartedCount++;
          const startingBonusSeconds = (playersStartedCount - 1) * 30;
          playerStartingBonuses.set(player.id, startingBonusSeconds);
          
          // Only send bonus message if bonus is greater than 0
          if (startingBonusSeconds > 0) {
            player.ui.sendData({
              type: 'apply-start-bonus',
              timeBonus: startingBonusSeconds
            });
            // console.log(`Player ${player.username} is player #${playersStartedCount}, granting start bonus: ${startingBonusSeconds}s`); // DEBUG
            world.chatManager.sendPlayerMessage(
              player,
              `Welcome! As player #${playersStartedCount}, you get a +${startingBonusSeconds} second starting bonus!`,
              'FFFF00' // Yellow color
            );
          } else {
            // console.log(`Player ${player.username} is player #${playersStartedCount}, no bonus.`); // DEBUG
            world.chatManager.sendPlayerMessage(
              player,
              `You are the first player! Find the exit! Good luck!`,
              '00FF00' // Green color
            );
          }
        }
        // --- END Multiplayer Starting Bonus ---
        
        // Start the background music now
        playBackgroundMusic();
        
        // Tell the UI to hide the welcome screen
        player.ui.sendData({
          type: 'hide-welcome'
        });

        // world.chatManager.sendPlayerMessage(player, 'GO! Find the exit!', '00FF00'); // Keep notification
      }
      // --- End Game Start Logic ---
      
      // Default player model animations (only if not awaiting start)
      if (timerState && !timerState.awaitingStart) {
        if (isMoving) {
          if (isRunning) {
            if (!entity.modelLoopedAnimations.has('run')) {
              entity.stopModelAnimations(['idle', 'walk']);
              entity.startModelLoopedAnimations(['run']);
            }
          } else {
            if (!entity.modelLoopedAnimations.has('walk')) {
              entity.stopModelAnimations(['idle', 'run']);
              entity.startModelLoopedAnimations(['walk']);
            }
          }
        } else {
          if (!entity.modelLoopedAnimations.has('idle')) {
            entity.stopModelAnimations(['walk', 'run']);
            entity.startModelLoopedAnimations(['idle']);
          }
        }
      }
    });
  });

  world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    // console.log(`Player left: ${player.username}`);
    
    // Clean up player entities belonging to the disconnected player
    const playerEntities = world.entityManager.getPlayerEntitiesByPlayer(player);
    if (playerEntities.length > 0) {
      // console.log(`Cleaning up ${playerEntities.length} entities for player ${player.username}`);
      playerEntities.forEach((entity: PlayerEntity) => {
        if (entity.isSpawned) {
          entity.despawn();
          // console.log(`Despawned entity for disconnected player: ${entity.name}`);
        }
      });
    }
    
    // Remove from connected players set
    connectedPlayers.delete(player);
    
    // Remove timer data
    playerTimers.delete(player.id);
  });

  /**
   * Places an item safely on a walkable path in the maze
   * @param world The game world
   * @param mazeGenerator The maze generator instance
   * @param position The position to place the item
   * @param modelUri The URI of the model to use
   * @param name The name of the entity
   * @param scale The scale of the model
   * @param lightColor Optional light color for the item
   * @returns The created entity or null if placement failed
   */
  function placeItemSafely(
    world: World,
    mazeGenerator: MazeGenerator,
    position: { x: number; y: number; z: number },
    modelUri: string,
    name: string,
    scale: number = 0.5
  ): Entity | null {
    // Check if the position is on a walkable path
    if (!mazeGenerator.isWalkablePath(position.x, position.y, position.z)) {
      // Keep error log
      console.error(`Cannot place ${name} at (${position.x}, ${position.y}, ${position.z}) - not a walkable path`);
      return null;
    }

    // Create the entity
    const entity = new Entity({
      name,
      modelUri,
      modelScale: scale,
      opacity: 1.0,
      rigidBodyOptions: {
        type: RigidBodyType.FIXED,
        colliders: [
          {
            shape: ColliderShape.BALL,
            radius: 0.5 * scale,
            isSensor: true
          }
        ]
      }
    });

    // Spawn the entity
    entity.spawn(world, position);

    // Track the potion in our global array if it exists
    if (potions) {
      potions.push({
        entity,
        position,
        active: true
      });
    }

    return entity;
  }

  /**
   * Places a random potion somewhere in the maze
   * Uses the path verification system to ensure it's on a valid path
   */
  function placeRandomPotion(world: World, mazeGenerator: MazeGenerator): void {
    // Get a random position that's guaranteed to be on a walkable path
    // Exclude positions near entrance and exit (within 3 cells)
    const randomPosition = mazeGenerator.getRandomWalkablePosition(3);
    
    if (randomPosition) {
      // The y position should already be correct from getRandomWalkablePosition,
      // which now uses entranceWorldPosition.y + 1.0
      // console.log(`Placing random test potion at height: ${randomPosition.y}`);
      
      // Place an entity at the random position
      placeItemSafely(
        world,
        mazeGenerator,
        randomPosition,
        'models/items/golden-apple.gltf', // Using a different model for variety
        'RandomPotion',
        1.0
      );
    } else {
      // Keep error log
      console.error('Failed to find a random walkable position in the maze');
    }
  }

  /**
   * Creates minimal sunset-themed atmospheric lighting in the maze
   */
  function createAtmosphericLighting(world: World, entrance: Vector3Like, exit: Vector3Like): void {
    // console.log('Creating minimal sunset atmospheric lighting for the maze');
    
    // Create a warm light at the entrance
    const entranceLight = new Light({
      position: {
        x: entrance.x,
        y: entrance.y + 3,
        z: entrance.z
      },
      color: { r: 255, g: 200, b: 130 }, // Warm golden light
      intensity: 1.8, // Slightly increased to compensate for fewer lights
      distance: 15  // Increased range to compensate for fewer lights
    });
    
    entranceLight.spawn(world);
    
    // Create a light at the exit - golden to guide players
    const exitLight = new Light({
      position: {
        x: exit.x,
        y: exit.y + 3,
        z: exit.z
      },
      color: { r: 255, g: 210, b: 140 }, // Similar golden tone
      intensity: 2.5, // Increased to compensate for fewer lights
      distance: 20 // Increased range to help guide players
    });
    
    exitLight.spawn(world);
    
    // Create a subtle flickering effect on entrance light to simulate sunset flare
    let flickerIntensity = 1.7;
    let flickerDirection = 0.06;
    
    setInterval(() => {
      // Change flicker direction at intensity thresholds
      if (flickerIntensity > 2.0) flickerDirection = -0.06;
      if (flickerIntensity < 1.6) flickerDirection = 0.06;
      
      flickerIntensity += flickerDirection;
      
      // Update entrance light intensity for subtle flickering effect
      entranceLight.setIntensity(flickerIntensity);
    }, 120); // Update every 120ms for a warm sunset flicker
  }

  /**
   * Places multiple random potions throughout the maze
   * @param world The game world
   * @param mazeGenerator The maze generator instance
   * @param count The number of potions to place
   * @returns Array of placed potion entities
   */
  function placeRandomPotions(world: World, mazeGenerator: MazeGenerator, count: number) {
    // console.log(`Placing ${count} random potions throughout the maze...`);
    const placedPotions = [];
    
    for (let i = 0; i < count; i++) {
      const position = mazeGenerator.getRandomWalkablePosition(3); // Exclude areas near entrance/exit
      if (position) {
        // Position will have consistent height from getRandomWalkablePosition
        // console.log(`Placing random-potion-${i} at (${position.x}, ${position.y}, ${position.z})`);
        
        // Log height of the first few potions for debugging
        if (i < 3) {
          // console.log(`Random potion ${i} height: ${position.y}`);
        }
        
        const potion = placeItemSafely(
          world,
          mazeGenerator,
          position,
          'models/items/potion-water.gltf', // Correct model path
          `random-potion-${i}`,
          1.0 // Increased scale to match entrance potion
        );
        if (potion) {
          placedPotions.push(potion);
        }
      }
    }
    
    // console.log(`Successfully placed ${placedPotions.length} potions out of ${count} attempted`);
    
    // Set up a global interval to check all potions for player proximity
    setupPotionCollectionSystem(world);
    
    return placedPotions;
  }

  /**
   * Sets up the potion collection system to check all potions
   * @param world The game world
   */
  function setupPotionCollectionSystem(world: World) {
    // console.log(`Setting up potion collection system for ${potions.length} potions`);
    
    // Set up a regular interval to check potions
    const checkInterval = setInterval(() => {
      // Skip if there are no potions or world is gone
      if (potions.length === 0 || !world) {
        return;
      }
      
      // Get all player entities once
      const playerEntities = world.entityManager.getAllPlayerEntities();
      
      // Check each potion against all players
      for (let i = 0; i < potions.length; i++) {
        const potion = potions[i];
        
        // Skip if this potion is no longer active
        if (!potion || !potion.active || !potion.entity.isSpawned) {
          continue;
        }
        
        // Check each player's distance to the potion
        for (const playerEntity of playerEntities) {
          const distance = Math.sqrt(
            Math.pow(playerEntity.position.x - potion.position.x, 2) +
            Math.pow(playerEntity.position.y - potion.position.y, 2) +
            Math.pow(playerEntity.position.z - potion.position.z, 2)
          );
          
          // If player is close enough to the potion
          if (distance < 1.5) {
            const player = playerEntity.player;
            
            // Find player's timer state
            const playerTimer = playerTimers.get(player.id);
            if (playerTimer && playerTimer.isRunning) {
              // Add 15 seconds to the timer
              // console.log(`Player ${player.username} collected potion ${potion.entity.name}! Adding 15 seconds`);
              
              // Mark as inactive to prevent duplicate collection
              potion.active = false;
              
              // Send a message to the UI to add time to the countdown
              // Always send bubble effect even if countdown isn't active yet
              player.ui.sendData({
                type: 'potion-collected',
                timeBonus: 15
              });
              
              // Actually add 15 seconds to the oxygen timer - but only if countdown is active
              if (playerTimer.countdownActive) {
                // Reset the countdown timer but keep it active
                playerTimer.countdownActive = true;
                
                // We no longer use server-side timeouts
                // The client will notify us when the timer reaches zero
                
                // Notify the player about the time extension
                world.chatManager.sendPlayerMessage(
                  player,
                  'You collected a potion! +15 seconds of oxygen!',
                  '00FFFF'
                );
              } else {
                // If countdown isn't active yet (player hasn't left start platform)
                // Just provide feedback that they collected something
                world.chatManager.sendPlayerMessage(
                  player,
                  'You collected a potion! This will give you oxygen when you start.',
                  '00FFFF'
                );
              }
              
              // Play a collection sound
              new Audio({
                uri: 'audio/sfx/misc/Potion.mp3',
                volume: 0.4, // Reduced from 0.8 to 0.4 (50% quieter)
                attachedToEntity: playerEntity, // Attach to player for spatial audio
                referenceDistance: 20
              }).play(world);
              
              // Remove the potion
              potion.entity.despawn();
              
              // No need to check other players for this potion
              break;
            }
          }
        }
      }
      
      // Clean up the array by removing inactive potions
      for (let i = potions.length - 1; i >= 0; i--) {
        const potionItem = potions[i];
        if (!potionItem || !potionItem.active || (potionItem.entity && !potionItem.entity.isSpawned)) {
          potions.splice(i, 1);
        }
      }
    }, 100); // Check every 100ms
    
    // Add shutdown logic for the interval
    world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
      if (world.entityManager.getAllPlayerEntities().length === 0) {
        // If no players left, clear the interval
        clearInterval(checkInterval);
      }
    });
  }

  // Helper functions for placing the water potions
  function placeWaterPotion(world: World, entrance: Vector3Like): void {
    // console.log('Placing water potion in the second cell of the maze');
    
    // Path width constant from maze generator (should be 4 blocks)
    const PATH_WIDTH = 4;
    
    // Calculate a position that's centered on a path cell
    // First path cell center is at z=PATH_WIDTH/2 (2)
    // For the second cell, use PATH_WIDTH + PATH_WIDTH/2 (6)
    const potionPosition = {
      x: entrance.x,                // Same x-coordinate as entrance (center of path)
      y: entrance.y + 1.0,          // Consistent with all other potions
      z: PATH_WIDTH + PATH_WIDTH/2  // Center of the second cell in the maze (6)
    };
    
    // console.log(`Placing water potion at height: ${potionPosition.y}`);
    
    // Use the safe placement function
    placeItemSafely(
      world,
      mazeGenerator,
      potionPosition,
      'models/items/potion-water.gltf',
      'WaterPotion',
      1.0
    );
  }

  function placeEntrancePotion(world: World, entrance: Vector3Like): void {
    // console.log('Placing entrance potion in the first cell of the maze');
    
    // Path width constant from maze generator (should be 4 blocks)
    const PATH_WIDTH = 4;
    
    // Calculate position at the center of the first cell
    const potionPosition = {
      x: entrance.x,        // Same x-coordinate as entrance (center of path)
      y: entrance.y + 1.0,  // Consistent with all other potions
      z: PATH_WIDTH/2       // Center of the first cell in the maze (2)
    };
    
    // console.log(`Placing entrance potion at height: ${potionPosition.y}`);
    
    // Use the safe placement function
    placeItemSafely(
      world,
      mazeGenerator,
      potionPosition,
      'models/items/potion-water.gltf',
      'EntrancePotion',
      1.0
    );
  }

  // After the maze is initialized and built
  mazeGenerator.buildMaze(world);
  // console.log("Maze built!");

  // Spawn zombies throughout the maze
  spawnZombies(world, mazeGenerator, playerTimers);

  /**
   * Broadcasts the current leaderboard to all connected players
   */
  function broadcastLeaderboardUpdate() {
    // console.log("Broadcasting leaderboard update to all players.");
    const leaderboardData = { type: 'leaderboard-update', times: leaderboardTimes };
    for (const player of connectedPlayers) {
      player.ui.sendData(leaderboardData);
    }
  }
});

/**
 * Spawns zombie NPCs throughout the maze on walkable paths
 * @param world The game world
 * @param mazeGenerator The maze generator instance
 * @param playerTimers Map of player timer states
 */
function spawnZombies(world: World, mazeGenerator: MazeGenerator, playerTimers: Map<string, PlayerTimerState>) {
  // console.log(`Spawning ${MAX_ZOMBIES} zombies in the maze...`);
    
  // Store references to zombies and track player damage cooldowns
  const zombies: Entity[] = [];
  const playerDamageCooldowns = new Map<string, number>();
    
  // Spawn zombies at random walkable positions in the maze
  for (let i = 0; i < MAX_ZOMBIES; i++) {
    // Get a random position that's guaranteed to be on a walkable path
    // Make sure zombies aren't too close to entrance/exit
    const position = mazeGenerator.getRandomWalkablePosition(ZOMBIE_SPAWN_EXCLUSION_RADIUS);
        
    if (!position) {
      // Keep warn log
      console.warn(`Failed to find valid position for zombie ${i}`);
      continue;
    }
        
    // Create the zombie entity
    const zombie = new Entity({
      name: `Zombie_${i}`,
      tag: "zombie",
      modelUri: "models/npcs/zombie.gltf",
      modelScale: 0.5, // Reduced from 0.8 to 0.5 to match player size
      modelLoopedAnimations: ["idle"], // Start with idle animation
      rigidBodyOptions: {
        type: RigidBodyType.DYNAMIC, // Ensure dynamic type for physics
        enabledRotations: { x: false, y: true, z: false }, // Only allow Y-axis rotation
        colliders: [
          {
            shape: ColliderShape.CAPSULE,
            halfHeight: 0.45, // Tightened to better match zombie body
            radius: 0.3, // Tightened to better match zombie body
          }
        ]
      }
    });
        
    // Spawn the zombie at the calculated position with a slight Y offset
    zombie.spawn(world, {
      x: position.x,
      y: position.y + 0.5, // Slightly off the ground
      z: position.z
    });
        
    zombies.push(zombie);
    // console.log(`Spawned zombie ${i} at position:`, position);
  }
    
  // Set up interval to update zombie behavior
  const zombieUpdateInterval = setInterval(() => {
    // Safety check - stop if world is not available
    if (!world) {
      clearInterval(zombieUpdateInterval);
      return;
    }
        
    // Get all player entities
    const playerEntities = world.entityManager.getAllPlayerEntities();
    if (playerEntities.length === 0) return;
        
    // Current time for cooldown calculations
    const currentTime = Date.now();
        
    // Update each zombie's behavior
    zombies.forEach(zombie => {
      if (!zombie || !zombie.isSpawned) return;
            
      // Find closest player
      let closestPlayer: PlayerEntity | null = null;
      let closestDistance = Infinity;
            
      for (const player of playerEntities) {
        if (!player || !player.isSpawned) continue;
                
        // Calculate distance between zombie and player
        const zombiePos = zombie.position;
        const playerPos = player.position;
        const dx = zombiePos.x - playerPos.x;
        const dz = zombiePos.z - playerPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
                
        // If this player is closer than the previous closest
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPlayer = player;
        }
                
        // Check for collision with player (zombie and player are very close)
        if (distance < 1.2) { // Tightened collision distance from 2.0 to 1.2 for more accurate collisions
          // Make sure player has an ID
          if (!player.player) continue; 
          const playerId = player.player.id;
                    
          // Apply damage cooldown - better null safety
          const lastDamageTime = playerDamageCooldowns.get(playerId) || 0;
          if (currentTime - lastDamageTime > ZOMBIE_DAMAGE_COOLDOWN) {
                        
            // Find the timer state for this player
            const timerState = playerTimers.get(playerId);
            if (timerState && timerState.isRunning) {
              // Reduce oxygen timer - track on server and send to client
              const oldOxygenValue = timerState.oxygenTimer;
              timerState.oxygenTimer = Math.max(0, timerState.oxygenTimer - ZOMBIE_DAMAGE_SECONDS);
              
              // console.log(`Zombie attack: Reducing oxygen from ${oldOxygenValue} to ${timerState.oxygenTimer}`);
                            
              // Update the UI with the new timer value - using a specific zombie damage message
              player.player.ui.sendData({
                type: "zombie-damage",
                timeReduction: ZOMBIE_DAMAGE_SECONDS,
                newTime: timerState.oxygenTimer
              });
                           
              // Play zombie attack sound
              const damageSound = new Audio({
                uri: 'audio/sfx/damage/Zombie.mp3',
                volume: 0.4, // Reduced from 0.8 to 0.4 (50% quieter)
                attachedToEntity: player, // Attach to player for spatial audio
                referenceDistance: 20
              });
              damageSound.play(world);
                            
              // Notify player
              world.chatManager.sendPlayerMessage(
                player.player,
                `A zombie attacked you! -${ZOMBIE_DAMAGE_SECONDS} seconds oxygen!`,
                "FF0000"
              );
                            
              // Set cooldown for this player - zombies STAY in place after attack
              playerDamageCooldowns.set(playerId, currentTime);
              
              // Debug log for collision
              // console.log(`Zombie collision with player: ${player.player.username} at distance ${distance.toFixed(2)}`);
            }
          }
        }
      }
            
      // Always update rotation to face the closest player if we have one
      if (closestPlayer) {
        const playerPos = closestPlayer.position;
        const zombiePos = zombie.position;
        
        // Calculate direction vector toward player
        const dx = playerPos.x - zombiePos.x;
        const dz = playerPos.z - zombiePos.z;
        const length = Math.sqrt(dx * dx + dz * dz);
        
        if (length > 0) {
          // In Hytopia, some models face along positive Z axis and some face along negative Z
          // Zombie model appears to face along negative Z, so we need to adjust accordingly
          
          // Calculate angle but adjust for zombie model's base orientation
          // Model faces -Z, but we want it to face toward the player
          // This is equivalent to adding π (180 degrees) to normal atan2 result
          const modelAdjustedYaw = Math.atan2(-dx, -dz);
          const halfYaw = modelAdjustedYaw / 2;
          
          // Apply rotation with correctly adjusted yaw
          zombie.setRotation({
            x: 0, 
            y: Math.sin(halfYaw),
            z: 0,
            w: Math.cos(halfYaw)
          });

          // Only move zombie toward player if within detection range
          if (closestDistance < ZOMBIE_DETECTION_RANGE) {
            // Move zombie toward player
            const speedFactor = ZOMBIE_SPEED * 0.1; // Increased speed factor
            const newPos = {
              x: zombiePos.x + (dx / length) * speedFactor,
              y: zombiePos.y,
              z: zombiePos.z + (dz / length) * speedFactor
            };
                      
            // Update zombie position
            zombie.setPosition(newPos);
                      
            // Update animation based on distance
            if (closestDistance < 5) {
              // Run when close to player
              if (!zombie.modelLoopedAnimations.has("run")) {
                zombie.stopModelAnimations(["idle", "walk"]);
                zombie.startModelLoopedAnimations(["run"]);
              }
            } else {
              // Walk when further from player
              if (!zombie.modelLoopedAnimations.has("walk")) {
                zombie.stopModelAnimations(["idle", "run"]);
                zombie.startModelLoopedAnimations(["walk"]);
              }
            }
          } else {
            // No player in detection range - zombie should be idle
            if (!zombie.modelLoopedAnimations.has("idle")) {
              zombie.stopModelAnimations(["walk", "run"]);
              zombie.startModelLoopedAnimations(["idle"]);
            }
          }
        }
      } else {
        // No closest player at all - zombie should be idle
        if (!zombie.modelLoopedAnimations.has("idle")) {
          zombie.stopModelAnimations(["walk", "run"]);
          zombie.startModelLoopedAnimations(["idle"]);
        }
      }
    });
        
    // Clean up destroyed zombies (only if they're truly despawned, not just temporarily inactive)
    for (let i = zombies.length - 1; i >= 0; i--) {
      const zombie = zombies[i];
      if (!zombie || !zombie.isSpawned) {
        zombies.splice(i, 1);
      }
    }
  }, 250); // Update every 250ms (was 100ms)
    
  // Add cleanup for when there are no players
  world.on(PlayerEvent.LEFT_WORLD, () => {
    const remainingPlayers = world.entityManager.getAllPlayerEntities();
    if (remainingPlayers.length === 0) {
      clearInterval(zombieUpdateInterval);
    }
  });
}

/**
 * Calculates the distance between two positions
 */
function calculateDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
} 