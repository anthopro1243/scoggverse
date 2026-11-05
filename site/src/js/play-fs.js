// Flappy Scogg's page: the game loads only when Play is pressed, into an iframe of /flappy-scogg/.
// ?test=1 and ?seed= are passed through so the playtests can drive it from here.
const screen = document.querySelector("[data-screen]");
const cover = document.querySelector("[data-cover]");
const fullBtn = document.querySelector("[data-fullscreen]");
let frame = null;

function gameUrl() {
  const here = new URLSearchParams(location.search);
  const pass = new URLSearchParams();
  for (const k of ["test", "seed", "touch"]) if (here.has(k)) pass.set(k, here.get(k));
  const q = pass.toString();
  return `/flappy-scogg/${q ? `?${q}` : ""}`;
}

document.querySelector("[data-play]").addEventListener("click", () => {
  if (frame) return;
  frame = document.createElement("iframe");
  frame.className = "tower__frame";
  frame.title = "Flappy Scogg";
  frame.allow = "autoplay; fullscreen";
  frame.allowFullscreen = true;
  frame.src = gameUrl();
  screen.prepend(frame);
  cover.hidden = true;
  fullBtn.disabled = false;
  frame.focus();
  // Space goes to the game straight away
  frame.addEventListener("load", () => frame.contentWindow?.focus(), { once: true });
});

fullBtn.addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else frame?.requestFullscreen?.();
});
