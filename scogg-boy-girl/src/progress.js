// Saved progress: best grade per chamber, which unlocks the next one. localStorage can be blocked
// (private windows, school filters), so every read and write is wrapped; when it is, progress
// lasts for this visit only and the level select says so.
import { ORDER } from "./levels.js";
import { cleanProgress, recordGrade } from "./logic/progress.js";

const KEY = "sbg-progress";
let saved = true;
let mem;
try { mem = cleanProgress(JSON.parse(localStorage.getItem(KEY) || "{}"), ORDER); } catch { mem = cleanProgress({}, ORDER); saved = false; }

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); saved = true; } catch { saved = false; }
}

export const progress = {
  get: () => mem,
  /** Did the last read or write reach the browser's storage? */
  get saved() { return saved; },
  record(name, grade) { mem = recordGrade(mem, name, grade); write(); return mem; },
};
