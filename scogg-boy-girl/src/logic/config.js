// Every tuning number for the whole game lives here. No Phaser imports in src/logic/.

export const WORLD_W = 960;          // internal resolution (world units)
export const WORLD_H = 540;
export const TILE = 30;              // 32 x 18 tiles per screen
export const HZ = 60;                // fixed simulation rate
export const STEP_MS = 1000 / HZ;
export const MAX_STEPS_PER_FRAME = 5; // after a long stall, drop time instead of spiralling
export const MAX_RENDER_SCALE = 2;   // canvas is 960x540 times this at most (1920x1080)

// Movement feel (G1, tested by replay; numbers logged in PROGRESS.md).
export const MOVE = {
  gravity: 1500,      // px/s^2
  runSpeed: 210,      // px/s, instant start and stop (the original's tight feel), full air control
  jumpSpeed: 640,     // px/s, about a 4.5 tile jump: clears a platform you can also walk under
  maxFall: 820,       // px/s terminal speed, so long drops stay readable
  coyote: 0.1,        // s: you can still jump this long after walking off a ledge
  jumpBuffer: 0.12,   // s: a jump pressed this long before landing still happens
  jumpCut: 0.45,      // letting go of jump while rising keeps this much of the upward speed (short hops)
  bodyW: 20,
  bodyH: 52,          // compact elemental figures: about 1.8 tiles tall
};

// Scogg Bucks lose value as the level clock runs; Gavels keep theirs.
export const SCORE = {
  buckStart: 10,      // $ when the level starts
  inflation: 0.03,    // lose 3% ...
  every: 10,          // ... every 10 s, compounding
  buckFloor: 2,       // never worth less than $2
  gavel: 10,          // $ each, always
  // grade = collected value / best possible value (everything grabbed at full value)
  grades: [["A", 0.9], ["B", 0.82], ["C", 0.68], ["D", 0.52], ["F", 0]],
};

// The puzzle pieces (G2).
export const MECH = {
  slab: 15,           // px thick: moving platforms, elevators, the scale's pans
  crateW: 28,         // px: a surplus crate is a tile tall and a little narrower, so it drops into a one-tile pit
  pushSpeed: 100,     // px/s a hero walks while pushing a crate (crates are heavy)
  moverSpeed: 70,     // px/s a lever- or plate-driven platform travels
  scaleSpeed: 40,     // px/s the scale's pans tip
  basinSpeed: 45,     // px/s an Inflation basin rises or drains
};

export const LEVEL = {
  winHold: 0.35,      // s both heroes must stand at their doors before the level ends
  endCardDelay: 1.1,  // s of the win pose before the end card
  doorReach: 14,      // px either side of a door's center that counts as standing at it
  gateSpeed: 2.5,     // gates open or close fully in 0.4 s
  plateDepth: 3,      // px a pressure plate sinks when held
};

// The one "Don't deny yourself an education" sign per chamber (G3): it spans both exits when they
// stand close together on one floor, otherwise it hangs alone halfway between them.
export const MOTTO_SIGN = {
  h: 40,              // px tall (two lines of the pixel font, big enough to read)
  pad: 6,             // px past each outer door edge
  spanMax: 420,       // px: wider than this and it would cross the level, so it hangs alone
  soloW: 170,         // px: the lone sign (motto on two lines)
};

// Sound (G3): every sound is synthesized in the browser, nothing is a recording.
export const SOUND = {
  volume: 0.8,        // master volume to start with
  music: 0.6,         // the tune's share of it
  buckDrop: 7,        // semitones the Buck chime falls from full value down to the $2 floor
  minGap: 0.06,       // s: the same sound never starts twice closer than this
  maxPeak: 0.7,       // no sound peaks above this (nothing that startles)
};
