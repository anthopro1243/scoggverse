// One palette for the whole game: "The Scoggins Archive", a dark underground hall lit by its pools,
// its doors and the two heroes. Near-black blues and browns, bronze for Macro, marble for Gov.

export const PAL = {
  // shared darks and UI
  void: 0x07080b, ink: 0x0b0906, outline: 0x0b0906,
  // menus in Kenney's colors: slate panels, white text, coin gold
  tablet: 0x2b2d3c, tabletEdge: 0x959ab1, gold: 0xf4b41b, goldBright: 0xfee481, goldDim: 0xcb815e,
  text: 0xffffff, textDim: 0xdce1e7,

  // Macro wing: basalt and treasury bronze
  macro: {
    skyTop: 0x0d0a08, skyBottom: 0x16110c, far: 0x1d1610, farLit: 0x2a2017,
    mid: 0x241c15, midLit: 0x3b2e21, carve: 0xc9973f,
    stone: 0x2b2621, stoneLit: 0x4a4036, stoneDark: 0x15120f, speck: 0x3a332b,
    trim: 0x9a6a30, trimLit: 0xe0aa5c,
  },
  // Gov wing: dark marble in low light
  gov: {
    skyTop: 0x07090d, skyBottom: 0x0c1017, far: 0x12161e, farLit: 0x1a2029,
    mid: 0x1e232c, midLit: 0x3d4554, carve: 0x9fabbf,
    stone: 0x2c313b, stoneLit: 0x4b5260, stoneDark: 0x15181e, speck: 0x3a404c, vein: 0x4a5161,
    trim: 0x7d8696, trimLit: 0xc7cfdc,
  },

  // Scogg Boy, AP Macro: a body of dark red and gold fire
  boy: {
    deep: 0x5e0f07, red: 0xa4250f, orange: 0xd9561a, gold: 0xf2b23b, hot: 0xffe3a0,
    mark: 0xffd98a, rim: 0xffa040, glow: [255, 140, 50],
  },
  // Scogg Girl, AP Gov: a body of clear deep-blue water with ink drifting through it
  girl: {
    deep: 0x050f26, ink: 0x0b2150, blue: 0x1d5bb0, light: 0x4f9be6, foam: 0xa9d4ff, shine: 0xe2f4ff,
    mark: 0xf4f8ff, rim: 0x8fd0ff, glow: [70, 140, 255],
  },

  pools: {
    inflation: { top: 0xffc54a, mid: 0xc4461a, deep: 0x6a1408, glint: 0xffe6a0, coin: 0xe0a83a, coinDark: 0x9a6a1c, glow: [255, 120, 40] },
    ink: { top: 0x5aa9ff, mid: 0x123d8f, deep: 0x061638, glint: 0xb8dcff, glow: [60, 120, 255] },
    recession: { top: 0x6aa83a, mid: 0x26461a, deep: 0x0f1f0a, glint: 0x9bd85a, glow: [90, 170, 60] },
  },
};

/** 0xrrggbb -> css color for Canvas 2D. */
export const css = (hex, a = 1) => {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  return a === 1 ? `#${hex.toString(16).padStart(6, "0")}` : `rgba(${r},${g},${b},${a})`;
};
export const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;

export const SERIF = '"Kenney Pixel", monospace';         // titles, signs and numbers (Kenney's pixel font)
export const SERIF_SCALE = 1.6;                            // the pixel font runs small: sizes were set for a serif
export const FONT = '"Noto Sans", system-ui, sans-serif';  // small text
