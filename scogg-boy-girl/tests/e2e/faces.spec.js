import { test, expect } from "@playwright/test";
import { open, replay } from "./helpers.js";

// Hard rule: never alter the face. It may move, tilt with the hero, or scale evenly; at death it is hidden, never faded.
test("every pose, both ways, frame by frame: no face is ever flipped, tinted, faded, warped or covered", async ({ page }) => {
  // the look sheet (?scene=look) is dev-only now, so the pose sweep runs on a real level's heroes
  const errors = await open(page, "&level=sandbox");
  const checks = await page.evaluate(() => window.__sbg.faceChecks());
  expect(checks.length).toBe(2);
  for (const c of checks) expect(c).toMatchObject({ uniform: true, flipped: false, tinted: false, opaque: true, onTop: true, rigUniform: true });
  expect(await page.evaluate(() => window.__sbg.sweepPoses())).toEqual([]);
  expect(errors).toEqual([]);
});

test("the shipped build has no look sheet: ?scene=look opens the title screen", async ({ page }) => {
  const errors = await open(page, "&scene=look");
  expect(await page.evaluate(() => window.__sbg.scene)).toBe("title");
  expect(errors).toEqual([]);
});

test("sandbox: faces stay untouched through running, jumping, dying and respawning", async ({ page }) => {
  await open(page, "&level=sandbox");
  await replay(page);
  for (const c of await page.evaluate(() => window.__sbg.faceChecks())) {
    expect(c).toMatchObject({ uniform: true, flipped: false, tinted: false, opaque: true, onTop: true, rigUniform: true });
  }
});

test("the face images are the untouched cut-outs from the slide", async ({ request }) => {
  // served as files (not re-encoded by the build), same bytes as in assets/faces/
  const { readFileSync } = await import("node:fs");
  const html = await (await request.get("/")).text();
  const js = html.match(/assets\/index-[^"]+\.js/)[0];
  const bundle = await (await request.get(`/${js}`)).text();
  for (const who of ["boy", "girl"]) {
    const name = bundle.match(new RegExp(`scogg-${who}-[A-Za-z0-9_-]+\\.png`))[0];
    const served = Buffer.from(await (await request.get(`/assets/${name}`)).body());
    expect(served.equals(readFileSync(new URL(`../../assets/faces/scogg-${who}.png`, import.meta.url)))).toBe(true);
  }
});
