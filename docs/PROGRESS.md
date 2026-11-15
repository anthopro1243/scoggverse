# Progress

## Five Nights at Scoggy's 2 page (branch `fnas2-page`)

- New page `/play/five-nights-at-scoggies-2/`, built like game 1's page. The frame loads `/fnas2/` (set by `data-src` on `.cam`; `play.js` is shared).
- Poster `site/public/art/fnas2-title.webp` is a placeholder (site colours, title in Special Elite, 12 KB). A real title screenshot replaces it later. At 390 wide the Play button sits over the title; fine for a placeholder, a real picture will not have that problem.
- Game 2 is on the Play page and Home, so the games row is now four tiles (4 columns wide, 2 on tablets, 1 on phones). Headings say "All four". Home says "four games" and its small line now names Flappy Scogg as the phone game, since the newest game needs a keyboard.
- `vercel.json`: rewrite `/fnas2/:path*` to `https://fnas2-files.vercel.app/:path*` (the game's static project), `/fnas2/` left out of the CSP rule like `/game/`, same revalidate cache rule.
- Preview step: site build and tests pass; four Scogg Boy & Girl e2e tests failed once under full-suite load and pass alone and on a re-run of their file.
- Page text uses the "Not affiliated with Scott Cawthon" line, same as game 1.
- Tests added or extended: copy, polish, header and anonymity (build contains the page and poster), headers (rewrite, CSP, cache), games row, Home.
