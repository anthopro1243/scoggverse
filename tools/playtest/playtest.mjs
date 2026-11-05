// Real-browser playtest: opens the web build in headless Chromium and plays it with
// mouse clicks, mouse moves and key presses. Decisions use only `observe` (what's on
// screen); `truth` is read only to check results and to time the scripted player.
//
//   node playtest.mjs --url=http://localhost:8060 [--share=TOKEN] [--speed=4]
//                     [--only=well,idle,...] [--video=../../docs/media] [--out=../../docs/playtest]
//
// Needs the build's TestBridge (?test=1). Coordinates are in the game's 1920x1080 space.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, "").split("=");
  return [k, v.join("=") || "1"];
}));
const BASE = (args.url || "http://localhost:8060").replace(/\/$/, "");
const DEFAULT_SPEED = Number(args.speed || 4);
// A real-input player needs ~2 frames per action; the full well-played night runs slower so it keeps up.
const SCENARIO_SPEED = { well: Math.min(DEFAULT_SPEED, 2) };
let SPEED = DEFAULT_SPEED;
const ONLY = args.only ? args.only.split(",") : null;
const VIDEO_DIR = args.video ? path.resolve(args.video) : null;
const OUT_DIR = path.resolve(args.out || "../../docs/playtest");
const VIEW = { width: 1280, height: 720 };
const K = VIEW.width / 1920;

const BTN = {
  howBack: [1750, 995],
  door: [[114, 435], [1806, 435]], light: [[114, 565], [1806, 565]],
  pause: [59, 50], pauseResume: [960, 427], pauseHow: [960, 547],
  retry: [740, 675], overMenu: [1180, 675], winNext: [740, 815], winMenu: [1180, 815], winMenuOnly: [960, 815],
  customStart: [1640, 980], customBack: [280, 980],
  neutral: [960, 300], belowFeed: [960, 700], bar: [960, 1025],
};
const CAM = {
  1: [1337, 721], 2: [1337, 795], 3: [1209, 795], 4: [1465, 795], 5: [1209, 721],
  6: [1209, 869], 7: [1209, 943], 8: [1465, 869], 9: [1465, 943],
};

class Game {
  constructor(page) { this.page = page; this.errors = []; this.log = []; this.console = []; }
  consoleTail() { return this.console.slice(-8); }
  async state() {
    return this.page.evaluate(() => (window.fnasState ? JSON.parse(window.fnasState) : null));
  }
  async obs() { return (await this.state())?.observe; }
  async move([x, y]) { await this.page.mouse.move(x * K, y * K); }
  async click(xy) { await this.move(xy); await this.page.mouse.down(); await this.page.mouse.up(); }
  async key(k) { await this.page.keyboard.press(k); }
  async gameSleep(seconds) { await this.page.waitForTimeout((seconds * 1000) / SPEED); }
  async waitFor(pred, what, realMs = 15000) {
    const end = Date.now() + realMs;
    while (Date.now() < end) {
      const s = await this.state();
      if (s && pred(s)) return s;
      await this.page.waitForTimeout(30);
    }
    throw new Error(`timed out waiting for ${what}`);
  }
  note(msg) { this.log.push(msg); console.log("   ", msg); }

  async cmd(c) { await this.page.evaluate((x) => { window.fnasCmd = x; }, c); await this.page.waitForTimeout(100); }
  // Title buttons stack on the left from y=490, 105 apart; which ones show depends on the save.
  async titleButton(prefix) {
    const s = await this.waitFor((x) => x.scene === "Title" && x.title_buttons, "title screen", 60000);
    const i = s.title_buttons.findIndex((b) => b.startsWith(prefix));
    if (i < 0) throw new Error(`no "${prefix}" button on the title (${s.title_buttons.join(", ")})`);
    return [430, 490 + i * 105 + 47];
  }
  async skipIntro(title) {
    const s = await this.waitFor((x) => x.observe?.ending === "intro", "intro card");
    if (title && s.observe.night_title !== title) throw new Error(`intro says ${s.observe.night_title}, expected ${title}`);
    await this.click(BTN.neutral);
    await this.waitFor((x) => x.observe?.ending === "" && x.observe.state === "playing", "night to start");
    return s.observe.night_title;
  }
  async startNight() {
    await this.click(await this.titleButton("New Game"));
    await this.skipIntro("Night 1");
    await this.move(BTN.neutral);
  }
  // Test-only shortcut: set the Continue night, reload, and continue from the title.
  async startNightAt(n) {
    await this.waitFor((x) => x.scene === "Title", "title screen", 60000);
    await this.cmd(`progress:${n}`);
    await this.page.reload({ waitUntil: "domcontentloaded" });
    await this.click(await this.titleButton("Continue"));
    await this.skipIntro(`Night ${n}`);
    await this.move(BTN.neutral);
  }
  async raiseTablet() {
    const o = await this.obs();
    if (o.tablet_up) return;
    await this.move(BTN.belowFeed);
    await this.move(BTN.bar);
    await this.waitFor((s) => s.observe.tablet_up || s.observe.state !== "playing", "tablet up");
  }
  async lowerTablet() {
    const o = await this.obs();
    if (!o.tablet_up) return;
    await this.move(BTN.belowFeed);
    await this.move(BTN.bar);
    await this.waitFor((s) => !s.observe.tablet_up, "tablet down");
    await this.move(BTN.neutral);
  }
  async viewCam(n) {
    await this.click(CAM[n]);
    return (await this.waitFor((s) => s.observe.cam === String(n) || s.observe.state !== "playing", `CAM ${n}`)).observe;
  }
  async setDoor(side, shut) {
    const o = await this.obs();
    if (o.doors[side] === shut || o.jammed[side] || o.tablet_up) return;
    await this.click(BTN.door[side]);
    await this.waitFor((s) => s.observe.doors[side] === shut || s.observe.state !== "playing", "door");
    await this.move(BTN.neutral);
  }
  async peekDoor(side) {
    const o = await this.obs();
    if (o.jammed[side] || o.tablet_up) return { bot: "", jammed: o.jammed[side] };
    await this.click(BTN.light[side]);
    const lit = (await this.waitFor((s) => s.observe.light_side === side || s.observe.state !== "playing", "light on")).observe;
    await this.gameSleep(0.2);
    const bot = (await this.obs()).lit_door_bot;
    await this.click(BTN.light[side]);
    await this.waitFor((s) => s.observe.light_side !== side || s.observe.state !== "playing", "light off");
    await this.move(BTN.neutral);
    return { bot, jammed: lit.jammed[side] };
  }
  async over() {
    const s = await this.state();
    return !s?.observe || s.observe.ending !== "" || ["won", "lost"].includes(s.observe.state);
  }
  async waitForEnd(realMs) {
    return this.waitFor((s) => s.observe && (s.observe.ending === "win" || s.observe.ending === "game_over"), "night to end", realMs);
  }
}

// --- The scripted "decent player" (same habits as tools/decent_player.gd) ---
async function playWell(g, { useCameras = true } = {}) {
  const want = [false, false];
  let leaderCorner = false;
  let guardUntil = -1;
  let lastHits = 0;
  let nextLights = 0;
  let nextCams = 4;
  let rounds = 0;
  while (!(await g.over())) {
    const s = await g.state();
    const t = s.truth.time;
    if (s.truth.sprinter_hits > lastHits) { // the bang on the left door is audible
      lastHits = s.truth.sprinter_hits;
      guardUntil = -1;
      g.note(`${s.observe.clock}: Scoggis Khan banged on the shut left door`);
    }
    if (guardUntil >= 0 && t > guardUntil) guardUntil = -1;
    if (t >= nextLights) {
      nextLights = t + 3;
      for (const side of [0, 1]) {
        const { bot } = await g.peekDoor(side);
        if (process.env.PT_DEBUG) { const d = await g.state(); g.note(`t=${d.truth.time.toFixed(1)} peek ${side} -> '${bot}' rooms=${JSON.stringify(d.truth.rooms)}`); }
        if (bot && !want[side]) g.note(`${(await g.obs()).clock}: ${bot} at the ${side ? "right" : "left"} door, shutting it`);
        if (!bot && want[side]) g.note(`${(await g.obs()).clock}: ${side ? "right" : "left"} doorway clear, opening`);
        want[side] = bot !== "";
        await g.setDoor(side, want[side] || (side === 0 && guardUntil >= 0) || (side === 1 && leaderCorner));
      }
    }
    if (await g.over()) break;
    const t2 = (await g.state()).truth.time;
    if (useCameras && t2 >= nextCams) {
      nextCams = t2 + 9;
      rounds++;
      // The night can end (6 AM or an attack) mid-round; the scenario then checks how it ended.
      try {
      await g.raiseTablet();
      let o = await g.viewCam(9);
      await g.gameSleep(0.3);
      leaderCorner = (await g.obs()).cam_bots.includes("Uncle Scogg");
      if (!(leaderCorner && !o.doors[1])) {
        o = await g.viewCam(5);
        await g.gameSleep(0.3);
        o = await g.obs();
        if (o.curtain_empty) { guardUntil = t2 + 30; g.note(`${o.clock}: curtain empty, guarding left door`); }
        else if (o.curtain_stage === 2) nextCams = t2 + 4.5;
        await g.viewCam(6);
        await g.gameSleep(0.3);
        o = await g.obs();
        if (o.cam_bots.includes("Scoggis Khan")) { guardUntil = t2 + 30; g.note(`${o.clock}: Scoggis Khan running on CAM 6`); }
      }
      await g.lowerTablet();
      } catch (e) {
        if (await g.over()) break;
        throw e;
      }
    }
    if (await g.over()) break;
    for (const side of [0, 1]) {
      const shut = want[side] || (side === 0 && guardUntil >= 0) || (side === 1 && leaderCorner);
      await g.setDoor(side, shut);
    }
    await g.gameSleep(0.1);
  }
  return rounds;
}

// --- Scenarios ---
const scenarios = {
  async well(g) {
    await g.startNight();
    const rounds = await playWell(g);
    const s = await g.waitForEnd(120000);
    await g.page.waitForTimeout(2500); // hold on the end screen for the recording
    const o = s.observe;
    g.note(`ended: ${o.ending} at ${o.clock}, power ${o.power}%, ${rounds} camera checks`);
    return { pass: o.ending === "win", detail: o.ending === "win" ? `Survived to 6 AM with ${o.power}% power (${rounds} camera checks)` : `Died: ${s.truth.death_cause} at ${o.clock}` };
  },

  async idle(g) {
    await g.startNight();
    const s = await g.waitForEnd((600 / SPEED) * 1000 + 30000);
    const died = s.observe.ending === "game_over";
    if (!died) return { pass: false, retry: true, detail: "Survived Night 1 without doing anything (the simulator says ~6% of idle nights do)" };
    // Also exercises the game-over buttons.
    await g.click(BTN.retry);
    await g.skipIntro("Night 1");
    await g.key("Escape");
    await g.waitFor((x) => x.observe?.paused, "pause");
    await g.click([960, 867]); // Quit to title (5th pause button since Settings was added)
    await g.waitFor((x) => x.scene === "Title", "title");
    return { pass: true, detail: `Killed by ${s.truth.death_cause} at ${s.observe.clock}; Retry and Quit to title worked` };
  },

  async open_door(g) {
    await g.startNightAt(3); // Night 1's robots can take until 6 AM to reach a door
    let seen = null;
    let looks = 0;
    while (!seen && !(await g.over())) {
      for (const side of [0, 1]) {
        const { bot } = await g.peekDoor(side);
        if (bot === "Scoggcrates" || bot === "Scogga Lisa") { seen = { side, bot }; break; }
      }
      if (seen) break;
      // Glance at the curtain now and then so Scoggis Khan stays put while we wait.
      if (++looks % 3 === 0) {
        await g.raiseTablet();
        await g.viewCam(5);
        await g.gameSleep(0.5);
        await g.lowerTablet();
      }
      await g.gameSleep(1);
    }
    if (!seen) { const st = await g.state(); return { pass: false, retry: true, detail: st.truth.death_cause ? `Died before a bot reached a door: ${st.truth.death_cause}` : "No bot reached a door before 6 AM" }; }
    const clockSeen = (await g.obs()).clock;
    g.note(`${clockSeen}: ${seen.bot} at the ${seen.side ? "right" : "left"} door, leaving it open`);
    // Keep checking cameras (raise/lower) like a player who forgot the door.
    while (!(await g.over())) {
      await g.raiseTablet();
      await g.gameSleep(2);
      await g.lowerTablet().catch(() => {});
      await g.gameSleep(2);
    }
    const s = await g.waitFor((x) => x.observe.ending === "jumpscare" || x.observe.ending === "game_over", "jumpscare");
    const cause = s.truth.death_cause;
    await g.waitFor((x) => x.observe.ending === "game_over", "game over screen");
    await g.page.waitForTimeout(2500); // hold on the end screen for the recording
    const pass = cause === seen.bot;
    return { pass, retry: !pass && !cause.startsWith(seen.bot), detail: `Night 3: ${seen.bot} seen at ${clockSeen}; jumpscared by ${cause} at ${s.observe.clock}` };
  },

  async doors_shut(g) {
    await g.startNight();
    await g.setDoor(0, true);
    await g.setDoor(1, true);
    g.note(`both doors shut, usage ${(await g.obs()).usage}`);
    const out = await g.waitFor((s) => s.observe.state === "power_out" || s.observe.ending !== "", "power out", (600 / SPEED) * 1000);
    if (out.observe.state !== "power_out") return { pass: false, detail: `Ended before power-out: ${out.truth.death_cause}` };
    g.note(`power out at ${out.observe.clock}; doors open: ${!out.observe.doors[0] && !out.observe.doors[1]}`);
    const eyes = await g.waitFor((s) => s.observe.leader_eyes || s.observe.ending !== "", "Uncle Scogg at the door", 30000);
    const end = await g.waitFor((s) => s.observe.ending !== "", "attack", 60000);
    const pass = out.observe.doors.every((d) => !d) && eyes.observe.leader_eyes && end.truth.death_cause.includes("power out");
    return { pass, detail: `Power ran out at ${out.observe.clock}, doors opened, Uncle Scogg's eyes appeared, then ${end.truth.death_cause} at ${end.observe.clock}` };
  },

  async curtain(g) {
    await g.startNightAt(3); // Scoggis Khan starts at 0 on Night 1
    // Light checks and doors only; the tablet never comes up.
    const want = [false, false];
    let lastStage = 0;
    while (!(await g.over())) {
      const s = await g.state();
      if (s.truth.sprinter_stage !== lastStage) { lastStage = s.truth.sprinter_stage; g.note(`${s.observe.clock}: Scoggis Khan stage ${lastStage} (hidden from player)`); }
      if (s.truth.sprinter_running || s.truth.sprinter_hits > 0) {
        g.note(`${s.observe.clock}: Scoggis Khan is sprinting down the left hall`);
        return { pass: true, detail: `Night 3: Scoggis Khan left the curtain and sprinted at ${s.observe.clock} without the cameras ever being raised` };
      }
      for (const side of [0, 1]) { want[side] = (await g.peekDoor(side)).bot !== ""; await g.setDoor(side, want[side]); }
      await g.gameSleep(2);
    }
    const s = await g.state();
    const pass = s.truth.death_cause === "Scoggis Khan";
    return { pass, retry: !pass, detail: pass ? `Scoggis Khan sprinted in at ${s.observe.clock}` : `Ended by ${s.truth.death_cause || s.observe.ending} before Scoggis Khan ran` };
  },

  async flow(g) {
    // Menus, intro/6 AM cards, Scogg Bucks and saving. Uses the test-only "dawn" command
    // to jump to 5:59 AM instead of sitting through each night.
    const steps = [];
    const step = (m) => { steps.push(m); g.note(m); };
    let s = await g.waitFor((x) => x.scene === "Title", "title", 60000);
    if (s.title_buttons.some((b) => b.startsWith("Continue"))) throw new Error("fresh save shows Continue");
    step(`fresh title: ${s.title_buttons.join(" / ")}`);
    await g.click(await g.titleButton("New Game"));
    await g.skipIntro("Night 1");
    step("New Game showed the '12 AM / Night 1' card");
    await g.cmd("dawn");
    s = await g.waitFor((x) => x.observe?.ending === "win", "6 AM card");
    if (!(s.progress.scogg_bucks > 0)) throw new Error("no Scogg Bucks after 6 AM");
    if (s.progress.night !== 2) throw new Error(`Continue night is ${s.progress.night} after beating Night 1`);
    step(`6 AM card: ${s.progress.scogg_bucks} Scogg Bucks, Continue moved to Night 2`);
    await g.click(BTN.winNext);
    await g.skipIntro("Night 2");
    step("Next Night showed the Night 2 card");
    await g.page.reload({ waitUntil: "domcontentloaded" });
    s = await g.waitFor((x) => x.scene === "Title" && x.title_buttons, "title after reload", 60000);
    if (!s.title_buttons.includes("Continue  (Night 2)")) throw new Error(`after reload: ${s.title_buttons.join(", ")}`);
    if (!(s.progress.scogg_bucks > 0)) throw new Error("bucks lost on reload");
    step(`after a page reload the save kept Night 2 and ${s.progress.scogg_bucks} bucks`);
    await g.click(await g.titleButton("Continue"));
    await g.skipIntro("Night 2");
    step("Continue started Night 2");
    await g.key("Escape");
    await g.waitFor((x) => x.observe?.paused, "pause");
    await g.click([960, 867]); // Quit to title (5th pause button since Settings was added)
    await g.click(await g.titleButton("New Game"));
    s = await g.waitFor((x) => x.observe?.ending === "intro", "intro");
    if (s.observe.night_title !== "Night 1" || s.progress.night !== 1 || !(s.progress.scogg_bucks > 0)) throw new Error("New Game didn't restart at Night 1 with bucks kept");
    step("New Game restarted at Night 1 and kept the bucks");
    return { pass: true, detail: steps.join("; ") };
  },

  async unlocks(g) {
    const steps = [];
    const step = (m) => { steps.push(m); g.note(m); };
    await g.startNightAt(5);
    await g.cmd("dawn");
    let s = await g.waitFor((x) => x.observe?.ending === "win", "6 AM card");
    if (s.progress.best_night !== 6 || s.progress.custom_unlocked) throw new Error("Night 5 win didn't unlock exactly Night 6");
    step("beating Night 5 unlocked Night 6 (Custom Night still locked)");
    await g.click(BTN.winNext);
    await g.skipIntro("Night 6");
    await g.cmd("dawn");
    s = await g.waitFor((x) => x.observe?.ending === "win", "6 AM card");
    if (!s.progress.custom_unlocked) throw new Error("Night 6 win didn't unlock Custom Night");
    step("beating Night 6 unlocked Custom Night");
    await g.click(BTN.winMenuOnly);
    await g.click(await g.titleButton("Custom Night"));
    await g.waitFor((x) => x.custom_screen, "Custom Night screen");
    for (let i = 0; i < 3; i++) await g.click([1456, 296]); // Uncle Scogg +
    await g.click([706 + 0, 296 + 140]); // Scoggcrates - (stays 0)
    await g.click([760 + 640 * 0.75, 300 + 3 * 140]); // Scoggis Khan slider at 3/4
    s = await g.waitFor((x) => x.custom_levels?.leader === 3 && x.custom_levels.sprinter > 0, "sliders", 5000).catch(async () => g.state());
    const lv = s.custom_levels;
    if (lv.left_hall !== 0 || lv.sprinter < 13 || lv.sprinter > 17) throw new Error(`sliders: ${JSON.stringify(lv)}`);
    step(`Custom Night sliders set to ${JSON.stringify(lv)}`);
    await g.click(BTN.customStart);
    s = await g.waitFor((x) => x.observe?.ending === "intro", "intro");
    if (s.observe.night_title !== "Custom Night") throw new Error(`intro says ${s.observe.night_title}`);
    await g.skipIntro("Custom Night");
    s = await g.state();
    if (s.truth.levels.leader !== lv.leader || s.truth.levels.sprinter !== lv.sprinter) throw new Error(`night levels ${JSON.stringify(s.truth.levels)}`);
    step("Custom Night started with those levels");
    await g.cmd("dawn");
    s = await g.waitFor((x) => x.observe?.ending === "win", "6 AM card");
    step(`surviving Custom Night paid out (total ${s.progress.scogg_bucks} bucks)`);
    return { pass: true, detail: steps.join("; ") };
  },

  async controls(g) {
    const checks = [];
    const check = async (name, action, pred) => {
      try { await action(); await g.waitFor(pred, name, 8000); checks.push([name, true]); }
      catch (e) { checks.push([name, false]); g.note(`FAIL ${name}: ${e.message}`); }
    };
    const how = await g.titleButton("How to Play");
    await check("Title: How to Play opens", () => g.click(how), (s) => s.how_to_play === true);
    await check("Title: How to Play Back", () => g.click(BTN.howBack), (s) => s.how_to_play === false);
    await check("Title: New Game shows the Night 1 card", async () => g.click(await g.titleButton("New Game")), (s) => s.observe?.ending === "intro" && s.observe.night_title === "Night 1");
    await check("Intro card: click starts the night", () => g.click(BTN.neutral), (s) => s.observe?.ending === "" && s.observe.state === "playing");
    await g.move(BTN.neutral);
    for (const side of [0, 1]) {
      const n = side ? "right" : "left";
      await check(`${n} DOOR button shuts`, () => g.click(BTN.door[side]), (s) => s.observe.doors[side]);
      await check(`${n} DOOR button opens`, () => g.click(BTN.door[side]), (s) => !s.observe.doors[side]);
      await check(`${n} LIGHT button on`, () => g.click(BTN.light[side]), (s) => s.observe.light_side === side);
      await check(`${n} LIGHT button off`, () => g.click(BTN.light[side]), (s) => s.observe.light_side === -1);
    }
    await g.move(BTN.neutral);
    for (const [k, side] of [["a", 0], ["d", 1]]) {
      await check(`key ${k.toUpperCase()} shuts door`, () => g.key(k), (s) => s.observe.doors[side]);
      await check(`key ${k.toUpperCase()} opens door`, () => g.key(k), (s) => !s.observe.doors[side]);
    }
    for (const [k, side] of [["q", 0], ["e", 1]]) {
      await check(`key ${k.toUpperCase()} light on`, () => g.key(k), (s) => s.observe.light_side === side);
      await check(`key ${k.toUpperCase()} light off`, () => g.key(k), (s) => s.observe.light_side === -1);
    }
    await check("II button pauses", () => g.click(BTN.pause), (s) => s.observe.paused);
    await check("Pause: How to Play opens", () => g.click(BTN.pauseHow), (s) => s.observe.pause_how_to_play);
    await check("Pause: How to Play Back", () => g.click(BTN.howBack), (s) => !s.observe.pause_how_to_play);
    await check("Pause: Resume", () => g.click(BTN.pauseResume), (s) => !s.observe.paused);
    await g.move(BTN.neutral);
    await check("Esc pauses", () => g.key("Escape"), (s) => s.observe.paused);
    await check("Esc resumes", () => g.key("Escape"), (s) => !s.observe.paused);
    await check("Space raises tablet", () => g.key(" "), (s) => s.observe.tablet_up);
    for (let n = 1; n <= 9; n++) await check(`key ${n} -> CAM ${n}`, () => g.key(String(n)), (s) => s.observe.cam === String(n));
    await check("doors locked while tablet up", () => g.key("a"), (s) => s.observe.tablet_up && !s.observe.doors[0]);
    await check("Space lowers tablet", () => g.key(" "), (s) => !s.observe.tablet_up);
    await g.move(BTN.neutral);
    await check("hovering the bar raises tablet", async () => { await g.move(BTN.belowFeed); await g.move(BTN.bar); }, (s) => s.observe.tablet_up);
    for (let n = 9; n >= 1; n--) await check(`CAM ${n} button`, () => g.click(CAM[n]), (s) => s.observe.cam === String(n));
    await check("hovering the bar lowers tablet", async () => { await g.move(BTN.belowFeed); await g.move(BTN.bar); }, (s) => !s.observe.tablet_up);
    const failed = checks.filter(([, ok]) => !ok).map(([n]) => n);
    return { pass: failed.length === 0, detail: `${checks.length - failed.length}/${checks.length} controls responded${failed.length ? "; failed: " + failed.join(", ") : ""}`, checks };
  },
};

// --- Milestone 3: the art follows the night, the scares show, the jumpscares play ---
const ART_NAME = { "Scoggcrates": "scoggcrates", "Scogga Lisa": "scogga_lisa", "Scoggis Khan": "scoggis_khan", "Uncle Scogg": "uncle_scogg" };
const ROOM = { STAGE: 0, CAFETERIA: 1, LIBRARY: 2, LOUNGE: 3, CURTAIN: 4, LEFT_HALL: 5, LEFT_CORNER: 6, RIGHT_HALL: 7, RIGHT_CORNER: 8, LEFT_DOOR: 9, RIGHT_DOOR: 10 };

scenarios.art = async (g) => {
  const checks = [];
  const check = async (name, action, pred, ms = 8000) => {
    try { await action(); await g.waitFor(pred, name, ms); checks.push([name, true]); }
    catch (e) { checks.push([name, false]); g.note(`FAIL ${name}: ${e.message}`); }
  };
  const art = (s) => s.art || {};
  await g.startNightAt(3);
  await check("office shows the rendered office", async () => {}, (s) => art(s).office_art === true);
  await check("left door shut shows its shutter", () => g.setDoor(0, true), (s) => art(s).office.includes("shutter_0"));
  await g.setDoor(0, false);
  await check("right light shows the lit doorway", () => g.click(BTN.light[1]), (s) => art(s).office.includes("light_1"));
  await g.click(BTN.light[1]);
  await g.cmd(`place:left_hall:${ROOM.LEFT_DOOR}`);
  await check("left light with Scoggcrates there shows his standee", () => g.click(BTN.light[0]),
    (s) => art(s).office.includes("bot_0") && s.observe.lit_door_bot === "Scoggcrates");
  await g.click(BTN.light[0]);
  await g.cmd(`place:left_hall:${ROOM.LIBRARY}`);
  await g.cmd(`place:right_hall:${ROOM.RIGHT_HALL}`);
  await g.cmd(`place:leader:${ROOM.CAFETERIA}`);
  await g.move(BTN.neutral);
  await g.raiseTablet();
  for (const [cam, who] of [[3, "Scoggcrates"], [8, "Scogga Lisa"], [2, "Uncle Scogg"]]) {
    await check(`CAM ${cam} shows ${who}'s standee layer`, () => g.viewCam(cam),
      (s) => s.observe.cam_bots.includes(who) && art(s).cam_bots.includes(ART_NAME[who]));
  }
  await check("the blank poster shows once Uncle Scogg has left the stage", async () => {}, (s) => art(s).office.includes("poster_blank"));
  await check("an empty camera shows no standee", () => g.viewCam(6), (s) => s.observe.cam_bots.length === 0 && art(s).cam_bots.length === 0);
  await check("the Scoggipede crawls across CAM 7", async () => { await g.viewCam(7); await g.cmd("scare:3"); }, (s) => art(s).scoggipede === true);
  await g.lowerTablet();
  await check("a hallucination flashes over the office", () => g.cmd("scare:1"), (s) => (art(s).last_flash || "").startsWith("halluc_p"), 3000);
  await g.page.waitForTimeout(600);
  await check("the rare scare flashes Absolute Scoggema", () => g.cmd("scare:4"), (s) => art(s).last_flash === "scoggema", 3000);
  await check("the hum plays while nothing is inside", async () => {}, (s) => art(s).hum > 0.9);
  await check("silence once a bot is inside (before the scare)", () => g.cmd("getin:right_hall"), (s) => art(s).hum === 0, 15000);
  const failed = checks.filter(([, ok]) => !ok).map(([n]) => n);
  return { pass: failed.length === 0, detail: `${checks.length - failed.length}/${checks.length} art checks passed${failed.length ? "; failed: " + failed.join(", ") : ""}`, checks };
};

scenarios.jumpscares = async (g) => {
  const want = { left_hall: ["Scoggcrates", "rush"], sprinter: ["Scoggis Khan", "rush"], right_hall: ["Scogga Lisa", "flat"], leader: ["Uncle Scogg", "flat"] };
  const seen = [];
  let ok = true;
  for (const [id, [who, style]] of Object.entries(want)) {
    await g.startNightAt(2);
    await g.cmd(`attack:${id}`);
    const s = await g.waitFor((x) => x.art?.jumpscare_frames >= 8 || x.observe.ending === "game_over", `${who} jumpscare`, 10000);
    const good = s.art.jumpscare_style === style && s.art.jumpscare_frames >= 8;
    ok = ok && good;
    seen.push(`${who}: ${s.art.jumpscare_style} ${s.art.jumpscare_frames}/8 frames${good ? "" : " (expected " + style + ")"}`);
    g.note(seen.at(-1));
    await g.waitFor((x) => x.observe.ending === "game_over", "game over", 10000);
    await g.page.reload({ waitUntil: "domcontentloaded" });
  }
  return { pass: ok, detail: seen.join("; ") };
};

// --- Milestone 4: every sound fires at the right moment (checked from the game's sound event log) ---
scenarios.sounds = async (g) => {
  const checks = [];
  const ev = (s) => s.audio?.events || [];
  const lastMs = async () => Math.max(0, ...ev(await g.state()).map((e) => e.ms));
  // Do `action`, then wait for a logged sound named `sound` (newer than the action) that passes `ok`.
  const hear = async (name, action, sound, ok = () => true, ms = 8000) => {
    try {
      const mark = await lastMs();
      const t0 = (await g.state()).truth.time;
      await action();
      const s = await g.waitFor((x) => ev(x).some((e) => e.ms > mark && e.sound === sound && ok(e, x, t0)), name, ms);
      checks.push([name, true]);
      return ev(s).find((e) => e.ms > mark && e.sound === sound);
    } catch (e) { checks.push([name, false]); g.note(`FAIL ${name}: ${e.message}`); return null; }
  };
  const pass = (name, ok, why = "") => { checks.push([name, ok]); if (!ok) g.note(`FAIL ${name} ${why}`); };
  const nothing = async () => {};

  // Night 1: room tone, the voicemail, then every control and scare.
  await g.startNight();
  let s = await g.state();
  pass("room tone and fan start with the night", ev(s).some((e) => e.sound === "amb_office") && s.audio.loops.office && s.audio.loops.fan);
  await hear("the phone rings after the night starts", nothing, "phone_ring", (e) => e.t >= 0.9, 10000);
  const pickup = await hear("the call picks up after the ringing", nothing, "phone_pickup", (e, x) => x.audio.call.phase === "talking", 10000);
  s = await g.state();
  pass("the phone line plays under the captions", ev(s).some((e) => e.sound === "phone_line" && pickup && e.ms >= pickup.ms) && s.audio.call.caption !== "");
  await hear("Mute call hangs up", () => g.click([139, 125]), "phone_hangup", (e, x) => x.audio.call.muted && x.audio.call.phase === "done", 4000);
  // Doors and lights: the sound lands between the press and the change on screen, on that side.
  await hear("A slams the left door (left speaker)", () => g.key("a"), "door_close",
    (e, x, t0) => e.bus === "Left" && x.observe.doors[0] && e.t >= t0 && e.t <= x.truth.time);
  await hear("A opens it again", () => g.key("a"), "door_open", (e, x) => e.bus === "Left" && !x.observe.doors[0]);
  await hear("D slams the right door (right speaker)", () => g.key("d"), "door_close", (e, x) => e.bus === "Right" && x.observe.doors[1]);
  await g.key("d");
  await hear("Q turns on the left light with its buzz", () => g.key("q"), "light_on", (e, x) => e.bus === "Left" && x.audio.loops.light_buzz);
  await hear("Q again turns it off", () => g.key("q"), "light_off", (e, x) => !x.audio.loops.light_buzz);
  let mark = await lastMs();
  await g.gameSleep(2);
  pass("no door or light sounds when nothing is pressed", !ev(await g.state()).some((e) => e.ms > mark && /^(door|light)_/.test(e.sound)));
  // Tablet and cameras.
  await hear("raising the tablet flips it up", () => g.raiseTablet(), "tablet_up", () => true);
  await g.gameSleep(1);
  pass("the camera room tone takes over on the tablet", (await g.state()).audio.loops.cams);
  await hear("switching cameras clicks", () => g.viewCam(3), "cam_switch");
  await hear("a bot walking into the watched room garbles the feed", () => g.cmd(`place:left_hall:${ROOM.LIBRARY}`), "cam_garble");
  await hear("a glitch frame crackles", () => g.cmd("scare:2"), "glitch");
  await g.viewCam(7);
  await hear("the Scoggipede scuttles on CAM 7", () => g.cmd("scare:3"), "scuttle");
  await hear("lowering the tablet flips it down", () => g.lowerTablet(), "tablet_down");
  // Footsteps: louder and panned near the doors, muffled far away.
  await hear("a bot in the left corner: loud footstep on the left", () => g.cmd(`place:left_hall:${ROOM.LEFT_CORNER}`), "step",
    (e) => e.bus === "Left" && e.db > -12);
  await hear("a bot in the cafeteria: quiet muffled footstep", () => g.cmd(`place:left_hall:${ROOM.CAFETERIA}`), "step",
    (e) => e.bus === "Far" && e.db < -20);
  await hear("a hallucination whispers", () => g.cmd("scare:1"), "whisper");
  await hear("Absolute Scoggema stings", () => g.cmd("scare:4"), "sting_scoggema");
  // Scoggis Khan: gallop down the hall, bang on the shut door, gallop stops.
  await g.key("a");
  const gallop = await hear("Scoggis Khan gallops when he runs", () => g.cmd("sprint"), "gallop", (e, x) => x.audio.loops.gallop);
  await hear("he bangs on the shut left door", nothing, "door_bang", (e, x) => e.bus === "Left" && (!gallop || e.t > gallop.t) && !x.audio.loops.gallop, 8000);
  await g.key("a");
  // Power out: the power dies, silence, the march when Uncle Scogg reaches the door, it sags, silence, scream.
  const down = await hear("the power dies with a power-down sound", () => g.cmd("power_out"), "power_down",
    (e, x) => x.observe.state === "power_out" && !x.audio.loops.office);
  const march = await hear("the march starts when Uncle Scogg is in the dark doorway", nothing, "march",
    (e, x) => x.observe.leader_eyes && x.audio.loops.march && (!down || e.t - down.t >= 2.8), 10000);
  let minPitch = 1, silence = null, scream = null;
  try {
    s = await g.waitFor((x) => {
      if (x.audio.march_pitch > 0) minPitch = Math.min(minPitch, x.audio.march_pitch);
      return ev(x).some((e) => e.sound === "scream" && (!march || e.ms > march.ms));
    }, "power-out scream", 20000);
    silence = ev(s).filter((e) => e.sound === "silence").at(-1);
    scream = ev(s).filter((e) => e.sound === "scream").at(-1);
  } catch (e) { g.note(`FAIL power-out scream: ${e.message}`); }
  pass("the march slows and sags before he attacks", minPitch < 0.95, `(lowest pitch ${minPitch})`);
  const gap = silence && scream ? scream.ms - silence.ms : -1;
  pass("a full second of silence before the scream", gap >= 900, `(${gap} ms)`);
  // In sync: the jumpscare's first frame is up within 0.3 s (real) of the scream.
  const synced = await g.waitFor((x) => x.art.jumpscare_frames >= 1, "jumpscare frame", 300).then(() => true, () => false);
  pass("the scream is Uncle Scogg's, in sync with the jumpscare", scream?.file === "scream_uncle_scogg" && synced,
    `(file ${scream?.file}, frame shown ${synced})`);
  g.note(`power out: march ${march ? (march.t - down.t).toFixed(1) : "?"} s after the power died, lowest pitch ${minPitch.toFixed(2)}, silence ${gap} ms`);
  await g.waitFor((x) => x.observe.ending === "game_over", "game over", 10000);

  // Night 2 at 5:59: the 6 AM chime, and no scream on a win.
  await g.page.reload({ waitUntil: "domcontentloaded" });
  await g.startNightAt(2);
  mark = await lastMs();
  await hear("6 AM chimes", () => g.cmd("dawn"), "chime_6am", (e, x) => x.observe.state === "won", 8000);
  pass("no scream on a win", !ev(await g.state()).some((e) => e.ms > mark && e.sound === "scream"));

  const failed = checks.filter(([, ok]) => !ok).map(([n]) => n);
  return { pass: failed.length === 0, detail: `${checks.length - failed.length}/${checks.length} sound checks passed${failed.length ? "; failed: " + failed.join(", ") : ""}`, checks };
};

// Settings > Sound check: a real click on every button plays that sound; loops toggle.
scenarios.sound_check = async (g) => {
  await g.waitFor((x) => x.scene === "Title" && x.title_buttons, "title screen", 60000);
  await g.click([275, 992]); // Settings
  await g.page.waitForTimeout(300);
  await g.click([640, 890]); // Sound test
  let s = await g.waitFor((x) => x.sound_check, "sound check page", 5000);
  const files = Object.keys(s.sound_check.rects);
  const loopsOn = [];
  for (const f of files) {
    const [x, y, w, h] = s.sound_check.rects[f];
    await g.page.mouse.click((x + w / 2) * K, (y + h / 2) * K);
    await g.page.waitForTimeout(60);
    const st = (await g.state()).sound_check;
    if (st.loops.includes(f)) loopsOn.push(f);
  }
  s = await g.state();
  const missing = files.filter((f) => !s.sound_check.played.includes(f));
  const march = loopsOn.includes("march"), menu = loopsOn.includes("menu");
  await g.click([1490, 995]); // Stop all
  await g.page.waitForTimeout(200);
  const stopped = (await g.state()).sound_check.loops.length === 0;
  await g.click([1750, 995]); // Back
  await g.page.waitForTimeout(200);
  const gone = !(await g.state()).sound_check;
  const ok = files.length >= 37 && missing.length === 0 && march && menu && stopped && gone;
  return { pass: ok, detail: `${files.length - missing.length}/${files.length} buttons played their sound; ${loopsOn.length} loops toggled on (march ${march ? "✓" : "✗"}, menu ${menu ? "✓" : "✗"}); Stop all ${stopped ? "✓" : "✗"}; Back ${gone ? "✓" : "✗"}${missing.length ? "; missing: " + missing.join(", ") : ""}` };
};

// --- Milestone 5: phones get the "best on a laptop" notice; the embed page plays in an iframe ---
// These two load their own pages (a phone, or the embed page), so the runner doesn't open the game first.
const SELF_LOADING = new Set(["phone", "embed"]);
let BROWSER = null;
const SHARE_URL = () => `${BASE}/?_vercel_share=${args.share}`;

scenarios.phone = async (g) => {
  const ctx = await BROWSER.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => g.errors.push(String(e)));
  let wasm = 0;
  p.on("request", (r) => { if (r.url().includes("index.wasm")) wasm++; });
  try {
    if (args.share) await p.goto(SHARE_URL(), { waitUntil: "domcontentloaded", timeout: 120000 });
    wasm = 0;
    await p.goto(`${BASE}/?test=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.waitForSelector("#phone-notice", { state: "visible", timeout: 10000 });
    await p.waitForTimeout(1500);
    const before = wasm;
    await p.tap("#phone-play");
    await p.waitForFunction(() => window.fnasState && JSON.parse(window.fnasState).scene === "Title", null, { timeout: 180000 });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(800);
    const again = await p.isVisible("#phone-notice");
    const ok = before === 0 && wasm > 0 && !again;
    return { pass: ok, detail: `phone saw "Best on a laptop" with no download started (${before} engine requests); Play anyway loaded the title; after a reload the notice ${again ? "showed again ✗" : "stayed away (remembered)"}` };
  } finally { await ctx.close(); }
};

scenarios.embed = async (g) => {
  const p = g.page;
  if (args.share) await p.goto(SHARE_URL(), { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.goto(`${BASE}/embed.html?test=1&speed=${SPEED}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const el = await p.waitForSelector("#fnas-game", { timeout: 10000 });
  const frame = await el.contentFrame();
  const st = async () => frame.evaluate(() => (window.fnasState ? JSON.parse(window.fnasState) : null)).catch(() => null);
  const until = async (pred, what, ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { const s = await st(); if (s && pred(s)) return s; await p.waitForTimeout(50); }
    throw new Error(`timed out waiting for ${what}`);
  };
  const phoneShown = await frame.isVisible("#phone-notice");
  let s = await until((x) => x.scene === "Title" && x.title_buttons, "title in the iframe", 180000);
  const box = await el.boundingBox();
  const k = box.width / 1920;
  const at = ([x, y]) => p.mouse.click(box.x + x * k, box.y + y * k);
  await at([430, 490 + s.title_buttons.findIndex((b) => b.startsWith("New Game")) * 105 + 47]);
  await until((x) => x.observe?.ending === "intro", "intro card", 10000);
  await at([960, 300]);
  await until((x) => x.observe?.ending === "" && x.observe.state === "playing", "night start", 10000);
  await p.keyboard.press("a");
  s = await until((x) => x.observe.doors[0], "A to shut the left door", 5000).catch(() => null);
  const keys = !!s;
  if (keys) await p.keyboard.press("a");
  // It stays in its box until F asks for full screen; F again comes back.
  const full = () => p.evaluate(() => !!document.fullscreenElement);
  const startedWindowed = !(await full());
  await p.keyboard.press("f");
  await p.waitForTimeout(600);
  const wentFull = await full();
  await p.keyboard.press("f");
  await p.waitForTimeout(600);
  const cameBack = !(await full());
  const fs = startedWindowed && wentFull && cameBack;
  const ok = !phoneShown && keys && fs && Math.round(box.width) < VIEW.width;
  return { pass: ok, detail: `embed page: the game loaded in a ${Math.round(box.width)}x${Math.round(box.height)} iframe, New Game and the intro took clicks, the A key shut the door${keys ? "" : " ✗"}; it stayed in its box until F went full screen and F came back${fs ? "" : " ✗"}; no phone notice on a desktop${phoneShown ? " ✗" : ""}` };
};

const LABELS = {
  well: "Full Night 1 played well",
  idle: "Doing nothing at all",
  open_door: "Door left open with a bot at it",
  doors_shut: "Both doors shut all night",
  curtain: "Curtain camera ignored",
  controls: "Every button, key and camera",
  flow: "Menus, cards, Scogg Bucks and saving",
  unlocks: "Night 6 and Custom Night unlocks",
  art: "Art follows the night (layers, scares, silence)",
  jumpscares: "Each bot's jumpscare plays its frames",
  sounds: "Every sound fires at the right moment",
  sound_check: "Settings > Sound test plays every sound",
  phone: "Phone: \"best on a laptop\" notice before the download",
  embed: "Embed page: the game plays inside an iframe",
};

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    // PW_CHROMIUM points at a Chromium already on the machine (cloud sessions), else Playwright's own.
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
    // Vulkan ANGLE runs the game at 60 fps here; SwiftShader (CI, no GPU) manages ~14 fps.
    args: [...(args.gl === "swiftshader" ? ["--use-angle=swiftshader"] : ["--use-gl=angle", "--use-angle=vulkan"]),
      `--window-size=${VIEW.width},${VIEW.height}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
  });
  BROWSER = browser;
  const results = [];
  const allErrors = [];
  for (const name of Object.keys(scenarios)) {
    if (ONLY && !ONLY.includes(name)) continue;
    let res;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const record = VIDEO_DIR && (name === "well" || name === "open_door");
      const context = await browser.newContext({
        viewport: VIEW,
        ...(record ? { recordVideo: { dir: VIDEO_DIR, size: VIEW } } : {}),
      });
      const page = await context.newPage();
      const g = new Game(page);
      // Only the game's own pages count as console errors (not Vercel's login page after a lost share cookie).
      page.on("console", (m) => { g.console.push(`${m.type()}: ${m.text().slice(0, 160)}`); if (m.type() === "error" && page.url().startsWith(BASE)) g.errors.push(m.text()); });
      page.on("requestfailed", (r) => g.console.push(`requestfailed: ${r.url().replace(/\?.*/, "")} ${r.failure()?.errorText}`));
      page.on("pageerror", (e) => g.errors.push(String(e)));
      SPEED = SCENARIO_SPEED[name] ?? DEFAULT_SPEED;
      console.log(`== ${LABELS[name]} (attempt ${attempt}, ${SPEED}x)`);
      const started = Date.now();
      try {
        // The 38 MB engine download can be slow; the scenario itself waits for the title screen.
        if (SELF_LOADING.has(name)) {
          res = await scenarios[name](g);
        } else {
          if (args.share) await page.goto(`${BASE}/?_vercel_share=${args.share}`, { waitUntil: "domcontentloaded", timeout: 120000 });
          await page.goto(`${BASE}/?test=1&speed=${SPEED}`, { waitUntil: "domcontentloaded", timeout: 120000 });
          try {
            await g.waitFor((st) => st.scene === "Title", "title screen", 180000);
          } catch (e) {
            // Record why the page never reached the title (load-stall investigation).
            const diag = await page.evaluate(() => ({
              url: location.href.replace(/_vercel_share=[^&]+/, "_vercel_share=…"),
              title: document.title,
              notice: document.getElementById("status-notice")?.innerText || "",
              status: document.getElementById("status")?.style.visibility || "(removed)",
              progress: document.getElementById("status-progress")?.value ?? null,
              canvas: !!document.getElementById("canvas"),
              hasState: !!window.fnasState,
              state: window.fnasState ? JSON.parse(window.fnasState).scene : null,
            })).catch((err) => ({ evalError: String(err) }));
            g.note(`load stall: ${JSON.stringify(diag)}; console: ${g.consoleTail().join(" | ")}`);
            await page.screenshot({ path: path.join(OUT_DIR, `${name}_stall${attempt}.png`) });
            throw e;
          }
          await page.mouse.click(BTN.neutral[0] * K, BTN.neutral[1] * K); // focus the canvas
          res = await scenarios[name](g);
        }
      } catch (e) {
        res = { pass: false, retry: true, detail: `error: ${e.message.split("\n")[0]}` };
      }
      res.seconds = Math.round((Date.now() - started) / 1000);
      res.speed = SPEED;
      res.errors = g.errors;
      res.log = g.log;
      await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
      const video = page.video();
      await context.close();
      if (video) {
        const dest = path.join(VIDEO_DIR, `${name}.webm`);
        await video.saveAs(dest);
        await video.delete();
        res.video = dest;
      }
      console.log(`   ${res.pass ? "PASS" : "FAIL"}: ${res.detail} (${res.seconds}s real)`);
      if (res.pass || !res.retry) break;
    }
    results.push({ name, label: LABELS[name], ...res });
  }
  await browser.close();
  if (args.append && fs.existsSync(path.join(OUT_DIR, "results.json"))) {
    const old = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "results.json"), "utf8"));
    const order = Object.keys(scenarios);
    const merged = Object.fromEntries(old.map((r) => [r.name, r]));
    for (const r of results) merged[r.name] = r;
    results.splice(0, results.length, ...order.filter((n) => merged[n]).map((n) => merged[n]));
  }
  // Errors from the attempt each scenario kept (a retried attempt's errors went with it).
  for (const r of results) allErrors.push(...(r.errors || []).filter((e) => !allErrors.includes(e)));

  const lines = [
    `Played in headless Chromium with real mouse and keyboard input, 1280x720, against ${BASE.replace(/\?.*/, "")}. Game sped up with \`?test=1&speed=N\` (shown per scenario).`,
    "",
    "| Scenario | Result | What happened |",
    "|---|---|---|",
    ...results.map((r) => `| ${r.label} (${r.speed}x) | ${r.pass ? "✅ pass" : "❌ fail"} | ${r.detail} |`),
    `| No console errors | ${allErrors.length === 0 ? "✅ pass" : "❌ fail"} | ${allErrors.length === 0 ? "0 errors across all scenarios" : allErrors.slice(0, 5).join("; ")} |`,
  ];
  fs.writeFileSync(path.join(OUT_DIR, "results.md"), lines.join("\n") + "\n");
  fs.writeFileSync(path.join(OUT_DIR, "results.json"), JSON.stringify(results, null, 2));
  console.log("\n" + lines.join("\n"));
  process.exit(results.every((r) => r.pass) && allErrors.length === 0 ? 0 : 1);
}

run();
