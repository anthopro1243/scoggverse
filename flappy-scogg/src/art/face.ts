// The face sprite: the slide crop scaled evenly, with a thin light outline and a soft shadow drawn
// behind it. The face itself is drawn last, untouched: never stretched, tinted, faded or flipped.
import type { FaceSize } from "../logic/faces.ts";
import { PAL } from "./palette.ts";
import { makeLayer, type Layer } from "./scenery.ts";

const PAD = 7; // room around the face for the outline and the shadow (field units)
const LINE = 1.6; // outline thickness

export interface FaceArt extends Layer { pad: number; faceW: number; faceH: number }

export function drawFaceArt(img: HTMLImageElement, size: FaceSize, k: number): FaceArt {
  const [layer, c] = makeLayer(size.w + PAD * 2, size.h + PAD * 2, k);
  // silhouette of the face in the outline color
  const [sil, sc] = makeLayer(size.w, size.h, k);
  sc.drawImage(img, 0, 0, size.w, size.h);
  sc.globalCompositeOperation = "source-in";
  sc.fillStyle = PAL.faceLine;
  sc.fillRect(0, 0, size.w, size.h);
  // shadow, then the outline ring
  c.save();
  c.shadowColor = PAL.faceShadow;
  c.shadowBlur = 6 * k;
  c.shadowOffsetY = 3 * k;
  c.drawImage(sil.canvas, PAD, PAD, size.w, size.h);
  c.restore();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    c.drawImage(sil.canvas, PAD + Math.cos(a) * LINE, PAD + Math.sin(a) * LINE, size.w, size.h);
  }
  // the face, scaled evenly (size.w / size.h is the PNG's own aspect)
  c.imageSmoothingQuality = "high";
  c.drawImage(img, PAD, PAD, size.w, size.h);
  return { ...layer, pad: PAD, faceW: size.w, faceH: size.h };
}

export function drawFace(ctx: CanvasRenderingContext2D, art: FaceArt, x: number, y: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(art.canvas, -art.w / 2, -art.h / 2, art.w, art.h);
  ctx.restore();
}
