// Pose math for the two heroes, kept free of Phaser so it can be unit-tested.
// A pose moves body parts and squashes/stretches the BODY only. The face only ever moves or tilts
// with the figure: there is deliberately no head-scale field, so nothing here can warp the face.

export const GEO = {
  faceW: 26,              // the face oval's width in world units (about 0.9 tile)
  frame: 1.1,             // thin dark frame line around the face
  torsoTop: -28, torsoBottom: -9, shoulderW: 22, hipW: 12,
  hipY: -9, hipX: 3.6, legLen: 8.5, legW: 7.5,
  shoulderY: -24, shoulderX: 9.5, armLen: 9, armW: 6,
  neckOverlap: 3,         // the face's chin sits this far into the body
  height: 53,             // feet to top of the face, for hitboxes and layout (crowns go higher)
};
export const FACE_ASPECT = 177.4 / 162.5; // the oval on the slide, height / width
export const FACE_RX = GEO.faceW / 2;
export const FACE_RY = FACE_RX * FACE_ASPECT;

export const POSE_KINDS = ["idle", "run", "jump", "fall", "land", "death", "win"];

// Death: serious, not gory. The body collapses (embers or ink), then the hero is gone.
export const DEATH = { collapseAt: 0.12, collapseLen: 0.5, burstAt: 0.08, burstLen: 0.9, goneAt: 0.66, total: 1.1 };
export const LAND_LEN = 0.14;

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (v) => 1 - (1 - v) * (1 - v);

/**
 * @param {string} kind one of POSE_KINDS
 * @param {number} t seconds since this pose started
 * @param {{tick?: number, facing?: 1|-1, speed?: number}} opts tick = seconds since the level started
 */
export function computePose(kind, t, { tick = t, facing = 1, speed = 1 } = {}) {
  const breath = Math.sin(TAU * 0.45 * tick);
  const p = {
    rootRot: 0, rootDX: 0, rootDY: 0, sx: 1, sy: 1,
    legs: [0, 0], arms: [-0.18, 0.18], headRot: 0, headDY: 0,
    sway: 0.15 * Math.sin(tick * 2.1),   // crown / hood lean: negative trails behind
    glow: 1 + 0.06 * breath,             // light the hero gives off
    collapse: 0, burst: -1, faceShown: true, bodyAlpha: 1,
  };
  switch (kind) {
    case "idle": {
      p.sy = 1 + 0.025 * breath; p.sx = 1 - 0.015 * breath;
      p.arms = [-0.2 - 0.04 * breath, 0.2 + 0.04 * breath];
      p.headDY = -0.6 * breath;
      break;
    }
    case "run": {
      const ph = TAU * 2.4 * t * Math.max(0.4, speed);
      const s = Math.sin(ph);
      p.legs = [0.6 * s, -0.6 * s];
      p.arms = [-0.65 * s, 0.65 * s];
      p.rootDY = -1.6 * Math.abs(Math.cos(ph));
      p.rootRot = 0.06 * facing;
      p.sy = 1 + 0.03 * Math.cos(2 * ph); p.sx = 1 - 0.02 * Math.cos(2 * ph);
      p.sway = -0.55 + 0.08 * s;
      break;
    }
    case "jump": {
      const k = clamp01(t / 0.18);
      p.sy = 1.1 - 0.1 * easeOut(k); p.sx = 0.92 + 0.08 * easeOut(k);
      p.legs = [0.45, -0.3];
      p.arms = [-0.9, 0.9];
      p.sway = -0.2;
      break;
    }
    case "fall": {
      p.legs = [0.2 + 0.06 * Math.sin(t * 12), -0.3 - 0.06 * Math.sin(t * 12)];
      p.arms = [-1.6 - 0.15 * Math.sin(t * 10), 1.6 + 0.15 * Math.sin(t * 10)];
      p.sway = 0.6; // falling: the crown streams upward
      break;
    }
    case "land": {
      const k = 1 - clamp01(t / LAND_LEN);
      p.sy = 1 - 0.16 * k; p.sx = 1 + 0.12 * k;
      p.legs = [0.2 * k, -0.2 * k];
      p.arms = [-0.18 - 0.5 * k, 0.18 + 0.5 * k];
      break;
    }
    case "death": {
      const { collapseAt, collapseLen, burstAt, burstLen, goneAt } = DEATH;
      const c = easeOut(clamp01((t - collapseAt) / collapseLen));
      p.collapse = c;
      p.sy = 1 - 0.82 * c;
      p.sx = 1 + 0.5 * c;
      p.arms = [-0.4 - 0.8 * c, 0.4 + 0.8 * c];
      p.legs = [0.5 * c, -0.5 * c];
      p.glow = 1 + 0.8 * Math.sin(Math.PI * clamp01(t / 0.5)) - 0.9 * clamp01((t - goneAt) / 0.3);
      if (t >= burstAt) p.burst = clamp01((t - burstAt) / burstLen);
      p.faceShown = t < goneAt;
      p.bodyAlpha = 1 - clamp01((t - goneAt + 0.1) / 0.35);
      p.sway = 0.4;
      break;
    }
    case "win": {
      // stepping into the door: a calm rise, arms lifting, the light swelling
      const k = easeOut(clamp01(t / 0.5));
      p.rootDY = -3 * k - 1.2 * Math.sin(TAU * 0.8 * t) * k;
      p.arms = [-0.2 - 1.9 * k, 0.2 + 1.9 * k];
      p.glow = 1 + 0.7 * k;
      p.sway = 0.25;
      break;
    }
    default:
      throw new Error(`unknown pose: ${kind}`);
  }
  return p;
}

/** Flame tongue heights (relative, about 1) flickering with time. */
export function flicker(tick, i) {
  return 1 + 0.18 * Math.sin(tick * 10.7 + i * 2.3) + 0.08 * Math.sin(tick * 23.1 + i * 1.7);
}

/** Where the face's center sits for a pose: on the body, following its squash, never scaled. */
export function headCenterY(p) {
  const y = GEO.torsoTop * p.sy - FACE_RY + GEO.neckOverlap + p.headDY;
  return Math.min(y, -FACE_RY - 4); // even fully collapsed, the face stays clear of the floor (and pools)
}
