# Credits

Five Nights at Scoggy's is a free, non-commercial fan parody of Five Nights at Freddy's by Scott Cawthon. It isn't affiliated with or endorsed by him. It copies only the game's rules and numbers; all art, sound and writing are our own.

## Code

- **Cupcakes Framework** by Oplexitie, MIT license (see `LICENSE`). https://github.com/Oplexitie/Cupcakes-Framework. The office, tablet, camera system, AI base classes, shaders and placeholder graphics come from it.
- **GUT (Godot Unit Test)** by Butch Wesley (bitwes), MIT license (see `addons/gut/LICENSE.md`). https://github.com/bitwes/Gut. Used for tests only, not shipped in the web build.
- **Godot Engine**, MIT license. https://godotengine.org

## Art (Milestone 3)

- **Blender** (GPL), used to model and render every image. https://www.blender.org. All models and materials are built by the scripts in `tools/art/blender/`; no third-party 3D models or textures are used.
- **DejaVu fonts** (free license, `tools/art/fonts/LICENSE-DejaVu.txt`), for the Uncle Scogg poster and the flyers. https://dejavu-fonts.github.io
- The characters, posters, chalk drawings, flashes and the Scogg Buck bill are the classmates' slides from "The Scogg Files" deck, used with Dr. Scoggins' OK and left uncredited per the deck's rules. They're cut out and placed with ordinary image tools (no AI).

## Sound (Milestone 4)

- Every sound effect and the menu music are synthesized from scratch by `tools/audio/make_sounds.py` (numpy DSP in `tools/audio/dsp.py`). No recordings, samples or AI voices. The nightly call is captions over a synthesized phone-line sound.
- **The Stars and Stripes Forever** by John Philip Sousa (1896, public domain): the power-out march plays its trio on a synthesized music box. The notes come from the Mutopia Project's public-domain LilyPond edition (piece 626), https://www.mutopiaproject.org, read as text; no recording was used.
