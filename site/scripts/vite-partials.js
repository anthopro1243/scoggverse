// Replaces <!--@header-->, <!--@footer--> and <!--@games--> in every page with the shared partials, marks the
// current page's nav link with aria-current, and fills in build-time values (%SHOWN_COUNT%,
// %SHOWN_NUM%, <!--@addscogg-->) from src/data/deck.json and src/config.json. No runtime JS needed.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(import.meta.dirname, "../src/partials");
const readJson = (p, d) => { try { return JSON.parse(readFileSync(resolve(import.meta.dirname, p), "utf8")); } catch { return d; } };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NAV = ["/", "/gallery/", "/play/"];

function pagePath(filename) {
  const rel = filename.replace(/\\/g, "/").split("/").slice(-3).join("/");
  if (rel.endsWith("play/scogg-boy-girl/index.html")) return "/play/scogg-boy-girl/";
  if (rel.endsWith("play/five-nights-at-scoggies-2/index.html")) return "/play/five-nights-at-scoggies-2/";
  if (rel.endsWith("play/flappy-scogg/index.html")) return "/play/flappy-scogg/";
  if (rel.endsWith("gallery/index.html")) return "/gallery/";
  if (rel.endsWith("play/index.html")) return "/play/";
  if (rel.endsWith("404.html")) return "/404";
  return "/";
}

export function renderHeader(current) {
  let html = readFileSync(resolve(dir, "header.html"), "utf8");
  for (const href of NAV) {
    // a page inside a section (the Play page's own game pages) marks its section
    const attr = href === current || (href !== "/" && current.startsWith(href)) ? ' aria-current="page"' : "";
    html = html.replace(`href="${href}" data-nav`, `href="${href}" data-nav${attr}`);
  }
  return html;
}

export function renderFooter() {
  return readFileSync(resolve(dir, "footer.html"), "utf8");
}

export function renderGames() {
  return readFileSync(resolve(dir, "games.html"), "utf8");
}

/** Link-preview and privacy tags for a page, from its own <title> and description. */
export function headTags(html, path, config = readJson("../src/config.json", {})) {
  const site = (config.siteUrl || "").replace(/\/$/, "");
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] || "The Scoggverse";
  const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] || "";
  const url = path === "/404" ? `${site}/` : `${site}${path}`;
  const img = `${site}/share-card.jpg`;
  return [
    `<meta name="robots" content="noindex">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="The Scoggverse">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${desc}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:type" content="image/jpeg">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="The Uncle Scogg poster: I want you to not deny yourself an education">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${desc}">`,
    `<meta name="twitter:image" content="${img}">`,
  ].map((t) => `  ${t}`).join("\n");
}

export function addScogg(config = readJson("../src/config.json", {})) {
  return config.addScoggUrl
    ? `<a class="btn btn--gold add-scogg" href="${esc(config.addScoggUrl)}" target="_blank" rel="noopener">Add a Scogg</a>`
    : "";
}

export function fillValues(html, deck = readJson("../src/data/deck.json", {}), config = readJson("../src/config.json", {})) {
  const n = (x) => (Number.isFinite(x) ? x.toLocaleString("en-US") : "0");
  // one count everywhere: the Scoggs you can actually see in the gallery
  return html.replaceAll("%SHOWN_COUNT%", n(deck.shown)).replaceAll("%SHOWN_NUM%", String(Number.isFinite(deck.shown) ? deck.shown : 0)).replaceAll("<!--@addscogg-->", addScogg(config));
}

export function partials() {
  return {
    name: "scoggverse-partials",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const current = pagePath(ctx.filename);
        const filled = fillValues(html.replace("<!--@header-->", renderHeader(current)).replace("<!--@footer-->", renderFooter()).replace("<!--@games-->", renderGames()));
        return filled.replace("</head>", `${headTags(filled, current)}\n</head>`);
      },
    },
  };
}
