// Text and panels: the score, the title screen, the game-over card and the pause screen.
// Kenney's pixel font in white and coin gold on flat slate panels; the game-over card is light paper
// with dark text, so it doesn't look like the platformer's menus.
import { CARD_LOCK, CARD_SLIDE, H, W } from "../logic/config.ts";
import { cardAge, type Game } from "../logic/game.ts";
import { gradeFor, lineFor } from "../logic/grade.ts";
import { TEXT } from "../texts.ts";
import { FONT, PAL, SERIF, SERIF_SCALE } from "./palette.ts";

export interface UiOptions { touch: boolean; reduceMotion: boolean }

function label(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, opts: { font?: string; weight?: number; color?: string; stroke?: number; align?: CanvasTextAlign; alpha?: number } = {}): void {
  c.save();
  const font = opts.font ?? SERIF;
  c.font = `${opts.weight ?? 700} ${font === SERIF ? Math.round(size * SERIF_SCALE) : size}px ${font}`;
  c.textAlign = opts.align ?? "center";
  c.textBaseline = "middle";
  c.globalAlpha = opts.alpha ?? 1;
  if (opts.stroke) {
    c.lineJoin = "round";
    c.lineWidth = opts.stroke;
    c.strokeStyle = PAL.outline;
    c.strokeText(s, x, y);
  }
  c.fillStyle = opts.color ?? PAL.goldBright;
  c.fillText(s, x, y);
  c.restore();
}

function tablet(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, edge = PAL.tabletEdge, fill = PAL.tablet): void {
  c.fillStyle = edge;
  c.fillRect(x, y, w, h);
  c.fillStyle = fill;
  c.fillRect(x + 3, y + 3, w - 6, h - 6);
}

/** Wrap a line to a width; returns the lines. */
function wrap(c: CanvasRenderingContext2D, s: string, width: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (c.measureText(next).width > width && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function drawScore(c: CanvasRenderingContext2D, g: Game): void {
  label(c, String(g.score), W / 2, 78, 60, { stroke: 7 });
}

export function drawTitle(c: CanvasRenderingContext2D, g: Game, o: UiOptions): void {
  label(c, TEXT.title1, W / 2, 150, 46, { stroke: 8 });
  label(c, TEXT.title2, W / 2, 214, 58, { stroke: 9, color: PAL.gold });
  if (g.best > 0) label(c, `${TEXT.best}  ${g.best}`, W / 2, 352, 20, { color: PAL.gold, stroke: 4 });
  const pulse = o.reduceMotion ? 1 : 0.72 + 0.28 * Math.sin(g.frame / 18);
  label(c, o.touch ? TEXT.startTouch : TEXT.startMouse, W / 2, 470, 20, { font: FONT, weight: 600, color: PAL.text, stroke: 4, alpha: pulse });
}

export function drawCard(c: CanvasRenderingContext2D, g: Game, o: UiOptions): void {
  const age = cardAge(g);
  if (age < 0) return;
  const t = Math.min(1, age / CARD_SLIDE);
  const ease = 1 - (1 - t) ** 3;
  const dy = o.reduceMotion ? 0 : (1 - ease) * (H - 150);
  const cw = 316, ch = 344;
  const x = (W - cw) / 2, y = 150 + dy;
  c.save();
  if (o.reduceMotion) c.globalAlpha = ease;
  tablet(c, x, y, cw, ch, PAL.cardEdge, PAL.card);

  // score and best, side by side, with the grade between them
  label(c, TEXT.score, x + 62, y + 40, 15, { font: FONT, weight: 600, color: PAL.cardDim });
  label(c, String(g.score), x + 62, y + 80, 40, { color: PAL.cardText });
  label(c, TEXT.best, x + cw - 62, y + 40, 15, { font: FONT, weight: 600, color: PAL.cardDim });
  label(c, String(g.best), x + cw - 62, y + 80, 40, { color: PAL.cardGold });
  if (g.newBest && g.score > 0) label(c, TEXT.newBest, x + cw - 62, y + 112, 13, { font: FONT, weight: 600, color: PAL.cardGold });

  const grade = gradeFor(g.score);
  c.strokeStyle = PAL.cardGold;
  c.lineWidth = 2.5;
  c.beginPath();
  c.arc(W / 2, y + 72, 30, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = PAL.cardRule;
  c.lineWidth = 1;
  c.beginPath();
  c.arc(W / 2, y + 72, 25, 0, Math.PI * 2);
  c.stroke();
  label(c, grade, W / 2, y + 75, 36, { color: PAL.cardText });

  c.fillStyle = PAL.cardRule;
  c.fillRect(x + 30, y + 138, cw - 60, 1);

  // his line
  c.font = `400 19px ${FONT}`;
  const lines = wrap(c, `"${lineFor(g.score)}"`, cw - 56);
  lines.forEach((l, i) => label(c, l, W / 2, y + 180 + i * 27 - (lines.length - 1) * 13, 19, { font: FONT, weight: 400, color: PAL.cardText }));
  label(c, TEXT.quoteBy, W / 2, y + 232, 14, { font: SERIF, weight: 700, color: PAL.cardGold });

  const ready = age >= CARD_SLIDE + CARD_LOCK;
  const pulse = !ready ? 0.35 : o.reduceMotion ? 1 : 0.75 + 0.25 * Math.sin(g.frame / 16);
  const again = o.touch ? TEXT.againTouch : TEXT.againMouse;
  label(c, again, W / 2, y + ch - 46, o.touch ? 19 : 16, { font: FONT, weight: 600, color: PAL.cardText, alpha: pulse });
  c.restore();
}

export function drawPaused(c: CanvasRenderingContext2D, o: UiOptions): void {
  c.fillStyle = "rgba(6, 8, 14, 0.55)";
  c.fillRect(0, 0, W, H);
  tablet(c, 72, 270, W - 144, 130);
  label(c, TEXT.paused, W / 2, 318, 34);
  label(c, o.touch ? TEXT.resumeTouch : TEXT.resumeMouse, W / 2, 364, 15, { font: FONT, weight: 600, color: PAL.text });
}
