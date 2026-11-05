// One palette for the whole game: the Scoggins Archive at night. Near-black blues for the sky and
// the far buildings, cool marble for the columns, bronze for every cap, trim and lamp, and the
// same gold-on-dark as the platformer's menus for text.

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
  floor: "#1a1f29",
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

  gold: "#d9b45a",
  goldBright: "#f3d58b",
  goldDim: "#8a6d34",
  text: "#e8dcc0",
  textDim: "#9d927f",
  tablet: "rgb(18, 14, 10)",
  tabletEdge: "#6e5428",
  outline: "#0b0906",
};

export const SERIF = '"Cinzel", Georgia, serif'; // engraved titles, the score, grades
export const FONT = '"Noto Sans", system-ui, sans-serif'; // small text
