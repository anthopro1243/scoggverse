// The grade and Dr. Scoggins' line on the game-over card. Every line is in TEXTS.md too.
import { GRADES } from "./config.ts";

export function gradeFor(score: number): string {
  for (const [grade, min] of GRADES) if (score >= min) return grade;
  return "F";
}

// His own lines from his slides and the class questionnaire, lightly adapted. Text only.
export const LINES = {
  firstColumn: "Brace yourselves.",
  F: "Shocker.",
  D: "This is a lot.",
  C: "That's the right idea, close, but missing one thing.",
  B: "You're on fire! Excellent.",
  A: "Good, that's exactly right.",
} as const;

/** The line for a finished run. Dying before the first column gets its own line. */
export function lineFor(score: number): string {
  if (score === 0) return LINES.firstColumn;
  return LINES[gradeFor(score) as "A" | "B" | "C" | "D" | "F"];
}
