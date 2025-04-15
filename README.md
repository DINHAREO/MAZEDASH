# Maze Dash - Hytopia Game

## Game Overview

Maze Dash is a timed, single-player arcade-style game built using the Hytopia SDK. Players are challenged to navigate a randomly generated maze from the entrance to the exit as quickly as possible. Adding to the challenge is a depleting oxygen supply (acting as a timer) and hostile zombies roaming the maze paths. Players can collect oxygen potions scattered throughout the maze to extend their time.

## Gameplay Mechanics

*   **Fixed Maze Layout:** Players navigate a predefined maze layout, offering a consistent challenge.
*   **Timed Challenge:** Players have a limited oxygen supply that depletes over time. Reaching the exit before running out of oxygen is the goal.
*   **Start/Finish:** The game begins when the player presses the spacebar on the welcome screen. The timer starts, and the player navigates from a designated entrance block to an exit platform.
*   **Obstacles:** Zombies patrol the maze. Colliding with a zombie reduces the player's remaining oxygen.
*   **Collectibles:** Oxygen potions appear throughout the maze. Collecting them adds bonus time to the oxygen timer.
*   **Win/Loss Conditions:**
    *   **Win:** Reach the exit platform before oxygen runs out. A win screen displays the completion time and best time, along with a confetti celebration.
    *   **Lose:** Run out of oxygen (or get hit by a zombie when oxygen is low). A death screen appears.
*   **Restart:** Players can restart the game from either the win screen or the death screen.
*   **Leaderboard:** The game tracks the top 10 fastest completion times for the current server session, displayed on the UI.

## Key Features

*   **Predefined Maze:** Features a carefully designed maze layout for a balanced challenge.
*   **Custom UI:** Features a dynamic, holographic-style UI built with HTML/CSS/JS for:
    *   Welcome Screen (Instructions)
    *   Oxygen Timer/HUD (with warning states)
    *   Win Screen (with confetti effects)
    *   Death Screen
    *   Leaderboard Display
*   **Dynamic Obstacles:** Zombies with basic AI (pathfinding towards the player within range, attack cooldown).
*   **Item Pickups:** Potions that grant time bonuses when collected.
*   **Sound Design:** Includes background music (shuffled tracks) and spatial sound effects for player actions (death), zombie attacks, and potion collection.
*   **Visual Effects:** Enhanced UI animations, particle effects for winning (confetti), potion collection (bubbles), and zombie damage (blood splatter).
*   **Lighting & Atmosphere:** Uses ambient and directional lighting, plus a skybox, to create a sunset atmosphere.

## Technical Details

*   **Engine:** Hytopia SDK
*   **Server Logic:** TypeScript
*   **Client UI:** HTML, CSS, JavaScript
*   **Key SDK Features Used:**
    *   `startServer`, `World`
    *   `PlayerEntity`, `Entity`, `Player`
    *   `PlayerEvent`, `PlayerUIEvent`, `BaseEntityControllerEvent`
    *   `Audio` (spatial and ambient)
    *   `RigidBodyType`, `Collider`, `ColliderShape`, Sensors
    *   `Block`, `BlockType`, Custom Block Registration
    *   `MazeGenerator` (Custom Module)
    *   `GoalDetector` (Custom Module)
    *   UI Loading (`player.ui.load`) & Communication (`sendData`, `onData`, `eventSub`)
    *   Lighting (`setAmbientLightColor`, `setDirectionalLightColor`, `Light` entity)
    *   Chat Manager (`sendBroadcastMessage`, `sendPlayerMessage`)

## Development Note

This game was primarily developed through collaboration with an AI assistant (Gemini). The process involved iterative refinement of requirements, AI-driven code generation, testing, and debugging based on user feedback.

## How to Play

1.  Ensure the Hytopia server is running with this game package.
2.  Connect to the server using the Hytopia client.
3.  Upon joining, you will see a welcome screen. Press the **SPACEBAR** to begin the maze run and start the oxygen timer.
4.  Navigate the maze using standard movement controls (W, A, S, D).
5.  Reach the exit platform before your oxygen runs out.
6.  Collect blue potions to gain extra oxygen time.
7.  Avoid zombies, as they will deplete your oxygen upon contact.
8.  If you win or lose, use the buttons on the respective screens to play again or quit.

## Implementation Details

The game uses the following components:

- `maze-generator.ts`: Defines and builds the static maze structure used in the game.
- `goal-detection.ts`: Handles goal detection using physics colliders
- `index.ts`: Sets up the game world and handles player events

## Development

This game was created using the Hytopia SDK, a platform for creating web-based 3D multiplayer games.

To run the game:

```
npm install
npm start
```

## Future Enhancements

Potential future enhancements could include:

- Multiple difficulty levels with different maze sizes
- More varied Collectibles scattered throughout the maze (e.g., speed boosts, temporary invulnerability)
- Multiplayer race mode
- Persistent Leaderboards (beyond server session)
