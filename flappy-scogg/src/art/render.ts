// Draws a frame. The 405x720 field is scaled evenly to fit the screen: on a wide screen it sits in
// the middle with the site's dark background either side; on a tall phone it fills the width and
// the terrace carries on down to the bottom edge. Layers are redrawn only when the size changes.
import { FACE_DRAW_SCALE, FACE_START_Y, FACE_X, FLOOR_Y, H, PARALLAX_FAR, PARALLAX_MID, W } from "../logic/config.ts";
import { cardAge, type Game } from "../logic/game.ts";
import { drawFace, drawFaceArt, type FaceArt } from "./face.ts";
import { PAL } from "./palette.ts";
import { drawColumn, drawPillarArt, type PillarArt } from "./pillars.ts";
import { blitRepeat, drawFar, drawFloor, drawMid, drawSky, drawVignette, FLOOR_DEPTH, type Layer } from "./scenery.ts";
import { drawCard, drawPaused, drawScore, drawTitle, type UiOptions } from "./ui.ts";

export interface Layout { cssW: number; cssH: number; dpr: number; scale: number; x: number; y: number; extraBottom: number }

export function computeLayout(cssW: number, cssH: number, dpr: number): Layout {
  const scale = Math.min(cssW / W, cssH / H);
  const fieldW = W * scale;
  const fieldH = H * scale;
  const tall = cssH - fieldH > 1;
  const x = (cssW - fieldW) / 2;
  const y = tall ? 0 : (cssH - fieldH) / 2; // tall screens: field at the top, terrace below
  return { cssW, cssH, dpr, scale, x, y, extraBottom: tall ? (cssH - fieldH) / scale : 0 };
}

export interface Renderer {
  layout: Layout;
  resize(cssW: number, cssH: number, dpr: number): void;
  draw(g: Game, ui: UiOptions & { paused: boolean }): void;
  /** What the last frame drew the face with (tests check the face is only scaled evenly). */
  lastFace: { x: number; y: number; angle: number; w: number; h: number; srcW: number; srcH: number } | null;
}

export function createRenderer(canvas: HTMLCanvasElement, faceImgOf: (g: Game) => HTMLImageElement): Renderer {
  const ctx = canvas.getContext("2d", { alpha: false })!;
  let layout = computeLayout(1, 1, 1);
  let sky: Layer, far: Layer, mid: Layer, floor: Layer, vignette: Layer, pillars: PillarArt;
  let face: FaceArt | null = null;
  let faceKey = "";

  const r: Renderer = {
    get layout() { return layout; },
    lastFace: null,
    resize(cssW, cssH, dpr) {
      layout = computeLayout(cssW, cssH, dpr);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      const k = layout.scale * dpr;
      sky = drawSky(k);
      far = drawFar(k);
      mid = drawMid(k);
      floor = drawFloor(k);
      vignette = drawVignette(k);
      pillars = drawPillarArt(k);
      face = null;
    },
    draw(g, ui) {
      const { dpr, scale, x, y, extraBottom } = layout;
      const k = scale * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = PAL.page;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(k, 0, 0, k, x * dpr, y * dpr);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H + extraBottom);
      ctx.clip();

      const scroll = ui.reduceMotion ? 0 : g.scroll;
      ctx.drawImage(sky.canvas, 0, 0, W, FLOOR_Y);
      blitRepeat(ctx, far, scroll * PARALLAX_FAR, 0);
      blitRepeat(ctx, mid, scroll * PARALLAX_MID, 0);
      for (const col of g.columns) if (col.x < W + 20 && col.x > -100) drawColumn(ctx, pillars, col);
      // the terrace moves with the columns; with reduce motion on it holds still on the title
      blitRepeat(ctx, floor, ui.reduceMotion && g.phase === "title" ? 0 : g.scroll, FLOOR_Y);
      if (extraBottom > FLOOR_DEPTH - (H - FLOOR_Y)) {
        ctx.fillStyle = PAL.floor;
        ctx.fillRect(0, FLOOR_Y + FLOOR_DEPTH, W, extraBottom);
      }
      ctx.drawImage(vignette.canvas, 0, 0, W, H);

      const size = g.size;
      const faceImg = faceImgOf(g);
      const key = `${g.face}:${k}`;
      const drawn = { w: size.w * FACE_DRAW_SCALE, h: size.h * FACE_DRAW_SCALE, scale: size.scale * FACE_DRAW_SCALE };
      if (!face || faceKey !== key) { face = drawFaceArt(faceImg, drawn, k); faceKey = key; }
      // with reduce motion on, the title face holds still instead of bobbing
      const still = ui.reduceMotion && g.phase === "title";
      const fy = still ? FACE_START_Y : g.body.y, fa = still ? 0 : g.body.angle;
      drawFace(ctx, face, FACE_X, fy, fa);
      r.lastFace = { x: FACE_X, y: fy, angle: fa, w: drawn.w, h: drawn.h, srcW: faceImg.naturalWidth, srcH: faceImg.naturalHeight };

      if (g.phase === "title") drawTitle(ctx, g, ui);
      if (g.phase === "playing" || (g.phase === "over" && cardAge(g) < 0)) drawScore(ctx, g);
      if (g.phase === "over") drawCard(ctx, g, ui);
      if (ui.paused) drawPaused(ctx, ui);
      ctx.restore();
    },
  };
  return r;
}
