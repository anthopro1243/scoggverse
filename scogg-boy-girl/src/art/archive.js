// "The Scoggins Archive": a dark neoclassical hall under the school. Each level is drawn with
// Canvas 2D into a few textures: two parallax layers, the stone tiles, the colored light that the
// pools and doors cast, and a vignette. Dust drifts in the light. Macro wing: basalt, bronze, gears,
// glowing carved graphs. Gov wing: dark marble, fluted columns, a dome, Article I-III panels.
import Phaser from "phaser";
import { PAL, css, rgba, SERIF } from "./palette.js";
import { TILE, WORLD_W, WORLD_H } from "../logic/config.js";
import { createRng } from "../logic/rng.js";
import { DOOR, PROP_RES, mottoSign } from "./textures.js";
import { mottoRect } from "../logic/motto.js";
import { prefs } from "../prefs.js";

const OV = 24; // parallax overscan, world units

export const DEPTH = { far: 0, mid: 1, tiles: 2, light: 3, vignette: 4, dust: 5, doors: 6, items: 7, heroes: 10, pools: 12, ui: 20 };

/**
 * @param {Phaser.Scene} scene
 * @param {ReturnType<import("../logic/grid.js").parseGrid>} grid
 * @param {{wings: {x:number,y:number,w:number,h:number,wing:"macro"|"gov"}[], seed?: string, rs: number,
 *          doors?: {x:number,y:number,kind:"vault"|"chamber",lit?:boolean}[]}} opts  doors: bottom-center in world units
 */
export function buildArchive(scene, grid, { wings, seed = "archive", rs, doors = [] }) {
  const key = `archive-${scene.sys.settings.key}`; // one set per scene, replaced when the next level builds its own
  const wingAt = (x, y) => (wings.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) || wings[0]).wing;
  const layer = (name, draw, overscan, depth, blend) => {
    const cv = document.createElement("canvas");
    cv.width = Math.round((WORLD_W + 2 * overscan) * rs);
    cv.height = Math.round((WORLD_H + 2 * overscan) * rs);
    const ctx = cv.getContext("2d");
    ctx.scale(rs, rs);
    ctx.translate(overscan, overscan);
    draw(ctx, createRng(`${seed}-${name}`));
    if (scene.textures.exists(`${key}-${name}`)) scene.textures.remove(`${key}-${name}`);
    scene.textures.addCanvas(`${key}-${name}`, cv);
    const img = scene.add.image(-overscan, -overscan, `${key}-${name}`).setOrigin(0).setScale(1 / rs).setDepth(depth);
    if (blend) img.setBlendMode(blend);
    return img;
  };
  const far = layer("far", (ctx, rng) => wings.forEach((r) => region(ctx, r, OV, () => (r.wing === "macro" ? macroFar : govFar)(ctx, r, rng))), OV, DEPTH.far);
  const mid = layer("mid", (ctx, rng) => wings.forEach((r) => region(ctx, r, OV, () => (r.wing === "macro" ? macroMid : govMid)(ctx, r, rng))), OV, DEPTH.mid);
  layer("tiles", (ctx, rng) => drawTiles(ctx, grid, wingAt, rng), 0, DEPTH.tiles);
  const lights = staticLights(grid, doors);
  layer("light", (ctx) => drawLights(ctx, lights), 0, DEPTH.light, Phaser.BlendModes.ADD);
  layer("vignette", drawVignette, 0, DEPTH.vignette);

  const doorObjs = doors.map((d) => new Door(scene, d));
  // one carved motto sign over both exits
  const motto = mottoRect(doors, DOOR);
  if (motto) {
    if (scene.textures.exists(`${key}-motto`)) scene.textures.remove(`${key}-motto`);
    scene.textures.addCanvas(`${key}-motto`, mottoSign(motto.w));
    scene.add.image(motto.x, motto.y, `${key}-motto`).setOrigin(0).setScale(1 / PROP_RES).setDepth(DEPTH.doors);
  }
  const dust = new Dust(scene, wingAt, lights);

  return {
    doors: doorObjs,
    motto,
    wingAt,
    /** Parallax from the heroes' average position, and dust in the light (both held still with reduce motion). */
    update(tick, heroes = []) {
      if (prefs.get("reduceMotion")) {
        far.setPosition(-OV, -OV); mid.setPosition(-OV, -OV);
        dust.draw(0, heroes);
        return;
      }
      const ax = heroes.length ? heroes.reduce((s, h) => s + h.x, 0) / heroes.length : WORLD_W / 2;
      const ay = heroes.length ? heroes.reduce((s, h) => s + h.y, 0) / heroes.length : WORLD_H / 2;
      far.setPosition(-OV - (ax - WORLD_W / 2) * 0.02, -OV - (ay - WORLD_H / 2) * 0.015);
      mid.setPosition(-OV - (ax - WORLD_W / 2) * 0.045, -OV - (ay - WORLD_H / 2) * 0.03);
      dust.draw(tick, heroes);
    },
  };
}

function region(ctx, r, ov, draw) {
  ctx.save();
  ctx.beginPath();
  // regions on the screen edge extend into the overscan
  const x0 = r.x <= 0 ? -ov : r.x, y0 = r.y <= 0 ? -ov : r.y;
  const x1 = r.x + r.w >= WORLD_W ? WORLD_W + ov : r.x + r.w, y1 = r.y + r.h >= WORLD_H ? WORLD_H + ov : r.y + r.h;
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  draw();
  ctx.restore();
}

// ------------------------------------------------------------------------------------ far layers

function macroFar(ctx, r, rng) {
  const M = PAL.macro;
  sky(ctx, r, M.skyTop, M.skyBottom);
  // vault arches along the back wall
  const archW = 128, spring = r.y + r.h * 0.42;
  for (let x = r.x - 40; x < r.x + r.w + 60; x += archW + 18) {
    ctx.fillStyle = css(M.far);
    ctx.beginPath(); ctx.moveTo(x, r.y + r.h + 30); ctx.lineTo(x, spring); ctx.arc(x + archW / 2, spring, archW / 2, Math.PI, 0); ctx.lineTo(x + archW, r.y + r.h + 30); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.moveTo(x + 8, r.y + r.h + 30); ctx.lineTo(x + 8, spring); ctx.arc(x + archW / 2, spring, archW / 2 - 8, Math.PI, 0); ctx.lineTo(x + archW - 8, r.y + r.h + 30); ctx.fill();
  }
  // giant gears in the dark
  for (let i = 0; i < 2; i++) {
    gear(ctx, r.x + r.w * (0.22 + 0.55 * i) + rng.range(-30, 30), r.y + r.h * (0.3 + 0.25 * i), 58 + 30 * i, 14 + 4 * i, css(M.farLit, 0.55), rng.range(0, 1));
  }
  shaft(ctx, r.x + r.w * 0.62, r.y, r.h, [255, 190, 120], 0.05);
}

function govFar(ctx, r, rng) {
  const G = PAL.gov;
  sky(ctx, r, G.skyTop, G.skyBottom);
  // the dome, far above: coffered rings and ribs
  const cx = r.x + r.w / 2, cy = r.y + r.h * 0.62, R = Math.min(r.w * 0.42, 260);
  ctx.strokeStyle = css(G.farLit, 0.9);
  for (let k = 0; k < 5; k++) { ctx.lineWidth = 3 - k * 0.4; ctx.beginPath(); ctx.arc(cx, cy, R - k * 34, Math.PI, 0); ctx.stroke(); }
  ctx.lineWidth = 2;
  for (let i = 1; i < 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R - 136), cy + Math.sin(a) * (R - 136)); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
  }
  // a distant colonnade
  const base = r.y + r.h;
  for (let x = r.x + rng.range(0, 20); x < r.x + r.w; x += 38) {
    ctx.fillStyle = css(G.far); ctx.fillRect(x, cy - 10, 12, base - cy + 10);
    ctx.fillStyle = css(G.farLit, 0.7); ctx.fillRect(x, cy - 10, 2, base - cy + 10);
  }
  ctx.fillStyle = css(G.far); ctx.fillRect(r.x, cy - 18, r.w, 9);
  shaft(ctx, cx, r.y, r.h, [150, 190, 255], 0.06); // light from the oculus
}

function sky(ctx, r, top, bottom) {
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, css(top)); g.addColorStop(1, css(bottom));
  ctx.fillStyle = g;
  ctx.fillRect(r.x - OV, r.y - OV, r.w + 2 * OV, r.h + 2 * OV);
}

function shaft(ctx, x, y, h, color, a) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - 18, y - OV); ctx.lineTo(x + 18, y - OV); ctx.lineTo(x + 70, y + h); ctx.lineTo(x - 70, y + h); ctx.fill();
}

function gear(ctx, cx, cy, R, teeth, color, rot) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = rot + (i / (teeth * 2)) * Math.PI * 2, a1 = rot + ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? R : R + 9;
    ctx.lineTo(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr);
    ctx.lineTo(cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr);
  }
  ctx.closePath();
  ctx.arc(cx, cy, R * 0.45, 0, Math.PI * 2, true);
  ctx.fill("evenodd");
}

// ------------------------------------------------------------------------------------ mid layers

function macroMid(ctx, r, rng) {
  const M = PAL.macro;
  // basalt pillars with bronze bands
  const n = Math.max(2, Math.round(r.w / 240));
  for (let i = 0; i <= n; i++) {
    const x = r.x + (i / n) * r.w - 14;
    const g = ctx.createLinearGradient(x, 0, x + 28, 0);
    g.addColorStop(0, css(M.midLit)); g.addColorStop(0.35, css(M.mid)); g.addColorStop(1, "#120e0a");
    ctx.fillStyle = g; ctx.fillRect(x, r.y - OV, 28, r.h + 2 * OV);
    ctx.fillStyle = css(M.trim, 0.55);
    for (const by of [r.y + 18, r.y + r.h - 40]) { ctx.fillRect(x - 3, by, 34, 6); ctx.fillStyle = css(M.trimLit, 0.35); ctx.fillRect(x - 3, by, 34, 1); ctx.fillStyle = css(M.trim, 0.55); }
  }
  // carvings between the pillars: the giant coin, and the graphs glowing faintly in the stone
  const slots = [];
  for (let i = 0; i < n; i++) slots.push(r.x + ((i + 0.5) / n) * r.w);
  const carvings = [coinCarving, sdCarving, ppcCarving, cycleCarving];
  const start = rng.int(0, 3);
  slots.forEach((cx, i) => carvings[(start + i) % carvings.length](ctx, cx, r.y + r.h * 0.38, Math.min(r.h * 0.28, 70)));
}

function panel(ctx, cx, cy, w, h, carve) {
  ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.strokeStyle = css(carve, 0.18); ctx.lineWidth = 1; ctx.strokeRect(cx - w / 2 + 0.5, cy - h / 2 + 0.5, w - 1, h - 1);
}

function glowLine(ctx, color, draw) {
  ctx.save();
  ctx.strokeStyle = css(color, 0.55); ctx.fillStyle = css(color, 0.55);
  ctx.shadowColor = css(color, 0.9); ctx.shadowBlur = 6;
  ctx.lineWidth = 1.6; ctx.lineCap = "round";
  draw();
  ctx.restore();
}

function coinCarving(ctx, cx, cy, s) {
  const c = PAL.macro.carve;
  ctx.strokeStyle = css(c, 0.22); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, s * 0.9, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, s * 0.76, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; ctx.fillStyle = css(c, 0.2); ctx.fillRect(cx + Math.cos(a) * s * 0.83 - 0.8, cy + Math.sin(a) * s * 0.83 - 0.8, 1.6, 1.6); }
  ctx.font = `700 ${Math.round(s * 0.95)}px ${SERIF}`; ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillText("$", cx, cy + s * 0.33);
  ctx.fillStyle = css(c, 0.16); ctx.fillText("$", cx, cy + s * 0.33 + 1);
}

function sdCarving(ctx, cx, cy, s) {
  const c = PAL.macro.carve;
  panel(ctx, cx, cy, s * 2.2, s * 1.7, c);
  const x0 = cx - s * 0.8, y0 = cy + s * 0.6, w = s * 1.6, h = s * 1.2;
  glowLine(ctx, c, () => {
    ctx.beginPath(); ctx.moveTo(x0, y0 - h); ctx.lineTo(x0, y0); ctx.lineTo(x0 + w, y0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0 + w * 0.1, y0 - h * 0.1); ctx.lineTo(x0 + w * 0.9, y0 - h * 0.9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0 + w * 0.1, y0 - h * 0.9); ctx.lineTo(x0 + w * 0.9, y0 - h * 0.1); ctx.stroke();
    ctx.font = `700 9px ${SERIF}`; ctx.textAlign = "center";
    ctx.fillText("S", x0 + w * 0.97, y0 - h * 0.92); ctx.fillText("D", x0 + w * 0.97, y0 - h * 0.02);
  });
}

function ppcCarving(ctx, cx, cy, s) {
  const c = PAL.macro.carve;
  panel(ctx, cx, cy, s * 2.2, s * 1.7, c);
  const x0 = cx - s * 0.8, y0 = cy + s * 0.6, w = s * 1.6, h = s * 1.2;
  glowLine(ctx, c, () => {
    ctx.beginPath(); ctx.moveTo(x0, y0 - h); ctx.lineTo(x0, y0); ctx.lineTo(x0 + w, y0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0 - h * 0.9); ctx.quadraticCurveTo(x0 + w * 0.85, y0 - h * 0.85, x0 + w * 0.9, y0); ctx.stroke();
    ctx.beginPath(); ctx.arc(x0 + w * 0.6, y0 - h * 0.62, 2, 0, Math.PI * 2); ctx.fill();
    ctx.font = `700 7px ${SERIF}`; ctx.textAlign = "center";
    ctx.fillText("PPC", x0 + w * 0.45, y0 - h * 0.98);
  });
}

function cycleCarving(ctx, cx, cy, s) {
  const c = PAL.macro.carve;
  panel(ctx, cx, cy, s * 2.2, s * 1.7, c);
  const x0 = cx - s * 0.9, y0 = cy + s * 0.15, w = s * 1.8;
  glowLine(ctx, c, () => {
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const u = i / 40; ctx.lineTo(x0 + u * w, y0 - Math.sin(u * Math.PI * 3) * s * 0.35 - u * s * 0.3); }
    ctx.stroke();
    ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + w, y0 - s * 0.3); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `700 6.5px ${SERIF}`; ctx.textAlign = "center";
    ctx.fillText("PEAK", x0 + w / 6, y0 - s * 0.47); ctx.fillText("TROUGH", x0 + w / 2, y0 + s * 0.3);
  });
}

function govMid(ctx, r, rng) {
  const G = PAL.gov;
  const n = Math.max(2, Math.round(r.w / 200));
  const top = r.y + 10, bottom = r.y + r.h + OV;
  // arches between fluted columns
  for (let i = 0; i < n; i++) {
    const x0 = r.x + (i / n) * r.w, x1 = r.x + ((i + 1) / n) * r.w, cx = (x0 + x1) / 2, R = (x1 - x0) / 2 - 14;
    ctx.strokeStyle = css(G.midLit, 0.45); ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, top + R + 16, R, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, top + R + 16, R - 4, Math.PI, 0); ctx.stroke();
  }
  for (let i = 0; i <= n; i++) {
    const x = r.x + (i / n) * r.w - 12;
    const g = ctx.createLinearGradient(x, 0, x + 24, 0);
    g.addColorStop(0, css(G.midLit)); g.addColorStop(0.4, css(G.mid)); g.addColorStop(1, "#11151c");
    ctx.fillStyle = g; ctx.fillRect(x, top + 8, 24, bottom - top);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    for (let k = 1; k < 5; k++) ctx.fillRect(x + k * 4.8, top + 14, 1, bottom - top);
    ctx.fillStyle = css(G.midLit, 0.9); ctx.fillRect(x - 4, top, 32, 8);   // capital
    ctx.fillStyle = css(G.mid); ctx.fillRect(x - 2, top + 3, 28, 4);
  }
  // carved panels: the Constitution's structure, a scroll and a gavel
  const items = ["ARTICLE I", "ARTICLE II", "ARTICLE III", "scroll", "gavel"];
  const start = rng.int(0, 4);
  for (let i = 0; i < n; i++) {
    const cx = r.x + ((i + 0.5) / n) * r.w, cy = r.y + r.h * 0.5;
    const it = items[(start + i) % items.length];
    panel(ctx, cx, cy, 92, 46, G.carve);
    ctx.fillStyle = css(G.carve, 0.4); ctx.strokeStyle = css(G.carve, 0.4); ctx.lineWidth = 1.4;
    if (it.startsWith("ARTICLE")) {
      ctx.font = `700 11px ${SERIF}`; ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillText(it, cx, cy + 4);
      ctx.fillStyle = css(G.carve, 0.3); ctx.fillText(it, cx, cy + 4.8);
      ctx.fillRect(cx - 30, cy + 10, 60, 0.8); ctx.fillRect(cx - 30, cy - 12, 60, 0.8);
    } else if (it === "scroll") {
      ctx.strokeRect(cx - 24, cy - 12, 48, 24);
      ctx.beginPath(); ctx.arc(cx - 24, cy, 12, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + 24, cy, 12, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      for (let k = 0; k < 4; k++) ctx.fillRect(cx - 16, cy - 6 + k * 4, 32 - (k % 2) * 8, 0.8);
    } else {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.5);
      ctx.strokeRect(-14, -6, 12, 12); ctx.strokeRect(-2, -1.5, 22, 3);
      ctx.restore();
      ctx.strokeRect(cx - 18, cy + 12, 36, 5);
    }
  }
}

// ------------------------------------------------------------------------------------ tiles

function drawTiles(ctx, grid, wingAt, rng) {
  const { w, h, isSolid } = grid;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (!isSolid(c, r)) continue;
      const x = c * TILE, y = r * TILE;
      const S = PAL[wingAt(x + TILE / 2, y + TILE / 2)];
      const up = isSolid(c, r - 1), down = isSolid(c, r + 1), left = isSolid(c - 1, r), right = isSolid(c + 1, r);
      const g = ctx.createLinearGradient(0, y, 0, y + TILE);
      g.addColorStop(0, css(S.stone)); g.addColorStop(1, css(S.stoneDark));
      ctx.fillStyle = g; ctx.fillRect(x, y, TILE, TILE);
      // grain: specks for basalt, veins for marble
      for (let i = 0; i < 7; i++) { ctx.fillStyle = css(i % 2 ? S.speck : S.stoneDark, 0.8); ctx.fillRect(x + rng.range(2, TILE - 3), y + rng.range(4, TILE - 3), rng.range(0.8, 2.2), rng.range(0.6, 1.4)); }
      if (S.vein) {
        ctx.strokeStyle = css(S.vein, 0.35); ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(x, y + rng.range(6, TILE)); ctx.bezierCurveTo(x + 10, y + rng.range(0, TILE), x + 20, y + rng.range(0, TILE), x + TILE, y + rng.range(6, TILE)); ctx.stroke();
      }
      // bevel and masonry joints (big blocks, two tiles wide, staggered)
      ctx.fillStyle = css(S.stoneLit, 0.5); ctx.fillRect(x, y, 1, TILE);
      ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(x, y + TILE - 1, TILE, 1);
      if (left && (c + r) % 2 === 0) { ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y, 1.2, TILE); }
      // exposed edges: a clear lit top (bronze trim or pale marble lip), dark undersides and sides
      if (!up) {
        ctx.fillStyle = css(S.trim); ctx.fillRect(x, y, TILE, 4);
        ctx.fillStyle = css(S.trimLit); ctx.fillRect(x, y, TILE, 1.4);
        ctx.fillStyle = css(PAL.outline); ctx.fillRect(x, y + 4, TILE, 1);
      }
      if (!down) { ctx.fillStyle = css(PAL.outline); ctx.fillRect(x, y + TILE - 2, TILE, 2); }
      if (!left) { ctx.fillStyle = css(PAL.outline); ctx.fillRect(x, y, 1.6, TILE); }
      if (!right) { ctx.fillStyle = css(PAL.outline); ctx.fillRect(x + TILE - 1.6, y, 1.6, TILE); }
    }
  }
}

// ------------------------------------------------------------------------------------ light

function staticLights(grid, doors) {
  const L = [];
  for (const p of grid.pools) {
    const col = PAL.pools[p.kind].glow;
    L.push({ x: (p.c + p.len / 2) * TILE, y: p.r * TILE + 4, r: 60 + p.len * 14, color: col, a: 0.32 });
  }
  for (const d of doors) {
    const col = d.kind === "vault" ? PAL.boy.glow : PAL.girl.glow;
    L.push({ x: d.x, y: d.y - DOOR[d.kind].h * 0.45, r: 70, color: col, a: d.lit ? 0.3 : 0.12 });
  }
  return L;
}

function drawLights(ctx, lights) {
  for (const l of lights) {
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    g.addColorStop(0, rgba(l.color, l.a)); g.addColorStop(0.5, rgba(l.color, l.a * 0.35)); g.addColorStop(1, rgba(l.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
}

function drawVignette(ctx) {
  const g = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, 230, WORLD_W / 2, WORLD_H / 2, 600);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.62)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
}

// ------------------------------------------------------------------------------------ doors and dust

export class Door extends Phaser.GameObjects.Container {
  constructor(scene, { x, y, kind, lit = false }) {
    super(scene, x, y);
    this.kind = kind;
    this.halo = scene.add.image(0, -DOOR[kind].h * 0.45, kind === "vault" ? "glow-boy" : "glow-girl").setBlendMode(Phaser.BlendModes.ADD).setScale(1.1);
    this.img = scene.add.image(0, 0, `door-${kind}`).setOrigin(0.5, 1).setScale(1 / PROP_RES);
    this.add([this.halo, this.img]);
    this.setDepth(DEPTH.doors);
    scene.add.existing(this);
    this.setLit(lit);
  }

  /** The seal lights up when its hero steps in. */
  setLit(lit) {
    this.lit = lit;
    this.img.setTexture(`door-${this.kind}${lit ? "-lit" : ""}`);
    this.halo.setAlpha(lit ? 0.9 : 0.25);
    return this;
  }
}

class Dust extends Phaser.GameObjects.Graphics {
  constructor(scene, wingAt, lights) {
    super(scene);
    this.lights = lights;
    const rng = createRng("dust");
    this.motes = Array.from({ length: 46 }, () => ({ x: rng.range(0, WORLD_W), y: rng.range(0, WORLD_H), vx: rng.range(-4, 4), vy: rng.range(-5, -1), ph: rng.range(0, 6.28) }));
    this.motes.forEach((m) => { m.warm = wingAt(m.x, m.y) === "macro"; });
    this.setDepth(DEPTH.dust);
    scene.add.existing(this);
  }

  draw(tick, heroes) {
    this.clear();
    const lit = this.lights.concat(heroes.map((h) => ({ x: h.x, y: h.y - 26, r: 90, a: 0.4 })));
    for (const m of this.motes) {
      const x = (((m.x + tick * m.vx) % WORLD_W) + WORLD_W) % WORLD_W;
      const y = (((m.y + tick * m.vy + Math.sin(tick * 0.4 + m.ph) * 6) % WORLD_H) + WORLD_H) % WORLD_H;
      let light = 0.05;
      for (const l of lit) { const d = Math.hypot(x - l.x, y - l.y); if (d < l.r) light = Math.max(light, (1 - d / l.r) * 0.9); }
      const a = light * (0.55 + 0.45 * Math.sin(tick * 1.3 + m.ph));
      if (a > 0.04) this.fillStyle(m.warm ? 0xffd9a0 : 0xcfe2ff, a).fillCircle(x, y, 0.9);
    }
  }
}
