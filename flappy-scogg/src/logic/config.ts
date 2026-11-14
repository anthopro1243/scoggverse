// Every tuning number in the game. Units: the 405x720 play field, seconds, and 60 Hz steps.
// The feel numbers were picked by replay and the skill simulator (npm run sim); see HANDOFF.md.

export const STEP_MS = 1000 / 60;
export const DT = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;

// The play field
export const W = 405;
export const H = 720;
export const FLOOR_Y = 640; // the terrace's top edge; touching it ends the run
export const CEIL_Y = 0; // the top of the field; touching it ends the run too

// The face
export const FACE_X = 118; // its center never moves sideways; the world scrolls past
export const FACE_START_Y = 300;
export const FACE_H = 36; // drawn height in field units (scaled evenly from the slide crop)
export const FACE_MAX_W = 92; // a very wide crop is scaled down evenly until it fits this width
export const FACE_DRAW_SCALE = 1.2; // the art is drawn this much bigger (evenly) so his face reads on a phone; the hitbox stays on FACE_H

// Hitbox: an ellipse a little smaller than the drawn face, so a near miss is a miss
export const HIT_RX = 0.42; // of the drawn width, from the center
export const HIT_RY = 0.38; // of the drawn height
export const HIT_CIRCLES = 7; // the ellipse is checked as a chain of circles along its long axis

// Flight
export const GRAVITY = 1500; // units/s^2
export const FLAP_VY = -455; // a flap sets the upward speed to this (units/s)
export const MAX_FALL = 680; // terminal fall speed
export const TILT_UP = -0.22; // radians, nose up right after a flap (a wide face lifts its front a lot, so keep it small)
export const TILT_DOWN = 0.7; // radians, the most it noses down while falling
export const TILT_FALL_FROM = 120; // starts nosing down once falling faster than this
export const TILT_FALL_FULL = 640; // fully nosed down at this fall speed
export const TILT_EASE = 0.16; // how fast the tilt follows (per step)

// Columns
export const SCROLL = 150; // units/s, never changes during a run
export const COL_W = 68; // shaft width
export const CAP_OVERHANG = 7; // the bronze capital sticks out this far each side
export const CAP_H = 20; // capital height at the gap edge (it collides too: what you see is what hits)
export const COL_SPACING = 240; // center to center
export const FIRST_COL_X = W + 30; // left edge of the first column when a run starts
export const EASY_COLUMNS = 10; // the first ten gaps are wider
export const EASY_GAP = 196;
export const GAP = 168;
export const GAP_MARGIN = 64; // a gap's edge stays this far from the ceiling and the floor
export const MAX_RISE = 130; // the next gap's center is at most this much higher than the last
export const MAX_DROP = 160; // and at most this much lower
export const FIRST_GAP_RANGE = 70; // the first gap sits within this of the face's start height
export const BRONZE_EVERY = 7; // about one column in seven is bronze with a faint "$"

// Ending a run
export const CARD_DELAY = 24; // steps between the hit and the card starting to slide in
export const CARD_SLIDE = 24; // steps the slide takes
export const CARD_LOCK = 30; // taps are ignored for half a second after the card shows

// Scenery
export const PARALLAX_FAR = 0.08;
export const PARALLAX_MID = 0.3;
export const TITLE_SCROLL = 0.5; // the scenery drifts at half speed on the title screen

// Grades: the lowest score for each grade
export const GRADES: ReadonlyArray<readonly [string, number]> = [
  ["A", 40],
  ["B", 20],
  ["C", 10],
  ["D", 5],
  ["F", 0],
];
