// Scogg Boy (AP Macro, fire) and Scogg Girl (AP Gov, water and ink): small elemental figures with the
// classmate's face cut-out as the head. The element wraps around the face (a ring of flame, a thin
// rippling ring of water) but is never drawn over it; the face is the last child of the rig, so nothing is
// ever drawn over it. The face is only moved, tilted with the figure, shown or hidden. It is never
// flipped, tinted, faded or scaled unevenly.
import Phaser from "phaser";
import { PAL } from "./palette.js";
import { GEO, FACE_RX, FACE_RY, computePose, headCenterY, flicker, DEATH } from "./poses.js";

const BUBBLES = 5; // rising off Scogg Girl's water edge

const T = GEO.torsoTop, B = GEO.torsoBottom;
const EMBERS = 5;
const WATER = 0.48;  // Scogg Girl's water is see-through
const LINE = { boy: 0x2a0703, girl: 0x050c1e }; // outlines: the element's own darkest tone, same weight as the stone's

export class Hero extends Phaser.GameObjects.Container {
  /** @param {"boy"|"girl"} who */
  constructor(scene, x, y, who) {
    super(scene, x, y);
    this.who = who;
    this.c = PAL[who];
    this.facing = 1;
    this.kind = "idle";
    this.poseT = 0;
    this.tick = 0;
    this.glow = scene.add.image(0, -24, `glow-${who}`).setBlendMode(Phaser.BlendModes.ADD);
    this.fx = scene.add.graphics();            // death embers / ink splash, behind the figure
    this.embers = who === "boy" ? Array.from({ length: EMBERS }, () => scene.add.image(0, 0, "ember-dollar").setScale(0.5)) : [];
    this.rig = scene.add.container(0, 0);
    this.gBack = scene.add.graphics();         // flame ring / water hood, behind the face
    this.gBody = scene.add.graphics();
    this.gFrame = scene.add.graphics();        // rim glow + dark frame around the face
    this.face = scene.add.image(0, 0, `face-${who}`);
    this.faceScale = GEO.faceW / (this.face.width - 2.5); // texture has ~1.25 px of transparent margin
    this.face.setScale(this.faceScale);
    this.line = LINE[who];
    if (who === "boy") this.gFrame
      .lineStyle(1, this.c.rim, 0.55).strokeEllipse(0, 0, (FACE_RX + 1.5) * 2, (FACE_RY + 1.5) * 2, 40)
      .lineStyle(GEO.frame, this.line, 1).strokeEllipse(0, 0, (FACE_RX + 0.5) * 2, (FACE_RY + 0.5) * 2, 40);
    this.rig.add([this.gBack, this.gBody, this.gFrame, this.face]);
    this.add([this.glow, this.fx, ...this.embers, this.rig]);
    scene.add.existing(this);
    this.setPose("idle", 0, 0);
  }

  /** Switch pose (restarts its clock if it's a different pose). */
  play(kind) {
    if (kind !== this.kind) { this.kind = kind; this.poseT = 0; }
  }

  /** Advance by dt seconds of simulation time and redraw. */
  tickPose(dt, tick, speed = 1) {
    this.poseT += dt;
    this.setPose(this.kind, this.poseT, tick, speed);
  }

  get deathDone() { return this.kind === "death" && this.poseT >= DEATH.total; }

  setPose(kind, t, tick = t, speed = 1) {
    this.kind = kind;
    this.poseT = t;
    this.tick = tick;
    const p = computePose(kind, t, { tick, facing: this.facing, speed });
    this.lastPose = p;
    this.drawPose(p);
  }

  drawPose(p) {
    this.rig.setPosition(p.rootDX, p.rootDY).setRotation(p.rootRot);
    const hy = headCenterY(p);
    for (const part of [this.gFrame, this.face, this.gBack]) part.setPosition(0, hy).setRotation(p.headRot);
    this.face.setScale(this.faceScale).setVisible(p.faceShown);
    this.gFrame.setVisible(p.faceShown);
    this.gBody.alpha = this.gBack.alpha = p.bodyAlpha;
    const flick = this.who === "boy" ? 0.06 * Math.sin(this.tick * 13) : 0;
    this.glow.setAlpha(Math.max(0, Math.min(1, 0.5 * p.glow + flick))).setScale(1.25 * Math.max(0.3, p.glow));
    this.drawBody(p);
    if (this.who === "boy") this.drawFlameRing(p); else { this.gBack.clear(); this.drawWaterHead(p); }
    this.drawParticles(p, hy);
  }

  // ---------------------------------------------------------------- body
  drawBody(p) {
    if (this.who === "girl") return this.drawWaterBody(p);
    const g = this.gBody.clear();
    const f = this.facing, sx = p.sx, sy = p.sy, tick = this.tick, fire = this.who === "boy", c = this.c, line = this.line;
    const S = (x, y) => ({ x: x * sx, y: y * sy });
    const outer = fire ? c.deep : c.ink, mid = fire ? c.red : c.blue;

    // limbs: short and thick, a flame tongue or a rounded rush of water
    const limb = (x, y, ang, len, w0, w1, color, inner) => {
      const a = { x: x * sx, y: y * sy };
      const b = { x: a.x + Math.sin(ang) * len * f, y: a.y + Math.cos(ang) * len * sy };
      taper(g, a, b, w0, w1, color, line, !fire, inner);
      return b;
    };
    limb(-GEO.shoulderX * f, GEO.shoulderY, p.arms[0], GEO.armLen, GEO.armW, 2.4, outer, null);
    [-1, 1].forEach((side, i) => limb(side * GEO.hipX * f, GEO.hipY, p.legs[i], GEO.legLen, GEO.legW, fire ? 1 : 2.4, i ? mid : outer, fire && i ? c.orange : null));

    // torso
    const base = fire
      ? [[-6, T], [-11, T + 3], [-11, T + 8], [-8.5, T + 13], [-5.5, B], [-2.5, B + 1.5], [2.5, B + 1.5], [5.5, B], [8.5, T + 13], [11, T + 8], [11, T + 3], [6, T]]
      : [[-6, T], [-10, T + 3], [-10.5, T + 9], [-9.5, T + 14], [-11.5, B + 1], [-7, B + 2.5], [-2, B + 1.2], [2, B + 1.2], [7, B + 2.5], [11.5, B + 1], [9.5, T + 14], [10.5, T + 9], [10, T + 3], [6, T]];
    const cy = (T + B) / 2;
    const half = base.length / 2;
    const ring = (k, dy = 0) => {
      const pts = [];
      base.forEach(([x, y], i) => {
        const sideX = x < 0 ? -1 : 1;
        const rip = fire ? 0 : 1.1 * Math.sin(tick * 2.4 + y * 0.5 + (i < half ? 0 : 2));
        pts.push(S((x + (Math.abs(x) > 8 ? rip * sideX : 0)) * k, cy + (y - cy) * k + dy));
        if (fire && i < base.length - 1 && Math.abs(x) > 5 && Math.abs(base[i + 1][0]) > 5 && Math.sign(base[i + 1][0]) === sideX && y > T) {
          // a tongue of flame licking out and up between two edge points
          const [nx, ny] = base[i + 1];
          const lick = (1.6 + 2.4 * Math.max(0, flicker(tick, i * 3) - 0.8)) * k;
          pts.push(S(((x + nx) / 2 + sideX * lick) * k, cy + ((y + ny) / 2 - cy) * k - 2.6 * k + dy));
        }
      });
      return pts;
    };
    fillOutlined(g, ring(1), outer, line, 1.2);
    g.fillStyle(mid, 1).fillPoints(ring(0.8, 0.6), true);
    if (fire) {
      g.fillStyle(c.orange, 1).fillPoints(ring(0.55, 2), true);
      g.fillStyle(c.gold, 0.55).fillEllipse(0, (T + 12) * sy, 5 * sx, 8 * sy, 14);
      for (const [i, sgn] of [[0, -1], [1, 1]]) {     // flames off the shoulders
        const h = 5 * flicker(tick, i + 4);
        const bx = sgn * 8.5 * sx, by = (T + 2) * sy;
        flame(g, bx, by, bx + sgn * 1.5 - f * 1.5, by - h, 3, line, outer, mid, c.orange);
      }
    }
    // the subject mark, faint, glowing in the chest
    const mx = 0, my = (T + 9) * sy;
    g.fillStyle(c.mark, 0.12).fillCircle(mx, my, 5.5);
    g.lineStyle(1.1, c.mark, 0.5).beginPath();
    g.moveTo(mx - 3.2, my - 3); g.lineTo(mx + 3.2, my + 3);     // demand
    g.moveTo(mx - 3.2, my + 3); g.lineTo(mx + 3.2, my - 3);     // supply
    g.strokePath();
    limb(GEO.shoulderX * f, GEO.shoulderY, p.arms[1], GEO.armLen, GEO.armW, 2.4, mid, fire ? c.orange : null);
  }

  // ---------------------------------------------------------------- Scogg Boy: a frame of flame + crown
  drawFlameRing(p) {
    const g = this.gBack.clear();
    const f = this.facing, tick = this.tick, c = this.c, line = this.line;
    const trail = -f * Math.max(0, -p.sway) * 0.55;
    const N = 17;
    const tongues = [];
    for (let i = 0; i < N; i++) {
      const a = Math.PI * (0.8 + 1.4 * (i / (N - 1)));   // from the jaw on one side, over the top, to the other
      const up = Math.max(0, -Math.sin(a));
      const bx = Math.cos(a) * (FACE_RX + 1), by = Math.sin(a) * (FACE_RY + 1);
      let h = (4 + 9 * up * up) * flicker(tick, i);
      if (i >= 7 && i <= 9) h += 8 * flicker(tick, i + 9);  // the tall crown
      const dx = Math.cos(a) * 0.7 + trail, dy = Math.sin(a) * 0.5 - 1.1 * (p.sway > 0 ? 1 + p.sway : 1);
      const L = Math.hypot(dx, dy);
      tongues.push({ bx, by, tx: bx + (dx / L) * h, ty: by + (dy / L) * h, w: 3.4 + 1.6 * up });
    }
    // the face sits in a continuous frame of fire; tongues lick out of it, then three color layers
    g.fillStyle(line, 1).fillEllipse(0, 0, (FACE_RX + 4.6) * 2, (FACE_RY + 4.4) * 2, 36);
    for (const t of tongues) teardrop(g, t.bx, t.by, t.tx, t.ty, t.w + 0.9, line);
    g.fillStyle(c.deep, 1).fillEllipse(0, 0, (FACE_RX + 3.6) * 2, (FACE_RY + 3.4) * 2, 36);
    for (const t of tongues) teardrop(g, t.bx, t.by, t.tx, t.ty, t.w, c.deep);
    g.fillStyle(c.red, 1).fillEllipse(0, 0, (FACE_RX + 2.4) * 2, (FACE_RY + 2.2) * 2, 36);
    for (const t of tongues) teardrop(g, t.bx * 0.97, t.by * 0.97, t.bx + (t.tx - t.bx) * 0.72, t.by + (t.ty - t.by) * 0.72, t.w * 0.66, c.red);
    for (const t of tongues) teardrop(g, t.bx * 0.95, t.by * 0.95, t.bx + (t.tx - t.bx) * 0.45, t.by + (t.ty - t.by) * 0.45, t.w * 0.38, c.gold);
  }

  // ---------------------------------------------------------------- Scogg Girl: a body of clear moving water
  drawWaterBody(p) {
    const g = this.gBody.clear();
    const f = this.facing, sx = p.sx, sy = p.sy, tick = this.tick, c = this.c, line = this.line;
    const limb = (x, y, ang, len, w0, w1, front) => {
      const a = { x: x * sx, y: y * sy };
      const b = { x: a.x + Math.sin(ang) * len * f, y: a.y + Math.cos(ang) * len * sy };
      waterLimb(g, a, b, w0, w1, c, line, front);
    };
    limb(-GEO.shoulderX * f, GEO.shoulderY, p.arms[0], GEO.armLen, GEO.armW, 3, false);
    [-1, 1].forEach((side, i) => limb(side * GEO.hipX * f, GEO.hipY, p.legs[i], GEO.legLen, GEO.legW, 3.2, i === 1));

    // the torso: one smooth shape of water, its sides rippling, its hem rolling
    const hw = (y) => {           // half-width down the body
      const k = (y - T) / (B - T);
      return k < 0.2 ? 6 + 20 * k : 10 - 1.2 * Math.sin(Math.PI * k) + 1.5 * Math.max(0, k - 0.7) / 0.3;
    };
    const left = [], right = [];
    for (let y = T; y <= B + 0.01; y += 2) {
      const rip = 0.75 * Math.sin(y * 0.45 + tick * 2.6);
      left.push({ x: (-hw(y) - rip) * sx, y: y * sy });
      right.push({ x: (hw(y) + 0.75 * Math.sin(y * 0.45 + tick * 2.6 + 2)) * sx, y: y * sy });
    }
    const hem = [];
    for (let x = -10.5; x <= 10.5; x += 1.5) hem.push({ x: x * sx, y: (B + 1.6 + 0.7 * Math.sin(x * 0.55 - tick * 3.1)) * sy });
    const torso = [...left, ...hem, ...right.reverse()];
    g.fillStyle(c.blue, WATER).fillPoints(torso, true);
    g.fillStyle(c.light, 0.22).fillPoints(torso.filter((q) => q.y < (T + 10) * sy).concat([{ x: 8 * sx, y: (T + 12) * sy }, { x: -8 * sx, y: (T + 12) * sy }]).sort((m, n) => Math.atan2(m.y - (T + 6) * sy, m.x) - Math.atan2(n.y - (T + 6) * sy, n.x)), true); // light coming down through the top
    g.fillStyle(c.ink, 0.3).fillPoints(torso.map((q) => ({ x: q.x * 0.68, y: (T + 12) * sy + (q.y - (T + 12) * sy) * 0.72 })), true); // deeper water in the middle
    g.lineStyle(1.1, line, 0.7).strokePoints(torso, true, true);
    g.lineStyle(0.7, c.light, 0.55).strokePoints(torso.map((q) => ({ x: q.x * 0.9, y: (T + 10) * sy + (q.y - (T + 10) * sy) * 0.95 })), true, true); // the surface catching light
    // light catching the front edge, and a glint at the shoulder
    g.lineStyle(1, c.foam, 0.5).strokePoints(left.slice(1, -2).map((q) => ({ x: q.x + 1.6 * sx, y: q.y })), false, false);
    g.lineStyle(1.2, c.shine, 0.75).beginPath(); g.arc(-4 * sx, (T + 7) * sy, 4, Math.PI * 1.08, Math.PI * 1.5); g.strokePath();

    // light moving through the water: wavy caustic lines drifting up, bubbles rising, sparkles
    for (let i = 0; i < 2; i++) {
      const ph = (tick * 0.3 + i * 0.5) % 1;
      const y = B - 2 - ph * (B - T - 5);
      const w = hw(y) - 2.2, a = 0.5 * Math.sin(Math.PI * ph);
      const pts = [];
      for (let x = -w; x <= w * 0.6; x += 1.2) pts.push({ x: x * sx, y: (y + 0.9 * Math.sin(x * 0.8 + tick * 3.3 + i * 2)) * sy });
      g.lineStyle(0.8, c.shine, a).strokePoints(pts, false, false);
    }
    for (let i = 0; i < 3; i++) {
      const ph = (tick * 0.42 + i * 0.33) % 1;
      const x = ((i - 1) * 4.2 + 0.8 * Math.sin(tick * 2.6 + i * 2)) * sx, y = (B - 1 - ph * (B - T - 4)) * sy;
      const r = 0.5 + 0.55 * ph;
      g.lineStyle(0.6, c.shine, 0.75 * Math.sin(Math.PI * ph)).strokeCircle(x, y, r);
    }
    for (let i = 0; i < 5; i++) {
      const tw = Math.max(0, Math.sin(tick * (2.1 + i * 0.37) + i * 1.9));
      const x = (((i * 4.7) % 13) - 6.5) * sx, y = (T + 4 + ((i * 7.3) % (B - T - 6))) * sy;
      if (tw > 0.6) g.fillStyle(c.shine, (tw - 0.6) * 2).fillCircle(x, y, 0.5 + 0.4 * tw);
    }
    // small ink drops curling down through it
    for (let i = 0; i < 2; i++) {
      const ph = (tick * 0.18 + i * 0.5) % 1;
      const x = ((i ? 3.5 : -4) + Math.sin(tick * 0.7 + i * 2)) * sx, y = (T + 5 + ph * (B - T - 5)) * sy;
      g.fillStyle(c.deep, 0.5 * Math.sin(Math.PI * ph)).fillCircle(x, y, 1.1).fillTriangle(x - 1, y - 0.3, x + 1, y - 0.3, x + 0.3 * Math.sin(tick * 2 + i), y - 3.4);
    }
    // the subject mark: a faint white star
    const my = (T + 9) * sy;
    g.fillStyle(c.mark, 0.1).fillCircle(0, my, 5.5);
    g.fillStyle(c.mark, 0.55).fillPoints(starPts(0, my, 3.4, 1.4), true);

    // drips: a bead swells at the hem, lets go, falls and splashes; then a new one forms
    const grounded = this.kind !== "jump" && this.kind !== "fall";
    [-5.5, 1, 6.5].forEach((dx, i) => {
      const ph = (tick / 1.7 + i * 0.37) % 1;
      const x = dx * sx, y0 = (B + 1.8) * sy;
      if (ph < 0.5) {
        const k = ph / 0.5, r = 0.5 + 1.0 * k, hang = 1.4 * k * k;
        g.fillStyle(c.blue, WATER + 0.15).fillEllipse(x, y0 + hang, r * 2, (r + hang * 0.5) * 2, 10);
        g.fillStyle(c.shine, 0.7).fillCircle(x - r * 0.35, y0 + hang - r * 0.3, 0.35 + r * 0.25);
      } else if (ph < 0.8) {
        const k = (ph - 0.5) / 0.3, y = y0 + 2 + (-y0 - 2) * k * k;
        g.fillStyle(c.blue, WATER + 0.15).fillPoints(teardropPts(x, y, x, y - 3.2, 1.2), true);
        g.fillStyle(c.shine, 0.7).fillCircle(x - 0.4, y - 0.5, 0.45);
      } else if (grounded) {
        const k = (ph - 0.8) / 0.2;
        g.lineStyle(0.8, c.light, 0.7 * (1 - k)).strokeEllipse(x, -0.6, 2 + 6 * k, 0.8 + 1.2 * k, 12);
      }
    });
    limb(GEO.shoulderX * f, GEO.shoulderY, p.arms[1], GEO.armLen, GEO.armW, 3, true);
  }

  /**
   * Her head of water: an uneven, gently moving water edge around the face (thin at the chin, a
   * little fuller at the top) with small bubbles rising off it. Nothing sits on top of her head:
   * every crown, stream and wave tried there read as a hat. Drawn under the face, never over it.
   */
  drawWaterHead(p) {
    const g = this.gFrame.clear();
    const tick = this.tick, c = this.c, line = this.line;

    const NE = 64, edge = [];
    for (let i = 0; i < NE; i++) {
      const a = (i / NE) * Math.PI * 2;
      const crown = Math.max(0, -Math.sin(a)), chin = Math.max(0, Math.sin(a));
      const r = 1.5 + 0.6 * crown - 0.6 * chin
        + 0.9 * Math.sin(3 * a + tick * 0.9 + 1.3) + 0.5 * Math.sin(5 * a - tick * 1.3) + 0.25 * Math.sin(11 * a + tick * 2.1);
      edge.push({ x: Math.cos(a) * (FACE_RX + Math.max(0.9, r)), y: Math.sin(a) * (FACE_RY + Math.max(0.9, r)) });
    }
    g.lineStyle(1.2, line, 0.25).strokePoints(edge, true, true);
    g.fillStyle(c.blue, 0.5).fillPoints(edge, true);
    // light travelling round the edge, both ways
    for (const [speed, len, off] of [[5, 9, 0], [-3.5, 6, NE / 2]]) {
      const k = Math.floor(((tick * speed + off) % NE + NE) % NE);
      g.lineStyle(1, c.shine, 0.75).strokePoints(Array.from({ length: len }, (_, j) => edge[(k + j) % NE]), false, false);
    }
    // small bubbles leave the upper edge and rise, wobbling, until they pop
    for (let i = 0; i < BUBBLES; i++) {
      const ph = (tick * (0.42 + 0.07 * (i % 3)) + i / BUBBLES) % 1;
      const a = -Math.PI / 2 + (((i * 0.618) % 1) * 2 - 1) * 1.15;          // somewhere on the top half
      const x0 = Math.cos(a) * (FACE_RX + 1.8), y0 = Math.sin(a) * (FACE_RY + 1.8);
      const x = x0 + Math.sin(tick * 3 + i * 1.7) * 1.2 * ph, y = y0 - 15 * ph;
      const r = (0.7 + 0.25 * (i % 3)) * (0.7 + 0.5 * ph), alpha = Math.sin(Math.PI * Math.min(1, ph * 1.15));
      g.lineStyle(0.6, c.light, 0.8 * alpha).strokeCircle(x, y, r);
      g.fillStyle(c.blue, 0.35 * alpha).fillCircle(x, y, r);
      g.fillStyle(c.shine, 0.8 * alpha).fillCircle(x - 0.35 * r, y - 0.35 * r, r * 0.3);
    }
    // a short soft glint of cold light at the top front of the face (not a full ring: that read as a helmet)
    const f = this.facing, ac = -Math.PI / 2 + f * Math.PI / 4 + 0.15 * Math.sin(tick * 0.8);
    g.lineStyle(1, c.rim, 0.45).beginPath();
    for (let k = 0; k <= 8; k++) {
      const a = ac - 0.45 + (k / 8) * 0.9;
      if (k) g.lineTo(Math.cos(a) * (FACE_RX + 1.3), Math.sin(a) * (FACE_RY + 1.3)); else g.moveTo(Math.cos(a) * (FACE_RX + 1.3), Math.sin(a) * (FACE_RY + 1.3));
    }
    g.strokePath();
    g.lineStyle(GEO.frame, line, 1).strokeEllipse(0, 0, (FACE_RX + 0.5) * 2, (FACE_RY + 0.5) * 2, 40);
  }

  // ---------------------------------------------------------------- embers, ink, death
  drawParticles(p, hy) {
    const tick = this.tick, f = this.facing;
    this.embers.forEach((e, i) => {
      const ph = (tick * 0.45 + i / EMBERS + (i * 0.37) % 0.2) % 1;
      const show = p.burst < 0 && this.kind !== "win" ? 1 : 0;
      e.setPosition(((i * 37) % 11 - 5) * 1.7 + Math.sin(tick * 1.6 + i) * 2.5, -12 - ph * 50).setAlpha(show * 0.85 * Math.sin(Math.PI * ph));
    });
    const g = this.fx.clear();
    if (p.burst < 0) return;
    const b = p.burst, c = this.c;
    if (this.who === "boy") {
      // crumbling into embers that rise and go out
      for (let i = 0; i < 18; i++) {
        const a = -Math.PI / 2 + ((i * 2.399) % 2.6) - 1.3;
        const v = 18 + ((i * 53) % 17);
        const x = Math.cos(a) * v * b * 1.1 + Math.sin(tick * 4 + i) * 2;
        const y = -18 + Math.sin(a) * v * b * 0.6 - 26 * b;
        g.fillStyle(i % 3 ? c.orange : c.gold, (1 - b) * 0.95).fillCircle(x, y, 0.6 + 1.8 * (1 - b));
      }
      g.fillStyle(c.deep, 0.8 * (1 - b)).fillEllipse(0, -1, 16 + 6 * b, 3, 12);   // the last coals
    } else {
      // splashing into ink: drops arc out and fall, a puddle spreads and soaks away
      for (let i = 0; i < 16; i++) {
        const dir = ((i * 0.618) % 1) * 2 - 1;
        const x = dir * (14 + (i % 4) * 6) * b;
        const y = -10 - (34 + (i % 3) * 10) * b + 70 * b * b;
        if (y < 2) g.fillStyle(i % 2 ? c.light : c.blue, 1 - b).fillCircle(x, y, 1 + 1.4 * (1 - b));
      }
      g.fillStyle(c.ink, 0.9 * (1 - b * b)).fillEllipse(f * 0, -1, 18 + 22 * Math.min(1, b * 2), 4, 16);
      g.fillStyle(c.light, 0.4 * (1 - b)).fillEllipse(-3, -1.8, 8 + 10 * b, 1.2, 10);
    }
  }
}

// ------------------------------------------------------------------ drawing helpers

function fillOutlined(g, pts, fill, line, lw) {
  g.fillStyle(fill, 1).fillPoints(pts, true);
  g.lineStyle(lw, line, 1).strokePoints(pts, true, true);
}

/** A limb that tapers from w0 to w1, outlined; round = water (rounded tip), else a flame point. */
function taper(g, a, b, w0, w1, fill, line, round, inner) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const tip = round ? b : { x: b.x + (dx / L) * 2.2, y: b.y + (dy / L) * 2.2 };
  const pts = [
    { x: a.x + nx * w0 / 2, y: a.y + ny * w0 / 2 }, { x: b.x + nx * w1 / 2, y: b.y + ny * w1 / 2 },
    tip,
    { x: b.x - nx * w1 / 2, y: b.y - ny * w1 / 2 }, { x: a.x - nx * w0 / 2, y: a.y - ny * w0 / 2 },
  ];
  g.fillStyle(line, 1).fillCircle(a.x, a.y, w0 / 2 + 0.7);
  if (round) g.fillCircle(b.x, b.y, w1 / 2 + 0.7);
  g.lineStyle(1.4, line, 1).strokePoints(pts, true, true);
  g.fillStyle(fill, 1).fillPoints(pts, true).fillCircle(a.x, a.y, w0 / 2);
  if (round) g.fillCircle(b.x, b.y, w1 / 2);
  if (inner) g.fillStyle(inner, 1).fillPoints([{ x: a.x + nx * w0 / 5, y: a.y + ny * w0 / 5 }, { x: a.x + (dx / L) * L * 0.75, y: a.y + (dy / L) * L * 0.75 }, { x: a.x - nx * w0 / 5, y: a.y - ny * w0 / 5 }], true);
}

/** Points of a teardrop: round end of radius r at (cx, cy), point at (tx, ty). */
function teardropPts(cx, cy, tx, ty, r) {
  const a = Math.atan2(ty - cy, tx - cx);
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = a + Math.PI / 2 + (i / 10) * Math.PI;
    pts.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
  }
  pts.push({ x: tx, y: ty });
  return pts;
}
function teardrop(g, cx, cy, tx, ty, r, color) {
  g.fillStyle(color, 1).fillPoints(teardropPts(cx, cy, tx, ty, r), true);
}

function flame(g, bx, by, tx, ty, w, line, outer, mid, core) {
  teardrop(g, bx, by, tx, ty, w + 0.8, line);
  teardrop(g, bx, by, tx, ty, w, outer);
  teardrop(g, bx, by, bx + (tx - bx) * 0.7, by + (ty - by) * 0.7, w * 0.6, mid);
  teardrop(g, bx, by, bx + (tx - bx) * 0.4, by + (ty - by) * 0.4, w * 0.3, core);
}

/** A limb of water: see-through, rounded at both ends, light along its front edge. */
function waterLimb(g, a, b, w0, w1, c, line, front) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const pts = [
    { x: a.x + nx * w0 / 2, y: a.y + ny * w0 / 2 }, { x: b.x + nx * w1 / 2, y: b.y + ny * w1 / 2 },
    { x: b.x - nx * w1 / 2, y: b.y - ny * w1 / 2 }, { x: a.x - nx * w0 / 2, y: a.y - ny * w0 / 2 },
  ];
  g.fillStyle(line, 0.6).fillCircle(b.x, b.y, w1 / 2 + 0.7);
  g.lineStyle(1.1, line, 0.6).strokePoints(pts, true, true);
  g.fillStyle(front ? c.blue : c.ink, WATER).fillPoints(pts, true).fillCircle(b.x, b.y, w1 / 2);
  g.lineStyle(0.8, c.foam, front ? 0.55 : 0.3).lineBetween(a.x + nx * w0 * 0.25, a.y + ny * w0 * 0.25, b.x + nx * w1 * 0.2, b.y + ny * w1 * 0.2);
}

function starPts(cx, cy, R, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
  }
  return pts;
}

/** What the tests check about a face: never flipped, tinted, faded or scaled unevenly, and drawn on top. */
/** Sweep every pose over time on each hero and report any frame where a face check fails (tests). */
export function sweepPoses(heroes) {
  const bad = [];
  for (const h of heroes) {
    const facing0 = h.facing;
    for (const facing of [1, -1]) {
      h.facing = facing;
      for (const kind of ["idle", "run", "jump", "fall", "land", "death", "win"]) {
        for (let f = 0; f <= 90; f++) {
          h.setPose(kind, f / 60, f / 60);
          const c = faceCheck(h);
          if (!c.uniform || c.flipped || c.tinted || !c.opaque || !c.onTop || !c.rigUniform) bad.push({ kind, f, facing, ...c });
        }
      }
    }
    h.facing = facing0;
  }
  return bad;
}

export function faceCheck(h) {
  const f = h.face;
  return {
    who: h.who,
    uniform: Math.abs(f.scaleX - f.scaleY) < 1e-9,
    flipped: f.flipX || f.flipY,
    tinted: !!f.isTinted,
    opaque: f.alpha === 1,
    onTop: h.rig.list[h.rig.list.length - 1] === f,
    rigUniform: Math.abs(h.rig.scaleX - h.rig.scaleY) < 1e-9 && Math.abs(h.scaleX - h.scaleY) < 1e-9,
  };
}
