// Textures drawn once with Canvas 2D at boot: light glows, embers, the two exit doors, the Scogg Buck
// and the Gavel (and, per chamber, the motto sign over the exits). Props are drawn at PROP_RES times their world size so
// they stay sharp under the camera zoom; display them with setScale(1 / PROP_RES).
import { PAL, css, rgba, SERIF, FONT } from "./palette.js";
import { MOTTO_SIGN } from "../logic/config.js";

export const PROP_RES = 4;
const BODY = { vault: { w: 96, h: 89 }, chamber: { w: 92, h: 89 } };
// world units, bottom = floor (2 extra on top for the chamber's pediment tip)
export const DOOR = Object.fromEntries(Object.entries(BODY).map(([k, b]) => [k, { w: b.w, h: b.h + 2 }]));
const MOTTO = ["DON'T DENY YOURSELF", "AN EDUCATION"];
const OLD_TOP = 23; // the door art below was drawn under a 23-unit lintel

function canvas(w, h, res = PROP_RES) {
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(w * res); cv.height = Math.ceil(h * res);
  const ctx = cv.getContext("2d");
  ctx.scale(res, res);
  return { cv, ctx };
}

export function makeTextures(scene) {
  const add = (key, cv) => { if (!scene.textures.exists(key)) scene.textures.addCanvas(key, cv); };
  add("glow-boy", glow(PAL.boy.glow));
  add("glow-girl", glow(PAL.girl.glow));
  add("ember-dollar", ember());
  add("door-vault", vaultDoor(false));
  add("door-vault-lit", vaultDoor(true));
  add("door-chamber", chamberDoor(false));
  add("door-chamber-lit", chamberDoor(true));
  add("buck", buck());
  add("gavel", gavel());
  add("parchment", parchment());
}

/** Soft radial light, 128 px across (displayed at world scale ~1.25 -> ~80 px radius). */
function glow(color) {
  const { cv, ctx } = canvas(128, 128, 1);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, rgba(color, 0.55));
  g.addColorStop(0.35, rgba(color, 0.22));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return cv;
}

function ember() {
  const { cv, ctx } = canvas(12, 14, 4);
  ctx.font = `700 11px ${FONT}`;
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(255,140,40,0.9)";
  ctx.shadowBlur = 4;
  ctx.fillStyle = css(PAL.boy.hot);
  ctx.fillText("$", 6, 11);
  return cv;
}

/** Engraved letters: dark cut with a lit lower lip, so they read as carved into the stone. */
function engrave(ctx, text, x, y, size, light = "rgba(255,230,180,0.28)") {
  ctx.font = `700 ${size}px ${SERIF}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillText(text, x, y - 0.5);
  ctx.fillStyle = light;
  ctx.fillText(text, x, y + 0.3);
}

/** The carved motto sign: a stone slab with the motto cut into it, lit letters on dark stone. One line when it fits. */
export function mottoSign(w) {
  const h = MOTTO_SIGN.h, M = PAL.macro, ink = "rgba(250,205,130,0.95)";
  const { cv, ctx } = canvas(w, h);
  ctx.fillStyle = css(PAL.outline);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = css(M.stone);
  ctx.fillRect(1, 1, w - 2, h - 2);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(4, 4, w - 8, h - 8);              // the sunken panel the letters are cut into
  ctx.fillStyle = css(M.stoneLit);
  ctx.fillRect(1, 1, w - 2, 1.4);
  ctx.fillRect(4, h - 4, w - 8, 0.8);
  let size = 11;
  ctx.font = `700 ${size}px ${SERIF}`;
  const line = MOTTO.join(" ");
  if (ctx.measureText(line).width <= w - 18) { engrave(ctx, line, w / 2, h / 2 + size * 0.36, size, ink); return cv; }
  const widest = Math.max(...MOTTO.map((m) => ctx.measureText(m).width));
  if (widest > w - 14) size *= (w - 14) / widest;  // shrink only if the font runs wide
  engrave(ctx, MOTTO[0], w / 2, h / 2 - 1.5, size, ink);
  engrave(ctx, MOTTO[1], w / 2, h / 2 + size - 1, size, ink);
  return cv;
}

/** Canvas for a door: the door art (drawn for a 23-unit top) with its top cropped to the door. */
function doorCanvas(kind) {
  const { w, h } = DOOR[kind];
  const { cv, ctx } = canvas(w, h);
  ctx.translate(0, h - BODY[kind].h - OLD_TOP);
  return { cv, ctx, w, h: BODY[kind].h + OLD_TOP };
}

/**
 * A best-grade stamp for the level select: two red rings and the letter, tilted like a hand stamp.
 * The tilt is drawn into the texture: Phaser 4.2.1 renders a rotated Text only partly (half an "A").
 */
export function stampTexture(scene, grade, color, radius = 25) {
  const key = `stamp-${grade}-${radius}`;
  if (scene.textures.exists(key)) return key;
  const k = radius / 25, S = Math.ceil(radius * 2 + 10), c = S / 2;
  const { cv, ctx } = canvas(S, S);
  ctx.strokeStyle = css(color, 0.9); ctx.lineWidth = 2.4 * k;
  ctx.beginPath(); ctx.arc(c, c, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = css(color, 0.8); ctx.lineWidth = k;
  ctx.beginPath(); ctx.arc(c, c, 21 * k, 0, Math.PI * 2); ctx.stroke();
  ctx.translate(c, c); ctx.rotate(-0.2);
  ctx.font = `700 ${Math.round(28 * k)}px ${SERIF}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = css(color, 0.92);
  ctx.fillText(grade, 0, 2 * k);
  scene.textures.addCanvas(key, cv);
  return key;
}

/** Scogg Boy's exit: a round bronze vault door with a "$" seal and IN SCOGG WE TRUST around it. */
function vaultDoor(lit) {
  const M = PAL.macro;
  const { cv, ctx, w, h } = doorCanvas("vault");
  // stone recess
  ctx.fillStyle = css(PAL.outline); ctx.fillRect(w / 2 - 38, 23, 76, h - 23);
  ctx.fillStyle = css(M.stoneDark); ctx.fillRect(w / 2 - 36, 24, 72, h - 24);
  const cx = w / 2, cy = 24 + (h - 24) / 2, R = 32;
  // the door: bronze rim, rivets, motto, inner disc
  const rim = ctx.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, R);
  rim.addColorStop(0, "#c48a44"); rim.addColorStop(0.7, "#7d5124"); rim.addColorStop(1, "#4a2e14");
  ctx.fillStyle = css(PAL.outline); ctx.beginPath(); ctx.arc(cx, cy, R + 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#5a3a1a"; ctx.beginPath(); ctx.arc(cx, cy, R - 8.5, 0, Math.PI * 2); ctx.fill();
  const inner = ctx.createRadialGradient(cx - 6, cy - 7, 2, cx, cy, R - 9);
  inner.addColorStop(0, "#a8733a"); inner.addColorStop(1, "#5e3c1b");
  ctx.fillStyle = inner; ctx.beginPath(); ctx.arc(cx, cy, R - 9.5, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.fillStyle = "#e0b070"; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (R - 2.6), cy + Math.sin(a) * (R - 2.6), 0.9, 0, Math.PI * 2); ctx.fill();
  }
  // IN SCOGG WE TRUST around the upper rim
  ctx.font = `700 4.6px ${SERIF}`;
  ctx.textAlign = "center";
  const motto = "IN SCOGG WE TRUST";
  const span = 2.3;
  [...motto].forEach((ch, i) => {
    const a = -Math.PI / 2 - span / 2 + (span * (i + 0.5)) / motto.length;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * (R - 5.8), cy + Math.sin(a) * (R - 5.8));
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = "rgba(255,225,170,0.35)"; ctx.fillText(ch, 0, 1.9);
    ctx.fillStyle = "rgba(30,15,5,0.85)"; ctx.fillText(ch, 0, 1.6);
    ctx.restore();
  });
  // handle wheel
  ctx.strokeStyle = css(PAL.outline); ctx.lineWidth = 3.2; ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9); ctx.lineTo(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17); ctx.stroke();
  }
  ctx.strokeStyle = "#c99550"; ctx.lineWidth = 1.8;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9); ctx.lineTo(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17); ctx.stroke();
    ctx.fillStyle = "#e6b56a"; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 17.5, cy + Math.sin(a) * 17.5, 1.7, 0, Math.PI * 2); ctx.fill();
  }
  seal(ctx, cx, cy, 8, lit, lit ? "#ffd27a" : "#8a5e2a", lit ? "rgba(255,170,60,1)" : null, (c) => {
    c.font = `700 11px ${SERIF}`; c.textAlign = "center";
    c.fillStyle = lit ? "#fff3cf" : "#3a2410"; c.fillText("$", cx, cy + 4);
  });
  return cv;
}

/** Scogg Girl's exit: a tall marble chamber door under a pediment, with a gavel seal. */
function chamberDoor(lit) {
  const { cv, ctx, w, h } = doorCanvas("chamber");
  const W = 66; // the door itself, centered in its canvas
  ctx.save();
  ctx.translate((w - W) / 2, 0);
  // pediment
  ctx.fillStyle = css(PAL.outline);
  ctx.beginPath(); ctx.moveTo(2, 34); ctx.lineTo(W / 2, 21); ctx.lineTo(W - 2, 34); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#5d6676";
  ctx.beginPath(); ctx.moveTo(5, 33); ctx.lineTo(W / 2, 23); ctx.lineTo(W - 5, 33); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#8d97a8"; ctx.fillRect(2, 33, W - 4, 3);
  // pilasters with flutes
  for (const x of [3, W - 12]) {
    ctx.fillStyle = css(PAL.outline); ctx.fillRect(x - 0.5, 36, 10, h - 36);
    const col = ctx.createLinearGradient(x, 0, x + 9, 0);
    col.addColorStop(0, "#7c8697"); col.addColorStop(0.5, "#5b6475"); col.addColorStop(1, "#3c4352");
    ctx.fillStyle = col; ctx.fillRect(x, 36, 9, h - 36);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    for (let k = 1; k < 4; k++) ctx.fillRect(x + k * 2.25, 40, 0.7, h - 44);
    ctx.fillStyle = "#9aa4b5"; ctx.fillRect(x - 0.5, 36, 10, 2); ctx.fillRect(x - 0.5, h - 3, 10, 3);
  }
  // the two door leaves
  const dx = 13, dw = W - 26;
  ctx.fillStyle = css(PAL.outline); ctx.fillRect(dx, 37, dw, h - 37);
  const leaf = ctx.createLinearGradient(0, 37, 0, h);
  leaf.addColorStop(0, "#2c3340"); leaf.addColorStop(1, "#1a1f28");
  ctx.fillStyle = leaf; ctx.fillRect(dx + 1, 38, dw - 2, h - 38);
  ctx.fillStyle = css(PAL.outline); ctx.fillRect(W / 2 - 0.5, 38, 1, h - 38);
  ctx.strokeStyle = "rgba(160,175,200,0.3)"; ctx.lineWidth = 0.8;
  for (const px of [dx + 3, W / 2 + 2.5]) { ctx.strokeRect(px, 42, dw / 2 - 5.5, 20); ctx.strokeRect(px, 78, dw / 2 - 5.5, 24); }
  seal(ctx, W / 2, 70, 8.5, lit, lit ? "#bfe3ff" : "#5f6c84", lit ? "rgba(90,160,255,1)" : null, (c) => {
    // a gavel: head and handle
    c.save(); c.translate(W / 2, 70); c.rotate(-0.6);
    c.fillStyle = lit ? "#f4fbff" : "#1b2230";
    c.fillRect(-1, -1, 9, 2);              // handle
    c.fillRect(-5.5, -3.6, 6, 7.2);        // head
    c.fillRect(-6.3, -3.6, 1, 7.2); c.fillRect(0.3, -3.6, 1, 7.2);
    c.restore();
  });
  ctx.restore();
  return cv;
}

function seal(ctx, cx, cy, r, lit, color, glowColor, drawIcon) {
  ctx.save();
  if (lit) { ctx.shadowColor = glowColor; ctx.shadowBlur = 10; }
  ctx.fillStyle = css(PAL.outline); ctx.beginPath(); ctx.arc(cx, cy, r + 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  drawIcon(ctx);
}

/** A Scogg Buck: a gold coin with a red ring and "$". */
function buck() {
  const { cv, ctx } = canvas(24, 24);
  ctx.translate(12, 12); ctx.scale(1.3, 1.3); ctx.translate(-9, -9);
  ctx.shadowColor = "rgba(255,170,60,0.8)"; ctx.shadowBlur = 4;
  ctx.fillStyle = css(PAL.outline); ctx.beginPath(); ctx.arc(9, 9, 7.4, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  const g = ctx.createRadialGradient(6.5, 6, 1, 9, 9, 7);
  g.addColorStop(0, "#ffe9a6"); g.addColorStop(0.6, "#e0a83a"); g.addColorStop(1, "#9a6a1c");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(9, 9, 6.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#a3261a"; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(9, 9, 4.9, 0, Math.PI * 2); ctx.stroke();
  ctx.font = `700 7.5px ${SERIF}`; ctx.textAlign = "center";
  ctx.fillStyle = "#8a1d12"; ctx.fillText("$", 9, 11.8);
  return cv;
}

/** A Gavel, glowing cold blue: the same size and brightness as a Scogg Buck. */
function gavel() {
  const { cv, ctx } = canvas(30, 30);
  ctx.translate(15, 15); ctx.scale(1.5, 1.5); ctx.rotate(-0.65); ctx.translate(-1, 0);
  ctx.shadowColor = "rgba(150,205,255,0.95)"; ctx.shadowBlur = 5;
  ctx.fillStyle = css(PAL.outline);
  ctx.beginPath(); ctx.roundRect(-1.8, -1.7, 11.2, 3.4, 1.3); ctx.fill();
  ctx.beginPath(); ctx.roundRect(-8.2, -4.8, 7.9, 9.6, 1.6); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#a9d8ff"; ctx.beginPath(); ctx.roundRect(-1, -0.95, 9.8, 1.9, 0.8); ctx.fill();
  const g = ctx.createLinearGradient(-7, -4, -1, 4);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.45, "#bfe2ff"); g.addColorStop(1, "#4f9be6");
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-7.4, -4, 6.3, 8, 1.2); ctx.fill();
  ctx.fillStyle = "#1f5fb8"; ctx.fillRect(-7.4, -1.7, 6.3, 0.9); ctx.fillRect(-7.4, 0.8, 6.3, 0.9);
  return cv;
}

/** The end card: dark aged parchment with a gold double rule, 400 x 270 world units (drawn at 2x). */
function parchment() {
  const W = 400, H = 270;
  const { cv, ctx } = canvas(W, H, 2);
  const g = ctx.createRadialGradient(W / 2, H / 2 - 20, 30, W / 2, H / 2, W * 0.62);
  g.addColorStop(0, "#3a2e1f"); g.addColorStop(0.7, "#2a2016"); g.addColorStop(1, "#15100a");
  ctx.fillStyle = css(PAL.outline); ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = g; ctx.fillRect(2, 2, W - 4, H - 4);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {                     // fibres and age spots
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? "0,0,0" : "255,220,160"},${0.03 + rnd() * 0.05})`;
    ctx.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 0.6 + rnd());
  }
  ctx.strokeStyle = css(PAL.goldDim); ctx.lineWidth = 1.4; ctx.strokeRect(9, 9, W - 18, H - 18);
  ctx.strokeStyle = "rgba(217,180,90,0.45)"; ctx.lineWidth = 0.8; ctx.strokeRect(13, 13, W - 26, H - 26);
  return cv;
}
