import { test } from "node:test";
import assert from "node:assert/strict";
import { pickDeck, titleFromBlocks, stripCredits, textSafety, parseTerms, hasCredit, trimTitle } from "../../scripts/lib/deck.js";
import { parseLayout } from "../../scripts/lib/layout.js";
import { selectMemes, fold } from "../../src/js/text.js";

test("pickDeck: skips Copy of and broken files, most pages wins, ties go newest", () => {
  const d = pickDeck([
    { name: "Copy of -The Scogg Files-.pdf", pages: 999, mtimeMs: 9 },
    { name: "-The Scogg Files- (3).pdf", pages: 300, mtimeMs: 5 },
    { name: "-The Scogg Files- (21).pdf", pages: 451, mtimeMs: 7 },
    { name: "-The Scogg Files- (22).pdf", pages: 451, mtimeMs: 8 },
    { name: "-The Scogg Files- (9).pdf", pages: NaN, mtimeMs: 10 },
  ]);
  assert.equal(d.name, "-The Scogg Files- (22).pdf");
  assert.equal(pickDeck([{ name: "Copy of x.pdf", pages: 61, mtimeMs: 1 }]), null);
});

test("titles: first line, joined across a connector, Vines skipped, credits stripped, trimmed", () => {
  assert.equal(titleFromBlocks([["The Lost City of", "Scogglantis"]], 57), "The Lost City of Scogglantis");
  assert.equal(titleFromBlocks([["Jaghatai Scogg", "The Warhawk of Choscoggris"]], 39), "Jaghatai Scogg");
  assert.equal(titleFromBlocks([["Vines"], ["x"]], 3), "Scogg #3");
  assert.equal(titleFromBlocks([["E"]], 99), "Scogg #99");
  assert.equal(titleFromBlocks([], 324), "Scogg #324");
  assert.equal(titleFromBlocks([["Scoggzilla made by Jordan"]], 5), "Scoggzilla");
  const long = titleFromBlocks([["Dr. Scogglove or: How I Learned to Stop Worrying and", "Love the Bomb"]], 205);
  assert.ok(long.length <= 60 && long.endsWith("…"), long);
});

test("stripCredits removes maker credits but keeps real titles", () => {
  assert.equal(stripCredits("Scogg Wick - by Sam"), "Scogg Wick");
  assert.equal(stripCredits("Scoggcrates (made by Alex P.)"), "Scoggcrates");
  assert.equal(stripCredits("Scogg Buck"), "Scogg Buck");
  assert.equal(stripCredits("Stand by Scogg"), "Stand by Scogg");
  assert.equal(stripCredits("Stand by me"), "Stand by me");
  assert.equal(trimTitle("a ".repeat(50)).length <= 60, true);
});

test("text safety: private terms, emails, phones and credits are caught; clean text passes", () => {
  const terms = parseTerms("# comment\nSpringfield High\ncs:SHS\n");
  assert.equal(textSafety("Welcome to springfield   high!", terms), "private term in slide text");
  assert.equal(textSafety("Go SHS", terms), "private term in slide text");
  assert.equal(textSafety("Go shs fans", terms), null, "cs: terms are case-sensitive");
  assert.equal(textSafety("CRASHSHS", terms), null, "whole words only");
  assert.equal(textSafety("mail me at a.b@school.org", terms), "email address in slide text");
  assert.equal(textSafety("call 214-555-0199", terms), "phone number in slide text");
  assert.equal(textSafety("Scogg Wick", terms), null);
  assert.ok(hasCredit("edited by Chris"));
  // The reason never contains the matched term itself.
  assert.doesNotMatch(textSafety("Springfield High", terms), /springfield/i);
});

test("parseLayout reads pages, blocks and lines", () => {
  const html = `<page><flow><block><line><word>The</word><word>Scogg</word></line><line><word>Files</word></line></block><block><line><word>Vines</word></line></block></flow></page><page></page>`;
  assert.deepEqual(parseLayout(html), [[["The Scogg", "Files"], ["Vines"]], []]);
});

test("selectMemes: search by folded title or #page, sorted newest/oldest", () => {
  const memes = [{ page: 9, title: "Scogga Lisa" }, { page: 128, title: "Absolute Scoggema" }, { page: 30, title: "Scogge Alighieri" }];
  assert.deepEqual(selectMemes(memes, "", "newest").map((m) => m.page), [128, 30, 9]);
  assert.deepEqual(selectMemes(memes, "", "oldest").map((m) => m.page), [9, 30, 128]);
  assert.deepEqual(selectMemes(memes, "LÍSA", "newest").map((m) => m.page), [9]);
  assert.deepEqual(selectMemes(memes, "#128", "newest").map((m) => m.page), [128]);
  assert.equal(fold("Scoggé"), "scogge");
});
