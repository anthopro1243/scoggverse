// Signals wire a level together: plates, levers and timers switch signals on and off; gates,
// platforms and basins read them. An expression is ids joined by & (and) and | (or), with ! for
// not; & binds tighter than |. "P1all" is on only while every plate in group 1 is held.

/** @param {string} expr e.g. "L1", "P1&P2", "!T1|L2" @param {Record<string, boolean>} sig */
export function evalSignal(expr, sig) {
  if (expr === undefined || expr === null || expr === "") return false;
  if (typeof expr === "boolean") return expr;
  return String(expr).split("|").some((term) => term.split("&").every((atom) => {
    const a = atom.trim();
    return a.startsWith("!") ? !sig[a.slice(1)] : !!sig[a];
  }));
}

/** The ids an expression reads (for checking a level's wiring). */
export const signalIds = (expr) => (typeof expr === "string" ? expr.split(/[|&]/).map((a) => a.trim().replace(/^!/, "")).filter(Boolean) : []);
