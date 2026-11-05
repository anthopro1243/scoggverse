// Audio output test: measures what actually reaches the speakers, not just which sounds were
// triggered. Every Web Audio node that connects to ctx.destination is also tapped into a meter
// (an AudioWorklet that sees every sample: loudest 2048-sample RMS window, and the peak).
// The game is then driven through the moments that must be audible, and each one has to show
// RMS clearly above 0 (and no peak above 1.0). Finally every Settings > Sound check button is
// played alone and its RMS and peak are logged.
//
//   node audio_output.mjs --url=http://localhost:8060            # the game page (/game/ on a deployment)
//   node audio_output.mjs --play=https://<site>                   # through the site's /play/ iframe
//   node audio_output.mjs --embed=https://<site>                  # through /embed.html
//   [--share=TOKEN] [--gl=swiftshader] [--out=../../docs/playtest] [--name=audio_output] [--no-sweep]
//
// Needs the build's TestBridge (?test=1) for the jumpscare, power-out and 6 AM shortcuts.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, "").split("=");
  return [k, v.join("=") || "1"];
}));
const trim = (u) => u.replace(/\/$/, "");
const MODE = args.play ? "play" : args.embed ? "embed" : "game";
const BASE = trim(args.play || args.embed || args.url || "http://localhost:8060");
const OUT_DIR = path.resolve(args.out || "../../docs/playtest");
const NAME = args.name || `audio_output${MODE === "game" ? "" : "_" + MODE}`;
const VIEW = { width: 1280, height: 720 };
// "Clearly above 0": -40 dBFS RMS. Silence through a broken graph reads exactly 0.
const MIN_RMS = 0.01;
const MAX_PEAK = 1.0;

const BTN = {
  neutral: [960, 300], belowFeed: [960, 700], bar: [960, 1025], muteCall: [139, 125],
  retry: [740, 675], winMenu: [1180, 815], settings: [275, 992], soundCheck: [640, 890],
  stopAll: [1490, 995], back: [1750, 995], cam3: [1209, 795],
};

// Runs in every frame before the page's own scripts.
function installTap() {
  const origConnect = AudioNode.prototype.connect;
  const origDisconnect = AudioNode.prototype.disconnect;
  const taps = new Map();
  window.__audioTaps = taps;
  window.__audioFrames = [];
  // The meter runs on the audio thread and sees every 128-frame block, so even a 30 ms click
  // is caught on a slow machine. It reports, every 1024 frames, the loudest 2048-frame window
  // (RMS over both channels, and per channel) and the largest sample.
  const METER = `
    class Meter extends AudioWorkletProcessor {
      constructor() { super(); this.l = new Float64Array(16); this.r = new Float64Array(16); this.i = 0; this.n = 0; this.reset(); }
      reset() { this.max = 0; this.maxL = 0; this.maxR = 0; this.peak = 0; }
      process(inputs) {
        const ch = inputs[0];
        let sl = 0, sr = 0;
        if (ch.length) {
          const L = ch[0], R = ch[1] || ch[0];
          for (let k = 0; k < L.length; k++) {
            sl += L[k] * L[k]; sr += R[k] * R[k];
            const a = Math.max(Math.abs(L[k]), Math.abs(R[k]));
            if (a > this.peak) this.peak = a;
          }
        }
        this.l[this.i] = sl; this.r[this.i] = sr; this.i = (this.i + 1) % 16;
        let wl = 0, wr = 0;
        for (let k = 0; k < 16; k++) { wl += this.l[k]; wr += this.r[k]; }
        const N = 2048;
        this.max = Math.max(this.max, Math.sqrt((wl + wr) / (2 * N)));
        this.maxL = Math.max(this.maxL, Math.sqrt(wl / N));
        this.maxR = Math.max(this.maxR, Math.sqrt(wr / N));
        if (++this.n % 8 === 0) { this.port.postMessage([this.max, this.maxL, this.maxR, this.peak]); this.reset(); }
        return true;
      }
    }
    registerProcessor("fnas-meter", Meter);`;
  const meterUrl = URL.createObjectURL(new Blob([METER], { type: "text/javascript" }));
  function tapFor(ctx) {
    let t = taps.get(ctx);
    if (t) return t;
    // Godot's buses carry 6 channels (5.1). Fold them to stereo exactly like a stereo
    // destination does ("speakers" downmix), then meter the left and right channels.
    const mix = ctx.createGain();
    mix.channelCount = 2;
    mix.channelCountMode = "explicit";
    mix.channelInterpretation = "speakers";
    t = { an: mix, feeders: 0 };
    taps.set(ctx, t);
    ctx.audioWorklet.addModule(meterUrl).then(() => {
      const meter = new AudioWorkletNode(ctx, "fnas-meter", { channelCount: 2, channelCountMode: "explicit", outputChannelCount: [2] });
      const sink = ctx.createGain();
      sink.gain.value = 0;
      origConnect.call(mix, meter);
      origConnect.call(meter, sink);
      origConnect.call(sink, ctx.destination);
      meter.port.onmessage = (e) => {
        const [rms, l, r, peak] = e.data;
        const f = window.__audioFrames;
        f.push({ t: performance.now(), rms, l, r, peak });
        if (f.length > 200000) f.splice(0, 50000);
      };
    });
    return t;
  }
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = origConnect.call(this, dest, ...rest);
    if (typeof AudioDestinationNode !== "undefined" && dest instanceof AudioDestinationNode) {
      const t = tapFor(this.context);
      origConnect.call(this, t.an, rest[0] ?? 0);
      t.feeders++;
    }
    return r;
  };
  AudioNode.prototype.disconnect = function (...a) {
    const r = origDisconnect.apply(this, a);
    // disconnect() with no arguments already drops the tap; disconnect(destination) must drop it too.
    if (typeof AudioDestinationNode !== "undefined" && a[0] instanceof AudioDestinationNode) {
      const t = taps.get(this.context);
      if (t) { try { origDisconnect.call(this, t.an); } catch { /* not tapped */ } }
    }
    return r;
  };
  window.__audioStats = (t0, t1) => {
    const fr = window.__audioFrames.filter((f) => f.t >= t0 && f.t <= t1);
    if (!fr.length) return { rms: 0, peak: 0, frames: 0 };
    return {
      rms: Math.max(...fr.map((f) => f.rms)),
      mean: fr.reduce((s, f) => s + f.rms, 0) / fr.length,
      peak: Math.max(...fr.map((f) => f.peak)),
      l: Math.max(...fr.map((f) => f.l)),
      r: Math.max(...fr.map((f) => f.r)),
      frames: fr.length,
    };
  };
  window.__audioInfo = () => {
    const ctxs = [...taps.keys()];
    return { contexts: ctxs.length, state: ctxs.map((c) => c.state).join(","), rate: ctxs[0]?.sampleRate ?? 0, feeders: [...taps.values()].map((t) => t.feeders) };
  };
}

class Driver {
  constructor(page) { this.page = page; this.frame = page.mainFrame(); this.box = null; this.errors = []; this.log = []; }
  async attach() {
    if (MODE === "game") {
      this.el = await this.page.waitForSelector("canvas#canvas", { timeout: 120000 });
    } else {
      this.el = await this.page.waitForSelector(MODE === "play" ? "iframe.cam__frame" : "iframe#fnas-game", { timeout: 120000 });
      this.frame = await this.el.contentFrame();
    }
  }
  async xy([x, y]) {
    // The canvas fills its page or iframe (stretch aspect "ignore"), so x and y scale separately.
    const b = await this.el.boundingBox();
    return [b.x + (x * b.width) / 1920, b.y + (y * b.height) / 1080];
  }
  async move(p) { const [x, y] = await this.xy(p); await this.page.mouse.move(x, y); }
  // Hold the button a moment so a slow (software-GL) frame still sees the press.
  async click(p) { const [x, y] = await this.xy(p); await this.page.mouse.click(x, y, { delay: 60 }); }
  async key(k) { await this.page.keyboard.press(k); }
  async state() { return this.frame.evaluate(() => (window.fnasState ? JSON.parse(window.fnasState) : null)).catch(() => null); }
  async waitFor(pred, what, ms = 15000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const s = await this.state();
      if (s && pred(s)) return s;
      await this.page.waitForTimeout(30);
    }
    throw new Error(`timed out waiting for ${what}`);
  }
  async cmd(c) { await this.frame.evaluate((x) => { window.fnasCmd = x; }, c); await this.page.waitForTimeout(100); }
  async now() { return this.frame.evaluate(() => performance.now()); }
  async stats(t0, t1) { return this.frame.evaluate(([a, b]) => window.__audioStats(a, b), [t0, t1]); }
  // Measure from `lead` ms before now for `ms` ms.
  async measure(ms, lead = 0) {
    const t0 = (await this.now()) - lead;
    await this.page.waitForTimeout(ms);
    return this.stats(t0, t0 + lead + ms);
  }
  async titleButton(prefix) {
    const s = await this.waitFor((x) => x.scene === "Title" && x.title_buttons, "title screen", 180000);
    const i = s.title_buttons.findIndex((b) => b.startsWith(prefix));
    if (i < 0) throw new Error(`no "${prefix}" button on the title (${s.title_buttons.join(", ")})`);
    return [430, 490 + i * 105 + 47];
  }
  async skipIntro() {
    await this.waitFor((x) => x.observe?.ending === "intro", "intro card");
    await this.click(BTN.neutral);
    await this.waitFor((x) => x.observe?.ending === "" && x.observe.state === "playing", "night to start");
  }
  // Wait for a logged sound newer than `mark` (game ms), then measure for `ms` more. The window
  // starts at `since` (page ms, taken just before the input that causes it) when given, so a
  // short click isn't missed on a slow machine where the log shows up a few frames late.
  async after(sound, mark, ms, timeout = 20000, since = null) {
    await this.waitFor((x) => (x.audio?.events || []).some((e) => e.sound === sound && e.ms > mark), sound, timeout);
    const t0 = since ?? (await this.now()) - 80;
    await this.page.waitForTimeout(ms);
    return this.stats(t0, await this.now());
  }
  async lastMs() { return Math.max(0, ...((await this.state())?.audio?.events || []).map((e) => e.ms)); }
}

const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : "-inf");
// RMS a one-shot adds on top of a steady tone (powers add for unrelated sounds).
const added = (m, base) => Math.sqrt(Math.max(0, m.rms ** 2 - base.rms ** 2));
// A click over a steady tone: its peak must stand clearly above the tone's own peak. (The RMS it
// adds is logged too, but a 46 ms window over a wavering tone is too noisy to pass/fail on.)
const ratio = (m, base) => (base.peak > 0 ? (m.peak / base.peak).toFixed(1) : "∞");
const stands = (m, base) => m.peak >= 1.5 * base.peak;
const fmt = (m) => `RMS ${m.rms.toFixed(4)} (${db(m.rms)} dBFS), peak ${m.peak.toFixed(3)}`;

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: [...(args.gl === "swiftshader" ? ["--use-angle=swiftshader"] : ["--use-gl=angle", "--use-angle=vulkan"]),
      `--window-size=${VIEW.width},${VIEW.height}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const context = await browser.newContext({ viewport: VIEW });
  await context.addInitScript(installTap);
  const page = await context.newPage();
  const g = new Driver(page);
  page.on("pageerror", (e) => g.errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/vercel\.live/.test(m.text())) g.errors.push(m.text()); });

  const checks = []; // [label, stats, pass, note]
  const check = (label, m, extra = true, note = "") => {
    const ok = m.rms >= MIN_RMS && m.peak <= MAX_PEAK && extra;
    checks.push({ label, ...m, pass: ok, note });
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}: ${fmt(m)}${note ? " " + note : ""}`);
    return ok;
  };
  const sweep = [];
  let info = null;
  let fatal = "";

  try {
    if (args.share) await page.goto(`${BASE}/?_vercel_share=${args.share}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    const url = MODE === "play" ? `${BASE}/play/?test=1` : MODE === "embed" ? `${BASE}/embed.html?test=1` : `${BASE}/?test=1`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    if (MODE === "play") await page.click("[data-play]");
    await g.attach();
    await g.el.scrollIntoViewIfNeeded();
    console.log(`  game box: ${JSON.stringify(await g.el.boundingBox())}`);
    await g.waitFor((x) => x.scene === "Title" && x.title_buttons, "title screen", 180000);

    // 1. Title: menu music, after the first click (browsers start audio on a user gesture).
    await g.click(BTN.neutral);
    await page.waitForTimeout(1500);
    info = await g.frame.evaluate(() => window.__audioInfo());
    console.log(`  audio: ${JSON.stringify(info)}`);
    check("Menu music (title screen)", await g.measure(2500));

    // 2. New Game: the phone call over the office room tone.
    await g.click(await g.titleButton("New Game"));
    await g.skipIntro();
    await g.move(BTN.neutral);
    await g.waitFor((x) => (x.audio?.events || []).some((e) => e.sound === "phone_ring"), "phone ring", 10000);
    check("Phone call (ring, pickup, line)", await g.measure(6000, 100));
    await g.click(BTN.muteCall);
    await page.waitForTimeout(1500);
    const amb = await g.measure(2500);
    check("Office ambience (room tone + fan)", amb);

    // 3. Door: a slam over the room tone.
    let mark = await g.lastMs();
    let since = await g.now();
    await g.key("a");
    const door = await g.after("door_close", mark, 700, 3000, since);
    check("Door close", door, stands(door, amb), `(peak ${ratio(door, amb)}× the room tone's; adds ${added(door, amb).toFixed(4)} RMS)`);
    await g.key("a");
    await page.waitForTimeout(800);

    // 4. Cameras: the switch click over the camera room tone.
    await g.move(BTN.belowFeed);
    await g.move(BTN.bar);
    await g.waitFor((x) => x.observe.tablet_up, "tablet up", 5000);
    await page.waitForTimeout(1500);
    const camTone = await g.measure(1000);
    mark = await g.lastMs();
    since = await g.now();
    await g.click(BTN.cam3);
    const cam = await g.after("cam_switch", mark, 500, 3000, since);
    check("Camera switch", cam, stands(cam, camTone), `(peak ${ratio(cam, camTone)}× the camera room tone's; adds ${added(cam, camTone).toFixed(4)} RMS)`);
    await g.move(BTN.belowFeed);
    await g.move(BTN.bar);
    await g.waitFor((x) => !x.observe.tablet_up, "tablet down", 5000);
    await g.move(BTN.neutral);

    // 5. A jumpscare: Scoggcrates attacks; 1 s of silence, then his scream.
    mark = await g.lastMs();
    await g.cmd("attack:left_hall");
    check("Jumpscare scream (Scoggcrates)", await g.after("scream", mark, 1500, 15000));
    await g.waitFor((x) => x.observe?.ending === "game_over", "game over", 15000);

    // 6. Power out: the power-down, then the march in the dark doorway, then Uncle Scogg's scream.
    await g.click(BTN.retry);
    await g.skipIntro();
    await g.move(BTN.neutral);
    await g.cmd("mute_call");
    mark = await g.lastMs();
    since = await g.now();
    await g.cmd("power_out");
    check("Power-down", await g.after("power_down", mark, 1200, 5000, since));
    check("Power-out march", await g.after("march", mark, 3000, 15000));
    // He'd attack 5-20 s (game time) after appearing, which a slow software-GL runner may not
    // reach in time; make him attack now (same silence beat and scream as the natural attack).
    mark = await g.lastMs();
    await g.cmd("attack:leader");
    const leaderScream = await g.after("scream", mark, 1500, 20000);
    const who = ((await g.state())?.audio?.events || []).filter((e) => e.sound === "scream" && e.ms > mark).at(-1)?.file;
    check("Power-out scream (Uncle Scogg)", leaderScream, who === "scream_uncle_scogg", who === "scream_uncle_scogg" ? "" : `(played ${who})`);
    await g.waitFor((x) => x.observe?.ending === "game_over", "game over", 15000);

    // 7. 6 AM: the chime.
    await g.click(BTN.retry);
    await g.skipIntro();
    await g.move(BTN.neutral);
    await g.cmd("mute_call");
    mark = await g.lastMs();
    await g.cmd("dawn");
    check("6 AM chime", await g.after("chime_6am", mark, 2500, 15000));

    // 8. Settings > Sound check: every sound alone, on its in-game bus and level.
    if (!args["no-sweep"]) {
      await g.waitFor((x) => x.observe?.ending === "win", "6 AM card", 15000);
      await page.waitForTimeout(1500);
      await g.click(BTN.winMenu);
      await g.waitFor((x) => x.scene === "Title", "title", 15000);
      await g.click(BTN.settings);
      await page.waitForTimeout(300);
      // The volume sliders change what comes out (Settings: sliders at x 880-1440, y 262/362/462).
      const slider = async (row, v) => { await g.click([882 + v * 556, 290 + row * 100]); await page.waitForTimeout(400); };
      const music = await g.measure(1500);
      await slider(0, 0);
      const masterOff = await g.measure(1000);
      await slider(0, 1);
      const masterBack = await g.measure(1500);
      await slider(1, 0);
      const musicOff = await g.measure(1000);
      await slider(1, 0.8);
      const musicBack = await g.measure(1500);
      const slidersOk = music.rms >= MIN_RMS && masterOff.rms < music.rms / 30 && musicOff.rms < music.rms / 30 &&
        masterBack.rms > music.rms * 0.7 && musicBack.rms > music.rms * 0.7;
      const r = (m) => m.rms.toFixed(4);
      check("Volume sliders (menu music)", music, slidersOk,
        `(Master 0 → ${r(masterOff)}, back to 100 → ${r(masterBack)}; Music 0 → ${r(musicOff)}, back to 80 → ${r(musicBack)})`);
      await g.click(BTN.soundCheck);
      const s = await g.waitFor((x) => x.sound_check, "sound check page", 5000);
      await g.click(BTN.stopAll);
      await page.waitForTimeout(600);
      for (const f of Object.keys(s.sound_check.rects)) {
        const [x, y, w, h] = s.sound_check.rects[f];
        const quiet = await g.measure(200);
        const since = await g.now();
        let played = false;
        for (let attempt = 0; attempt < 2 && !played; attempt++) {
          await g.click([x + w / 2, y + h / 2]);
          played = await g.waitFor((st) => st.sound_check?.played.includes(f), `${f} played`, 1500).then(() => true, () => false);
        }
        await page.waitForTimeout(f === "march" || f === "menu" ? 3000 : 2200);
        const m = await g.stats(since, await g.now());
        await g.click(BTN.stopAll);
        await page.waitForTimeout(400);
        sweep.push({ sound: f, ...m, before: quiet.rms });
        console.log(`  ${f}: ${fmt(m)}`);
      }
      await g.click(BTN.back);
    }
  } catch (e) {
    fatal = e.message.split("\n")[0];
    console.log(`  ERROR: ${fatal}`);
  }
  await page.screenshot({ path: path.join(OUT_DIR, `${NAME}.png`) });
  await browser.close();

  const silentSweep = sweep.filter((r) => r.rms < MIN_RMS).map((r) => r.sound);
  const clipSweep = sweep.filter((r) => r.peak > MAX_PEAK).map((r) => r.sound);
  const pass = !fatal && checks.length >= 10 && checks.every((c) => c.pass) && !silentSweep.length && !clipSweep.length && g.errors.length === 0;
  const where = MODE === "play" ? `${BASE}/play/ (the game in the Play page's iframe)` : MODE === "embed" ? `${BASE}/embed.html` : BASE;
  const lines = [
    `Measured output in headless Chromium against ${where}: every node feeding \`ctx.destination\` tapped, folded to stereo like the speakers, and metered on the audio thread (an AudioWorklet that sees every sample). RMS is the loudest 2048-sample (43–46 ms) window over both channels; peak is the largest sample on either channel (1.0 = full scale). Pass: RMS ≥ ${MIN_RMS} (−40 dBFS) and peak ≤ ${MAX_PEAK}; the door slam's and camera click's peaks must also be at least 1.5× the peak of the room tone under them.`,
    "",
    `AudioContext: ${info ? `${info.state}, ${info.rate} Hz, ${info.feeders.join("+")} node(s) feeding the speakers` : "not reached"}.`,
    "",
    "| Moment | RMS | dBFS | Peak | Result |",
    "|---|---|---|---|---|",
    ...checks.map((c) => `| ${c.label} ${c.note} | ${c.rms.toFixed(4)} | ${db(c.rms)} | ${c.peak.toFixed(3)} | ${c.pass ? "✅" : "❌"} |`),
    `| Console errors | | | | ${g.errors.length ? "❌ " + g.errors.slice(0, 3).join("; ") : "✅ none"} |`,
    ...(fatal ? ["", `**Stopped early:** ${fatal}`] : []),
  ];
  if (sweep.length) {
    const bal = (r) => (r.l > 0 && r.r > 0 ? `${(20 * Math.log10(r.l / r.r)).toFixed(1)}` : "");
    lines.push("", "Settings > Sound check, each sound alone (L−R: left minus right channel level in dB; 0 = centered):", "",
      "| Sound | RMS | dBFS | Peak | L−R dB | Result |", "|---|---|---|---|---|---|",
      ...sweep.map((r) => `| ${r.sound} | ${r.rms.toFixed(4)} | ${db(r.rms)} | ${r.peak.toFixed(3)} | ${bal(r)} | ${r.rms >= MIN_RMS && r.peak <= MAX_PEAK ? "✅" : "❌"} |`));
  }
  lines.push("", `**${pass ? "PASS" : "FAIL"}**`);
  fs.writeFileSync(path.join(OUT_DIR, `${NAME}.md`), lines.join("\n") + "\n");
  fs.writeFileSync(path.join(OUT_DIR, `${NAME}.json`), JSON.stringify({ where, info, checks, sweep, errors: g.errors, fatal, pass }, null, 2));
  console.log("\n" + lines.join("\n"));
  process.exit(pass ? 0 : 1);
}

run();
