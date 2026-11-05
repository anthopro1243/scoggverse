import { describe, it, expect } from "vitest";
import { mergeTracks, replayFrames } from "../../src/logic/replay.js";

describe("replays", () => {
  it("merges both players' tracks frame by frame", () => {
    expect(mergeTracks([[2, ["D"]], [1, []]], [[1, ["LEFT"]], [2, ["UP"]]])).toEqual([[1, ["D", "LEFT"]], [1, ["D", "UP"]], [1, ["UP"]]]);
  });
  it("a shorter track just stops pressing", () => {
    expect(mergeTracks([[3, ["D"]]], [])).toEqual([[3, ["D"]]]);
  });
  it("counts frames", () => {
    expect(replayFrames({ boy: [[5, []]], girl: [[7, ["UP"]]] })).toBe(7);
    expect(replayFrames({ steps: [[3, []], [4, ["D"]]] })).toBe(7);
  });
});
