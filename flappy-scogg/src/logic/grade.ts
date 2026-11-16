// The grade on the game-over card.
import { GRADES } from "./config.ts";

export function gradeFor(score: number): string {
  for (const [grade, min] of GRADES) if (score >= min) return grade;
  return "F";
}
