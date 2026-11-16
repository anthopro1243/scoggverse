import { test, expect } from "@playwright/test";
import { watchErrors } from "./helpers.js";

test("Play: nothing from the game downloads until Play is pressed", async ({ page }) => {
  const errors = watchErrors(page);
  const gameRequests = [];
  page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/game/")) gameRequests.push(r.url()); });
  await page.goto("/play/five-nights-at-scoggies/");
  await page.waitForLoadState("networkidle");
  expect(gameRequests).toEqual([]);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator("[data-fullscreen]")).toBeDisabled();
  await page.locator("[data-play]").click();
  const iframe = page.locator("iframe.cam__frame");
  await expect(iframe).toHaveAttribute("src", "/game/");
  const frame = page.frameLocator("iframe.cam__frame");
  await expect(frame.locator("canvas#canvas")).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator("[data-fullscreen]")).toBeEnabled();
  await expect.poll(() => gameRequests.some((u) => u.includes("/game/index.js"))).toBe(true);
  expect(errors).toEqual([]);
});

test("Play: the game loads and plays from the Play page", async ({ page, isMobile }) => {
  test.skip(isMobile, "the game is played on desktop");
  test.setTimeout(240_000);
  await page.goto("/play/five-nights-at-scoggies/?test=1");
  await page.locator("[data-play]").click();
  const el = page.locator("iframe.cam__frame");
  await expect(el).toHaveAttribute("src", "/game/?test=1");
  const frame = await (await el.elementHandle()).contentFrame();
  const st = () => frame.evaluate(() => (window.fnasState ? JSON.parse(window.fnasState) : null)).catch(() => null);
  const until = async (pred, what, ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { const s = await st(); if (s && pred(s)) return s; await page.waitForTimeout(100); }
    throw new Error(`timed out waiting for ${what}`);
  };
  const s = await until((x) => x.scene === "Title" && x.title_buttons, "the game's title screen", 180_000);
  const box = await el.boundingBox();
  const k = box.width / 1920;
  const at = ([x, y]) => page.mouse.click(box.x + x * k, box.y + y * k);
  await at([430, 490 + s.title_buttons.findIndex((b) => b.startsWith("New Game")) * 105 + 47]);
  await until((x) => x.observe?.ending === "intro", "the Night 1 card", 20_000);
  await at([960, 300]);
  await until((x) => x.observe?.ending === "" && x.observe.state === "playing", "the night to start", 20_000);
  await page.keyboard.press("a");
  await until((x) => x.observe.doors[0], "A to shut the left door", 10_000);
});

test("Game 2 page: header, nothing downloads until Play, then the frame loads /fnas2/", async ({ page }) => {
  const errors = watchErrors(page);
  const requests = [];
  page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/fnas2/")) requests.push(r.url()); });
  // the game's files are hosted apart from this build, so answer the frame with a blank page here
  await page.route("**/fnas2/**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>game</title>" }));
  await page.goto("/play/five-nights-at-scoggies-2/");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toHaveText("Five Nights at Scoggy's 2");
  await expect(page.locator(".site-nav a")).toHaveCount(3);
  await expect(page.locator('.site-nav a[href="/play/"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".site-footer")).toContainText("Don't deny yourself an education.");
  await expect(page.locator(".cast__card")).toHaveCount(4);
  await expect(page.locator(".keys kbd")).toContainText(["A", "D", "Q", "W", "O", "P", "Space", "1", "2", "L"]);
  await expect(page.locator(".cam__warn")).toContainText("50 MB");
  await expect(page.locator(".phone-note a")).toHaveAttribute("href", "/play/flappy-scogg/");
  expect(requests).toEqual([]);
  await expect(page.locator("[data-fullscreen]")).toBeDisabled();
  await page.locator("[data-play]").click();
  await expect(page.locator("iframe.cam__frame")).toHaveAttribute("src", "/fnas2/index.html");
  await expect(page.locator("[data-fullscreen]")).toBeEnabled();
  expect(errors).toEqual([]);
});

test("Play: phones get the best-on-a-laptop note and a link to the phone game", async ({ page, isMobile }) => {
  await page.goto("/play/five-nights-at-scoggies/");
  if (isMobile) {
    await expect(page.locator(".phone-note")).toBeVisible();
    await expect(page.locator(".phone-note a")).toHaveAttribute("href", "/play/flappy-scogg/"); // the game that works on a phone
  }
  else await expect(page.locator(".phone-note")).toBeHidden();
});

test("no About page; every footer has the fan-made note and the takedown line", async ({ page }) => {
  for (const path of ["/", "/gallery/", "/play/", "/404.html"]) {
    await page.goto(path);
    await expect(page.locator(".site-nav a")).toHaveText(["Home", "Gallery", "Games"]);
    await expect(page.locator('a[href^="/about"]')).toHaveCount(0);
    await expect(page.locator(".site-footer__fine")).toHaveText("Fan-made, Dr. Scoggins said it's ok. Want something taken down? Ask him.");
    await expect(page.locator(".site-footer")).not.toContainText("Not affiliated");
  }
});

test("each game's fan-parody line is only on its own Play page", async ({ page }) => {
  const lines = { "/play/five-nights-at-scoggies/": "Scott Cawthon", "/play/five-nights-at-scoggies-2/": "Scott Cawthon", "/play/scogg-boy-girl/": "Fireboy and Watergirl", "/play/flappy-scogg/": "Flappy Bird" };
  for (const [path, who] of Object.entries(lines)) {
    await page.goto(path);
    await expect(page.locator("body")).toContainText(`Not affiliated with ${who}`);
    for (const other of Object.values(lines).filter((w) => w !== who)) await expect(page.locator("body")).not.toContainText(`Not affiliated with ${other}`);
  }
  await page.goto("/play/five-nights-at-scoggies/");
  await expect(page.locator(".fnaf-fine")).toHaveText("Unofficial fan parody. Not affiliated with Scott Cawthon or Five Nights at Freddy's. Made with Dr. Scoggins' permission, for fun.");
  for (const path of ["/", "/gallery/", "/play/", "/404.html"]) {
    await page.goto(path);
    await expect(page.locator("body")).not.toContainText("Not affiliated");
  }
});

test("old /about/ links go to Home", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, "the redirect lives in vercel.json, so it's checked on a deployment");
  await page.goto("/about/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("h1")).toHaveText("The Scoggverse");
});

test("Home has no add-your-slide note at the bottom", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".note--deck")).toHaveCount(0);
  await expect(page.locator("main .add-scogg")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Add yours to the end");
  await expect(page.locator(".games__tile")).toHaveCount(4);
});

test("Home: one Play button, one plain line, the four games, then 8 random files", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  // human pass H2: no label over the title, one button, no stats line, no "All N" link
  await expect(page.locator("main .eyebrow")).toHaveCount(0);
  await expect(page.locator(".hero .btn")).toHaveCount(1);
  await expect(page.locator("main").getByRole("link", { name: /^Play$/ })).toHaveAttribute("href", "/play/");
  await expect(page.locator(".hero__new")).toHaveText("4 games now. Flappy Scogg works on your phone.");
  await expect(page.locator("main")).not.toContainText("Scoggs on file");
  await expect(page.locator(".section-head a")).toHaveCount(0);
  await page.waitForSelector("html[data-home-ready]");
  await expect(page.locator("[data-strip] .card__btn")).toHaveCount(8);
  const first = await page.locator("[data-strip] .card__btn").first().getAttribute("href");
  expect(first).toMatch(/^\/gallery\/#\/scogg\/\d+$/);
  const tiles = page.locator(".games__tile");
  await expect(tiles).toHaveCount(4);
  expect(await tiles.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(["/play/five-nights-at-scoggies/", "/play/five-nights-at-scoggies-2/", "/play/scogg-boy-girl/", "/play/flappy-scogg/"]);
  expect(errors).toEqual([]);
});

test("only the poster and the file cards lean; the rest sits straight", async ({ page }) => {
  for (const path of ["/", "/gallery/", "/play/", "/play/five-nights-at-scoggies/", "/play/scogg-boy-girl/", "/play/flappy-scogg/", "/play/five-nights-at-scoggies-2/", "/404.html"]) {
    await page.goto(path);
    const leaning = await page.evaluate(() => [...document.querySelectorAll("main *")]
      .filter((el) => !el.closest(".poster, .card__btn") && /matrix\((?!1, 0, 0, 1,)/.test(getComputedStyle(el).transform))
      .map((el) => el.className || el.tagName));
    expect(leaning, path).toEqual([]);
  }
  await page.goto("/");
  await page.waitForSelector("html[data-home-ready]");
  // each card picks its own lean from its page number, so they aren't all the same
  const tilts = await page.locator("[data-strip] .card__btn").evaluateAll((bs) => bs.map((b) => b.style.getPropertyValue("--tilt")));
  expect(new Set(tilts).size).toBeGreaterThan(2);
});

test("no red labels left except the case-file ones (FILE numbers)", async ({ page }) => {
  for (const path of ["/", "/gallery/", "/play/", "/play/five-nights-at-scoggies/", "/play/scogg-boy-girl/", "/play/flappy-scogg/", "/play/five-nights-at-scoggies-2/"]) {
    await page.goto(path);
    await expect(page.locator(".eyebrow, .note__label, .case2__label, .case3__label"), path).toHaveCount(0);
    await expect(page.locator("main"), path).not.toContainText(/Case file|The other game|The phone one/i);
  }
});

test("404 page in the same style", async ({ page }) => {
  const res = await page.goto(process.env.PLAYWRIGHT_BASE_URL ? "/no-such-file/" : "/404.html");
  if (process.env.PLAYWRIGHT_BASE_URL) expect(res.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("File not found");
  await expect(page.locator("main")).toContainText("That page isn't here.");
  await expect(page.locator(".site-nav a")).toHaveCount(3);
});

test("Games page: all four games on one page, each a card that opens its own page", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/play/");
  await expect(page.locator("h1")).toHaveText("Games");
  await expect(page.locator('.site-nav a[href="/play/"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator("[data-play], iframe")).toHaveCount(0);
  const cards = page.locator(".game-card");
  expect(await cards.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(["/play/five-nights-at-scoggies/", "/play/five-nights-at-scoggies-2/", "/play/scogg-boy-girl/", "/play/flappy-scogg/"]);
  // game 2 is on the first screen at both sizes' widths: second in the list, never under the others
  await expect(cards.nth(1)).toContainText("Five Nights at Scoggy's 2");
  await cards.nth(1).click();
  await expect(page).toHaveURL(/\/play\/five-nights-at-scoggies-2\/$/);
  await expect(page.locator("h1")).toHaveText("Five Nights at Scoggy's 2");
  expect(errors).toEqual([]);
});

test("every game's page has the strip of all four at the top, with its own game marked", async ({ page }) => {
  for (const path of ["/play/five-nights-at-scoggies/", "/play/five-nights-at-scoggies-2/", "/play/scogg-boy-girl/", "/play/flappy-scogg/"]) {
    await page.goto(path);
    const strip = page.locator(".switch__game");
    await expect(strip).toHaveCount(4);
    await expect(page.locator(".switch__game[aria-current]")).toHaveCount(1);
    await expect(page.locator(`.switch__game[href="${path}"]`)).toHaveAttribute("aria-current", "page");
    // it sits above the game, so no scrolling to find the other three
    const last = await strip.last().boundingBox();
    const screen = await page.locator("[data-screen]").boundingBox();
    expect(last.y + last.height).toBeLessThanOrEqual(screen.y);
  }
  await page.goto("/play/five-nights-at-scoggies/");
  await page.locator(".switch__game", { hasText: "Scoggy's 2" }).click();
  await expect(page).toHaveURL(/\/play\/five-nights-at-scoggies-2\/$/);
});
