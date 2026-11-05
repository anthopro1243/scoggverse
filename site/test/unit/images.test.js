import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import sharp from "sharp";
import { FULL, THUMB, IMAGE_VERSION, imageName, parseImageName, trimBox, findTrim, isWhite, encodeWebp } from "../../scripts/lib/images.js";

const memes = JSON.parse(readFileSync("src/data/memes.json", "utf8"));

test("image names carry the render hash and the settings version, and read back", () => {
  assert.equal(imageName(57, "ab12cd34"), `57-ab12cd34-v${IMAGE_VERSION}.webp`);
  assert.deepEqual(parseImageName("57-ab12cd34-v2.webp"), { page: 57, hash: "ab12cd34", version: 2 });
  assert.deepEqual(parseImageName("57-ab12cd34.webp"), { page: 57, hash: "ab12cd34", version: 1 });
  assert.equal(parseImageName("57-notahash.webp"), null);
});

test("trimBox: pads the content box, stays inside the slide, skips tiny trims", () => {
  const size = { width: 1600, height: 900 };
  // content in the middle: padded by 2% of its long side on every edge
  assert.deepEqual(trimBox(size, { left: 400, top: 200, width: 800, height: 500 }), { left: 384, top: 184, width: 832, height: 532 });
  // content touching the top-left corner: the pad never goes outside the slide
  assert.deepEqual(trimBox(size, { left: 0, top: 0, width: 1000, height: 600 }), { left: 0, top: 0, width: 1020, height: 620 });
  // must-not: a trim that saves almost nothing keeps the whole slide
  assert.equal(trimBox(size, { left: 2, top: 2, width: 1596, height: 896 }), null);
  assert.equal(trimBox(size, null), null);
});

test("isWhite: only light, colourless corners count as a white margin", () => {
  assert.ok(isWhite([255, 255, 255]));
  assert.ok(isWhite([240, 238, 236]));
  assert.ok(!isWhite([0, 0, 0]));
  assert.ok(!isWhite([255, 240, 120]));
});

async function slide({ bg, block }) {
  // 1600x900 slide with a coloured block standing in for the picture
  const pic = await sharp({ create: { width: block.width, height: block.height, channels: 3, background: "#3366aa" } }).png().toBuffer();
  return sharp({ create: { width: 1600, height: 900, channels: 3, background: bg } }).composite([{ input: pic, left: block.left, top: block.top }]).png().toBuffer();
}

test("findTrim keeps the whole picture and drops only the white margins", async () => {
  const block = { left: 500, top: 150, width: 600, height: 500 };
  const box = await findTrim(await slide({ bg: "#ffffff", block }));
  assert.ok(box, "white margins are trimmed");
  assert.ok(box.left <= block.left && box.top <= block.top, "nothing cut on the top or left");
  assert.ok(box.left + box.width >= block.left + block.width && box.top + box.height >= block.top + block.height, "nothing cut on the bottom or right");
  assert.ok(box.width < 700 && box.height < 600, "the margins are gone");
});

test("findTrim must not trim a slide whose edge isn't plain white", async () => {
  assert.equal(await findTrim(await slide({ bg: "#101010", block: { left: 500, top: 150, width: 600, height: 500 } })), null);
  assert.equal(await findTrim(await slide({ bg: "#ffffff", block: { left: 0, top: 0, width: 1600, height: 900 } })), null);
});

test("encodeWebp fits inside the box and under the byte cap", async () => {
  const noise = await sharp(Buffer.from(Array.from({ length: 1600 * 900 * 3 }, () => Math.floor(Math.random() * 256))), { raw: { width: 1600, height: 900, channels: 3 } }).png().toBuffer();
  const buf = await encodeWebp(noise, { ...THUMB });
  const meta = await sharp(buf).metadata();
  assert.ok(meta.width <= THUMB.width && meta.height <= THUMB.height);
  assert.ok(buf.length <= THUMB.maxBytes, `${buf.length} bytes`);
});

test("every committed slide image uses the current settings", async () => {
  for (const m of memes) {
    for (const [kind, url, w, h, limit] of [["full", m.full, m.w, m.h, FULL], ["thumb", m.thumb, m.tw, m.th, THUMB]]) {
      const name = url.split("/").pop();
      assert.equal(parseImageName(name)?.version, IMAGE_VERSION, `${name}: re-encode with npm run reencode`);
      const file = `public${url}`;
      assert.ok(existsSync(file), file);
      assert.ok(statSync(file).size <= limit.maxBytes, `${file} is ${statSync(file).size} bytes`);
      if (kind === "full") assert.ok(Math.max(w, h) <= FULL.edge, `${file} is ${w}x${h}`);
      else assert.ok(w <= THUMB.width && h <= THUMB.height, `${file} is ${w}x${h}`);
    }
  }
  // must-not: no leftover image files outside memes.json (old sizes, hidden slides)
  const listed = new Set(memes.flatMap((m) => [m.full, m.thumb]));
  for (const sub of ["full", "thumb"]) for (const f of readdirSync(`public/memes/${sub}`)) assert.ok(listed.has(`/memes/${sub}/${f}`), `stray file ${sub}/${f}`);
  assert.ok(!existsSync("public/memes/og"), "per-slide preview JPEGs are gone (one shared card)");
});

test("the viewer keeps the whole slide: full images are never trimmed", async () => {
  for (const m of memes.filter((_, i) => i % 40 === 0)) {
    const meta = await sharp(`public${m.full}`).metadata();
    assert.equal((meta.width / meta.height).toFixed(2), (16 / 9).toFixed(2), m.full);
  }
});
