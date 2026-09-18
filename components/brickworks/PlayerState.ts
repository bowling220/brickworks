type PlayerStateListener = (pos: [number, number, number], yaw: number) => void;

interface PlayerStateData {
  pos: [number, number, number];
  yaw: number;
}

let currentPlayerState: PlayerStateData = {
  pos: [0, 0.5, 0],
  yaw: 0,
};

const listeners = new Set<PlayerStateListener>();

/**
 * High-performance localized state holder for high-frequency player movement (position & yaw).
 * Decouples walk updates and compass HUD from root component React re-renders.
 */
export function setPlayerMovementState(pos: [number, number, number], yaw: number): void {
  currentPlayerState = { pos, yaw };
  for (const listener of listeners) {
    listener(pos, yaw);
  }
}

export function getPlayerMovementState(): PlayerStateData {
  return currentPlayerState;
}

export function subscribePlayerMovement(listener: PlayerStateListener): () => void {
  listeners.add(listener);
  // Immediate sync with current state
  listener(currentPlayerState.pos, currentPlayerState.yaw);
  return () => {
    listeners.delete(listener);
  };
}
