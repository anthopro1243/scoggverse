// Gates, pressure plates and element barriers, with no Phaser.
// A gate opens while any of its plates is held and closes when they're all let go, but never
// closes onto a hero. Element barriers let only their own hero through.

/** Who can pass an element barrier: a curtain of flame lets Scogg Boy through, a curtain of water Scogg Girl. */
export const BARRIERS = { flame: "boy", water: "girl" };
export const barrierBlocks = (kind, who) => {
  if (!(kind in BARRIERS)) throw new Error(`unknown barrier: ${kind}`);
  return BARRIERS[kind] !== who;
};

/**
 * Move a gate's opening toward its target. open: 0 shut .. 1 fully open.
 * @param {{open: number}} gate
 * @param {{held: boolean, occupied: boolean, dt: number, speed: number}} s
 */
export function stepGate(gate, { held, occupied, dt, speed }) {
  if (held) gate.open = Math.min(1, gate.open + speed * dt);
  else if (!occupied) gate.open = Math.max(0, gate.open - speed * dt);
  return gate;
}

/** A gate blocks unless it's (almost) fully open. */
export const gateBlocks = (gate) => gate.open < 0.9;
