"""Entry point: blender -b --factory-startup -P tools/art/blender/render.py -- --shot=NAME --quality=test --out=PATH

Each shot builds a fresh scene (see shots.py) and writes one PNG. A shot that renders only part
of the frame (a doorway crop) stores its pixel rect in the scene's "crop_rect"; it's written next
to the PNG as NAME.json for the post step.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402

import lib  # noqa: E402
import shots  # noqa: E402


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = dict(a.lstrip("-").split("=", 1) for a in argv if "=" in a)
    name, quality = opts["shot"], opts.get("quality", "test")
    out = Path(opts.get("out", lib.ROOT / f"art/renders/{quality}/{name}.png"))
    lib.reset()
    shots.SHOTS[name](quality)
    lib.render(out)
    sc = bpy.context.scene
    meta = {"size": [sc.render.resolution_x, sc.render.resolution_y]}
    if "crop_rect" in sc:
        meta["crop_rect"] = [int(v) for v in sc["crop_rect"]]
    out.with_suffix(".json").write_text(json.dumps(meta))
    print(f"RENDERED {out}")


main()
