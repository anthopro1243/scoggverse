// The best score, saved in this browser. Storage can be blocked (private windows, strict
// settings): then every call quietly does nothing and the best lasts for the visit.
const KEY = "flappy-scogg-best";

export function loadBest(): number {
  try {
    const n = Number(window.localStorage.getItem(KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function saveBest(n: number): boolean {
  try {
    window.localStorage.setItem(KEY, String(n));
    return true;
  } catch {
    return false;
  }
}
