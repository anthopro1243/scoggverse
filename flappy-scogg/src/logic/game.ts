// The whole game as plain data: title, a run, the game-over card, and restart. One call to
// stepGame() is one fixed 1/60 s step; `flap` is true when a tap, click or Space landed in it.
// No DOM, so the same taps on the same seed always give the same run (tests and replays).
import { CARD_DELAY, CARD_LOCK, CARD_SLIDE, COL_SPACING, COL_W, DT, FACE_START_Y, FACE_X, FIRST_COL_X, FLOOR_Y, SCROLL, TITLE_SCROLL } from "./config.ts";
import { hitCircles, hitsCeiling, hitsColumn, hitsFloor } from "./collide.ts";
import { makeColumn, type Column } from "./columns.ts";
import { DEFAULT_FACE, faceSize, type FaceId, type FaceSize } from "./faces.ts";
import { stepBody, type Body } from "./physics.ts";
import { createRng, hashSeed, type Rng } from "./rng.ts";

export type Phase = "title" | "playing" | "over";
export type GameEvent = "start" | "flap" | "score" | "ten" | "hit" | "card" | "restart";
export type Cause = "column" | "floor" | "ceiling";

export interface Game {
  phase: Phase;
  seed: string;
  run: number; // runs started so far
  frame: number; // steps since the game was created (drives title and scenery animation)
  runFrame: number; // steps since this run started
  face: FaceId;
  size: FaceSize;
  body: Body;
  columns: Column[];
  nextIndex: number;
  score: number;
  best: number;
  newBest: boolean;
  scroll: number; // total distance the scenery has moved
  overFrame: number; // step the run ended on
  cause: Cause | null;
  rng: Rng;
  events: GameEvent[]; // what happened in the last step (sounds and tests read it)
}

export function createGame({ seed = "scogg", face = DEFAULT_FACE, best = 0 }: { seed?: string; face?: FaceId; best?: number } = {}): Game {
  return {
    phase: "title",
    seed,
    run: 0,
    frame: 0,
    runFrame: 0,
    face,
    size: faceSize(face),
    body: { y: FACE_START_Y, vy: 0, angle: 0 },
    columns: [],
    nextIndex: 0,
    score: 0,
    best,
    newBest: false,
    scroll: 0,
    overFrame: 0,
    cause: null,
    rng: createRng(seed),
    events: [],
  };
}

/** The seed for a run: the game's seed and the run number, so each run differs but replays exactly. */
export const runSeed = (seed: string, run: number): string => `${seed}#${run}`;

function startRun(g: Game): void {
  g.phase = "playing";
  g.run += 1;
  g.runFrame = 0;
  g.rng = createRng(hashSeed(runSeed(g.seed, g.run)));
  g.body = { y: FACE_START_Y, vy: 0, angle: 0 };
  g.columns = [];
  g.nextIndex = 0;
  g.score = 0;
  g.newBest = false;
  g.cause = null;
  spawnUntilFull(g, FIRST_COL_X);
}

function spawnUntilFull(g: Game, firstX: number): void {
  const last = () => g.columns[g.columns.length - 1] ?? null;
  while (!last() || last()!.x < 405 + COL_SPACING) {
    const prev = last();
    const x = prev ? prev.x + COL_SPACING : firstX;
    g.columns.push(makeColumn(g.rng, g.nextIndex++, x, prev));
  }
}

/** Steps since the card started sliding in, or -1 before it does. */
export const cardAge = (g: Game): number => (g.phase === "over" ? g.frame - g.overFrame - CARD_DELAY : -1);
/** True once the card has finished sliding in and the half-second lock is over. */
export const cardAcceptsTap = (g: Game): boolean => cardAge(g) >= CARD_SLIDE + CARD_LOCK;

function end(g: Game, cause: Cause): void {
  g.phase = "over";
  g.cause = cause;
  g.overFrame = g.frame;
  g.body.vy = 0;
  if (g.score > g.best) { g.best = g.score; g.newBest = true; }
  g.events.push("hit");
}

export function stepGame(g: Game, flap: boolean): Game {
  g.events = [];
  g.frame += 1;

  if (g.phase === "title") {
    g.scroll += SCROLL * TITLE_SCROLL * DT;
    g.body.y = FACE_START_Y + Math.sin(g.frame / 22) * 9; // a gentle bob
    g.body.angle = Math.sin(g.frame / 22 + 1.2) * 0.06;
    if (flap) {
      startRun(g);
      g.events.push("start");
    } else {
      return g;
    }
  }

  if (g.phase === "over") {
    if (cardAge(g) === 0) g.events.push("card");
    if (flap && cardAcceptsTap(g)) {
      startRun(g);
      g.events.push("restart");
    } else {
      return g;
    }
  }

  // playing
  g.runFrame += 1;
  if (flap) g.events.push("flap");
  stepBody(g.body, flap);
  const dx = SCROLL * DT;
  g.scroll += dx;
  for (const c of g.columns) c.x -= dx;
  if (g.columns.length && g.columns[0].x + COL_W < -40) g.columns.shift();
  spawnUntilFull(g, FIRST_COL_X);

  for (const c of g.columns) {
    if (!c.scored && c.x + COL_W / 2 <= FACE_X) {
      c.scored = true;
      g.score += 1;
      g.events.push("score");
      if (g.score % 10 === 0) g.events.push("ten");
    }
  }

  const circles = hitCircles(g.size, FACE_X, g.body.y, g.body.angle);
  if (hitsFloor(circles)) {
    // rest the face on the floor where it touched, so it never sinks into the terrace
    const low = Math.max(...circles.map((c) => c.y + c.r));
    g.body.y -= low - FLOOR_Y;
    end(g, "floor");
  } else if (hitsCeiling(circles)) end(g, "ceiling");
  else if (g.columns.some((c) => Math.abs(c.x + COL_W / 2 - FACE_X) < COL_W + g.size.w && hitsColumn(circles, c))) end(g, "column");
  return g;
}
