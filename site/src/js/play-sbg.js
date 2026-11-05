// Scogg Boy & Scogg Girl's page: the game loads only when Play is pressed, into an iframe of
// /scogg-boy-girl/. ?test=1 is passed through so the playtests can drive it from here.
const screen = document.querySelector("[data-screen]");
const cover = document.querySelector("[data-cover]");
const fullBtn = document.querySelector("[data-fullscreen]");
let frame = null;

function gameUrl() {
  const here = new URLSearchParams(location.search);
  const pass = new URLSearchParams();
  for (const k of ["test", "level", "phone"]) if (here.has(k)) pass.set(k, here.get(k));
  const q = pass.toString();
  return `/scogg-boy-girl/${q ? `?${q}` : ""}`;
}

document.querySelector("[data-play]").addEventListener("click", () => {
  if (frame) return;
  frame = document.createElement("iframe");
  frame.className = "vault__frame";
  frame.title = "Scogg Boy & Scogg Girl";
  frame.allow = "autoplay; fullscreen; gamepad";
  frame.allowFullscreen = true;
  frame.src = gameUrl();
  screen.prepend(frame);
  cover.hidden = true;
  fullBtn.disabled = false;
  frame.focus();
  // the keyboard goes to the game, so both players can start right away
  frame.addEventListener("load", () => frame.contentWindow?.focus(), { once: true });
});

fullBtn.addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else frame?.requestFullscreen?.();
});
