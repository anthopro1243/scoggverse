"""Every rendered shot, by name. Each function builds its scene and sets up the camera and
render size; render.py does the rest. GAME_SHOTS (at the bottom) is what the game uses."""
import math
import random

import bpy
from mathutils import Vector

import lib
import rooms
import scenes
import standee

SHOTS = {}
SIZES = lib.CFG["sizes"]


def shot(fn):
    SHOTS[fn.__name__] = fn
    return fn


# ---------------------------------------------------------------- final game art (Milestone 3)



def _border(points, pad_px: int = 24) -> None:
    """Render only the screen rect around these world points (stored as crop_rect for the post step)."""
    sc = bpy.context.scene
    bpy.context.view_layer.update()  # the camera's matrix must be current before projecting
    cam = sc.camera
    W, H = sc.render.resolution_x, sc.render.resolution_y
    uv = [lib.project(cam, p) for p in points]
    x0 = max(0, int(min(u for u, _ in uv) * W) - pad_px)
    x1 = min(W, int(max(u for u, _ in uv) * W) + pad_px)
    y0 = max(0, int(min(v for _, v in uv) * H) - pad_px)
    y1 = min(H, int(max(v for _, v in uv) * H) + pad_px)
    sc.render.use_border = True
    sc.render.use_crop_to_border = False
    sc.render.border_min_x, sc.render.border_max_x = x0 / W, x1 / W
    sc.render.border_min_y, sc.render.border_max_y = 1 - y1 / H, 1 - y0 / H
    sc["crop_rect"] = [x0, y0, x1, y1]


def _door_points(side: int) -> list:
    """The doorway plus the hall light's spill on the frame and floor around it."""
    x = -scenes.ROOM_X if side == 0 else scenes.ROOM_X
    y0, y1 = scenes.DOOR_Y
    pts = []
    for y in (y0 - 0.3, y1 + 0.3):
        for z in (0.0, scenes.DOOR_FRAME_TOP + 0.15):
            pts.append(Vector((x, y, z)))
    pts.append(Vector((x * 0.82, (y0 + y1) / 2, 0.0)))
    return pts


@shot
def office(quality: str) -> None:
    lib.setup_render(tuple(SIZES["office"]), quality)
    scenes.build_office()
    scenes.office_camera()


@shot
def office_dark(quality: str) -> None:
    """Power out: lamp, screens and buttons dead; the poster is blank (he's left the stage)."""
    lib.setup_render(tuple(SIZES["office"]), quality)
    scenes.build_office(power=False, poster_blank=True)
    lib.point_light((0, 0.5, 2.6), 2, (0.35, 0.45, 0.8), 0.5)  # a trace of moonlight so shapes read
    scenes.office_camera()


@shot
def office_poster_blank(quality: str) -> None:
    """The blank Uncle Scogg poster, cropped (shown once he's left the stage)."""
    lib.setup_render(tuple(SIZES["office"]), quality)
    scenes.build_office(poster_blank=True)
    scenes.office_camera()
    pos = Vector((-0.55, scenes.BACK_Y - 0.02, 1.65))
    _border([pos + Vector((dx, 0, dz)) for dx in (-0.5, 0.5) for dz in (-0.7, 0.7)], 6)


def _light(side: int):
    def fn(quality: str) -> None:
        lib.setup_render(tuple(SIZES["office"]), quality)
        scenes.build_office(lights=(side == 0, side == 1))
        scenes.office_camera()
        _border(_door_points(side))
    fn.__name__ = f"office_light_{side}"
    SHOTS[fn.__name__] = fn


def _shutter(side: int):
    def fn(quality: str) -> None:
        lib.setup_render(tuple(SIZES["office"]), quality)
        scenes.build_office()
        before = set(bpy.data.objects)
        scenes._door_shutter(side, lib.mat_metal("Shutter", (0.38, 0.38, 0.36), rust=0.5, rough=0.5, scale=3),
                             lib.mat_plain("HazardYellow", (0.6, 0.45, 0.05), 0.6))
        scenes.office_camera()
        rooms.make_holdout(set(bpy.data.objects) - before)
        _border(_door_points(side))
    fn.__name__ = f"office_shutter_{side}"
    SHOTS[fn.__name__] = fn


DOOR_BOTS = {0: "scoggcrates", 1: "scogga_lisa"}


def _door_bot(side: int):
    """The bot standing in the lit doorway (a see-through layer over office_light_<side>)."""
    def fn(quality: str) -> None:
        lib.setup_render(tuple(SIZES["office"]), quality)
        scenes.build_office(lights=(side == 0, side == 1))
        scenes.office_camera()
        before = set(bpy.data.objects)
        spot = scenes.door_bot_spot(side) + Vector((0.1 if side == 0 else -0.1, 0, 0))
        standee.face_toward(DOOR_BOTS[side], spot, scenes.EYE)
        rooms.make_holdout(set(bpy.data.objects) - before)
        _border(_door_points(side))
    fn.__name__ = f"office_bot_{side}"
    SHOTS[fn.__name__] = fn


for _s in (0, 1):
    _light(_s)
    _shutter(_s)
    _door_bot(_s)


def _dark_uncle(lit: bool):
    """Power out: Uncle Scogg in the dark left doorway. lit = his face and pointing hand caught
    from below (the flicker's on beat); otherwise only the glowing pupils show."""
    def fn(quality: str) -> None:
        lib.setup_render(tuple(SIZES["office"]), quality)
        scenes.build_office(power=False, poster_blank=True)
        scenes.office_camera()
        before = set(bpy.data.objects)
        spot = scenes.door_bot_spot(0) + Vector((0.2, 0, 0))
        s = standee.face_toward("uncle_scogg", spot, scenes.EYE, glow=25.0)
        if lit:
            to_cam = (Vector(scenes.EYE) - spot).normalized()
            up = Vector((spot.x, spot.y, 0)) + Vector((to_cam.x, to_cam.y, 0)) * 0.7 + Vector((0, 0, 0.25))
            lib.spot_light(up, s["face"] + Vector((0, 0, -0.3)), 220, 34, (0.75, 0.85, 1.0), 0.8, 0.05,
                           name="UnderLight")
        rooms.make_holdout(set(bpy.data.objects) - before)
        _border(_door_points(0))
    fn.__name__ = f"office_uncle_dark_{'lit' if lit else 'eyes'}"
    SHOTS[fn.__name__] = fn


_dark_uncle(True)
_dark_uncle(False)


def _room(room: str, bot: str | None):
    def fn(quality: str) -> None:
        rooms.build_room(room, quality, bot)
    fn.__name__ = room if bot is None else f"{room}__{bot}"
    SHOTS[fn.__name__] = fn


for _r, _spec in rooms.ROOMS.items():
    _room(_r, None)
    for _b in _spec["bots"]:
        _room(_r, _b)


def _yurt(stage: int):
    def fn(quality: str) -> None:
        rooms.build_yurt(stage, quality)
    fn.__name__ = f"cam5_s{stage}"
    SHOTS[fn.__name__] = fn


for _st in rooms.YURT_STAGES:
    _yurt(_st)


RUSH_FRAMES = 8
RUSH_BOTS = ("scoggcrates", "scoggis_khan")  # jumpscare A; the others use the flat version B


def _rush(bot: str, i: int):
    """Jumpscare A, frame i of RUSH_FRAMES: the standee charges the camera from across the room
    and fills the screen with its head and shoulders in ~0.3 s, with a shaking camera, motion
    blur and glowing pupils (the red flash and grain are added in post)."""
    def fn(quality: str) -> None:
        lib.setup_render(tuple(SIZES["screen"]), quality)
        scenes.build_office(desk=False, lamp=False)
        eye = Vector(scenes.EYE)
        s = standee.standee(bot, (0, 0, 0), 0, lean_deg=-6, riser=False, glow=30.0)
        r = s["root"]
        f0 = s["face"]

        def dist(t: float) -> float:  # accelerating toward the camera, from just past the desk
            return 1.75 - 1.3 * (t ** 1.4)

        sc = bpy.context.scene
        for k, t in ((1, i / (RUSH_FRAMES - 1)), (2, min(1.0, (i + 0.6) / (RUSH_FRAMES - 1)))):
            rnd = random.Random(hash((bot, i, k)) & 0xFFFF)
            amp = 0.5 + 3.5 * t
            r.location = Vector((-f0.x + rnd.uniform(-0.02, 0.02) * amp, dist(t) - f0.y, eye.z - f0.z - 0.04 * t))
            r.rotation_euler = (0, math.radians(rnd.uniform(-1, 1) * amp), math.radians(rnd.uniform(-1, 1) * amp))
            r.keyframe_insert("location", frame=k)
            r.keyframe_insert("rotation_euler", frame=k)
        sc.frame_set(1)
        sc.render.use_motion_blur = True
        sc.render.motion_blur_shutter = 0.9
        rnd = random.Random(i)
        cam = lib.camera(eye, eye + Vector((0, 1, -0.02)), lens=24)
        cam.rotation_euler.y += math.radians(rnd.uniform(-2, 2) * (i / RUSH_FRAMES))
        bpy.context.view_layer.update()
        face = r.matrix_world @ (r.matrix_world.inverted() @ Vector((0, dist(i / (RUSH_FRAMES - 1)), eye.z)))
        lib.area_light((0.0, 0.1, 0.35), face, 9, 0.4, (1.0, 0.6, 0.45), name="UnderLight")
        lib.point_light((-1.2, 0.8, 2.6), 6, (0.6, 0.7, 1.0), 0.3)
    fn.__name__ = f"jump_{bot}_{i}"
    SHOTS[fn.__name__] = fn


for _b in RUSH_BOTS:
    for _i in range(RUSH_FRAMES):
        _rush(_b, _i)


@shot
def scoggema_flash(quality: str) -> None:
    """The rare meme scare: Absolute Scoggema suddenly right in front of the desk, in a hard flash."""
    lib.setup_render(tuple(SIZES["screen"]), quality)
    scenes.build_office(lamp=False)
    s = standee.standee("absolute_scoggema", (0.0, 0.95, 0), 0, lean_deg=2)
    eye = Vector(scenes.EYE)
    lib.point_light(eye + Vector((0.25, 0.1, 0.3)), 200, (0.95, 0.97, 1.0), 0.1, name="Flash")
    lib.camera(eye, Vector((0, 1.0, s["face"].z - 0.18)), lens=22)


# Everything the game uses, in render order (tools/rerender.sh renders these).
GAME_SHOTS = (["office", "office_dark", "office_poster_blank"]
              + [f"office_{k}_{s}" for s in (0, 1) for k in ("light", "shutter", "bot")]
              + ["office_uncle_dark_lit", "office_uncle_dark_eyes"]
              + [n for r, spec in rooms.ROOMS.items() for n in [r] + [f"{r}__{b}" for b in spec["bots"]]]
              + [f"cam5_s{s}" for s in rooms.YURT_STAGES]
              + [f"jump_{b}_{i}" for b in RUSH_BOTS for i in range(RUSH_FRAMES)]
              + ["scoggema_flash"])  # the title screen is 2D now (build_game_art.title_art)
