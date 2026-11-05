// Macro is fire, Gov is water. Who survives which pool.

export const PLAYERS = ["boy", "girl"]; // Scogg Boy (AP Macro), Scogg Girl (AP Gov)

export const POOLS = {
  inflation: { name: "Inflation", safeFor: ["boy"] },
  ink: { name: "Ink", safeFor: ["girl"] },
  recession: { name: "Recession", safeFor: [] },
};

/** True when touching this pool kills this player. */
export function poolKills(pool, player) {
  const p = POOLS[pool];
  if (!p) throw new Error(`unknown pool: ${pool}`);
  if (!PLAYERS.includes(player)) throw new Error(`unknown player: ${player}`);
  return !p.safeFor.includes(player);
}
