// Text that never clips its last letter (every Phaser text in the game goes through this).

const probe = document.createElement("canvas").getContext("2d");

/**
 * No kerning: at small sizes the font tucks a period under an "r" ("browser." read "browsec"), so
 * every text is measured and drawn letter by letter at its own width.
 */
function noKerning(ctx) {
  for (const name of ["measureText", "fillText", "strokeText"]) {
    const fn = CanvasRenderingContext2D.prototype[name];
    ctx[name] = function (...args) { this.fontKerning = "none"; return fn.apply(this, args); };
  }
  return ctx;
}
noKerning(probe);

/**
 * Phaser sizes a text's canvas from widths measured at the text's own size, then draws it scaled
 * up by its resolution. Two things then poke out of the canvas and get cut off: at the drawn size
 * the browser's hinting makes bold letters a little wider ("each othe"), and big serif capitals
 * reach past their own advance width (half an "A" stamp). Before every redraw, measure each line's
 * real ink at the size it is drawn and pad both edges by however far it reaches (plus a pixel for
 * canvas rounding). Kerning is off, so the letters never run into each other either.
 */
export function fitText(t) {
  noKerning(t.context);
  const draw = t.updateText;
  const base = { left: t.padding.left, right: t.padding.right };
  t.updateText = function () {
    const st = this.style;
    if (st?._font) {
      const { left, right } = overhang(this);
      this.padding.left = base.left + Math.ceil(left) + 1;
      this.padding.right = base.right + Math.ceil(right) + 1;
    }
    return draw.call(this);
  };
  t.updateText();
  return t;
}

/** How far a text's lines reach past the box Phaser measures for them, left and right, in world units. */
export function overhang(t) {
  const st = t.style, res = st.resolution;
  const out = st.wordWrapWidth || st.wordWrapCallback ? t.runWordWrap(t._text ?? t.text) : (t._text ?? t.text);
  const lines = out.split(t.splitRegExp);
  // the ink of each line measured both ways: at the text's own size (how the browser may lay the
  // letters out before scaling) and at the size it is drawn; pad for whichever reaches further
  probe.font = st._font;
  const small = lines.map((l) => probe.measureText(l));
  probe.font = st._font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${n * res}px`);
  let left = 0, right = 0;
  lines.forEach((l, i) => {
    const m = probe.measureText(l), s = small[i];
    left = Math.max(left, m.actualBoundingBoxLeft / res, s.actualBoundingBoxLeft);
    right = Math.max(right, Math.max(m.width / res, m.actualBoundingBoxRight / res, s.actualBoundingBoxRight) - s.width);
  });
  return { left: Math.max(0, left), right: Math.max(0, right) };
}
