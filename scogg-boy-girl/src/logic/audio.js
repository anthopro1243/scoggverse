// Sound numbers and the tune's score: no Web Audio here, so it's unit-tested in Node.
import { SCORE, SOUND } from "./config.js";

/**
 * The Scogg Buck chime's pitch, as a playback rate: full value rings at the base pitch, and the
 * chime drops as inflation eats the Buck, down to SOUND.buckDrop semitones at the $2 floor.
 */
export function buckRate(value) {
  const span = Math.log(SCORE.buckStart / SCORE.buckFloor);
  const lost = Math.min(1, Math.max(0, Math.log(SCORE.buckStart / Math.max(value, SCORE.buckFloor)) / span));
  return 2 ** (-(SOUND.buckDrop * lost) / 12);
}

/** Settings with defaults, every number clamped to 0..1. */
export function cleanSettings(s = {}) {
  const n = (v, d) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);
  return {
    volume: n(s.volume, SOUND.volume),
    music: n(s.music, SOUND.music),
    muted: !!s.muted,
    reduceMotion: !!s.reduceMotion,
  };
}

/** The gain a bus plays at: master volume times the bus's own, silent when muted. */
export function busGain(settings, bus) {
  const s = cleanSettings(settings);
  if (s.muted) return 0;
  return s.volume * (bus === "music" ? s.music : 1);
}

/** MIDI note number -> Hz. */
export const hz = (m) => 440 * 2 ** ((m - 69) / 12);

// The tune: "Archive", D minor, 60 bpm, four chords of eight seconds each, low strings with a soft
// pulse on the root and a few slow bell notes. Each chord: [root for the pulse, string voicing].
export const TUNE = {
  bar: 8,                                           // seconds per chord
  chords: [
    [38, [50, 57, 62, 65]],                         // Dm      D2 | D3 A3 D4 F4
    [34, [46, 53, 58, 62]],                         // Bb      Bb1 | Bb2 F3 Bb3 D4
    [43, [43, 50, 55, 58]],                         // Gm      G2 | G2 D3 G3 Bb3
    [45, [45, 52, 57, 61]],                         // A       A2 | A2 E3 A3 C#4
  ],
  pulse: [0, 2, 4, 6],                              // pulse beats within each chord (seconds)
  bells: [[3, 74], [11, 70], [19, 67], [26, 69], [29, 73]], // [second, note]: a slow line over the top
};

/** The tune's length in seconds (one loop). */
export const tuneLength = () => TUNE.bar * TUNE.chords.length;
