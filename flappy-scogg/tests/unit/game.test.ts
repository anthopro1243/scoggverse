import { describe, expect, it } from "vitest";
import { CARD_DELAY, CARD_LOCK, CARD_SLIDE, COL_W, FACE_START_Y, FACE_X, SCROLL } from "../../src/logic/config.ts";
import { createAutopilot } from "../../src/logic/autopilot.ts";
import { cardAcceptsTap, createGame, stepGame, type Game } from "../../src/logic/game.ts";

const run = (g: Game, n: number, flap = false) => { for (let i = 0; i < n; i++) stepGame(g, flap); return g; };
const fly = (g: Game, until: (g: Game) => boolean, limit = 60 * 60) => {
  const bot = createAutopilot({ delay: 0, aimNoise: 0 });
  for (let i = 0; i < limit && !until(g); i++) stepGame(g, bot(g));
  return g;
};

describe("the title screen", () => {
  it("waits for a tap, with the face bobbing in place", () => {
    const g = run(createGame(), 120);
    expect(g.phase).toBe("title");
    expect(Math.abs(g.body.y - FACE_START_Y)).toBeLessThan(10);
    expect(g.columns).toHaveLength(0);
  });
  it("starts a run on the first tap, and that tap is the first flap", () => {
    const g = run(createGame(), 10);
    stepGame(g, true);
    expect(g.phase).toBe("playing");
    expect(g.events).toEqual(["start", "flap"]);
    expect(g.body.vy).toBeLessThan(0);
  });
});

describe("a run", () => {
  it("scores one point per column passed, when the face passes its middle", () => {
    const g = createGame({ seed: "score" });
    fly(g, (g) => g.score === 1);
    const passed = g.columns.find((c) => c.scored)!;
    expect(passed.x + COL_W / 2).toBeLessThanOrEqual(FACE_X);
    expect(passed.x + COL_W / 2).toBeGreaterThan(FACE_X - SCROLL / 60 - 0.01);
    expect(g.events).toContain("score");
  });
  it("chimes every ten points", () => {
    const g = createGame({ seed: "ten" });
    let tens = 0;
    const bot = createAutopilot({ delay: 0, aimNoise: 0 });
    while (g.score < 20 && g.phase !== "over") { stepGame(g, bot(g)); if (g.events.includes("ten")) tens++; }
    expect(g.score).toBe(20);
    expect(tens).toBe(2);
  });
  it("never speeds up", () => {
    const g = createGame({ seed: "speed" });
    fly(g, (g) => g.score === 30);
    const x = g.columns[0].x;
    stepGame(g, false);
    expect(x - g.columns[0].x).toBeCloseTo(SCROLL / 60, 9);
  });
  it("ends on the floor without a tap, and the face stops there", () => {
    const g = createGame();
    stepGame(g, true);
    run(g, 200);
    expect(g.phase).toBe("over");
    expect(g.cause).toBe("floor");
    const y = g.body.y;
    run(g, 30);
    expect(g.body.y).toBe(y);
  });
  it("ends at the ceiling when you tap too much", () => {
    const g = run(createGame(), 40, true);
    expect(g.phase).toBe("over");
    expect(g.cause).toBe("ceiling");
  });
  it("ends on a column", () => {
    const g = createGame({ seed: "col" });
    stepGame(g, true);
    // hold it level at the start height: sooner or later a column is in the way
    while (g.phase === "playing") stepGame(g, g.body.y > FACE_START_Y);
    expect(g.cause).toBe("column");
  });
});

describe("the game-over card", () => {
  const dead = () => { const g = createGame(); stepGame(g, true); while (g.phase === "playing") stepGame(g, false); return g; };
  it("ignores taps until half a second after it has slid in", () => {
    const g = dead();
    const stop = g.overFrame + CARD_DELAY + CARD_SLIDE + CARD_LOCK;
    while (g.frame < stop - 1) { stepGame(g, true); expect(g.phase).toBe("over"); }
    expect(cardAcceptsTap(g)).toBe(false);
    stepGame(g, false);
    expect(cardAcceptsTap(g)).toBe(true);
    stepGame(g, true);
    expect(g.phase).toBe("playing");
    expect(g.events).toContain("restart");
    expect(g.score).toBe(0);
  });
  it("keeps the best score across runs, and marks a new best", () => {
    const g = createGame({ seed: "best", best: 1 });
    fly(g, (g) => g.score === 3);
    run(g, 300);
    expect(g.phase).toBe("over");
    expect(g.best).toBe(3);
    expect(g.newBest).toBe(true);
    run(g, 60);
    stepGame(g, true);
    run(g, 300);
    expect(g.best).toBe(3);
    expect(g.newBest).toBe(false);
  });
  it("gives each run its own columns, the same every time for the same seed", () => {
    const a = createGame({ seed: "runs" }), b = createGame({ seed: "runs" });
    stepGame(a, true); stepGame(b, true);
    const first = a.columns.map((c) => c.gapY);
    expect(b.columns.map((c) => c.gapY)).toEqual(first);
    run(a, 300); run(a, 60); stepGame(a, true);
    expect(a.columns.map((c) => c.gapY)).not.toEqual(first);
  });
});
