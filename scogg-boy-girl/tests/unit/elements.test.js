import { describe, it, expect } from "vitest";
import { poolKills, POOLS } from "../../src/logic/elements.js";

describe("pools", () => {
  it("Inflation: Scogg Boy is safe, Scogg Girl dies", () => {
    expect(poolKills("inflation", "boy")).toBe(false);
    expect(poolKills("inflation", "girl")).toBe(true);
  });
  it("Ink: Scogg Girl is safe, Scogg Boy dies", () => {
    expect(poolKills("ink", "girl")).toBe(false);
    expect(poolKills("ink", "boy")).toBe(true);
  });
  it("Recession kills both", () => {
    expect(poolKills("recession", "boy")).toBe(true);
    expect(poolKills("recession", "girl")).toBe(true);
  });
  it("has exactly the three pools from the plan", () => {
    expect(Object.values(POOLS).map((p) => p.name)).toEqual(["Inflation", "Ink", "Recession"]);
  });
  it("rejects unknown pools and players", () => {
    expect(() => poolKills("lava", "boy")).toThrow();
    expect(() => poolKills("inflation", "fireboy")).toThrow();
  });
});
