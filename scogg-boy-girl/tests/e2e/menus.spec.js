// The title screen and its panels (How to Play, Settings, Credits), settings that stick, the pause
// menu's own How to Play and Settings, and reduce motion.
import { test, expect } from "@playwright/test";
import { open, press, tap } from "./helpers.js";

const title = (page) => page.evaluate(() => window.__sbg.title());
const inScene = (page, scene) => page.waitForFunction((s) => window.__sbg?.ready && window.__sbg.scene === s, scene);
const prefs = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("sbg-prefs") || "{}"));
const allText = (page) => page.evaluate(() => {
  const out = [];
  const walk = (list) => { for (const o of list) { if (o.type === "Text" && o.visible) out.push(o.text); if (o.list) walk(o.list); } };
  for (const sc of window.__sbg.game.scene.getScenes(true)) walk(sc.children.list);
  return out.join("\n");
});

test("the game opens on the title screen, and Play goes to the level select", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/?test=1");
  await inScene(page, "title");
  expect(await allText(page)).toContain("SCOGG BOY & SCOGG GIRL");
  await tap(page, "Enter");
  await inScene(page, "select");
  await tap(page, "Escape");
  await inScene(page, "title");
  expect(errors).toEqual([]);
});

test("How to Play and Credits open and close, and focus comes back to their button", async ({ page }) => {
  test.setTimeout(180_000); // many real key presses; software WebGL on a busy CI runner draws a few frames a second
  await open(page, "&scene=title");
  await tap(page, "ArrowDown", "Enter");
  await expect.poll(() => title(page)).toEqual({ panel: "how", focus: 0 });
  const how = await allText(page);
  for (const s of ["SCOGG BOY", "SCOGG GIRL", "W jump   A D move", "Up jump   Left Right move", "Both stand at your own door"]) expect(how).toContain(s);
  await tap(page, "Escape");
  await expect.poll(() => title(page)).toEqual({ panel: null, focus: 1 });
  await tap(page, "ArrowDown", "ArrowDown", "Enter");
  await expect.poll(async () => (await title(page)).panel).toBe("credits");
  const credits = await allText(page);
  for (const s of ["Phaser (MIT License)", "SIL Open Font License 1.1", "Faces from the class deck The Scogg Files",
    "Unofficial fan parody. Not affiliated with Fireboy and Watergirl or its makers.", "Made with Dr. Scoggins' permission, for fun."]) expect(credits).toContain(s);
  await tap(page, "Enter");                                 // Back
  await expect.poll(() => title(page)).toEqual({ panel: null, focus: 3 });
});

test("settings change with the arrow keys, save, and come back after a reload", async ({ page }) => {
  test.setTimeout(180_000); // many real key presses; software WebGL on a busy CI runner draws a few frames a second
  await open(page, "&scene=title");
  await tap(page, "ArrowDown", "ArrowDown", "Enter");      // Settings
  await expect.poll(async () => (await title(page)).panel).toBe("settings");
  expect((await prefs(page)).volume).toBeUndefined();      // opening it changed nothing
  await tap(page, "ArrowLeft", "ArrowLeft");               // volume 80% -> 60%
  await tap(page, "ArrowDown", "ArrowRight");              // music 60% -> 70%
  await tap(page, "ArrowDown", "Enter");                   // sound off
  await tap(page, "ArrowDown", "ArrowRight");              // reduce motion on
  await expect.poll(() => prefs(page)).toEqual({ volume: 0.6, music: 0.7, muted: true, reduceMotion: true });
  expect(await allText(page)).toContain("Volume   60%");
  await open(page, "&scene=title");
  await tap(page, "ArrowDown", "ArrowDown", "Enter");
  const shown = await allText(page);
  for (const s of ["Volume   60%", "Music   70%", "Sound   Off", "Reduce motion   On"]) expect(shown).toContain(s);
});

test("the pause menu opens How to Play and Settings; Esc steps back out one at a time", async ({ page }) => {
  test.setTimeout(180_000); // many real key presses; software WebGL on a busy CI runner draws a few frames a second
  const errors = await open(page, "&level=priming");
  await press(page, "Escape", (s) => s.state === "paused");
  await tap(page, "ArrowDown", "ArrowDown", "ArrowDown", "Enter"); // Settings
  await expect.poll(async () => (await page.evaluate(() => window.__sbg.snapshot())).panel).toBe("settings");
  expect((await prefs(page)).volume).toBeUndefined();      // the Enter that opened it didn't also press a row
  await press(page, "Escape", (s) => s.panel === null && s.state === "paused");
  await tap(page, "ArrowUp", "Enter");                     // How to Play
  await expect.poll(async () => (await page.evaluate(() => window.__sbg.snapshot())).panel).toBe("how");
  await press(page, "Escape", (s) => s.panel === null && s.state === "paused");
  await press(page, "Escape", (s) => s.state === "play");
  expect(errors).toEqual([]);
});

test("M turns the sound off and on, and the HUD says so", async ({ page }) => {
  await open(page, "&level=priming");
  await tap(page, "m");
  await expect.poll(async () => (await prefs(page)).muted).toBe(true);
  expect(await allText(page)).toContain("Sound off (M)");
  await tap(page, "m");
  await expect.poll(async () => (await prefs(page)).muted).toBe(false);
});

test("reduce motion holds the parallax, the dust and the pickups still", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sbg-prefs", JSON.stringify({ reduceMotion: true })));
  await open(page, "&level=priming");
  const look = () => page.evaluate(() => {
    const sc = window.__sbg.game.scene.getScene("level");
    const imgs = sc.children.list.filter((o) => o.type === "Image" && /archive-level-(far|mid)/.test(o.texture.key));
    return { layers: imgs.map((o) => [o.x, o.y]), pickups: sc.pickups.map((p) => [p.obj.img.y, p.obj.img.scaleX]) };
  });
  const a = await look();
  await page.evaluate(() => window.__sbg.step(90, ["D", "RIGHT"]));
  const b = await look();
  expect(b).toEqual(a);
  for (const [y] of b.pickups) expect(y).toBe(0);
});

test("reduce motion follows the system setting until it's changed in the game", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await open(page, "&scene=title");
  await tap(page, "ArrowDown", "ArrowDown", "Enter");
  await expect.poll(() => allText(page)).toContain("Reduce motion   On");
  await ctx.close();
});

test("one key press acts once, even when Phaser hands it over again in the same frame", async ({ page }) => {
  await open(page, "&level=priming");
  // under load Phaser re-emitted one Esc three times (pause, resume, pause); the same event again must do nothing
  const s = await page.evaluate(() => {
    const kb = window.__sbg.game.scene.getScene("level").input.keyboard;
    const esc = new KeyboardEvent("keydown", { key: "Escape", keyCode: 27 });
    kb.emit("keydown-ESC", esc); kb.emit("keydown-ESC", esc); kb.emit("keydown-ESC", esc);
    const down = new KeyboardEvent("keydown", { key: "ArrowDown", keyCode: 40 });
    kb.emit("keydown-DOWN", down); kb.emit("keydown-DOWN", down);
    const sc = window.__sbg.game.scene.getScene("level");
    return { paused: sc.paused, focus: sc.pauseMenu.buttons.focus };
  });
  expect(s).toEqual({ paused: true, focus: 1 });
});
