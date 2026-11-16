import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { renderHeader, renderFooter, renderGames, renderGameCards, renderSwitch, games } from "../../scripts/vite-partials.js";

test("header marks only the current page", () => {
  const html = renderHeader("/gallery/");
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.match(html, /href="\/gallery\/" data-nav aria-current="page"/);
});

test("404 marks no nav link", () => {
  assert.doesNotMatch(renderHeader("/404"), /aria-current/);
});

test("footer: the motto and the fan-made note with the takedown line, no game disclaimer", () => {
  assert.match(renderFooter(), /Don't deny yourself an education\./);
  assert.ok(renderFooter().includes("Fan-made, Dr. Scoggins said it's ok. Want something taken down? Ask him."));
  // each game's "not affiliated" line lives on that game's own Play page, not in every footer
  assert.doesNotMatch(renderFooter(), /Cawthon|Not affiliated/);
});

import { headTags, addScogg, fillValues } from "../../scripts/vite-partials.js";
import { sharePage } from "../../scripts/share.mjs";

test("head tags: noindex, absolute og:image, the page's own title", () => {
  const html = `<title>Gallery · X</title><meta name="description" content="Every Scogg.">`;
  const tags = headTags(html, "/gallery/", { siteUrl: "https://example.test" });
  assert.match(tags, /<meta name="robots" content="noindex">/);
  assert.match(tags, /og:image" content="https:\/\/example\.test\/share-card\.jpg"/);
  assert.match(tags, /og:title" content="Gallery · X"/);
  assert.match(tags, /og:url" content="https:\/\/example\.test\/gallery\/"/);
});

test("Add a Scogg: nothing without a link, a real link with one", () => {
  assert.equal(addScogg({ addScoggUrl: "" }), "");
  assert.match(addScogg({ addScoggUrl: "https://docs.google.com/x" }), /<a class="btn btn--gold add-scogg" href="https:\/\/docs\.google\.com\/x"/);
});


test("share page: escaped title, the slide as the picture with the JPEG card after it, redirect into the viewer", () => {
  const html = sharePage({ page: 9, title: `Scogga "Lisa" <3`, full: "/memes/full/9-abc-v2.webp", w: 1280, h: 720 }, { siteUrl: "https://example.test" });
  const images = [...html.matchAll(/og:image" content="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(images, ["https://example.test/memes/full/9-abc-v2.webp", "https://example.test/share-card.jpg"]);
  assert.match(html, /<title>Scogga &quot;Lisa&quot; &lt;3 - The Scoggverse<\/title>/);
  assert.match(html, /og:title" content="Scogga &quot;Lisa&quot; &lt;3"/);
  assert.match(html, /og:image" content="https:\/\/example\.test\/share-card\.jpg"/);
  assert.match(html, /og:image:width" content="1280"/);
  assert.doesNotMatch(html, /memes\/og\//);
  assert.match(html, /http-equiv="refresh" content="0; url=\/gallery\/#\/scogg\/9"/);
  // the description is one plain line, not the title again: no file number, no count
  assert.match(html, /name="description" content="From the Scogg Files\."/);
  assert.match(html, /og:description" content="From the Scogg Files\."/);
  assert.doesNotMatch(html, /Scoggs on file|FILE 0009/);
  assert.doesNotMatch(html, /<script/);
});

test("the games row: the four games, a picture and the name each, no label or pitch", () => {
  const html = renderGames();
  assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ["/play/five-nights-at-scoggies/", "/play/five-nights-at-scoggies-2/", "/play/scogg-boy-girl/", "/play/flappy-scogg/"]);
  assert.equal((html.match(/<img /g) || []).length, 4);
  assert.doesNotMatch(html, /label|Case file|Two player|Tap to flap|The FNAF one/);
});

test("every share page's pictures are real files in public/", () => {
  const dir = new URL("../../public/s/", import.meta.url);
  const pages = readdirSync(dir);
  assert.ok(pages.length > 0);
  for (const p of pages) {
    const html = readFileSync(new URL(`${p}/index.html`, dir), "utf8");
    const images = [...html.matchAll(/og:image" content="https?:\/\/[^/]+(\/[^"]+)"/g)].map((m) => m[1]);
    assert.equal(images.length, 2, `share page ${p} has the slide and the card`);
    for (const img of images) assert.ok(existsSync(new URL(`../../public${img}`, import.meta.url)), `${p}: ${img}`);
  }
});

test("the game cards: the same four, each with its one description and what it needs", () => {
  const html = renderGameCards();
  assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ["/play/five-nights-at-scoggies/", "/play/five-nights-at-scoggies-2/", "/play/scogg-boy-girl/", "/play/flappy-scogg/"]);
  for (const g of games()) {
    assert.ok(html.includes(g.desc), g.name);
    assert.ok(html.includes(g.needs), g.name);
    // one description per game, the same everywhere: the game's own page opens with it
    const page = readFileSync(new URL(`../..${g.href}index.html`, import.meta.url), "utf8");
    assert.ok(page.includes(`<p>${g.desc}</p>`), `${g.href} opens with the same description`);
  }
});

test("the strip on a game's page marks that game and no other; the Games page marks none", () => {
  const html = renderSwitch("/play/five-nights-at-scoggies-2/");
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.match(html, /href="\/play\/five-nights-at-scoggies-2\/" aria-current="page"/);
  assert.doesNotMatch(renderSwitch("/play/"), /aria-current/);
});
