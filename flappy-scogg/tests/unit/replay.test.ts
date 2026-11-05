import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { playReplay, replayChunks, type Replay } from "../../src/logic/replay.ts";

const replay: Replay = JSON.parse(readFileSync(new URL("../../replays/f0.json", import.meta.url), "utf8"));

describe("the F0 replay", () => {
  it("passes at least 25 columns and gets exactly the recorded score", () => {
    let most = 0;
    const g = playReplay(replay, (g) => { most = Math.max(most, g.score); });
    expect(most).toBeGreaterThanOrEqual(25);
    expect(g.score).toBe(replay.expect.score);
    expect(g.phase).toBe(replay.expect.phase);
    expect(g.cause).toBe(replay.expect.cause);
  });
  it("plays out the same way every time", () => {
    const ys: number[] = [];
    playReplay(replay, (g) => ys.push(g.body.y));
    let i = 0;
    playReplay(replay, (g) => expect(g.body.y).toBe(ys[i++]));
  });
  it("chunks into the same taps", () => {
    const taps: number[] = [];
    let s = 1;
    for (const [n, tap] of replayChunks(replay)) { if (tap) taps.push(s); s += n; }
    expect(taps).toEqual(replay.taps);
    expect(s - 1).toBe(replay.steps);
  });
});
