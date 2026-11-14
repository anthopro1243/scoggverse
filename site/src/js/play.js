// Play page: the game loads only when Play is pressed (it's ~53 MB), into an iframe of /game/ (or the page's data-src).
// ?test=1 and ?speed=N are passed through to the game so the playtests can drive it from here.
const cam = document.querySelector("[data-cam]");
const screen = document.querySelector("[data-screen]");
const cover = document.querySelector("[data-cover]");
const fullBtn = document.querySelector("[data-fullscreen]");
const stamp = document.querySelector("[data-stamp]");
let frame = null;

function gameUrl() {
  const here = new URLSearchParams(location.search);
  const pass = new URLSearchParams();
  for (const k of ["test", "speed"]) if (here.has(k)) pass.set(k, here.get(k));
  const q = pass.toString();
  return `${cam.dataset.src || "/game/"}${q ? `?${q}` : ""}`;
}

document.querySelector("[data-play]").addEventListener("click", () => {
  if (frame) return;
  frame = document.createElement("iframe");
  frame.className = "cam__frame";
  frame.title = cam.dataset.title || "Five Nights at Scoggy's";
  frame.allow = "autoplay; fullscreen; gamepad";
  frame.allowFullscreen = true;
  frame.src = gameUrl();
  screen.prepend(frame);
  cover.hidden = true;
  screen.classList.add("is-live");
  fullBtn.disabled = false;
  frame.focus();
  frame.addEventListener("load", () => frame.contentWindow?.focus(), { once: true });
});

fullBtn.addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else frame?.requestFullscreen?.();
});

// The little camera timestamp over the screen (cosmetic).
function tick() {
  const d = new Date();
  const h = d.getHours() % 12 || 12;
  const pad = (n) => String(n).padStart(2, "0");
  stamp.textContent = `CAM 00 · ${h}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${d.getHours() < 12 ? "AM" : "PM"}`;
}
tick();
setInterval(tick, 1000);
