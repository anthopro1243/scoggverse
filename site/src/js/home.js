// Home: a strip of 8 random file cards from the deck, with a Shuffle button.
import memesUrl from "../data/memes.json?url";
import { fileNo } from "./text.js";

const strip = document.querySelector("[data-strip]");
let memes = [];

function pick(n) {
  const a = memes.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

function render() {
  strip.replaceChildren(...pick(8).map((m) => {
    const li = document.createElement("li");
    li.className = "card";
    const a = document.createElement("a");
    a.className = "card__btn";
    a.href = `/gallery/#/scogg/${m.page}`;
    a.innerHTML = `<span class="card__cap"><span class="card__file">${fileNo(m.page)}</span><span class="card__title"></span></span><img alt="" loading="lazy" decoding="async">`;
    a.querySelector(".card__title").textContent = m.title;
    const img = a.querySelector("img");
    img.src = m.thumb; img.width = m.tw; img.height = m.th;
    li.append(a);
    return li;
  }));
}

document.querySelector("[data-shuffle]").addEventListener("click", render);
fetch(memesUrl).then((r) => r.json()).then((data) => { memes = data; render(); document.documentElement.dataset.homeReady = "1"; });
