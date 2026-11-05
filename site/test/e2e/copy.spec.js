// §7 copy rules: the site's own words (not the classmates' slide titles) must sound like a
// classmate wrote them. Fails on banned phrases, slogan runs, em dashes, more than one "!", link arrows, or his motto more than once.
import { test, expect } from "@playwright/test";
import { BANNED, ARROWS, MOTTO, sloganRun } from "../../scripts/lib/copy.js";

export const PAGES = ["/", "/gallery/", "/play/", "/play/scogg-boy-girl/", "/play/flappy-scogg/", "/404.html"];

for (const path of PAGES) {
  test(`copy on ${path} reads human`, async ({ page, isMobile }) => {
    test.skip(isMobile, "same text at both sizes");
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const { text, blocks, visible, links } = await page.evaluate(() => {
      const clone = document.body.cloneNode(true);
      // Slide titles are the classmates' words, not site copy.
      clone.querySelectorAll(".card__title, [data-lb-title], [data-slide-title], script, style, noscript").forEach((n) => n.remove());
      const metas = [...document.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]')].map((m) => m.content);
      const attrs = [...clone.querySelectorAll("[alt],[aria-label],[placeholder],[title]")].map((n) => [n.alt, n.getAttribute("aria-label"), n.placeholder, n.title].filter(Boolean).join(" "));
      // Each block of running text on its own, so separate list items or labels never join into a "run".
      const blocks = [...clone.querySelectorAll("p, li, h1, h2, h3, dd, figcaption, .note__text")].map((n) => n.innerText);
      return { text: `${document.title} ${metas.join(" ")} ${clone.innerText} ${attrs.join(" ")}`, blocks: [...blocks, ...metas], visible: document.body.innerText, links: [...document.querySelectorAll("a")].map((a) => a.innerText).join(" ") };
    });
    for (const re of BANNED) expect(text, `banned phrase ${re}`).not.toMatch(re);
    for (const b of blocks) expect(sloganRun(b), `slogan run in "${b}"`).toBeNull();
    expect(text, "no em dashes").not.toContain("—");
    expect((text.match(/!/g) || []).length, "at most one ! per page").toBeLessThanOrEqual(1);
    // (arrow key caps like Scogg Girl's ← → are fine; arrows tacked onto links are the template habit)
    expect(links, "no arrows on links").not.toMatch(ARROWS);
    // his line stays in the footer; more copies on one page read like a slogan
    expect(visible.split(MOTTO).length - 1, "the motto once per page").toBe(1);
  });
}
