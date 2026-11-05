import { describe, it, expect } from "vitest";
import { buckRate, cleanSettings, busGain, hz, TUNE, tuneLength } from "../../src/logic/audio.js";
import { SCORE, SOUND } from "../../src/logic/config.js";

describe("the Buck chime", () => {
  it("rings at the base pitch at full value", () => expect(buckRate(SCORE.buckStart)).toBe(1));
  it("drops as inflation rises, never rising again", () => {
    let last = 2;
    for (let v = SCORE.buckStart; v >= SCORE.buckFloor; v -= 0.25) { const r = buckRate(v); expect(r).toBeLessThanOrEqual(last); last = r; }
  });
  it("bottoms out at the floor", () => {
    expect(buckRate(SCORE.buckFloor)).toBeCloseTo(2 ** (-SOUND.buckDrop / 12));
    expect(buckRate(0.5)).toBeCloseTo(buckRate(SCORE.buckFloor));
  });
});

describe("sound settings", () => {
  it("fills defaults and clamps", () => {
    expect(cleanSettings({})).toEqual({ volume: SOUND.volume, music: SOUND.music, muted: false, reduceMotion: false });
    expect(cleanSettings({ volume: 4, music: -1, muted: 1 })).toMatchObject({ volume: 1, music: 0, muted: true });
    expect(cleanSettings({ volume: "loud", music: NaN }).volume).toBe(SOUND.volume);
  });
  it("mute silences every bus; music scales by its own slider", () => {
    expect(busGain({ volume: 1, music: 0.5, muted: true }, "sfx")).toBe(0);
    expect(busGain({ volume: 1, music: 0.5, muted: true }, "music")).toBe(0);
    expect(busGain({ volume: 0.5, music: 0.5 }, "sfx")).toBe(0.5);
    expect(busGain({ volume: 0.5, music: 0.5 }, "music")).toBe(0.25);
  });
});

describe("the tune", () => {
  it("is in tune", () => { expect(hz(69)).toBe(440); expect(hz(57)).toBeCloseTo(220); });
  it("loops: every bell note lands inside one loop, all notes in a low, calm range", () => {
    expect(tuneLength()).toBe(32);
    for (const [t, n] of TUNE.bells) { expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThan(tuneLength()); expect(n).toBeLessThan(80); }
    for (const [root, voicing] of TUNE.chords) { expect(root).toBeLessThan(48); for (const n of voicing) expect(n).toBeLessThan(70); }
  });
});
