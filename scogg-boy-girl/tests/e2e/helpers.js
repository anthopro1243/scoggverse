// Shared helpers for the browser tests: open a scene in test mode and collect console errors.
// With no level or scene named, it opens Priming (the game itself boots into the level select).
export async function open(page, query = "") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  if (!/[?&](level|scene)=/.test(query)) query += "&level=priming";
  await page.goto(`/?test=1${query}`);
  await page.waitForFunction(() => window.__sbg?.ready === true, null, { timeout: 30_000 });
  return errors;
}

// A short two-player run: both walk into their own pool, jump, and Scogg Boy ends up in Recession.
export const SCRIPT = [
  [20, []],
  [50, ["D", "LEFT"]],
  [1, ["D", "W", "LEFT", "UP"]],
  [40, ["D", "LEFT"]],
  [60, ["D"]],
  [90, []],
  [30, ["A", "RIGHT", "UP"]],
];

export async function replay(page, script = SCRIPT) {
  return page.evaluate((s) => s.map(([n, keys]) => window.__sbg.step(n, keys)), script);
}

/** Merge a replay file's tracks and play it; returns the last snapshot. */
export async function playReplay(page, r) {
  const { replaySteps } = await import("../../src/logic/replay.js");
  return page.evaluate((steps) => { let s; for (const [n, k] of steps) s = window.__sbg.step(n, k); return s; }, replaySteps(r));
}

/** Step one frame at a time until check(snapshot) is true (or give up after max frames). */
export async function stepUntil(page, keys, check, max = 600) {
  return page.evaluate(([keys, src, max]) => {
    const fn = new Function("s", `return (${src})(s)`);
    let s = window.__sbg.snapshot();
    for (let i = 0; i < max && !fn(s); i++) s = window.__sbg.step(1, keys);
    return s;
  }, [keys, check.toString(), max]);
}

/** Press a real key, then wait until the game has handled it (Phaser reads keys on its next frame). */
export async function press(page, key, until) {
  await page.keyboard.press(key);
  await page.waitForFunction(`(${until.toString()})(window.__sbg.snapshot())`, null, { timeout: 5000 });
}

/** Press keys one at a time, letting the game handle each before the next (two frames apart). */
export async function tap(page, ...keys) {
  for (const k of keys) {
    await page.keyboard.press(k);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
}
