// A playable chamber: both heroes, the pools, pickups with inflation, curtains, plates and gates,
// the two exit doors, the HUD, pause, restart and the end card. Runs on the fixed-timestep loop with
// Arcade Physics stepped by hand, so the same inputs always give the same game.
// ?level=<name> picks the level (default: Priming); ?test=1 freezes real time for tests and replays.
import { BaseScene } from "./base.js";
import { Hero } from "../art/hero.js";
import { Pool, Pickup } from "../art/pool.js";
import { buildArchive, DEPTH } from "../art/archive.js";
import { PROP_RES } from "../art/textures.js";
import { LAND_LEN } from "../art/poses.js";
import { mergeRects } from "../logic/grid.js";
import { loadLevel } from "../logic/level.js";
import { poolKills } from "../logic/elements.js";
import { createJump } from "../logic/jump.js";
import { buckValue, tally } from "../logic/score.js";
import { createStepper } from "../logic/fixedStep.js";
import { createRng } from "../logic/rng.js";
import { MOVE, TILE, HZ, LEVEL } from "../logic/config.js";
import { createInput } from "../input.js";
import { LEVELS, ORDER } from "../levels.js";
import { Hud, PauseMenu, EndCard } from "./ui.js";
import { HowToPanel, SettingsPanel } from "./panels.js";
import { Mechanisms } from "./mechs.js";
import { faceCheck, sweepPoses } from "../art/hero.js";
import { prefs } from "../prefs.js";
import { progress } from "../progress.js";
import { levelAfter } from "../logic/progress.js";
import { audio } from "../audio/audio.js";
import { buckRate } from "../logic/audio.js";

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Level extends BaseScene {
  constructor() { super("level"); }

  /** @param {{level?: string}} data the level to play (from the level select); else ?level=, else the first */
  create(data = {}) {
    this.setupCamera();
    const params = new URLSearchParams(location.search);
    this.test = params.has("test");
    this.levelName = [data.level, params.get("level")].find((n) => n in LEVELS) ?? ORDER[0];
    this.def = loadLevel(LEVELS[this.levelName]);
    const grid = (this.grid = this.def.grid);

    const doors = grid.doors.map((d) => ({ x: d.c * TILE + TILE / 2, y: (d.r + 1) * TILE, kind: d.kind, who: d.who }));
    this.archive = buildArchive(this, grid, { wings: this.def.wings, seed: this.levelName, rs: this.rs, doors });
    this.doors = this.archive.doors.map((obj, i) => ({ obj, ...doors[i] }));
    this.signs = this.def.signs.map((s) => this.tablet(s.x, s.y, s.text, { size: 10 }).setDepth(DEPTH.doors - 0.5).setAlpha(0.92).setAlign("center"));

    // collision: stone and pool tiles merged into as few rectangles as possible (no seams to catch on)
    const mask = grid.solid.map((row, r) => row.map((s, c) => s || grid.pools.some((p) => p.r === r && c >= p.c && c < p.c + p.len)));
    this.solidRects = mergeRects(mask).map((q) => ({ x: q.c * TILE, y: q.r * TILE, w: q.w * TILE, h: q.h * TILE }));
    this.solids = this.solidRects.map((q) => this.physics.add.staticBody(q.x, q.y, q.w, q.h));
    this.pools = grid.pools.map((p) => new Pool(this, p));

    this.players = ["boy", "girl"].map((who) => {
      const s = grid.spawns[who];
      const spawn = { x: s.c * TILE + TILE / 2, y: (s.r + 1) * TILE };
      const body = this.physics.add.body(spawn.x - MOVE.bodyW / 2, spawn.y - MOVE.bodyH, MOVE.bodyW, MOVE.bodyH);
      body.setMaxVelocityY(MOVE.maxFall);
      this.physics.add.collider(body, this.solids);
      const hero = new Hero(this, spawn.x, spawn.y, who).setDepth(DEPTH.heroes);
      const quip = this.tablet(0, 0, "Shocker.", { size: 12 }).setOrigin(0.5, 1).setVisible(false);
      return { who, spawn, body, hero, quip };
    });
    this.mech = new Mechanisms(this, grid, this.def.objects || [], this.players, this.solidRects);
    for (const p of this.players) {
      this.physics.add.collider(p.body, this.mech.blockers);
      this.physics.add.collider(p.body, this.mech.curtainsFor(p.who));
    }
    this.pickups = grid.pickups.map((p) => ({ ...p, obj: new Pickup(this, p.c * TILE + TILE / 2, p.r * TILE + TILE / 2, p.kind, PROP_RES, p.c * 0.7) }));
    this.totals = { bucks: this.pickups.filter((p) => p.kind === "buck").length, gavels: this.pickups.filter((p) => p.kind === "gavel").length };

    this.hud = new Hud(this, this.def.name, this.totals);
    this.next = levelAfter(ORDER, this.levelName);
    this.pauseMenu = new PauseMenu(this, {
      resume: () => this.setPaused(false), restart: () => this.restart(), levels: () => this.toLevels(),
      how: () => this.openPanel("how"), settings: () => this.openPanel("settings"),
    });
    const back = () => this.openPanel(null);
    this.panels = { how: new HowToPanel(this, { back }), settings: new SettingsPanel(this, { back }) };
    this.endCard = new EndCard(this, { again: () => this.restart(), levels: () => this.toLevels(), next: this.next && (() => this.scene.start("level", { level: this.next })) });

    this.input_ = createInput(this);
    this.stepper = createStepper({ manual: this.test });
    this.onKey("keydown-ESC", () => (this.panel ? this.openPanel(null) : this.togglePause()));
    this.onKey("keydown-R", () => this.restart());
    this.onKey("keydown-F", () => { if (!this.test) this.scale.toggleFullscreen(); });
    this.onKey("keydown-M", () => this.hud.setMuted(prefs.toggle("muted")));
    const unwatch = prefs.watch((st) => this.hud.setMuted(st.muted));
    this.events.once("shutdown", unwatch);
    this.hud.setMuted(prefs.get("muted"));
    this.padStartWas = false;

    this.reset();
    const { rs, game } = window.__sbg || {};
    window.__sbg = {
      rs, game,
      scene: "level",
      level: this.levelName,
      ready: true,
      /** Hold these keys for n fixed steps (tests and replays). */
      step: (n, keys = []) => { this.input_.script(keys); this.stepper.stepManual(n, () => this.simStep()); this.input_.script(null); return this.snapshot(); },
      snapshot: () => this.snapshot(),
      faceChecks: () => this.players.map(({ hero }) => faceCheck(hero)),
      /** Every pose on both heroes, frame by frame; returns any frame where a face check fails. Leaves the heroes posed oddly, so call it last. */
      sweepPoses: () => sweepPoses(this.players.map(({ hero }) => hero)),
      doors: () => this.doors.map(({ who, kind, x, y }) => ({ who, kind, x, y })),
      pickups: () => this.pickups.map(({ c, r, kind, taken }) => ({ c, r, kind, taken: !!taken })),
      /** Every sign's rect in world units: the level's tablets, then the motto sign over the exits. */
      signs: () => [
        ...this.signs.map((t) => { const b = t.getBounds(); return { kind: "tablet", text: t.text, x: b.x, y: b.y, w: b.width, h: b.height }; }),
        ...(this.archive.motto ? [{ kind: "motto", ...this.archive.motto }] : []),
      ],
    };
  }

  /** Put everything back to the start: heroes, pickups, gates, the clock. Used for R and after a death. */
  reset() {
    this.rng = createRng(this.levelName);
    this.time_ = 0;
    this.tick = 0;
    this.state = "play";      // play | dying | won
    this.paused = false;
    this.winT = 0;
    this.result = null;
    this.got = { bucks: [], gavels: 0 };
    for (const p of this.players) {
      p.dead = false; p.air = false; p.landT = 9; p.atDoor = false;
      p.jump = createJump();
      p.body.enable = true;
      p.body.reset(p.spawn.x - MOVE.bodyW / 2, p.spawn.y - MOVE.bodyH);
      p.hero.facing = p.who === "girl" && p.spawn.x > this.grid.w * TILE / 2 ? -1 : 1;
      p.hero.setPosition(p.spawn.x, p.spawn.y);
      p.hero.play("idle");
      p.quip.setVisible(false);
    }
    for (const it of this.pickups) { it.taken = false; it.obj.setVisible(true); }
    this.mech.reset();
    this.mechWas = null;      // the puzzle pieces' last state, for their sounds
    for (const d of this.doors) d.obj.setLit(false);
    this.openPanel(null, false);
    this.pauseMenu.hide();
    this.endCard.hide();
    this.render_();
  }

  restart() {
    this.reset();
  }

  toLevels() { this.scene.start("select"); }

  togglePause() { if (this.state !== "won") this.setPaused(!this.paused); }

  setPaused(v) {
    this.paused = v;
    this.openPanel(null, false);
    if (v) this.pauseMenu.show(); else this.pauseMenu.hide();
  }

  /** How to Play or Settings over the pause menu; null goes back to the pause menu. */
  openPanel(name, toMenu = true) {
    const was = this.panel;
    for (const [k, p] of Object.entries(this.panels)) if (k !== name) p.hide();
    this.panel = name;
    if (name) { this.pauseMenu.hide(); this.panels[name].show(); } else if (was && toMenu) this.pauseMenu.show(was === "how" ? 2 : 3);
  }

  update(_time, delta) {
    const start = this.input_.padStart();
    if (start && !this.padStartWas) this.togglePause();
    this.padStartWas = start;
    this.stepper.advance(delta, () => this.simStep());
  }

  simStep() {
    if (this.paused) return;
    const dt = 1 / HZ;
    const inp = this.input_.read();
    const dirs = {};
    if (this.state === "play") {
      for (const p of this.players) {
        const i = inp[p.who];
        const dir = (i.right ? 1 : 0) - (i.left ? 1 : 0);
        dirs[p.who] = dir;
        p.body.setVelocityX(dir * MOVE.runSpeed);
        if (dir) p.hero.facing = dir;
        const j = p.jump.step({ grounded: p.body.blocked.down, held: i.jump, vy: p.body.velocity.y, dt });
        if (j.jump) { p.body.setVelocityY(-MOVE.jumpSpeed); audio.play(p.who === "boy" ? "jumpBoy" : "jumpGirl", { x: p.body.center.x }); }
        if (j.cut) p.body.setVelocityY(p.body.velocity.y * MOVE.jumpCut);
      }
    } else {
      for (const p of this.players) if (p.body.enable) p.body.setVelocityX(0);
    }
    if (this.state !== "won") this.mech.pre(dt, dirs, this.time_);
    this.dirs = dirs;
    this.physics.world.singleStep();
    this.tick += dt;
    if (this.state === "play") this.time_ += dt;

    for (const p of this.players) this.updatePlayer(p, dt);
    if (this.state === "play") {
      this.updatePickups();
      this.mech.post(dt, this.dirs);
      this.mechSounds();
      this.updateDoors(dt);
    } else if (this.state === "dying") {
      if (this.players.some((p) => p.dead && p.hero.deathDone)) this.reset();
    } else if (this.state === "won") {
      this.winT += dt;
      if (this.winT >= LEVEL.endCardDelay && !this.endCard.visible) this.endCard.show(this.result);
    }
    this.render_();
  }

  updatePlayer(p, dt) {
    const { body, hero } = p;
    if (p.dead || this.state !== "play") {
      if (!p.dead && this.state === "dying") hero.setPosition(body.center.x, body.bottom); // the other one waits where they are
      hero.tickPose(dt, this.tick);
      return;
    }
    hero.setPosition(body.center.x, body.bottom);
    const onFloor = body.blocked.down;
    if (!onFloor) {
      p.air = true;
      hero.play(body.velocity.y < 0 ? "jump" : "fall");
    } else {
      if (p.air) { p.air = false; p.landT = 0; if (this.time_ > 0.3) audio.play("land", { x: body.center.x }); }
      p.landT += dt;
      hero.play(p.landT < LAND_LEN ? "land" : body.velocity.x !== 0 ? "run" : "idle");
    }
    hero.tickPose(dt, this.tick);
    const box = { x: body.left, y: body.top, w: body.width, h: body.height };
    for (const pool of this.pools) {
      if (overlaps(box, pool.hitRect) && poolKills(pool.kind, p.who)) { this.kill(p); return; }
    }
    if (this.mech.kills(p)) this.kill(p);
  }

  kill(p) {
    p.dead = true;
    p.body.stop();
    p.body.enable = false;
    p.hero.play("death");
    audio.play(p.who === "boy" ? "ember" : "splash", { x: p.body.center.x });
    p.quip.setPosition(p.hero.x, p.hero.y - 70).setVisible(true);
    this.state = "dying";
    for (const o of this.players) if (o !== p) { o.body.stop(); o.hero.play("idle"); }
  }

  /** Sounds for the puzzle pieces: a plate going down, a lever flipping, a gate starting to move. */
  mechSounds() {
    const m = this.mech;
    const now = { plates: m.plates.map((pl) => pl.down), levers: m.levers.map((l) => l.state.on), gates: m.gates.map((g) => g.art.state.open) };
    const was = this.mechWas;
    if (was) {
      now.plates.forEach((d, i) => { if (d && !was.plates[i]) audio.play("button", { x: m.plates[i].art.zone.x }); });
      now.levers.forEach((on, i) => { if (on !== was.levers[i]) audio.play("lever", { x: m.levers[i].x }); });
      now.moving = now.gates.map((o, i) => o !== was.gates[i]);
      now.moving.forEach((mv, i) => { if (mv && !was.moving?.[i]) audio.play("door", { x: m.gates[i].art.x }); });
    }
    this.mechWas = now;
  }

  updatePickups() {
    for (const it of this.pickups) {
      if (it.taken) continue;
      const who = it.kind === "buck" ? "boy" : "girl";
      const p = this.players.find((q) => q.who === who);
      const b = p.body;
      const zone = { x: it.obj.x - 9, y: it.obj.y - 9, w: 18, h: 18 };
      if (!overlaps({ x: b.left, y: b.top, w: b.width, h: b.height }, zone)) continue;
      it.taken = true;
      it.obj.setVisible(false);
      if (it.kind === "buck") {
        this.got.bucks.push(buckValue(this.time_));
        audio.play("buck", { rate: buckRate(buckValue(this.time_)), x: it.obj.x });
      } else { this.got.gavels++; audio.play("gavel", { x: it.obj.x }); }
    }
  }

  updateDoors(dt) {
    for (const p of this.players) {
      const d = this.doors.find((q) => q.who === p.who);
      p.atDoor = p.body.blocked.down && Math.abs(p.body.center.x - d.x) <= LEVEL.doorReach && Math.abs(p.body.bottom - d.y) < 2;
      if (d.obj.lit !== p.atDoor) d.obj.setLit(p.atDoor);
    }
    this.winT = this.players.every((p) => p.atDoor) ? this.winT + dt : 0;
    if (this.winT >= LEVEL.winHold) this.win();
  }

  win() {
    this.state = "won";
    this.winT = 0;
    this.result = tally({ bucks: this.got.bucks, gavels: this.got.gavels, totalBucks: this.totals.bucks, totalGavels: this.totals.gavels, time: this.time_ });
    this.result.bucks = this.got.bucks.length;
    this.result.gavels = this.got.gavels;
    this.result.totals = this.totals;
    progress.record(this.levelName, this.result.grade); // the best grade, and the next chamber opens
    audio.play("win");
    for (const p of this.players) {
      const d = this.doors.find((q) => q.who === p.who);
      p.body.stop();
      p.hero.setPosition(d.x, d.y); // step into the doorway
      p.hero.play("win");
    }
  }

  render_() {
    for (const pool of this.pools) pool.draw(this.tick);
    for (const it of this.pickups) if (!it.taken) it.obj.draw(this.tick);
    this.mech.draw(this.tick, this.time_);
    this.archive.update(this.tick, this.players.filter((p) => !p.dead).map((p) => p.hero));
    this.hud.update({ time: this.time_, value: buckValue(this.time_), bucks: this.got.bucks.length, gavels: this.got.gavels });
  }

  snapshot() {
    return {
      frame: this.stepper.frame,
      state: this.paused ? "paused" : this.state,
      time: Math.round(this.time_ * 1000) / 1000,
      buckValue: buckValue(this.time_),
      bucks: { got: this.got.bucks.length, total: this.totals.bucks },
      gavels: { got: this.got.gavels, total: this.totals.gavels },
      gates: this.mech.snapshot().gates,
      mech: this.mech.snapshot(),
      players: this.players.map((p) => ({
        who: p.who, x: p.body.x, y: p.body.y, vx: p.body.velocity.x, vy: p.body.velocity.y,
        pose: p.hero.kind, dead: p.dead, facing: p.hero.facing, atDoor: p.atDoor, grounded: p.body.blocked.down,
      })),
      result: this.result,
      endCard: this.endCard.visible,
      panel: this.panel || null,
      rng: this.rng.state,
    };
  }
}
