// The puzzle pieces at run time: pressure plates, levers (veto levers too), gates (bronze, and the
// filibuster wall that stays open once cloture is reached), moving platforms, business-cycle
// elevators, the checks-and-balances scale, surplus crates, the Rules Committee's sand clock and
// basins whose level the money supply lever sets. They talk through signals (src/logic/signals.js).
//
// Each fixed step: pre() moves platforms and crates (carrying whoever stands on them) before the
// physics step; post() reads plates, levers and timers into signals and opens or shuts gates.
import { Gate, Plate, LeverArt, SlabArt, ChainArt, CrateArt, HourglassArt, BasinArt, Curtain } from "../art/mechanisms.js";
import { evalSignal } from "../logic/signals.js";
import { pushLever, approach, cyclePhase, scaleOffset, stepTimer, stepLatch, ease } from "../logic/mechs.js";
import { stepGate, gateBlocks, barrierBlocks } from "../logic/gates.js";
import { poolKills } from "../logic/elements.js";
import { TILE, LEVEL, MECH, MOVE } from "../logic/config.js";

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const rectOf = (b) => ({ x: b.x, y: b.y, w: b.width, h: b.height });
const heroRect = (p) => ({ x: p.body.x, y: p.body.y, w: p.body.width, h: p.body.height });

/** Move (and resize) a static body that has no game object. */
function placeStatic(world, body, x, y, w = body.width, h = body.height) {
  world.staticTree.remove(body);
  body.position.set(x, y);
  body.width = w; body.height = h;
  body.halfWidth = w / 2; body.halfHeight = h / 2;
  body.updateCenter();
  world.staticTree.insert(body);
}

/** Shift a hero's body by (dx, dy) (riding a platform). */
function nudge(p, dx, dy) {
  p.body.position.x += dx;
  p.body.position.y += dy;
  p.body.updateCenter();
}

export class Mechanisms {
  /**
   * @param {Phaser.Scene} scene @param grid parsed grid @param {object[]} objects the level's objects
   * @param {object[]} players @param {{x,y,w,h}[]} solidRects stone and pools, in pixels
   */
  constructor(scene, grid, objects, players, solidRects) {
    this.scene = scene;
    this.world = scene.physics.world;
    this.players = players;
    this.solidRects = solidRects;
    this.sig = {};
    const add = (x, y, w, h) => scene.physics.add.staticBody(x, y, w, h);

    // curtains (from the grid): solid only for the hero they keep out
    this.curtains = grid.barriers.map((b) => ({ b, art: new Curtain(scene, b), body: add(b.c * TILE, b.r * TILE, b.w * TILE, b.h * TILE) }));

    // plates: grid digits 1-4 are ids P1-P4; object plates name their own id
    const plateDefs = [...grid.plates.map((p) => ({ ...p, id: `P${p.group}` })), ...objects.filter((o) => o.type === "plate")];
    this.plates = plateDefs.map((d) => ({ id: d.id, art: new Plate(scene, { c: d.c, r: d.r, group: d.id }) }));

    // gates: grid digits 5-8 open with plates 1-4; object gates have their own signal, maybe a latch
    const gateDefs = [...grid.gates.map((g) => ({ ...g, open: `P${g.group}` })), ...objects.filter((o) => o.type === "gate")];
    this.gates = gateDefs.map((d) => {
      const art = new Gate(scene, { group: d.open, c: d.c, r: d.r, w: d.w || 1, h: d.h || 1, style: d.style });
      return { d, art, body: add(art.x, art.y, art.w, art.h), latch: { on: false } };
    });

    this.levers = objects.filter((o) => o.type === "lever").map((d) => ({
      d, state: { on: !!d.start, rules: { on: d.on, off: d.off } },
      x: d.c * TILE + TILE / 2, y: (d.r + 1) * TILE, art: new LeverArt(scene, d.c * TILE + TILE / 2, (d.r + 1) * TILE, { on: d.on, off: d.off }),
    }));

    this.timers = objects.filter((o) => o.type === "timer").map((d) => ({ d, state: { left: 0 }, art: new HourglassArt(scene, d.c * TILE + TILE / 2, (d.r + 1) * TILE) }));

    // moving platforms (driven by a signal) and business-cycle elevators (always running)
    this.movers = objects.filter((o) => o.type === "mover" || o.type === "elevator").map((d) => {
      const w = (d.w || 2) * TILE, h = MECH.slab;
      const from = { x: d.c * TILE, y: d.r * TILE }, to = { x: d.to[0] * TILE, y: d.to[1] * TILE };
      const art = new SlabArt(scene, w, h, d.type === "elevator" ? "elevator" : "platform");
      return { d, from, to, w, h, k: 0, art, body: add(from.x, from.y, w, h), x: from.x, y: from.y };
    });

    // the scale: two pans; the heavier sinks, the lighter rises; equal weights level out
    this.scales = objects.filter((o) => o.type === "scale").map((d) => {
      const pan = ([c, r, w]) => {
        const x = c * TILE, y = r * TILE, pw = w * TILE;
        let top = Math.ceil(r) - 1; // pans may sit at half tiles
        while (top > 0 && !grid.isSolid(c, top)) top--;
        return { x, y0: y, y, w: pw, h: MECH.slab, art: new SlabArt(scene, pw, MECH.slab, "pan"), body: add(x, y, pw, MECH.slab), anchor: (top + 1) * TILE };
      };
      return { d, left: pan(d.left), right: pan(d.right), off: 0, chains: new ChainArt(scene) };
    });

    // basins: a pool whose level rises and falls with the money supply lever
    this.basins = objects.filter((o) => o.type === "basin").map((d) => ({
      d, top: d.r * TILE, bottom: (d.r + d.h) * TILE, level: d.startHigh === false ? (d.r + d.h) * TILE : d.r * TILE,
      x: d.c * TILE, w: d.w * TILE, art: new BasinArt(scene, d.c * TILE, d.w * TILE, d.kind || "inflation"),
      body: add(d.c * TILE, d.r * TILE, d.w * TILE, d.h * TILE),
    }));

    this.crates = objects.filter((o) => o.type === "crate").map((d) => {
      const w = MECH.crateW, h = TILE;
      return { d, w, h, x: d.c * TILE + (TILE - w) / 2, y: d.r * TILE, vy: 0, art: new CrateArt(scene, w, h), body: add(d.c * TILE + (TILE - w) / 2, d.r * TILE, w, h) };
    });
  }

  /** Static bodies every hero collides with (gates, platforms, pans, basin surfaces, crates). */
  get blockers() {
    return [...this.gates.map((g) => g.body), ...this.movers.map((m) => m.body), ...this.scales.flatMap((s) => [s.left.body, s.right.body]), ...this.basins.map((b) => b.body), ...this.crates.map((c) => c.body)];
  }

  /** Curtains this hero can't pass. */
  curtainsFor(who) { return this.curtains.filter((k) => barrierBlocks(k.b.kind, who)).map((k) => k.body); }

  reset() {
    this.sig = {};
    for (const g of this.gates) { g.art.state.open = 0; g.latch.on = false; g.body.enable = true; }
    for (const l of this.levers) l.state.on = !!l.d.start;
    for (const t of this.timers) t.state.left = 0;
    for (const m of this.movers) { m.k = 0; m.x = m.from.x; m.y = m.from.y; placeStatic(this.world, m.body, m.x, m.y); }
    for (const s of this.scales) { s.off = 0; for (const p of [s.left, s.right]) { p.y = p.y0; placeStatic(this.world, p.body, p.x, p.y); } }
    for (const b of this.basins) { b.level = b.d.startHigh === false ? b.bottom : b.top; this.placeBasin(b); }
    for (const c of this.crates) { c.x = c.d.c * TILE + (TILE - c.w) / 2; c.y = c.d.r * TILE; c.vy = 0; placeStatic(this.world, c.body, c.x, c.y); }
    this.post(0, null);
    // a gate whose signal is already on when the level starts (a "!lever" gate) starts open
    for (const g of this.gates) if (evalSignal(g.d.open, this.sig)) { g.art.state.open = 1; g.body.enable = gateBlocks(g.art.state); }
  }

  placeBasin(b) {
    const h = b.bottom - b.level;
    b.body.enable = h > 1;
    placeStatic(this.world, b.body, b.x, b.level, b.w, Math.max(1, h));
  }

  // ------------------------------------------------------------------ before the physics step
  /** @param {number} dt @param {Record<string, number>} dirs each hero's input direction @param {number} time level clock */
  pre(dt, dirs, time) {
    // things that ride: heroes and crates standing on a moving surface get carried with it
    const carry = (rect, dx, dy) => {
      if (!dx && !dy) return;
      for (const p of this.players) {
        if (p.dead || !p.body.enable) continue;
        const b = p.body;
        if (Math.abs(b.bottom - rect.y) < 2.5 && b.right > rect.x && b.x < rect.x + rect.w && b.velocity.y >= -1) nudge(p, dx, dy);
      }
      for (const c of this.crates) {
        if (Math.abs(c.y + c.h - rect.y) < 1.5 && c.x + c.w > rect.x && c.x < rect.x + rect.w) this.moveCrate(c, dx, dy, true);
      }
    };
    const blockedByHero = (rect, riders) => this.players.some((p) => !p.dead && p.body.enable && !riders(p) && overlaps(heroRect(p), rect));

    for (const m of this.movers) {
      let k;
      if (m.d.type === "elevator") k = cyclePhase(time, m.d.period || 6, m.d.offset || 0);
      else {
        const dist = Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y) || 1;
        k = approach(m.k, evalSignal(m.d.when, this.sig) ? 1 : 0, (m.d.speed || MECH.moverSpeed) / dist, dt);
      }
      const e = m.d.type === "elevator" ? k : ease(k);
      const nx = m.from.x + (m.to.x - m.from.x) * e, ny = m.from.y + (m.to.y - m.from.y) * e;
      const old = { x: m.x, y: m.y, w: m.w, h: m.h };
      const onTop = (p) => Math.abs(p.body.bottom - old.y) < 2.5 && p.body.right > old.x && p.body.x < old.x + old.w;
      if (m.d.type !== "elevator" && ny > old.y && blockedByHero({ x: nx, y: ny, w: m.w, h: m.h }, onTop)) continue; // never crush a hero
      m.k = k;
      placeStatic(this.world, m.body, nx, ny);
      m.x = nx; m.y = ny;
      carry(old, nx - old.x, ny - old.y);
    }

    for (const s of this.scales) {
      const load = (pan) => this.players.filter((p) => !p.dead && p.body.enable && p.body.blocked.down && Math.abs(p.body.bottom - pan.y) < 2.5 && p.body.right > pan.x && p.body.x < pan.x + pan.w).length
        + this.crates.filter((c) => Math.abs(c.y + c.h - pan.y) < 1.5 && c.x + c.w > pan.x && c.x < pan.x + pan.w).length;
      const target = scaleOffset(load(s.left), load(s.right), (s.d.travel ?? 2) * TILE);
      const off = approach(s.off, target, s.d.speed || MECH.scaleSpeed, dt);
      const d = off - s.off;
      if (!d) continue;
      s.off = off;
      for (const [pan, dy] of [[s.left, d], [s.right, -d]]) {
        const old = { x: pan.x, y: pan.y, w: pan.w, h: pan.h };
        pan.y += dy;
        placeStatic(this.world, pan.body, pan.x, pan.y);
        carry(old, 0, dy);
      }
    }

    for (const b of this.basins) {
      const target = evalSignal(b.d.high, this.sig) ? b.top : b.bottom;
      const lvl = approach(b.level, target, b.d.speed || MECH.basinSpeed, dt);
      if (lvl === b.level) continue;
      const old = { x: b.x, y: b.level, w: b.w, h: 1 };
      b.level = lvl;
      this.placeBasin(b);
      carry(old, 0, lvl - old.y);
    }

    // crates: pushed by a hero walking into them on the ground, and falling when nothing holds them up
    for (const p of this.players) {
      const dir = dirs[p.who];
      if (!dir || p.dead || !p.body.blocked.down) continue;
      const b = p.body;
      for (const c of this.crates) {
        const touching = dir > 0 ? Math.abs(b.right - c.x) < 2.5 : Math.abs(c.x + c.w - b.x) < 2.5;
        if (!touching || b.bottom <= c.y + 4 || b.y >= c.y + c.h - 4) continue;
        const moved = this.moveCrate(c, dir * MECH.pushSpeed * dt, 0, false, p);
        if (moved) b.setVelocityX(dir * MECH.pushSpeed);
      }
    }
    for (const c of this.crates) {
      c.vy = Math.min(MOVE.maxFall, c.vy + MOVE.gravity * dt);
      if (!this.moveCrate(c, 0, c.vy * dt, false)) c.vy = 0;
    }
  }

  /** Try to move a crate; it stops at anything solid (forced: carried by a platform, no checks). */
  moveCrate(c, dx, dy, forced, pusher = null) {
    if (!dx && !dy) return false;
    let nx = c.x + dx, ny = c.y + dy;
    if (!forced) {
      const rect = { x: nx, y: ny, w: c.w, h: c.h };
      const hits = this.crateBlockers(c, pusher).filter((r) => overlaps(rect, r));
      if (hits.length) {
        if (dy > 0 && !dx) { // land on the highest thing below
          const top = Math.min(...hits.map((r) => r.y));
          ny = top - c.h;
          if (ny <= c.y + 1e-6) return false;
        } else return false;
      }
    }
    c.x = nx; c.y = ny;
    placeStatic(this.world, c.body, nx, ny);
    return true;
  }

  crateBlockers(self, pusher) {
    const out = [...this.solidRects];
    for (const g of this.gates) if (g.body.enable) out.push(rectOf(g.body));
    for (const k of this.curtains) out.push(rectOf(k.body));
    for (const m of this.movers) out.push({ x: m.x, y: m.y, w: m.w, h: m.h });
    for (const s of this.scales) for (const p of [s.left, s.right]) out.push({ x: p.x, y: p.y, w: p.w, h: p.h });
    for (const b of this.basins) if (b.body.enable) out.push({ x: b.x, y: b.level, w: b.w, h: b.bottom - b.level });
    for (const c of this.crates) if (c !== self) out.push({ x: c.x, y: c.y, w: c.w, h: c.h });
    for (const p of this.players) if (p !== pusher && !p.dead && p.body.enable) out.push(heroRect(p));
    return out;
  }

  // ------------------------------------------------------------------ after the physics step
  /** Read plates, levers and timers into signals; open or shut gates. dirs: each hero's input direction. */
  post(dt, dirs) {
    const sig = {};
    const live = this.players.filter((p) => !p.dead && p.body.enable);
    const groups = {};
    for (const pl of this.plates) {
      const z = pl.art.zone;
      const hero = live.some((p) => p.body.blocked.down && Math.abs(p.body.bottom - z.y) < 2 && p.body.x < z.x + z.w && p.body.right > z.x);
      const crate = this.crates.some((c) => Math.abs(c.y + c.h - z.y) < 1.5 && c.x < z.x + z.w && c.x + c.w > z.x);
      const down = hero || crate;
      pl.down = down;
      pl.art.draw(down);
      (groups[pl.id] ??= []).push(down);
    }
    for (const [id, list] of Object.entries(groups)) { sig[id] = list.some(Boolean); sig[`${id}all`] = list.every(Boolean); }

    for (const l of this.levers) {
      if (dirs) for (const p of live) {
        const d = dirs[p.who];
        if (!d) continue;
        if (Math.abs(p.body.center.x - l.x) < 10 && p.body.bottom > l.y - 24 && p.body.y < l.y) pushLever(l.state, { dir: d, who: p.who });
      }
      sig[l.d.id] = l.state.on;
    }

    for (const t of this.timers) {
      sig[t.d.id] = stepTimer(t.state, { trigger: evalSignal(t.d.trigger, { ...this.sig, ...sig }), dt, seconds: t.d.seconds });
      t.art.draw(t.state.left / t.d.seconds, t.state.left);
    }
    this.sig = sig;

    for (const g of this.gates) {
      let held = evalSignal(g.d.open, sig);
      if (g.d.latch) held = stepLatch(g.latch, held);
      const occupied = live.some((p) => overlaps(heroRect(p), g.art.rect)) || this.crates.some((c) => overlaps({ x: c.x, y: c.y, w: c.w, h: c.h }, g.art.rect));
      stepGate(g.art.state, { held, occupied, dt, speed: LEVEL.gateSpeed });
      g.body.enable = gateBlocks(g.art.state);
    }
  }

  /** Does a basin's liquid kill this hero? */
  kills(p) {
    const box = heroRect(p);
    return this.basins.some((b) => b.bottom - b.level > 2 && poolKills(b.d.kind || "inflation", p.who) && overlaps(box, { x: b.x + 4, y: b.level - 2, w: b.w - 8, h: 8 }));
  }

  draw(tick, time) {
    for (const k of this.curtains) k.art.draw(tick);
    for (const g of this.gates) g.art.draw();
    for (const l of this.levers) l.art.draw(l.state.on, tick);
    for (const m of this.movers) {
      m.art.setPosition(m.x, m.y);
      if (m.d.type === "elevator") m.art.draw(cyclePhase(time, m.d.period || 6, m.d.offset || 0));
    }
    for (const s of this.scales) {
      for (const p of [s.left, s.right]) p.art.setPosition(p.x, p.y);
      s.chains.draw([s.left, s.right].flatMap((p) => [[p.x + 5, p.anchor, p.y], [p.x + p.w - 5, p.anchor, p.y]]));
    }
    for (const b of this.basins) b.art.draw(b.level, b.bottom, tick);
    for (const c of this.crates) c.art.setPosition(c.x, c.y);
  }

  snapshot() {
    const r = (v) => Math.round(v * 100) / 100;
    return {
      sig: { ...this.sig },
      levers: Object.fromEntries(this.levers.map((l) => [l.d.id, l.state.on])),
      timers: Object.fromEntries(this.timers.map((t) => [t.d.id, r(t.state.left)])),
      movers: this.movers.map((m) => ({ id: m.d.id, x: r(m.x), y: r(m.y) })),
      scales: this.scales.map((s) => ({ left: r(s.left.y), right: r(s.right.y) })),
      basins: this.basins.map((b) => r(b.level)),
      crates: this.crates.map((c) => ({ x: r(c.x), y: r(c.y) })),
      gates: this.gates.map((g) => r(g.art.state.open)),
    };
  }
}
