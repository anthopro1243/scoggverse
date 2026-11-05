// The gallery: a chunked, lazy grid of every shown Scogg, instant search, sort, Random Scogg,
// the class-goal counter, and a lightbox with prev/next, keys, swipe and #/scogg/<page> links.
import memesUrl from "../data/memes.json?url";
import deck from "../data/deck.json";
import { selectMemes, fileNo, tilt } from "./text.js";

const CHUNK = 48;
const $ = (sel) => document.querySelector(sel);

const grid = $("[data-grid]");
const sentinel = $("[data-sentinel]");
const search = $("[data-search]");
const sort = $("[data-sort]");
const countEl = $("[data-count]");
const emptyEl = $("[data-empty]");
const lb = $("[data-lightbox]");
const lbImg = $("[data-lb-img]");
const toast = $("[data-toast]");

let memes = [];
let list = [];
let rendered = 0;
let current = -1; // index into `list` shown in the lightbox
let byPage = new Map();

function setGoal() {
  const n = deck.shown;
  $("[data-goal-count]").textContent = n.toLocaleString("en-US");
  const bar = $("[data-goal] [role=progressbar]");
  bar.setAttribute("aria-valuenow", String(n));
  $("[data-goal-fill]").style.width = `${Math.min(100, (n / deck.goal) * 100)}%`;
  const left = Math.max(0, deck.goal - n);
  $("[data-goal-note]").textContent = left ? `${left.toLocaleString("en-US")} more to go. Add yours at the end of the slideshow and keep it appropriate.` : "We hit 1,000. Nice.";
}

function card(m, i) {
  const li = document.createElement("li");
  li.className = "card";
  const b = document.createElement("button");
  b.type = "button";
  b.className = "card__btn";
  b.style.setProperty("--tilt", tilt(m.page));
  b.dataset.index = String(i);
  b.setAttribute("aria-label", `${m.title}, file ${m.page}`);
  const img = document.createElement("img");
  img.src = m.thumb;
  img.width = m.tw;
  img.height = m.th;
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  const cap = document.createElement("span");
  cap.className = "card__cap";
  cap.innerHTML = `<span class="card__file">${fileNo(m.page)}</span><span class="card__title"></span>`;
  cap.lastChild.textContent = m.title;
  b.append(cap, img);
  li.append(b);
  return li;
}

function renderMore() {
  if (rendered >= list.length) return;
  const frag = document.createDocumentFragment();
  const end = Math.min(list.length, rendered + CHUNK);
  for (let i = rendered; i < end; i++) frag.append(card(list[i], i));
  grid.append(frag);
  rendered = end;
  grid.dataset.rendered = String(rendered);
}

function refresh() {
  list = selectMemes(memes, search.value, sort.value);
  grid.replaceChildren();
  rendered = 0;
  renderMore();
  const q = search.value.trim();
  countEl.textContent = q ? `${list.length} ${list.length === 1 ? "file matches" : "files match"} “${q}”` : `${list.length} files on display`;
  emptyEl.hidden = list.length > 0;
}

new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting)) renderMore();
}, { rootMargin: "800px 0px" }).observe(sentinel);

// ---------- lightbox ----------
function show(i) {
  if (!list.length) return;
  current = (i + list.length) % list.length;
  const m = list[current];
  lbImg.src = m.full;
  lbImg.width = m.w;
  lbImg.height = m.h;
  lbImg.alt = m.title;
  $("[data-lb-title]").textContent = m.title;
  $("[data-lb-page]").textContent = fileNo(m.page);
  $("[data-lb-pos]").textContent = `${current + 1} of ${list.length}`;
  lb.dataset.page = String(m.page);
  history.replaceState(null, "", `#/scogg/${m.page}`);
  // Warm the neighbours so prev/next feel instant.
  for (const d of [1, -1]) new Image().src = list[(current + d + list.length) % list.length].full;
}

function open(i) {
  show(i);
  if (!lb.open) lb.showModal();
}

function close() {
  if (lb.open) lb.close();
}

lb.addEventListener("close", () => {
  current = -1;
  history.replaceState(null, "", location.pathname + location.search);
  const back = grid.querySelector(`[data-index="${lb.dataset.lastIndex}"]`);
  back?.focus();
});

function openPage(page) {
  let i = list.findIndex((m) => m.page === page);
  if (i < 0 && byPage.has(page)) {
    // Deep link to a slide hidden by the current search: clear the search first.
    search.value = "";
    refresh();
    i = list.findIndex((m) => m.page === page);
  }
  if (i >= 0) { lb.dataset.lastIndex = String(i); open(i); }
  return i >= 0;
}

grid.addEventListener("click", (e) => {
  const b = e.target.closest(".card__btn");
  if (!b) return;
  lb.dataset.lastIndex = b.dataset.index;
  open(Number(b.dataset.index));
});

$("[data-lb-prev]").addEventListener("click", () => show(current - 1));
$("[data-lb-next]").addEventListener("click", () => show(current + 1));
$("[data-lb-close]").addEventListener("click", close);
lb.addEventListener("click", (e) => { if (e.target === lb || e.target.matches("[data-lb-stage]")) close(); });
lb.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") { e.preventDefault(); show(current - 1); }
  else if (e.key === "ArrowRight") { e.preventDefault(); show(current + 1); }
  else if (e.key === "Tab") {
    // Keep focus inside the lightbox (a modal dialog alone lets Tab escape to the browser UI).
    const items = [...lb.querySelectorAll("button")].filter((b) => b.offsetParent !== null);
    const i = items.indexOf(document.activeElement);
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
    e.preventDefault();
    items[next].focus();
  }
});

let toastTimer;
$("[data-lb-copy]").addEventListener("click", async () => {
  const url = `${location.origin}/s/${list[current].page}/`;
  try { await navigator.clipboard.writeText(url); toast.textContent = "Link copied"; }
  catch { toast.textContent = url; }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.textContent = ""), 2500);
});

// Swipe left/right on touch screens.
let touchX = null, touchY = null;
lb.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }, { passive: true });
lb.addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
  touchX = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
});

// ---------- toolbar ----------
search.addEventListener("input", refresh);
sort.addEventListener("change", refresh);
$("[data-toolbar]").addEventListener("submit", (e) => e.preventDefault());
$("[data-random]").addEventListener("click", () => {
  const pool = list.length ? list : memes;
  if (pool !== list) { search.value = ""; refresh(); }
  const i = Math.floor(Math.random() * list.length);
  lb.dataset.lastIndex = String(i);
  open(i);
});

function fromHash() {
  const m = /^#\/scogg\/(\d+)$/.exec(location.hash);
  if (m) openPage(Number(m[1]));
}
window.addEventListener("hashchange", fromHash);

setGoal();
fetch(memesUrl)
  .then((r) => r.json())
  .then((data) => {
    memes = data;
    byPage = new Map(memes.map((m) => [m.page, m]));
    refresh();
    document.documentElement.dataset.galleryReady = "1";
    fromHash();
  })
  .catch(() => {
    countEl.textContent = "The slides didn't load. Try refreshing the page.";
  });
