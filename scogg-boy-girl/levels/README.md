# Making a level

A level is a JSON file in this folder: its name, which subject it leans on, what it teaches (shown on the level select), which wing it's in, a few carved signs, an 18-row text grid (32 characters per row, one character per 30 px tile, the whole screen) and its puzzle pieces (`objects`, below). Add its name to `order.json` to put it in the game (each level opens once the one before is escaped), and write its replay (below) so the tests can prove it can be solved.

```json
{
  "name": "Priming",
  "teaches": "Pools, Bucks, Gavels, doors",
  "subject": "both",
  "wings": "split",
  "signs": [{ "x": 195, "y": 525, "text": "INFLATION: only Scogg Boy" }],
  "grid": ["################################", "..."]
}
```

- `wings`: `"macro"` (bronze vault), `"gov"` (marble) or `"split"` (Macro on the left half, Gov on the right).
- `signs`: carved plaques, `x`/`y` in pixels (the screen is 960 x 540), `\n` for a second line.

| Char | Tile |
|---|---|
| `.` | empty |
| `#` | solid stone |
| `I` | Inflation (only Scogg Boy is safe) |
| `K` | Ink (only Scogg Girl is safe) |
| `R` | Recession (nobody is safe) |
| `b` / `g` | where Scogg Boy / Scogg Girl start (the tile they stand in) |
| `V` / `C` | Scogg Boy's vault door / Scogg Girl's chamber door (the tile at the door's bottom center; exactly one each) |
| `$` / `*` | a Scogg Buck (only Scogg Boy grabs it) / a Gavel (only Scogg Girl) |
| `f` / `w` | a curtain of flame (only Scogg Boy passes) / of water (only Scogg Girl) |
| `1`-`4` | a pressure plate, on the floor below it |
| `5`-`8` | a gate, open while plate 1-4 is held (`5` by `1`, `6` by `2`...) |

Rules of thumb:
- Put pools in the floor row with stone under them; they sit flush with the floor.
- Heroes are about 1.8 tiles tall and jump about 4.5 tiles up and 6 across. Leave 2 empty rows under a platform people walk beneath, and keep platforms out of the way of a jump you want them to make.
- Doors are about 3 tiles tall and 3 wide. One carved motto sign (32 px) goes over both: across them when they stand side by side on one floor, or alone halfway between them otherwise. Leave room above the doors, and keep every sign off the Scogg Bucks and Gavels (`tests/e2e/signs.spec.js` checks).
- A level is checked when it loads (`src/logic/level.js`): 32 x 18, both starts, one door each standing on stone, every gate has its plate.

## Puzzle pieces (`objects`)

Positions are in tiles (`c` column, `r` row; halves are fine). Pieces talk through **signals**: plates, levers and timers switch them on and off; gates, lifts and basins read them. An expression is ids joined by `&` (and) and `|` (or), with `!` for not (`&` binds tighter). Grid plates `1`-`4` send `P1`-`P4`. Any plate id also sends `<id>all`, on only while every plate with that id is held.

| Piece | Fields | What it does |
|---|---|---|
| `plate` | `id`, `c`, `r` | A pressure plate on the floor below it, held by a hero or a crate. Several plates may share an id. |
| `gate` | `c`, `r`, `w`, `h`, `open`, `latch?`, `style?` | Open while `open` is on; never closes on a hero. `latch: true` stays open once it has opened (the filibuster wall: `open: "Fall"`, `style: "filibuster"`). `w: 2, h: 1` is a trapdoor. |
| `lever` | `id`, `c`, `r`, `start?`, `on?`, `off?` | Walking right into it switches it on, walking left switches it off. `on`/`off` say who may (`"boy"`, `"girl"`, default anyone): a veto lever is `on: "boy", off: "girl"`. Put levers where heroes don't walk by accident (a shelf, an end of a path); walking past one flips it. |
| `timer` | `id`, `c`, `r`, `seconds`, `trigger` | The Rules Committee's sand clock: refilled while `trigger` is on, then it runs out. On while sand is left. |
| `mover` | `id`, `c`, `r`, `w`, `to: [c, r]`, `when`, `speed?` | A platform that slides to `to` while `when` is on and back when it's off. Carries whoever stands on it and never comes down on a hero. Start it at `r` 16 in a one-tile hole in the floor to sit flush. |
| `elevator` | `c`, `r`, `w`, `to`, `period`, `offset?` | The business cycle: rides from trough (`c, r`) to peak (`to`) and back on the level clock, resting at each end. `offset: 0.5` runs opposite. |
| `scale` | `left: [c, r, w]`, `right: [c, r, w]`, `travel?` | Checks and balances: two hanging pans. The heavier side sinks `travel` tiles (default 2), the other rises; equal weight stays level. Heroes and crates weigh 1. |
| `basin` | `c`, `r`, `w`, `h`, `kind`, `high`, `startHigh?` | A pool (`inflation`, `ink` or `recession`) in a pit `h` tiles deep. While `high` is on it fills flush with the top (Scogg Boy can walk on Inflation); while off it drains to the floor. |
| `crate` | `c`, `r` | A surplus crate. A hero walking into it on the ground pushes it; it falls, rides platforms and holds plates down. |

`checkLevel` (`src/logic/level.js`) refuses unknown pieces, missing fields, repeated lever or timer ids, positions off the grid, and signals nobody sends.

## Replays (the solvability test)

`replays/<level>.json` holds one input track per player: lists of `[frames, keys]` held in turn (60 frames a second). Keys: `A` `D` `W` for Scogg Boy, `LEFT` `RIGHT` `UP` for Scogg Girl.

```json
{ "level": "priming", "boy": [[64, ["D"]], [30, ["D", "W"]]], "girl": [[4, ["RIGHT"]]] }
```

The easy way to write one: a plan in `replays/plans/<level>.json` lists each hero's moves in plain steps (`["walk", x]`, `["jumpTo", x, hold, delay]`, `["until", "s.mech.sig.P1"]`...; the list is at the top of `scripts/author.mjs`). `node scripts/author.mjs <level>` (with `npm run preview` running) plays the plan against the real game, steering frame by frame, prints what it missed, and saves the keys it pressed as `replays/<level>.json`. The test only plays those keys, so it doesn't depend on the tool.

`node scripts/trace.mjs replays/<level>.json` prints where both heroes are after each segment. `npm run test:e2e` replays every level in `order.json` and fails unless both reach their doors with everything collected and at least a B.

`sandbox.json` is the G0 test room (`?level=sandbox`); `test/` holds the small rooms the browser tests use.
