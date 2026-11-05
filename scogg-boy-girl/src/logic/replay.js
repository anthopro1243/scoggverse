// Replays: one input track per player, each a list of [frames, keys] held in turn. They're merged
// into one list of [frames, keys] for the fixed-step game. Same tracks, same game, every time.

/** @param {[number, string[]][]} boy @param {[number, string[]][]} girl */
export function mergeTracks(boy = [], girl = []) {
  const at = (track) => {
    const out = [];
    for (const [n, keys] of track) for (let i = 0; i < n; i++) out.push(keys);
    return out;
  };
  const a = at(boy), b = at(girl);
  const len = Math.max(a.length, b.length);
  const steps = [];
  for (let i = 0; i < len; i++) {
    const keys = [...(a[i] || []), ...(b[i] || [])];
    const last = steps[steps.length - 1];
    if (last && last[1].join() === keys.join()) last[0]++;
    else steps.push([1, keys]);
  }
  return steps;
}

/** A replay file's steps: either merged tracks ({boy, girl}) or a plain list ({steps}). */
export const replaySteps = (r) => (r.steps ? r.steps : mergeTracks(r.boy, r.girl));

/** Total frames in a replay. */
export const replayFrames = (r) => replaySteps(r).reduce((a, [n]) => a + n, 0);
