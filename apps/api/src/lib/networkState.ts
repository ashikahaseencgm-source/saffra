/** Runtime facts about how this server is reachable on the restaurant's network. */
export const networkState = {
  /** The extra no-port listener (normally 80) once it's actually listening; null if off or unavailable. */
  friendlyPort: null as number | null,
};
