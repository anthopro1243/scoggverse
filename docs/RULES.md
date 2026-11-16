# Rules

The spec for the Scoggverse: the site and its three games. Change the code and this file together.

# Five Nights at Scoggy's

A free, non-commercial fan parody of Five Nights at Freddy's (FNAF 1) starring Dr. Scoggins, who approved it. Built in Godot 4.6 on the Cupcakes Framework, exported to the web. The game is served at `/game/` and played from `/play/`.

## Settled decisions

- Godot 4.6 (pinned to 4.6.3-stable) + the Cupcakes Framework; typed GDScript.
- Single-threaded web export (thread support off, so no COOP/COEP headers needed).
- Hosted on Vercel through Git integration: pushes to `main` of the public repo deploy. Vercel has no Godot, so we export the game locally and commit `web/`. Vercel builds the site (`site/`, Vite) and copies `web/` byte for byte into `/game/`; `/embed.html` redirects to `/game/embed.html`.
- No database, accounts or online features.
- Out of scope: the platformer, leaderboards. (The meme site was out of scope for the game milestones; it now lives in `site/`.)
- Art: the Scoggatronics are life-size cardboard standees of the classmates' slides from `assets/reference/the_scogg_files_copy.pdf` ("Copy of -The Scogg Files-.pdf"; page numbers refer to it), cut out with ordinary image tools, faces never altered. Rooms, props and lighting are Blender scripts (`tools/rerender.sh`). Never use pages 9, 10, 12, 16, 19, 20, 27, 35, 36, 42, 50, 58 in the game (`tools/art/slides.py` refuses them). The deck was updated on 2026-10-04 (bigger faces on Scoggis Khan p. 60 and Kennedy p. 55; p. 61 is now the 1917-style "I WANT YOU" poster): find slides by title or content, not page number, when it changes again.
- Uncle Scogg has two pictures: the 1917 poster slide (p. 61, head and shoulders) is the office "I WANT YOU" poster and the title screen; the full-body costume slide (kept as `assets/reference/uncle_scogg_full_body.pdf`, since the new deck dropped it) is his standee everywhere he appears. He always shows his legs.

## Mechanics spec (match FNAF 1)

All numbers live in `Scripts/Config/game_config.gd`.

- The night runs 12 AM to 6 AM at ~90 real seconds per in-game hour.
- Four bots, each with its own movement timer: leader 3.02 s, left-hall 4.97 s, right-hall 4.98 s, sprinter 5.01 s. On each tick a bot moves if a random integer 1–20 is <= its AI level (0–20).
- During a night: left-hall AI +1 at 2, 3 and 4 AM; right-hall and sprinter +1 at 3 and 4 AM.
- Power starts at 99.9% (999 internal units). Usage rises with each closed door, each lit hall light, and the camera tablet. Each usage bar drains 1% per 13 s (FNAF 1 is 9.6 s; slowed so Night 1 ends with ~40% power). Extra passive drain every 6/5/4/3 s on nights 2/3/4/5+ (Custom Night counts as 5+).
- At 0% power: doors open, lights and cameras die, the leader appears at the left door in the dark, then attacks.
- Sprinter: slowed while the player watches cameras; random cooldown after lowering the tablet; charges the left door if ignored.
- Leader: can't leave the stage until both hall bots have; moves only when its camera isn't being watched.
- Nights 1–5, Night 6, and a Custom Night with a 0–20 slider per bot. Per-night starting AI levels live in `GameConfig.NIGHT_LEVELS` (modeled on FNAF 1, tuned with the simulator). Beating Night 5 unlocks Night 6; beating Night 6 unlocks Custom Night.
- Flow: title (Continue / New Game / Custom Night once unlocked / How to Play) → "12 AM / Night X" card → night → 6 AM card (Scogg Bucks, Next Night / Menu) or game over (Retry / Menu). Progress saves in the browser (`user://save.cfg`): Continue night, best night, Custom Night unlock, Scogg Bucks. New Game resets only the Continue night.
- Scogg Bucks on each 6 AM: 10/15/25/40/60/100 for Nights 1–6, 2 per AI level on Custom Night, plus 2 per full 10% of power left.
- Bot roles: left-hall = Scoggcrates, right-hall = Scogga Lisa, sprinter = Scoggis Khan, leader = Uncle Scogg, rare scare = Absolute Scoggema.
- Map (ours, not FNAF's): CAM 1 Stage, 2 Cafeteria, 3 Library, 4 Teachers' Lounge, 5 Drama Room, 6 Left Hall, 7 Left Corner, 8 Right Hall, 9 Right Corner. Routes live in `Scripts/Core/rooms.gd`.
- Hall bots and the leader: a bot at a door, on its next successful move, goes back down its route if the door is shut, or gets in if it's open. A bot that got in jams that side's door and light, attacks when the tablet next comes down, or attacks anyway after 30 s if the tablet is never raised.
- Sprinter blocked at the left door costs 1% power the first time, then 5% more each time after, and goes back behind the curtain.
- Power out: the leader appears at the left door 3 s after the lights die, then attacks 5–20 s later unless 6 AM comes first. Other bots freeze.
- Our own twist: a voicemail from "Dr. Scoggins" on Nights 1–5 in place of the phone guy, ending with "Don't deny yourself an education." The phone rings 1 s into the night, then captions play over a muffled phone line (no synthesized voice), with a Mute call button. Night 1 teaches the controls. A recording dropped in as `assets/voice/nightN.ogg` replaces the line sound.
- Cosmetic scares (they never change the rules; numbers in `GameConfig`, rolls in `Scripts/Core/scare_events.gd`): hallucination flashes for a few frames, about one a night (p. 8, 46 or 51 over the office; p. 59 over camera static); camera glitch frames, where a standee shows for a frame or two in a room it isn't in; the Scoggipede (p. 28) crawling across CAM 7 now and then; and the rare scare, Absolute Scoggema (p. 30), a split-second flash in the office at most once a night.
- Jumpscares: Scoggcrates and Scoggis Khan rush the camera (rendered frames); Scogga Lisa and Uncle Scogg are flat (the face zooms in full-screen). Both: red flash (drawn at runtime), shake, glowing pupils.
- Sound (all made by `tools/audio/make_sounds.py`: synthesized, except the four screams and the footsteps, which are cut from CC0 recordings in `tools/audio/recordings/`, listed in its `SOURCES.md`; every scream is one grown man's voice picked to fit the figure the standee is dressed as, never his voice): office room tone and desk fan, a thinner camera room tone while the tablet is up, door, light, tablet and camera sounds panned to their side, footsteps louder and clearer the closer a bot is, Scoggis Khan's gallop swelling down the hall and banging on a shut door, the ambience fading to silence once a bot is inside, at least 1 s of silence before every jumpscare and each bot's own scream on its first frame, a power-down then Uncle Scogg's march in the dark doorway (the trio of *The Stars and Stripes Forever*, public domain), which slows and sags in pitch before he attacks, stings for the cosmetic scares, a 6 AM chime, and menu music. Buses come from `default_bus_layout.tres`, never `AudioServer.add_bus` (that silences the web build). On the web, sounds play as Web Audio samples: levels, sliders and pitch apply, bus effects (pan, muffle, phone EQ) only on desktop. `tools/playtest/audio_output.mjs` must show every key sound above RMS 0.01 with peaks ≤ 1.0.
- Web page (`tools/web/shell.html`): a loading screen with the title, a red bar and "Loading N of 53 MB", and the fan-parody disclaimer. Phones (touch-only, small screen) get a "Best on a laptop" notice before the download starts, with "Play anyway" (remembered). `web/embed.html` is the page to embed on the Scoggverse site (snippet in `docs/EMBED.md`).
- Settings (title and pause menu; saved in `user://settings.cfg`, apart from progress): master, music and sound-effect volume; screen shake; Reduce flashing (no red flash or camera flicker, smaller static bursts, scare flashes and glitch frames fade in softly at lower strength, Uncle Scogg's power-out face fades instead of blinking); and a Sound test page with a button for every sound, the march and the menu loop. Credits screen on the title.

## Coding rules

- Small scripts, one job each. Typed GDScript (`var x: int`, `-> void`).
- Every tuning number goes in `Scripts/Config/game_config.gd`. No magic numbers in other scripts.
- Game logic that can be tested without a scene (rolls, power math, clock) goes in plain functions or `RefCounted` classes so GUT can test it headless.
- New mechanics come with GUT tests in `test/unit/`.

## Legal rules

- Copy FNAF's mechanics and numbers only.
- Never copy its art, sounds, character designs, office layout, camera map, fonts or text.
- Keep the Cupcakes Framework's MIT LICENSE and credit Oplexitie in CREDITS.md. Credit every third-party asset there too.

## Do not touch

- All LICENSE files (`LICENSE`, `addons/gut/LICENSE.md`, any future asset licenses).
- `assets/face_kit/` (the face-kit photos).

## Checks

A change is done only when every check below passes:

1. Spec: this file matches what was built.
2. Unit tests: GUT passes headless, with a must-happen and a must-not-happen test for each rule.
3. Night simulator: `tools/sim_report.sh` plays each of Nights 1–6 1,000 times with the scripted decent player, plus the idle and doors-shut players. Report win rate, power left and most common death. Decent-player win rate targets: N1 95%, N2 85%, N3 65%, N4 45%, N5 25%, N6 10% (±10). Night 1 power left ~35–50%, and power-out should almost never kill on Night 1.
4. Screenshot sheet: `tools/screenshots.sh` produces `docs/screens/contact_sheet.png` (desktop and 375 px) with no visual bugs.
5. Real-browser playtest on the local build (`vite preview`) and then the live address (`tools/playtest/playtest.mjs`, headless Chromium, real mouse/keyboard input, `?test=1`). Report pass/fail for each scenario:
   - A full night played well (checks cameras, flicks lights, shuts doors only when a bot is there) survives to 6 AM.
   - Doing nothing dies before 6 AM.
   - A door left open with a bot at it ends in that bot's jumpscare.
   - Both doors shut all night runs out of power and plays the power-out sequence.
   - Ignoring the yurt camera (CAM 5) lets Scoggis Khan sprint down the left hall.
   - Every button, key and camera responds, and there are no console errors.
   - The sound is actually heard: `tools/playtest/audio_output.mjs` measures RMS at the speakers for every key sound (on `/game/` and through `/play/`).
   Add scenarios for new features.
6. FNAF-feel review: compare what the playtest showed against FNAF 1's rules in this file and list every difference. Fix anything clearly wrong; for judgment calls pick the option closest to FNAF 1.

Gate for every commit: import + tests + web export all pass. CI also runs the simulator, the screenshot sheet and the browser controls check on the committed web build.

# The Scoggverse site (`site/`)

- **The game must not change.** `web/` stays byte for byte as exported; the site build only copies it (`site/scripts/copy-game.mjs`), and a test compares every file. All game tests, CI and browser playtests must keep passing.
- Vite multi-page site, plain HTML/CSS/JS, no framework. Pages: `/`, `/gallery/`, `/play/`, `/play/scogg-boy-girl/`, `/play/flappy-scogg/`, `404.html` (About was removed on 2026-10-05; `/about/` redirects to Home). The second game, Scogg Boy & Scogg Girl (`scogg-boy-girl/`, Phaser), is built by the site build and copied into `/scogg-boy-girl/` by the same `copy-game.mjs`. The third, Flappy Scogg (`flappy-scogg/`, TypeScript on a canvas), is built and copied into `/flappy-scogg/` the same way. Every footer has the motto and one small fan-made / takedown line (wording in `site/src/partials/footer.html`); each game's "not affiliated" line is only on that game's own Play page. JS per page under 30 KB gzipped. `site/.gdignore` keeps Godot out of it.
- Gallery images come only from the class deck PDF, rendered and compressed with ordinary tools (poppler, sharp). Never alter his face or the classmates' faces; no maker credits; keep Scoggs appropriate.
- Anonymity rule: nothing public names who made the site: no names, usernames, emails, team name or preview links; the anonymity test enforces it.
- **Keep real-life details out of everything public**: the school's names and abbreviations, room numbers, his email, students' names or photos. The private terms list is `~/.config/scoggverse/private-terms.txt` (outside the repo, never committed). Never commit the full deck PDF or images of hidden slides. `site/test/unit/class-names.test.js` checks the gallery titles against the class list (`~/.config/scoggverse/class-names.txt`, or the `ANON_CLASS_NAMES` secret in CI; also never committed) and is skipped without it.
- Media files carry no metadata (EXIF, XMP, PNG text, Ogg comment tags, MP4 tags): `python3 tools/strip_metadata.py <files>` strips them losslessly, `tools/audio/make_sounds.py` strips its own output, and `site/test/unit/anonymity.test.js` checks the build, the files inside the game's `index.pck` and every tracked media file. `site/test/e2e/private-files.spec.js` checks that docs, package files, source maps, `.git` and config files answer 404.
- Free: no ads, analytics, trackers or third-party scripts; fonts are self-hosted.
- Copy voice: written like a classmate made it, plain and casual, like texting a classmate. No slogans or trailer lines. Banned phrases (including the "X, but it's Y" pitch), three-sentence slogan runs, em dashes, extra "!", arrows on links (→ ↗) and the motto more than once per page are checked by a test (`site/scripts/lib/copy.js`, `site/test/e2e/copy.spec.js`). One description per game, the same everywhere. Every count of Scoggs the site shows is `deck.shown` (the slides in the gallery).

# Scogg Boy & Scogg Girl (`scogg-boy-girl/`)

A two-player co-op puzzle platformer on one keyboard (Phaser 4, Vite), built into the site at `/scogg-boy-girl/`.

- Never alter his face (crop, scale, frame, rim light only; never flip, tint, darken, fade, warp); no slide-maker credits; copy Fireboy and Watergirl's rules only (none of their art or designs); not horror; don't touch Five Nights at Scoggy's (`web/`, the Godot project).
- Logic with no Phaser imports lives in `src/logic/` (and `src/art/poses.js`) and is unit-tested. Every tuning number lives in `src/logic/config.js`.
- Gate for every commit: `npm run test:unit`, `npm run build`, `npm run size`, `npm run test:e2e` all pass.

# Flappy Scogg (`flappy-scogg/`)

A one-button flying game (tap, click or Space) with Dr. Scoggins' stretched face from the class deck. Plain TypeScript on one canvas, built with Vite, built into the site at `/flappy-scogg/` and played from `/play/flappy-scogg/`.

- Never alter his face (crop, scale evenly, rotate, outline, shadow only); no slide-maker credits; copy Flappy Bird's rules only (none of its art, sounds, font or text); not scary; don't touch Five Nights at Scoggy's (`web/`, the Godot project) or `scogg-boy-girl/`.
- Logic with no DOM lives in `src/logic/` and is unit-tested. Every tuning number lives in `src/logic/config.ts`.
- Gate for every commit: `npm run test:unit`, `npm run build`, `npm run size`, `npm run test:e2e` all pass, and the site tests in `../site` when the site or the build changes.
