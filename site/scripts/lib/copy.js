// Copy rules for the site's own words (not the classmates' slide titles): no template phrases,
// no trailer lines, no three-part slogans. Used by test/e2e/copy.spec.js; unit tested.
export const BANNED = [
  /\bwelcome to\b/i, /\bdive in(to)?\b/i, /\bexplor(e|es|ing)\b/i, /\bunleash/i, /\bultimate\b/i, /\bimmersive\b/i,
  /\bseamless/i, /\bjourney\b/i, /\belevate/i, /\bcurated\b/i, /\bvibrant\b/i, /\btestament\b/i, /\bdelve/i,
  /\bembark/i, /whether you['’]re/i, /\bnot just\b/i, /\bget ready\b/i, /\blook no further\b/i,
  /\bsomething for everyone\b/i, /game-changer/i,
  /\bcomes for you\b/i, /\byou know what['’]s next\b/i, /\bwe['’]re not telling\b/i,
  // the "X, but it's Y" pitch (human pass, H1): fine once, a formula six times
  /,\s*but it['’]s\b/i,
];

// Template arrows on links ("All 435 →", "Own page ↗").
export const ARROWS = /[→↗]/;
export const MOTTO = "Don't deny yourself an education.";

// Words a slogan line tends to open with ("Survive five nights. Close the doors. Watch your power.").
const VERBS = new Set(("survive close watch shut open check keep turn make play add hit grab find run try get go see take stay " +
  "read scroll search browse join discover meet face flick pick look listen hide wait guard fight beat start learn " +
  "share build create enjoy unlock save collect press").split(" "));

const sentences = (text) => text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

// Three or more short sentences in a row that each start with a verb. Returns the run, or null.
export function sloganRun(text, { maxWords = 6, run = 3 } = {}) {
  const list = sentences(text);
  let streak = [];
  for (const s of list) {
    const words = s.replace(/[^\p{L}\p{N}'’ -]/gu, "").split(/\s+/).filter(Boolean);
    const isSlogan = words.length > 0 && words.length <= maxWords && VERBS.has(words[0].toLowerCase());
    streak = isSlogan ? [...streak, s] : [];
    if (streak.length >= run) return streak.join(" ");
  }
  return null;
}
