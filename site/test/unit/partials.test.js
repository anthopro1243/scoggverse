import { test } from "node:test";
import assert from "node:assert/strict";
import { renderHeader, renderFooter } from "../../scripts/vite-partials.js";

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

test("Add a Scogg: disabled note without a link, a real link with one", () => {
  assert.match(addScogg({ addScoggUrl: "" }), /disabled>Add a Scogg<\/button><span class="add-scogg__note">Ask in class for the deck link/);
  assert.match(addScogg({ addScoggUrl: "https://docs.google.com/x" }), /<a class="btn btn--gold add-scogg" href="https:\/\/docs\.google\.com\/x"/);
});


test("share page: escaped title, the shared JPEG card, redirect into the viewer", () => {
  const html = sharePage({ page: 9, title: `Scogga "Lisa" <3` }, { siteUrl: "https://example.test", count: "435" });
  assert.match(html, /og:title" content="Scogga &quot;Lisa&quot; &lt;3"/);
  assert.match(html, /og:image" content="https:\/\/example\.test\/share-card\.jpg"/);
  assert.match(html, /og:image:width" content="1200"/);
  assert.doesNotMatch(html, /memes\/og\//);
  assert.match(html, /http-equiv="refresh" content="0; url=\/gallery\/#\/scogg\/9"/);
  assert.match(html, /FILE 0009 from the class deck/);
  assert.doesNotMatch(html, /<script/);
});
