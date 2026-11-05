"""Life-size cardboard standees of the classmates' slide pictures (cut out by tools/art/cutouts.py).

A standee is a printed front (the cutout, with its white die-cut margin), a plain cardboard back
a few millimeters behind it, a fold-out easel strut, and, for pictures that stop above the
floor (a half-length portrait, a figure cut off at the shins), a painted display riser.
It stands at its root's origin facing -Y, leaning back slightly on its strut.
"""
import json
import math

import bpy
from mathutils import Vector

import lib

CUTOUTS = lib.ROOT / "art/cutouts"
NAMES = ("scoggcrates", "scogga_lisa", "scoggis_khan", "uncle_scogg", "absolute_scoggema")


def meta(name: str) -> dict:
    return json.loads((CUTOUTS / f"{name}.json").read_text())


def _mat_back(name: str, img):
    """Brown corrugated cardboard, using the print's alpha for its outline."""
    key = ("card_back", name)
    if key in lib._cache:
        return lib._cache[key]
    m, nt, bsdf = lib._mat(f"CardBack_{name}")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    n = lib._noise(nt, 30.0, 3, 0.5, "UV")
    col = lib._ramp(nt, n.outputs["Fac"], [(0.3, (0.32, 0.22, 0.12)), (0.7, (0.42, 0.3, 0.17))])
    nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.9
    lib._cache[key] = m
    return m


def standee(name: str, loc=(0, 0, 0), yaw_deg: float = 0.0, lean_deg: float = 4.0, scale: float = 1.0,
            riser: bool = True, glow: float = 0.0) -> dict:
    """Builds the standee; returns {root, board, face (world), height, width, base}. glow > 0 adds
    the glowing-pupil effect layer (small emissive dots just in front of the print's pupils; the
    print itself is untouched), for dark shots only."""
    mt = meta(name)
    h = mt["height_m"] * scale
    w = h * mt["aspect"]
    base = mt["base_m"] * scale if riser else 0.0
    root = lib.empty(f"Standee_{name}", (0, 0, 0))
    board = lib.empty(f"Board_{name}", (0, 0, base), root)  # pivot at the bottom edge (it leans on this)
    front = lib.mat_image(f"Print_{name}", CUTOUTS / f"{name}.png", rough=0.45, alpha=True, dirt=0.12)
    img = bpy.data.images.load(str(CUTOUTS / f"{name}.png"), check_existing=True)
    lib.plane((w, h), (0, 0, base + h / 2), front, board, name=f"Print_{name}")
    lib.plane((w, h), (0, 0.005, base + h / 2), _mat_back(name, img), board, name=f"Back_{name}")
    card = lib.mat_plain("Cardboard", (0.36, 0.25, 0.14), 0.9)
    # Easel strut folded out behind, from about half height down to the floor.
    sh = base + h * 0.5
    lib.cyl_between((0, 0.01, sh), (0, 0.01 + sh * 0.35, 0.0), 0.012, card, board, verts=4, name="Strut")
    flap = lib.box((0.12, 0.008, sh * 1.0), (0, 0.02 + sh * 0.175, sh * 0.5), card, board, bevel=0, name="StrutFlap")
    flap.rotation_euler = (math.atan2(sh * 0.35, sh), 0, 0)
    if base > 0.05:
        u0, u1 = mt["bottom_u"]
        bw = (u1 - u0) * w + 0.08
        bx = ((u0 + u1) / 2 - 0.5) * w
        riser_mat = lib.mat_wood("Riser", (0.08, 0.07, 0.065), 0.55)
        lib.box((bw, 0.36, base), (bx, 0.14, base / 2), riser_mat, root, bevel=0.01, name="Riser")
    if glow:
        dot = lib.mat_emit(f"PupilGlow{glow}", (1.0, 0.97, 0.9), glow)
        for u, v in mt["pupils_uv"]:
            lib.sphere(0.0075 * h, ((u - 0.5) * w, -0.008, base + (1 - v) * h), dot, board, scale=(1, 0.3, 1),
                       segments=12, name="PupilGlow")
    board.rotation_euler = (math.radians(-lean_deg), 0, 0)
    root.location = Vector(loc)
    root.rotation_euler = (0, 0, math.radians(yaw_deg))
    bpy.context.view_layer.update()
    fu, fv = mt["face_uv"]
    face_local = Vector(((fu - 0.5) * w, -0.01, base + (1 - fv) * h))
    face = root.matrix_world @ (Vector((0, 0, base)) + _lean(face_local - Vector((0, 0, base)), lean_deg))
    return {"root": root, "board": board, "face": face, "height": h, "width": w, "base": base}


def _lean(v: Vector, lean_deg: float) -> Vector:
    a = math.radians(-lean_deg)
    return Vector((v.x, v.y * math.cos(a) - v.z * math.sin(a), v.y * math.sin(a) + v.z * math.cos(a)))


def face_toward(name: str, loc, target, **kw) -> dict:
    d = Vector(target) - Vector(loc)
    return standee(name, loc, math.degrees(math.atan2(d.x, -d.y)), **kw)
