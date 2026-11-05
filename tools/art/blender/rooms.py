"""The nine camera rooms, each with its security camera and the spot where each Scoggatronic
stands in it. Every room renders empty (the base image) and once per bot as a see-through
layer (the room set to holdout), so the game can stack any combination of bots over the empty
room.

Lighting rule: dark rooms with one weak source (a tired fluorescent, a work light, a lamp, a
vending machine); a standee is only ever lit by that source, never evenly.
"""
import math

import bpy
from mathutils import Vector

import lib
import scenes
import standee

TEX = lib.TEX
CAM_SIZE = lib.CFG["sizes"]["cam"]


# ---------------------------------------------------------------- helpers

def shell(W: float, L: float, H: float, floor, wall, ceil, y0: float = 0.0) -> None:
    """Floor, ceiling and four walls; the room spans x -W/2..W/2, y y0..y0+L."""
    yc = y0 + L / 2
    lib.box((W, L, 0.02), (0, yc, -0.01), floor, bevel=0, name="Floor")
    lib.box((W, L, 0.02), (0, yc, H + 0.01), ceil, bevel=0, name="Ceiling")
    for x in (-W / 2 - 0.075, W / 2 + 0.075):
        lib.box((0.15, L, H), (x, yc, H / 2), wall, bevel=0, name="Wall")
    for y in (y0 - 0.075, y0 + L + 0.075):
        lib.box((W + 0.3, 0.15, H), (0, y, H / 2), wall, bevel=0, name="Wall")


def caged_bulb(loc, power: float, color=(1.0, 0.82, 0.55)) -> None:
    lib.sphere(0.05, loc, lib.mat_emit(f"Bulb{power}", color, 12), name="Bulb")
    lib.point_light(loc, power, color, 0.06, name="BulbLight")


def exit_sign(loc, yaw: float = 0.0) -> None:
    lib.box((0.5, 0.06, 0.2), loc, lib.mat_emit("ExitRed", (1, 0.05, 0.03), 4), rot=(0, 0, math.radians(yaw)),
            bevel=0.01, name="Exit")
    lib.point_light((loc[0], loc[1] - 0.3 * math.cos(math.radians(yaw)), loc[2] - 0.1), 5, (1, 0.1, 0.05), 0.2)


def table(loc, w: float, d: float, h: float = 0.76, top=None, leg=None) -> None:
    lib.desk(loc, top, leg, w=w, d=d, h=h)


def bench(loc, w: float, mat) -> None:
    lib.box((w, 0.3, 0.05), (loc[0], loc[1], 0.45), mat, bevel=0.01, name="Bench")
    for dx in (-w / 2 + 0.1, w / 2 - 0.1):
        lib.box((0.05, 0.25, 0.45), (loc[0] + dx, loc[1], 0.225), lib.mat_metal("BenchLeg", (0.3, 0.3, 0.3)), bevel=0)


def shelf(loc, w: float, h: float, d: float = 0.4, yaw: float = 0.0, name: str = "Shelf") -> None:
    """A bookcase facing -Y (before yaw) with rows of book spines."""
    holder = lib.empty(name, (0, 0, 0))
    wood = lib.mat_wood("ShelfWood", (0.22, 0.13, 0.07), 0.55)
    spines = lib.mat_image("Spines", TEX / "book_spines.jpg", rough=0.7, dirt=0.35)
    lib.box((w, d, 0.04), (0, 0, h), wood, holder, bevel=0.005)
    for x in (-w / 2, w / 2):
        lib.box((0.04, d, h), (x, 0, h / 2), wood, holder, bevel=0.005)
    lib.box((w, 0.02, h), (0, d / 2, h / 2), wood, holder, bevel=0)
    rows = 5
    for i in range(rows):
        z = 0.08 + i * (h - 0.1) / rows
        lib.box((w, d, 0.03), (0, 0, z), wood, holder, bevel=0.004)
        lib.plane((w - 0.08, (h - 0.1) / rows - 0.05), (0, -d / 2 + 0.06, z + (h - 0.1) / rows / 2), spines, holder,
                  name="Books")
    lib._put(holder, loc, (0, 0, math.radians(yaw)))


# ---------------------------------------------------------------- CAM 1 Stage

def build_stage() -> None:
    """The auditorium stage: "Scoggins' Showtime" banner, the blackboard with the chalk drawings,
    red side curtains, rows of student desks; one weak spot on the stage."""
    lib.world((0.002, 0.002, 0.003), 1.0)
    W, L, H = 10.0, 9.5, 4.6
    shell(W, L, H, lib.mat_checker("AudFloor", (0.4, 0.4, 0.38), (0.06, 0.06, 0.06), 1.0),
          lib.mat_wall("AudWall", (0.32, 0.3, 0.27), (0.14, 0.12, 0.11), stain=0.5),
          lib.mat_plain("AudCeil", (0.08, 0.08, 0.08), 0.9))
    stage_wood = lib.mat_wood("StageWood", (0.24, 0.15, 0.08), 0.45)
    lib.box((8.4, 3.2, 0.6), (0, 7.9, 0.3), stage_wood, bevel=0.01, name="Floor_Stage")
    lib.box((8.4, 0.05, 0.6), (0, 6.28, 0.3), lib.mat_wood("StageApron", (0.12, 0.07, 0.04)), bevel=0, name="Apron")
    board_mat = lib.mat_image("Chalkboard", TEX / "chalkboard_deck.jpg", rough=0.9, dirt=0.25)
    lib.plane((4.8, 2.0), (0, L - 0.03, 2.55), board_mat, name="Blackboard")
    lib.box((5.0, 0.06, 0.08), (0, L - 0.05, 1.5), lib.mat_wood("ChalkTray", (0.2, 0.12, 0.06)), bevel=0.005)
    lib.framed(TEX / "banner_showtime.jpg", (0, L - 0.04, 4.0), 5.5, frame_mat=lib.mat_plain("BannerRod", (0.1, 0.1, 0.1)),
               name="Banner")
    curtain = lib.mat_fabric("StageCurtain", (0.3, 0.03, 0.04), dirt=0.3, sheen=0.6)
    for sx in (-1, 1):
        c = lib.plane((1.8, H - 0.2), (sx * 3.6, 7.0, (H - 0.2) / 2 + 0.1), curtain, rot=(0, 0, 0), name="Curtain")
        sub = c.modifiers.new("Sub", "SUBSURF")
        sub.subdivision_type = "SIMPLE"
        sub.levels = sub.render_levels = 4
        lib.wave(c, 0.1, 0.3)
    for row in range(3):
        for col in range(5):
            lib.school_desk((-3.2 + col * 1.6, 1.4 + row * 1.5, 0), yaw=180 + (col * 7 % 5 - 2))
    lib.framed(TEX / "deck_p54.jpg", (-W / 2 + 0.02, 3.2, 2.0), 1.4, rot=(0, 0, -math.pi / 2), name="StagePoster")
    exit_sign((W / 2 - 0.6, 0.05, 2.6), 180)
    # A single tired spot on the stage, from the side, so the standees catch it on one side.
    lib.spot_light((2.4, 4.6, 4.3), (-0.4, 7.8, 1.4), 1400, 62, (1.0, 0.86, 0.66), 0.6, 0.15, name="StageSpot")
    lib.point_light((-1.5, 4.0, 3.6), 25, (0.45, 0.55, 0.8), 0.5, name="Fill")


def stage_camera():
    return lib.camera((3.4, 3.2, 3.7), (-0.4, 7.6, 1.2), lens=15)


# ---------------------------------------------------------------- CAM 2 Cafeteria

def build_cafeteria() -> None:
    """Long lunch tables and benches, the serving counter, The Last Scugger (p. 37) on the wall;
    one fluorescent still working at the far end."""
    lib.world((0.002, 0.002, 0.003), 1.0)
    W, L, H = 12.0, 14.0, 3.4
    shell(W, L, H, lib.mat_checker("CafFloor", (0.5, 0.48, 0.42), (0.18, 0.14, 0.1), 1.2),
          lib.mat_wall("CafWall", (0.5, 0.47, 0.38), (0.25, 0.3, 0.22), stain=0.5),
          lib.mat_plain("CafCeil", (0.3, 0.3, 0.28), 0.9))
    top = lib.mat_plain("CafTable", (0.45, 0.42, 0.34), 0.4)
    leg = lib.mat_metal("CafLeg", (0.3, 0.3, 0.3), rust=0.3)
    seat = lib.mat_plain("CafBench", (0.25, 0.35, 0.45), 0.5)
    for i, y in enumerate((3.0, 5.5, 8.0, 10.5)):
        for x in (-3.5, 2.5):
            table((x, y, 0), 3.4, 0.8, top=top, leg=leg)
            bench((x, y - 0.65), 3.2, seat)
            bench((x, y + 0.65), 3.2, seat)
            lib.box((0.35, 0.25, 0.02), (x + (i - 1.5) * 0.5, y, 0.79), lib.mat_plain("Tray", (0.5, 0.3, 0.2), 0.4),
                    bevel=0.005, name="Tray")
    steel = lib.mat_metal("Steel", (0.55, 0.55, 0.55), rust=0.2, rough=0.3)
    lib.box((8.0, 0.9, 1.0), (0, L - 1.0, 0.5), steel, bevel=0.02, name="Counter")
    lib.box((8.0, 0.4, 0.05), (0, L - 1.0, 1.5), lib.mat_plain("Sneeze", (0.3, 0.35, 0.35), 0.05), bevel=0)
    lib.framed(TEX / "deck_p37.jpg", (W / 2 - 0.02, 7.5, 2.0), 2.4, rot=(0, 0, math.pi / 2), name="SupperPoster")
    lib.paper_sheet(TEX / "flyer_fall_fling.png", (-W / 2 + 0.01, 6.0, 1.5), 0.45, rot=(0, 0, -math.pi / 2), tilt=3)
    exit_sign((-W / 2 + 1.0, L - 0.05, 2.6))
    for i, y in enumerate((2.5, 6.5, 10.5)):
        for x in (-3.0, 3.0):
            lib.fluorescent((x, y, H - 0.04), on=(i == 2 and x < 0) or (i == 1 and x > 0), power=70)
    lib.point_light((5.5, 0.6, 3.0), 3, (0.5, 0.6, 0.8), 0.3, name="CamIR")


def cafeteria_camera():
    return lib.camera((5.6, 0.4, 3.15), (-1.2, 8.0, 0.7), lens=14)


# ---------------------------------------------------------------- CAM 3 Library

def build_library() -> None:
    """Rows of bookcases, a reading table under a green banker's lamp, Scoggules (p. 22)."""
    lib.world((0.002, 0.002, 0.003), 1.0)
    W, L, H = 9.0, 11.0, 3.2
    shell(W, L, H, lib.mat_plain("Carpet", (0.12, 0.14, 0.2), 0.95),
          lib.mat_wall("LibWall", (0.42, 0.36, 0.28), (0.2, 0.15, 0.1), stain=0.4),
          lib.mat_plain("LibCeil", (0.25, 0.24, 0.22), 0.9))
    for i in range(4):
        shelf((-2.4, 4.2 + i * 1.7, 0), 3.4, 2.2, yaw=0, name="Stack")
    for y in (2.0, 5.0, 8.0):
        shelf((W / 2 - 0.25, y, 0), 2.6, 2.4, yaw=90, name="WallShelf")
    table((1.4, 3.2, 0), 2.0, 1.0, top=lib.mat_wood("ReadTable", (0.3, 0.18, 0.09)))
    lamp_glass = lib.mat_emit("BankerGreen", (0.2, 0.7, 0.3), 1.5)
    lib.cyl(0.02, 0.35, (1.2, 3.2, 0.95), lib.mat_metal("Brass", (0.6, 0.45, 0.2)), verts=8)
    lib.cyl(0.15, 0.1, (1.2, 3.1, 1.12), lamp_glass, verts=24, rot=(math.pi / 2, 0, 0), name="LampShade")
    lib.point_light((1.2, 3.1, 1.02), 12, (1.0, 0.85, 0.55), 0.05, name="BankerLamp")
    lib.framed(TEX / "deck_p22.jpg", (-W / 2 + 0.02, 2.4, 1.8), 0.9, rot=(0, 0, -math.pi / 2), name="ScogglesPoster")
    lib.scogg_bucks((1.6, 3.1, 0.802), 3, 0.25, seed=21)
    lib.fluorescent((-0.2, 6.5, H - 0.04), on=True, power=28)
    lib.point_light((3.9, 0.4, 2.8), 3, (0.5, 0.6, 0.8), 0.3, name="CamIR")


def library_camera():
    return lib.camera((3.9, 0.4, 2.85), (-0.8, 6.0, 0.9), lens=15)


# ---------------------------------------------------------------- CAM 4 Teachers' Lounge

def build_lounge() -> None:
    """A couch, a coffee table, the fridge and counter, a humming vending machine; Scoggtemplation
    (p. 29) on the wall."""
    lib.world((0.002, 0.002, 0.003), 1.0)
    W, L, H = 7.0, 7.0, 3.0
    shell(W, L, H, lib.mat_checker("LoungeFloor", (0.45, 0.42, 0.36), (0.3, 0.26, 0.2), 1.5),
          lib.mat_wall("LoungeWall", (0.46, 0.43, 0.32), (0.3, 0.24, 0.18), stain=0.45),
          lib.mat_plain("LoungeCeil", (0.3, 0.3, 0.28), 0.9))
    couch = lib.mat_fabric("Couch", (0.3, 0.2, 0.12), dirt=0.45)
    lib.box((2.2, 0.9, 0.45), (1.4, 5.6, 0.25), couch, bevel=0.06, name="Couch")
    lib.box((2.2, 0.25, 0.55), (1.4, 6.0, 0.7), couch, bevel=0.06, name="CouchBack")
    lib.box((1.2, 0.6, 0.06), (1.4, 4.4, 0.42), lib.mat_wood("CoffeeTable", (0.28, 0.17, 0.09)), bevel=0.01)
    lib.cyl(0.045, 0.1, (1.2, 4.4, 0.5), lib.mat_plain("Mug", (0.6, 0.1, 0.08), 0.3), verts=20, name="Mug")
    white = lib.mat_metal("Fridge", (0.7, 0.68, 0.62), rust=0.25, rough=0.3)
    lib.box((0.8, 0.75, 1.9), (-W / 2 + 0.55, 5.6, 0.95), white, bevel=0.03, name="Fridge")
    lib.box((2.4, 0.65, 0.9), (-W / 2 + 0.4 + 1.2 + 0.6, L - 0.4, 0.45), lib.mat_wood("Counter", (0.3, 0.25, 0.2)),
            bevel=0.01, name="Counter")
    lib.box((0.3, 0.3, 0.38), (-0.6, L - 0.4, 1.09), lib.mat_plain("CoffeeMaker", (0.05, 0.05, 0.05), 0.4), bevel=0.02)
    lib.box((0.04, 0.04, 0.02), (-0.6, L - 0.56, 1.0), lib.mat_emit("CoffeeLED", (1, 0.1, 0.05), 8), bevel=0)
    # The vending machine: the only real light, a cold glow.
    lib.box((0.9, 0.8, 1.9), (W / 2 - 0.55, 5.2, 0.95), lib.mat_plain("Vend", (0.1, 0.12, 0.15), 0.4), bevel=0.02,
            name="Vending")
    lib.box((0.02, 0.6, 1.2), (W / 2 - 1.01, 5.2, 1.15), lib.mat_emit("VendGlass", (0.55, 0.75, 0.9), 2.0), bevel=0,
            name="VendGlow")
    lib.area_light((W / 2 - 1.1, 5.2, 1.2), (0, 4.0, 1.0), 30, 1.0, (0.55, 0.75, 0.95), name="VendLight")
    lib.framed(TEX / "deck_p29.jpg", (0.2, L - 0.02, 1.9), 0.6, name="ThinkerPoster")
    lib.paper_sheet(TEX / "senior_checklist.png", (1.6, L - 0.01, 1.7), 0.35, tilt=-3)
    lib.point_light((2.8, 0.4, 2.6), 2, (0.5, 0.6, 0.8), 0.3, name="CamIR")


def lounge_camera():
    return lib.camera((2.9, 0.4, 2.7), (-0.8, 4.6, 0.9), lens=15)


# ---------------------------------------------------------------- CAM 6 / CAM 8 halls

def left_hall_camera():
    return scenes.hallway_camera()


def build_right_hall() -> None:
    scenes.build_hallway(lit_index=1, posters=("deck_p23.jpg", "deck_p07.jpg", "deck_p29.jpg", "deck_p22.jpg",
                                               "deck_p54.jpg"), mirror=True)


def right_hall_camera():
    return lib.camera((-1.25, 0.25, 2.75), (0.2, 6.5, 0.9), lens=12.5)


# ---------------------------------------------------------------- CAM 7 Left Corner (the vent)

def build_left_corner() -> None:
    """The bend in the hall just before the left door: lockers, a floor vent grille (where the
    Scoggipede comes and goes), one caged bulb and the exit sign."""
    lib.world((0.002, 0.002, 0.003), 1.0)
    W, L, H = 3.4, 6.0, 3.0
    floor = lib.mat_checker("CornerFloor", (0.5, 0.5, 0.47), (0.06, 0.06, 0.06), 1.0, rough=0.25)
    wall = lib.mat_wall("CornerWall", (0.5, 0.48, 0.42), (0.16, 0.2, 0.25), stain=0.55)
    shell(W, L, H, floor, wall, lib.mat_plain("CornerCeil", (0.3, 0.3, 0.29), 0.9))
    # The hall turns: an opening in the right wall near the far end, toward the office.
    lib.box((0.2, 1.6, H), (W / 2 - 0.05, 4.4, H / 2), lib.mat_plain("Opening", (0.0, 0.0, 0.0), 1.0), bevel=0,
            name="OpeningDark")
    lib.lockers((-W / 2 + 0.23, 0.6, 0), 9, facing_yaw=-90, color=(0.3, 0.12, 0.1))
    grille = lib.mat_metal("Grille", (0.25, 0.25, 0.24), rust=0.6)
    lib.box((0.9, 0.05, 0.5), (0.6, L - 0.03, 0.35), lib.mat_plain("VentDark", (0.0, 0.0, 0.0), 1.0), bevel=0,
            name="VentHole")
    for i in range(7):
        lib.box((0.9, 0.04, 0.03), (0.6, L - 0.06, 0.13 + i * 0.07), grille, bevel=0.003, name="VentSlat")
    lib.framed(TEX / "deck_p05.jpg", (W / 2 - 0.02, 2.0, 1.75), 0.55, rot=(0, 0, math.pi / 2), name="VanScoggPoster")
    lib.paper_sheet(TEX / "flyer_homecoming.png", (W / 2 - 0.01, 3.0, 1.35), 0.38, rot=(0, 0, math.pi / 2), tilt=-5)
    exit_sign((0.6, L - 0.05, 2.65))
    caged_bulb((-0.4, 3.8, H - 0.25), 22)


def left_corner_camera():
    # Low-ish, close: the camera sits just above head height in the corner.
    return lib.camera((1.4, 0.3, 2.05), (-0.3, 5.0, 1.05), lens=13)


# ---------------------------------------------------------------- CAM 9 Right Corner

def build_right_corner() -> None:
    """The last stretch before the right door: a classroom doorway with its frame, a trophy case
    glowing faintly, a drinking fountain."""
    lib.world((0.002, 0.002, 0.003), 1.0)
    W, L, H = 3.4, 6.5, 3.0
    floor = lib.mat_checker("RCornerFloor", (0.5, 0.5, 0.47), (0.06, 0.06, 0.06), 1.0, rough=0.25)
    wall = lib.mat_wall("RCornerWall", (0.5, 0.48, 0.42), (0.16, 0.2, 0.25), stain=0.55)
    shell(W, L, H, floor, wall, lib.mat_plain("RCornerCeil", (0.3, 0.3, 0.29), 0.9))
    frame = lib.mat_metal("DoorFrame", (0.3, 0.31, 0.3), rust=0.45)
    # Classroom doorway in the left wall (a standee can stand half behind its frame).
    for y in (2.9, 4.0):
        lib.box((0.24, 0.1, 2.3), (-W / 2 + 0.05, y, 1.15), frame, bevel=0.01, name="Jamb")
    lib.box((0.24, 1.2, 0.1), (-W / 2 + 0.05, 3.45, 2.35), frame, bevel=0.01, name="Header")
    lib.box((0.1, 1.0, 2.3), (-W / 2 - 0.12, 3.45, 1.15), lib.mat_plain("ClassDark", (0.0, 0.0, 0.0), 1.0), bevel=0,
            name="ClassDark")
    case = lib.mat_wood("TrophyCase", (0.2, 0.12, 0.06), 0.5)
    lib.box((1.6, 0.45, 1.9), (W / 2 - 0.25, 4.8, 0.95), case, bevel=0.01, name="TrophyCase")
    lib.box((0.02, 1.4, 1.1), (W / 2 - 0.48, 4.8, 1.25), lib.mat_emit("CaseGlow", (0.85, 0.75, 0.5), 0.6), bevel=0,
            name="CaseGlass")
    gold = lib.mat_metal("Trophy", (0.75, 0.55, 0.2), rust=0.2, rough=0.25)
    for i in range(4):
        lib.cyl(0.06, 0.25, (W / 2 - 0.3, 4.3 + i * 0.32, 1.12 + (i % 2) * 0.4), gold, radius2=0.03, verts=16)
    steel = lib.mat_metal("Steel", (0.55, 0.55, 0.55), rust=0.2, rough=0.3)
    lib.box((0.45, 0.35, 0.3), (W / 2 - 0.2, 2.2, 0.9), steel, bevel=0.03, name="Fountain")
    lib.framed(TEX / "deck_p56.jpg", (-W / 2 + 0.02, 5.4, 1.75), 0.7, rot=(0, 0, -math.pi / 2), name="ScoggedPoster")
    lib.point_light((W / 2 - 0.6, 4.8, 1.3), 10, (0.9, 0.78, 0.5), 0.3, name="CaseLight")
    caged_bulb((0.2, 1.4, H - 0.25), 14)


def right_corner_camera():
    # Low angle: the camera is mounted low by the door, looking a little up the hall.
    return lib.camera((-1.35, 0.3, 1.35), (0.2, 5.0, 1.5), lens=13)


# ---------------------------------------------------------------- the table of rooms

# Each bot spot: loc (standee root), lean, optional "toward" (a point it faces; default the
# camera), "yaw" (degrees added), "light" (an extra light: a flashlight cone etc.).
ROOMS = {
    "cam1": {"build": build_stage, "camera": stage_camera, "bots": {
        "uncle_scogg": {"loc": (0.1, 7.4, 0.6)},
        "scoggcrates": {"loc": (-2.5, 7.6, 0.6)},
        "scogga_lisa": {"loc": (1.45, 7.2, 0.6)},
    }},
    "cam2": {"ir": 70, "build": build_cafeteria, "camera": cafeteria_camera, "bots": {
        "scoggcrates": {"loc": (-2.4, 9.6, 0)},
        "scogga_lisa": {"loc": (0.6, 9.2, 0)},          # Lisa, step 1: far
        "uncle_scogg": {"loc": (-0.6, 6.7, 0), "yaw": 12},
    }},
    "cam3": {"ir": 35, "build": build_library, "camera": library_camera, "bots": {
        # half hidden behind the end of a bookcase
        "scoggcrates": {"loc": (-0.35, 7.3, 0), "yaw": -10},
    }},
    "cam4": {"ir": 35, "build": build_lounge, "camera": lounge_camera, "bots": {
        "scogga_lisa": {"loc": (1.1, 2.6, 0)},          # step 2: halfway
        "uncle_scogg": {"loc": (1.7, 5.3, 0), "yaw": -10},  # by the vending machine's cold light
    }},
    "cam6": {"ir": 45, "build": scenes.build_hallway, "camera": left_hall_camera, "bots": {
        "scoggcrates": {"loc": (-0.4, 5.9, 0)},
        "scoggis_khan": {"loc": (0.15, 4.3, 0), "run": (0.0, 3.2, 0.0), "lean": 14},
    }},
    "cam7": {"ir": 45, "build": build_left_corner, "camera": left_corner_camera, "bots": {
        # very close, cut off by the left edge of the frame
        "scoggcrates": {"loc": (-0.55, 1.7, 0), "yaw": 20},
    }},
    "cam8": {"ir": 110, "build": build_right_hall, "camera": right_hall_camera, "bots": {
        "scogga_lisa": {"loc": (0.35, 3.0, 0)},          # step 3: close
        "uncle_scogg": {"loc": (0.5, 9.4, 0)},
    }},
    "cam9": {"ir": 90, "build": build_right_corner, "camera": right_corner_camera, "bots": {
        "scogga_lisa": {"loc": (0.05, 1.7, 0), "yaw": -10},   # step 4: right in the camera's face
        "uncle_scogg": {"loc": (-1.3, 3.55, 0), "yaw": 30},    # half behind the classroom door frame
    }},
}
# CAM 5 (the yurt) has its own four stage images instead of layers.
YURT_STAGES = {0: 0.0, 1: 0.35, 2: 0.7, 3: 1.0}
YURT_KHAN = {1: {"loc": (0.95, 4.35, 0)}, 2: {"loc": (0.6, 3.95, 0)}}


def bot_spot(room: str, bot: str, glow: float) -> dict:
    """Builds bot in room at its spot (the room and camera must already exist)."""
    spec = ROOMS[room]["bots"][bot]
    cam = bpy.context.scene.camera
    toward = Vector(spec.get("toward", cam.location))
    loc = Vector(spec["loc"])
    d = toward - loc
    yaw = math.degrees(math.atan2(d.x, -d.y)) + spec.get("yaw", 0.0)
    s = standee.standee(bot, loc, yaw, lean_deg=spec.get("lean", 4.0), glow=glow)
    if "run" in spec:  # mid-sprint: slides toward the camera during the shutter, blurred
        r = s["root"]
        r.keyframe_insert("location", frame=1)
        r.location = Vector(spec["run"])
        r.keyframe_insert("location", frame=2)
        sc = bpy.context.scene
        sc.frame_set(1)
        sc.render.use_motion_blur = True
        sc.render.motion_blur_shutter = 0.8
    return s


def make_holdout(keep: set) -> None:
    """Everything not in keep becomes holdout: cut out of the render, but still blocking light
    and casting shadows on the standee, so it's lit exactly as it would be in the room. (A floor
    shadow catcher would also pick up every prop's shadow, so the standee casts none in its layer.)"""
    for ob in bpy.data.objects:
        if ob in keep or ob.type not in {"MESH", "CURVE", "FONT"}:
            continue
        ob.is_holdout = True
    sc = bpy.context.scene
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = "RGBA"


def ir_lamp(power: float) -> None:
    """The security camera's own weak infrared lamp: a cone from the lens that falls off fast,
    so a bot close to the camera is half caught in it and a far one stays in the dark."""
    cam = bpy.context.scene.camera
    bpy.context.view_layer.update()
    ahead = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
    lib.spot_light(cam.location + Vector((0, 0, -0.15)), cam.location + ahead * 4.0, power, 75, (0.8, 0.92, 1.0), 0.9,
                   0.05, name="IRLamp")


def build_room(room: str, quality: str, bot: str | None = None, glow: float = 6.0) -> None:
    """The room's base image (bot None) or one bot's see-through layer."""
    lib.setup_render(tuple(CAM_SIZE), quality)
    ROOMS[room]["build"]()
    ROOMS[room]["camera"]()
    if ROOMS[room].get("ir"):
        ir_lamp(ROOMS[room]["ir"])
    if bot is None:
        return
    before = set(bpy.data.objects)
    bot_spot(room, bot, glow)
    make_holdout(set(bpy.data.objects) - before)


def build_yurt(stage: int, quality: str) -> None:
    lib.setup_render(tuple(CAM_SIZE), quality)
    scenes.build_yurt_room(flap=YURT_STAGES[stage])
    scenes.yurt_camera()
    if stage in YURT_KHAN:
        cam = bpy.context.scene.camera.location
        loc = Vector(YURT_KHAN[stage]["loc"])
        d = cam - loc
        standee.standee("scoggis_khan", loc, math.degrees(math.atan2(d.x, -d.y)), glow=6.0)
