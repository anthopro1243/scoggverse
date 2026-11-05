// Saved settings: volume, music, mute and reduce motion. localStorage can be blocked (private
// windows, school filters), so every read and write is wrapped and the game works without it.
// Reduce motion starts on when the system asks for less motion.
import { cleanSettings } from "./logic/audio.js";

const KEY = "sbg-prefs";
let mem = {};
try { mem = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { mem = {}; }
if (!("reduceMotion" in mem)) {
  try { mem.reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* no media queries */ }
}
mem = cleanSettings(mem);
const listeners = new Set();

export const prefs = {
  get: (k) => mem[k],
  all: () => ({ ...mem }),
  set(k, v) {
    mem = cleanSettings({ ...mem, [k]: v });
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* storage blocked: keep it for this visit */ }
    for (const fn of listeners) fn(mem);
    return mem[k];
  },
  toggle(k) { return this.set(k, !mem[k]); },
  /** Call fn with the settings whenever one changes; returns a function that stops it. */
  watch(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
