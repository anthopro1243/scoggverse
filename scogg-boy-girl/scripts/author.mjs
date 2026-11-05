#!/usr/bin/env node
// Writes a level's replay from a plan. A plan (replays/plans/<level>.json) lists each hero's moves
// in plain steps; this plays them against the real game (headless, fixed timestep), steering frame
// by frame, and saves the keys it pressed as replays/<level>.json. The replay is plain keys per
// frame, so the solvability test doesn't depend on this tool. Usage (with `npm run preview`):
//   node scripts/author.mjs <level>
//
// Moves (each hero runs its list in order, both at once):
//   ["walk", x]            walk until the hero's center is at x
//   ["jumpTo", x, hold?, delay?]  jump, steer toward x in the air, done on landing (hold: frames the jump
//                          key is held, default full; delay: frames to rise straight up before steering)
//   ["jump", dir, hold?]   jump straight (0) or holding left (-1) / right (1), done on landing
//   ["wait", n]            stand still n frames
//   ["until", "expr"]      stand still until expr is true (s = snapshot, me / other = the heroes)
//   ["walkUntil", dir, "expr"]  walk that way until expr is true
//   ["mark", "name"]       print where everyone is (for tuning)
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const [level] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(`replays/plans/${level.replace("/", "-")}.json`, "utf8"));
const url = process.env.SBG_URL || "http://localhost:4174";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on("pageerror", (e) => console.log("ERROR", e.message));
await page.goto(`${url}/?test=1&level=${plan.level}`);
await page.waitForFunction(() => window.__sbg?.ready);

const out = await page.evaluate((plan) => {
  const KEYS = { boy: { l: "A", r: "D", j: "W" }, girl: { l: "LEFT", r: "RIGHT", j: "UP" } };
  const log = (window.__authorLog = []);
  const runner = (who, idx) => {
    const list = plan[who] || [];
    let i = 0, st = null, frames = 0;
    const fn = (src) => new Function("s", "me", "other", `return (${src});`);
    return {
      done: () => i >= list.length,
      keys(s) {
        for (let guard = 0; guard < 20 && i < list.length; guard++) {
          const a = list[i];
          const me = s.players[idx], other = s.players[1 - idx];
          const cx = me.x + 10;
          const K = KEYS[who];
          const dirKey = (d) => (d > 0 ? [K.r] : d < 0 ? [K.l] : []);
          const next = () => { i++; st = null; frames = 0; };
          frames++;
          if (frames > 1500) throw new Error(`${who} stuck on step ${i}: ${JSON.stringify(a)} (frame ${s.frame}; ${s.players.map((p) => `${p.who} x${(p.x + 10).toFixed(1)} y${(p.y + 52).toFixed(1)}`).join(", ")}; gates ${JSON.stringify(s.gates)}; missed ${JSON.stringify(window.__sbg.pickups().filter((q) => !q.taken).map((q) => [q.kind, q.c, q.r]))})`);
          const [op] = a;
          if (op === "walk") {
            const d = a[1] - cx;
            if (Math.abs(d) <= 1.8) { next(); continue; }
            return dirKey(Math.sign(d));
          }
          if (op === "walkUntil") {
            if (fn(a[2])(s, me, other)) { next(); continue; }
            return dirKey(a[1]);
          }
          if (op === "wait") {
            if (frames > a[1]) { next(); continue; }
            return [];
          }
          if (op === "until") {
            if (fn(a[1])(s, me, other)) { next(); continue; }
            return [];
          }
          if (op === "mark") { log.push(`${s.frame} ${a[1]}: ${s.players.map((p) => `${p.who} x${(p.x + 10).toFixed(1)} y${(p.y + 52).toFixed(1)}${p.grounded ? "" : " air"}`).join(" | ")} ${JSON.stringify(s.mech.sig)}`); next(); continue; }
          if (op === "jump" || op === "jumpTo") {
            st ??= { phase: "press", t: 0 };
            st.t++;
            const hold = a[2] ?? 40;
            let dir;
            if (op === "jump") dir = a[1];
            else { const d = a[1] - cx; dir = Math.abs(d) > 2.5 && st.t0 !== undefined && st.t - st.t0 >= (a[3] ?? 0) ? Math.sign(d) : 0; }
            if (st.phase === "press") {
              // wait until standing (a hero is in the air for a frame after spawning), then take off
              if (me.grounded) { st.pressed = (st.pressed || 0) + 1; st.t0 ??= st.t; if (st.pressed > 4) throw new Error(`${who} couldn't jump at step ${i} (x ${cx.toFixed(1)})`); }
              else if (st.pressed) st.phase = "air";
              else if (st.t > 60) throw new Error(`${who} never landed to jump at step ${i}`);
            } else if (st.phase === "air" && me.grounded) { next(); continue; }
            const jumpKey = st.t <= hold && (st.phase === "press" || me.vy < 0) ? [K.j] : [];
            return [...dirKey(dir), ...jumpKey];
          }
          throw new Error(`unknown move ${op}`);
        }
        return [];
      },
    };
  };
  const rb = runner("boy", 0), rg = runner("girl", 1);
  const tracks = { boy: [], girl: [] };
  let s = window.__sbg.snapshot();
  let after = 0;
  for (let f = 0; f < 20000; f++) {
    if (s.state === "dying") throw new Error(`a hero died at frame ${s.frame}: ${JSON.stringify(s.players.map((p) => [p.who, Math.round(p.x + 10), Math.round(p.y + 52), p.dead]))}`);
    const kb = rb.keys(s), kg = rg.keys(s);
    tracks.boy.push(kb); tracks.girl.push(kg);
    s = window.__sbg.step(1, [...kb, ...kg]);
    if (s.endCard) { if (++after > 12) break; }
    else if (rb.done() && rg.done() && s.state === "play" && f > 0 && (s.frame - (s._idle ??= s.frame)) > 240) throw new Error("both plans finished but the level isn't won");
  }
  const pack = (t) => { const out = []; for (const k of t) { const last = out[out.length - 1]; if (last && last[1].join() === k.join()) last[0]++; else out.push([1, k]); } return out; };
  log.push(`missed: ${JSON.stringify(window.__sbg.pickups().filter((p) => !p.taken))}`);
  return { boy: pack(tracks.boy), girl: pack(tracks.girl), log, end: { state: s.state, time: s.time, bucks: s.bucks, gavels: s.gavels, result: s.result && { grade: s.result.grade, value: s.result.value, best: s.result.best } } };
}, plan).catch(async (e) => {
  for (const l of await page.evaluate(() => window.__authorLog || [])) console.log(l);
  console.log("FAILED:", e.message.split("\n")[0]);
  return null;
});

await browser.close();
if (!out) process.exit(1);
for (const l of out.log) console.log(l);
console.log("END", JSON.stringify(out.end));
const fmt = (t) => "[\n" + t.map((x) => `    ${JSON.stringify(x)}`).join(",\n") + "\n  ]";
writeFileSync(`replays/${level.replace("/", "-")}.json`, `{\n  "level": ${JSON.stringify(plan.level)},\n  "note": ${JSON.stringify(plan.note || "")},\n  "boy": ${fmt(out.boy)},\n  "girl": ${fmt(out.girl)}\n}\n`);
console.log(`wrote replays/${level.replace("/", "-")}.json`);
