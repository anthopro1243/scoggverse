// Colors for the parts drawn in code (text, panels, the face's outline). The scenery and columns are
// Kenney tiles (see kenney.ts); the night-scene colors below are no longer drawn and only kept
// for the page around the field. Menus use Kenney's slate, white and coin gold, like the platformer.

export const PAL = {
  page: "#120f0d", // the site's background, shown beside the field on wide screens

  skyTop: "#04060c",
  skyMid: "#0a1020",
  skyLow: "#18192a",
  horizonGlow: "rgba(214, 150, 74, 0.10)",
  star: "#cdd6f0",
  moon: "#e9e4d2",
  moonGlow: "rgba(233, 228, 210, 0.08)",

  farStone: "#121722",
  farLit: "#1e2532",
  farTrim: "rgba(170, 128, 66, 0.45)",
  window: "rgba(232, 172, 84, 0.42)",

  midStone: "#0d1018",
  midLit: "#262d3a",
  midTrim: "#5a4423",
  lamp: "rgba(255, 196, 110, 1)",
  lampGlow: [255, 176, 84] as const,

  floorTop: "#c08a42",
  floorTrim: "#6b4a1f",
  floor: "#cb815e", // Kenney's dirt, under the ground tiles on a tall phone
  floorLit: "#252c38",
  floorJoint: "#10141b",
  floorVein: "rgba(150, 160, 180, 0.07)",

  marble: ["#2b303a", "#6e7684", "#a8b0bd", "#c4cad4", "#8d95a3", "#4d5461", "#252a33"],
  flute: "rgba(20, 24, 32, 0.34)",
  fluteLit: "rgba(220, 228, 240, 0.16)",
  vein: "rgba(60, 66, 80, 0.18)",
  night: "rgba(8, 14, 30, 0.30)",

  bronze: ["#3a250e", "#6f4c1f", "#b78846", "#e2b46a", "#a4773a", "#5b3e18", "#2e1e0a"],
  bronzeLine: "rgba(30, 18, 6, 0.55)",
  bronzeShine: "rgba(255, 226, 160, 0.35)",
  engrave: "rgba(26, 16, 4, 0.55)",
  engraveLit: "rgba(255, 220, 150, 0.22)",

  faceLine: "rgba(14, 10, 8, 0.85)",
  faceShadow: "rgba(0, 0, 0, 0.45)",

  gold: "#f4b41b",
  goldBright: "#ffffff",
  goldDim: "#cb815e",
  text: "#ffffff",
  textDim: "#dce1e7",
  tablet: "#2b2d3c",
  tabletEdge: "#434a5f",
  outline: "#2a2433",
};

export const SERIF = '"Kenney Pixel", monospace'; // the title, the score, grades (Kenney's pixel font)
export const SERIF_SCALE = 1.5; // the pixel font runs small: sizes were set for a serif
export const FONT = '"Noto Sans", system-ui, sans-serif'; // small text
