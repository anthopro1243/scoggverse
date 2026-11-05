# The Scoggverse

A free fan site about Dr. Scoggins, a teacher who approved it: the class meme slideshow ("The Scogg Files") as a gallery, plus three games with him in them.

Play: https://five-nights-at-scoggies.vercel.app

| Folder | What it is |
|---|---|
| `site/` | The site (Vite, plain HTML/CSS/JS): Home, Gallery, Play pages |
| the root (`Scripts/`, `Scenes/`, `Graphics/`, `Audio/`, `web/`) | *Five Nights at Scoggy's*, a FNAF 1 parody in Godot 4.6 on the [Cupcakes Framework](https://github.com/Oplexitie/Cupcakes-Framework). `web/` is the committed web export |
| `scogg-boy-girl/` | *Scogg Boy & Scogg Girl*, a two-player platformer (Phaser 4) |
| `flappy-scogg/` | *Flappy Scogg*, a one-button flying game (TypeScript, canvas) |

Build the site (it builds both small games and copies the FNAF export in): `cd site && npm ci && npm run build`. Each part has its own tests (`npm test` in each folder; GUT for the Godot game). Rules for working on it are in [CLAUDE.md](CLAUDE.md); credits in [CREDITS.md](CREDITS.md) and each game's own CREDITS.md.

The class deck PDFs and the build notes are kept private and aren't in this repo.

Unofficial fan parody. Not affiliated with Scott Cawthon, Five Nights at Freddy's, Fireboy and Watergirl, Flappy Bird or their makers. Made with Dr. Scoggins' permission, for fun.
