"""The places: the security office (with its two side doors and hallways) and the school
rooms the cameras look at. Built from lib's primitives and procedural materials."""
import math

from mathutils import Vector

import lib

# --- Office layout (meters). The player sits at the origin looking down +Y.
EYE = (0.0, 0.0, 1.2)
OFFICE_HFOV = 115.0  # degrees across the 3000 px panorama
ROOM_X = 2.6         # side walls at +/-ROOM_X
BACK_Y = 3.4
FRONT_Y = -1.2
CEIL = 3.15
DOOR_Y = (1.9, 2.85)  # doorway span along each side wall
DOOR_TOP = 2.3       # shutter height; glass transom above, up to DOOR_FRAME_TOP
DOOR_FRAME_TOP = 2.85
HALL_LEN = 3.6


def office_lens() -> float:
    return 18.0 / math.tan(math.radians(OFFICE_HFOV / 2))


def door_mid(side: int) -> Vector:
    """Middle of a doorway at floor level; side 0 = left (-X), 1 = right (+X)."""
    x = -ROOM_X if side == 0 else ROOM_X
    return Vector((x, (DOOR_Y[0] + DOOR_Y[1]) / 2, 0))


def door_corners(side: int) -> list[Vector]:
    x = -ROOM_X if side == 0 else ROOM_X
    return [Vector((x, y, z)) for y in DOOR_Y for z in (0.0, DOOR_FRAME_TOP)]


def _side_wall(side: int, wall, frame, glass) -> None:
    sx = -1 if side == 0 else 1
    x = sx * (ROOM_X + 0.075)
    y0, y1 = DOOR_Y
    lib.box((0.15, y0 - FRONT_Y, CEIL), (x, (FRONT_Y + y0) / 2, CEIL / 2), wall, bevel=0, name="SideWallFront")
    lib.box((0.15, BACK_Y - y1, CEIL), (x, (y1 + BACK_Y) / 2, CEIL / 2), wall, bevel=0, name="SideWallBack")
    lib.box((0.15, y1 - y0, CEIL - DOOR_FRAME_TOP), (x, (y0 + y1) / 2, (CEIL + DOOR_FRAME_TOP) / 2), wall, bevel=0,
            name="SideWallTop")
    # Steel door frame, transom bar and glass.
    t = 0.09
    for y in (y0 - t / 2, y1 + t / 2):
        lib.box((0.24, t, DOOR_FRAME_TOP), (x, y, DOOR_FRAME_TOP / 2), frame, bevel=0.01, name="DoorJamb")
    lib.box((0.24, y1 - y0 + 2 * t, t), (x, (y0 + y1) / 2, DOOR_FRAME_TOP + t / 2), frame, bevel=0.01, name="Header")
    lib.box((0.2, y1 - y0, 0.06), (x, (y0 + y1) / 2, DOOR_TOP + 0.03), frame, bevel=0.01, name="TransomBar")
    lib.box((0.01, y1 - y0, DOOR_FRAME_TOP - DOOR_TOP - 0.06), (x, (y0 + y1) / 2, (DOOR_TOP + 0.06 + DOOR_FRAME_TOP) / 2),
            glass, bevel=0, name="TransomGlass")


def _door_shutter(side: int, mat, stripe) -> None:
    sx = -1 if side == 0 else 1
    x = sx * (ROOM_X + 0.03)
    y0, y1 = DOOR_Y
    lib.box((0.07, y1 - y0, DOOR_TOP), (x, (y0 + y1) / 2, DOOR_TOP / 2), mat, bevel=0.01, name="Shutter")
    for k in range(9):  # ribs
        lib.box((0.09, y1 - y0, 0.025), (x, (y0 + y1) / 2, 0.25 + k * 0.2), mat, bevel=0.005, name="Rib")
    for k in range(6):  # hazard stripes along the bottom
        y = y0 + 0.08 + k * (y1 - y0 - 0.16) / 5
        lib.box((0.075, 0.07, 0.18), (x - sx * 0.01, y, 0.12), stripe, rot=(math.radians(30), 0, 0), bevel=0,
                name="Hazard")


def _button_panel(side: int, door_closed: bool, light_on: bool, power: bool) -> None:
    sx = -1 if side == 0 else 1
    x = sx * (ROOM_X - 0.02)
    y = DOOR_Y[0] - 0.35
    plate = lib.mat_metal("PanelPlate", (0.35, 0.35, 0.33), rust=0.3)
    lib.box((0.04, 0.22, 0.5), (x, y, 1.3), plate, bevel=0.01, name="ButtonPanel")
    door_lit = door_closed and power
    light_lit = light_on and power
    red = lib.mat_plain("BtnRed" + ("On" if door_lit else "Off"), (0.6, 0.05, 0.05), 0.3,
                        emit=(1.0, 0.1, 0.05) if door_lit else None, emit_strength=6 if door_lit else 0)
    white = lib.mat_plain("BtnWhite" + ("On" if light_lit else "Off"), (0.7, 0.7, 0.65), 0.3,
                          emit=(1.0, 0.95, 0.8) if light_lit else None, emit_strength=6 if light_lit else 0)
    lib.cyl(0.055, 0.04, (x - sx * 0.03, y, 1.42), red, rot=(0, math.pi / 2, 0), name="DoorButton")
    lib.cyl(0.055, 0.04, (x - sx * 0.03, y, 1.18), white, rot=(0, math.pi / 2, 0), name="LightButton")


def _hallway(side: int, light_on: bool, floor, wall, ceiling) -> None:
    """The short dark hall outside a door, with the light the player can switch on."""
    sx = -1 if side == 0 else 1
    y0, y1 = DOOR_Y[0] - 0.5, DOOR_Y[1] + 0.5
    x_in, x_out = sx * (ROOM_X + 0.15), sx * (ROOM_X + 0.15 + HALL_LEN)
    xc = (x_in + x_out) / 2
    lib.box((HALL_LEN, y1 - y0, 0.02), (xc, (y0 + y1) / 2, -0.01), floor, bevel=0, name="FloorHall")
    lib.box((HALL_LEN, y1 - y0, 0.02), (xc, (y0 + y1) / 2, CEIL + 0.01), ceiling, bevel=0, name="HallCeil")
    for y in (y0 - 0.075, y1 + 0.075):
        lib.box((HALL_LEN, 0.15, CEIL), (xc, y, CEIL / 2), wall, bevel=0, name="HallWall")
    lib.box((0.15, y1 - y0, CEIL), (x_out, (y0 + y1) / 2, CEIL / 2), wall, bevel=0, name="HallEnd")
    lamp = (sx * (ROOM_X + 0.7), (DOOR_Y[0] + DOOR_Y[1]) / 2, CEIL - 0.12)
    lib.box((0.3, 0.3, 0.08), (lamp[0], lamp[1], CEIL - 0.04), lib.mat_metal("HallLamp", (0.5, 0.5, 0.5)), bevel=0.01)
    if light_on:
        lib.box((0.24, 0.24, 0.01), (lamp[0], lamp[1], CEIL - 0.085), lib.mat_emit("HallBulb", (1, 0.95, 0.85), 8),
                bevel=0)
        lib.spot_light(lamp, (lamp[0], lamp[1], 0), 260, 110, (1.0, 0.92, 0.8), 0.6, radius=0.15, name="HallLight")


def _desk(power: bool) -> None:
    """The desk and what's on it."""
    desk_y, desk_z = 1.4, 0.0
    lib.desk((0, desk_y, desk_z), w=2.4, d=0.8)
    lib.box((2.4, 0.04, 0.7), (0, desk_y - 0.38, 0.38), lib.mat_wood("DeskFront", (0.3, 0.2, 0.11)), bevel=0.005)
    top = desk_z + 0.8
    crt_on = power
    lib.crt_monitor((-0.65, desk_y + 0.1, top), yaw=12, strength=0.55 if crt_on else 0.0)
    lib.crt_monitor((0.6, desk_y + 0.15, top), yaw=-15, glow=(0.25, 0.5, 0.35), strength=0.45 if crt_on else 0.0)
    lib.desk_fan((0.05, desk_y + 0.05, top), yaw=10)
    lib.scogg_bucks((-0.15, desk_y - 0.15, top + 0.002), 9, 0.22, seed=3)
    lib.scogg_bucks((0.95, desk_y - 0.05, top + 0.002), 4, 0.1, seed=5)
    mug = lib.mat_plain("Mug", (0.6, 0.1, 0.08), 0.3)
    lib.cyl(0.045, 0.1, (0.35, desk_y - 0.2, top + 0.05), mug, verts=20, name="Mug")
    paper = lib.mat_plain("PaperWhite", (0.75, 0.74, 0.7), 0.9)
    for i in range(5):
        lib.box((0.21, 0.297, 0.002), (-1.0 + i * 0.02, desk_y - 0.1 + i * 0.01, top + 0.002 + i * 0.002), paper,
                rot=(0, 0, 0.1 * i), bevel=0)
    books = [(0.35, 0.05, 0.05), (0.1, 0.2, 0.35), (0.2, 0.3, 0.1)]
    for i, c in enumerate(books):
        lib.box((0.24, 0.32, 0.05), (1.0, desk_y + 0.2, top + 0.025 + i * 0.05), lib.mat_plain(f"Book{i}", c, 0.7),
                rot=(0, 0, 0.08 * (i - 1)), bevel=0.004)
    lib.sphere(0.045, (-0.4, desk_y - 0.25, top + 0.045), lib.mat_plain("Apple", (0.55, 0.04, 0.03), 0.35),
               name="Apple")


def build_office(doors=(False, False), lights=(False, False), power: bool = True, poster_blank: bool = False,
                 lamp: bool = True, desk: bool = True) -> None:
    """The office. desk=False leaves out the desk and its props (the jumpscare, where a bot stands there)."""
    lib.world((0.004, 0.005, 0.007), 1.0)
    floor = lib.mat_checker("OfficeFloor", (0.55, 0.55, 0.52), (0.05, 0.05, 0.05), 1.0)
    wall = lib.mat_wall("OfficeWall", (0.52, 0.48, 0.4), (0.18, 0.22, 0.24), stain=0.45)
    ceiling = lib.mat_plain("CeilingTile", (0.35, 0.34, 0.32), 0.9)
    frame = lib.mat_metal("DoorFrame", (0.3, 0.31, 0.3), rust=0.45)
    glass = lib.mat_plain("Glass", (0.05, 0.06, 0.06), 0.05, metal=0.0)
    shutter = lib.mat_metal("Shutter", (0.38, 0.38, 0.36), rust=0.5, rough=0.5, scale=3)
    stripe = lib.mat_plain("HazardYellow", (0.6, 0.45, 0.05), 0.6)
    w = ROOM_X * 2
    d = BACK_Y - FRONT_Y
    lib.box((w + 0.3, d, 0.02), (0, (BACK_Y + FRONT_Y) / 2, -0.01), floor, bevel=0, name="Floor")
    lib.box((w + 0.3, d, 0.02), (0, (BACK_Y + FRONT_Y) / 2, CEIL + 0.01), ceiling, bevel=0, name="Ceiling")
    lib.box((w + 0.3, 0.15, CEIL), (0, BACK_Y + 0.075, CEIL / 2), wall, bevel=0, name="BackWall")
    lib.box((w + 0.3, 0.15, CEIL), (0, FRONT_Y - 0.075, CEIL / 2), wall, bevel=0, name="FrontWall")
    for side in (0, 1):
        _side_wall(side, wall, frame, glass)
        if doors[side]:
            _door_shutter(side, shutter, stripe)
        _button_panel(side, doors[side], lights[side], power)
        _hallway(side, lights[side] and power, floor, lib.mat_wall("HallWall", (0.4, 0.42, 0.4), (0.15, 0.2, 0.22)),
                 ceiling)
    # Ceiling pipes and a vent.
    pipe = lib.mat_metal("Pipe", (0.3, 0.28, 0.25), rust=0.6)
    for x in (-1.6, -1.45):
        lib.cyl_between((x, FRONT_Y, CEIL - 0.15), (x, BACK_Y, CEIL - 0.15), 0.05, pipe, name="Pipe")
    lib.box((0.6, 0.6, 0.05), (1.2, 1.5, CEIL - 0.02), lib.mat_metal("Vent", (0.25, 0.25, 0.25)), bevel=0.01)

    # Back wall: the Uncle Scogg poster, flyers, the checklist and framed slides.
    tex = lib.TEX
    lib.framed(tex / ("poster_uncle_blank.png" if poster_blank else "poster_uncle.png"), (-0.55, BACK_Y - 0.02, 1.65),
               0.85, name="UnclePoster", glare=False)
    lib.paper_sheet(tex / "flyer_fall_fling.png", (0.55, BACK_Y - 0.01, 1.85), 0.42, tilt=4)
    lib.paper_sheet(tex / "flyer_homecoming.png", (1.1, BACK_Y - 0.01, 1.6), 0.42, tilt=-3)
    lib.paper_sheet(tex / "senior_checklist.png", (1.65, BACK_Y - 0.01, 1.8), 0.4, tilt=2)
    lib.framed(tex / "deck_p06.jpg", (-1.75, BACK_Y - 0.02, 1.75), 0.7, name="StarryPoster")
    lib.framed(tex / "deck_p55.jpg", (1.15, BACK_Y - 0.02, 2.42), 0.5, name="KennedyPoster")
    lib.framed(tex / "deck_p05.jpg", (-ROOM_X + 0.02, 0.9, 1.7), 0.45, rot=(0, 0, -math.pi / 2),
               name="LisaPoster")
    lib.framed(tex / "deck_p56.jpg", (ROOM_X - 0.02, 0.9, 1.7), 0.6, rot=(0, 0, math.pi / 2),
               name="CyclePoster")
    lib.paper_sheet(tex / "flyer_fall_fling.png", (ROOM_X - 0.01, 1.3, 1.2), 0.3, rot=(0, 0, math.pi / 2), tilt=-6)

    desk_y, top = 1.4, 0.8
    crt_on = power
    if desk:
        _desk(power)

    # Lights: a weak hanging lamp over the desk and the monitors' glow.
    shade = lib.mat_metal("Shade", (0.2, 0.25, 0.2), rust=0.4)
    lib.cyl_between((0, 1.5, CEIL), (0, 1.5, 2.3), 0.006, lib.mat_plain("Cord", (0.02, 0.02, 0.02)), name="Cord")
    lib.cyl(0.25, 0.18, (0, 1.5, 2.25), shade, radius2=0.06, verts=32, name="Shade")
    if lamp and power:
        lib.sphere(0.04, (0, 1.5, 2.18), lib.mat_emit("Bulb", (1, 0.8, 0.5), 30), name="Bulb")
        lib.point_light((0, 1.5, 2.15), 80, (1.0, 0.78, 0.5), 0.05, name="DeskLamp")
    if power:  # spill from the lamp and screens onto the desk front and the walls
        lib.point_light((0, -0.9, 2.3), 18, (1.0, 0.85, 0.65), 0.3, name="Spill")
    if crt_on:
        lib.point_light((-0.6, desk_y - 0.2, top + 0.25), 4, (0.4, 0.6, 0.8), 0.15, name="CRTGlow")
        lib.point_light((0.55, desk_y - 0.15, top + 0.25), 3, (0.35, 0.7, 0.45), 0.15, name="CRTGlow2")


def office_camera():
    return lib.camera(EYE, (EYE[0], EYE[1] + 5, EYE[2]), lens=office_lens())


def door_bot_spot(side: int) -> Vector:
    """Where a bot stands at a door: just outside, in the hall light."""
    m = door_mid(side)
    sx = -1 if side == 0 else 1
    return Vector((m.x + sx * 0.4, m.y + 0.1, 0))


# ---------------------------------------------------------------- the school hallway (CAM 6 / CAM 8)

def build_hallway(lit_index: int = 1, posters=("deck_p07.jpg", "deck_p22.jpg", "deck_p23.jpg", "deck_p29.jpg",
                                               "deck_p54.jpg"), mirror: bool = False) -> None:
    """A long school hall: lockers on one side, framed slides and flyers on the other, one tired
    light. mirror swaps the sides (the right hall)."""
    lib.world((0.003, 0.004, 0.005), 1.0)
    W, L, H = 3.2, 16.0, 3.0
    m = -1 if mirror else 1  # +1: lockers on the right (+X)
    floor = lib.mat_checker("HallFloor", (0.5, 0.5, 0.47), (0.06, 0.06, 0.06), 1.0, rough=0.25)
    wall = lib.mat_wall("HallWallL", (0.5, 0.48, 0.42), (0.16, 0.2, 0.25), stain=0.5)
    ceil = lib.mat_plain("HallCeiling", (0.3, 0.3, 0.29), 0.9)
    lib.box((W, L, 0.02), (0, L / 2, -0.01), floor, bevel=0, name="Floor")
    lib.box((W, L, 0.02), (0, L / 2, H + 0.01), ceil, bevel=0, name="Ceiling")
    lib.box((0.15, L, H), (-W / 2 - 0.075, L / 2, H / 2), wall, bevel=0, name="Wall")
    lib.box((0.15, L, H), (W / 2 + 0.075, L / 2, H / 2), wall, bevel=0, name="Wall")
    lib.box((W, 0.15, H), (0, L + 0.075, H / 2), wall, bevel=0, name="Wall")
    lib.box((W, 0.15, H), (0, -0.075, H / 2), wall, bevel=0, name="Wall")
    lib.lockers((m * (W / 2 - 0.23), 1.2 if m > 0 else 1.2 + 25 * 0.42, 0), 26, facing_yaw=90 * m)
    px = -m * (W / 2 - 0.02)
    prot = (0, 0, -m * math.pi / 2)
    for i, img in enumerate(posters):
        lib.framed(lib.TEX / img, (px, 2.2 + i * 2.6, 1.7), 0.75, rot=prot, name="HallPoster")
    fx = -m * (W / 2 - 0.01)
    lib.paper_sheet(lib.TEX / "flyer_homecoming.png", (fx, 3.4, 1.3), 0.4, rot=prot, tilt=5)
    lib.paper_sheet(lib.TEX / "flyer_fall_fling.png", (fx, 8.6, 1.35), 0.4, rot=prot, tilt=-4)
    lib.paper_sheet(lib.TEX / "senior_checklist.png", (fx, 11.4, 1.4), 0.38, rot=prot, tilt=3)
    # Exit sign glow at the far end (no words, just a red box).
    lib.box((0.5, 0.06, 0.2), (0, L - 0.05, 2.6), lib.mat_emit("ExitRed", (1, 0.05, 0.03), 4), bevel=0.01)
    lib.point_light((0, L - 0.4, 2.5), 6, (1, 0.1, 0.05), 0.2)
    # Fluorescent fixtures, most of them dead.
    for i in range(5):
        lib.fluorescent((0, 1.5 + i * 3.2, H - 0.04), on=(i == lit_index), power=55)
    # A drinking fountain and a trash can for scale.
    steel = lib.mat_metal("Steel", (0.55, 0.55, 0.55), rust=0.2, rough=0.3)
    lib.box((0.45, 0.35, 0.3), (-m * (W / 2 - 0.2), 6.0, 0.9), steel, bevel=0.03)
    lib.cyl(0.22, 0.65, (-m * (W / 2 - 0.3), 9.5, 0.33), lib.mat_plain("Trash", (0.15, 0.25, 0.18), 0.7), verts=24)
    lib.scogg_bucks((0.3 * m, 4.0, 0.002), 3, 0.3, seed=9)


def hallway_camera():
    """High-corner security camera, wide angle, looking down the hall."""
    return lib.camera((1.25, 0.25, 2.75), (-0.2, 6.5, 0.9), lens=12.5)


# ---------------------------------------------------------------- the drama room yurt (CAM 5)

YURT_C = (0.3, 5.6)
YURT_R = 1.8
YURT_WALL = 2.8
DOOR_HALF = 0.55   # door half-width (m)
DOOR_H = 2.6


def build_yurt_room(flap: float = 0.0) -> None:
    """The drama room: a felt yurt stage prop in front of black curtains. flap 0 = door flap shut,
    1 = flung open. Scoggis Khan hides inside."""
    lib.world((0.003, 0.003, 0.004), 1.0)
    W, L, H = 9.0, 10.0, 4.6
    stage = lib.mat_wood("StageFloor", (0.26, 0.17, 0.1), 0.45)
    lib.box((W, L, 0.02), (0, L / 2, -0.01), stage, bevel=0, name="Floor")
    lib.box((W, L, 0.02), (0, L / 2, H), lib.mat_plain("StageCeil", (0.05, 0.05, 0.05), 0.9), bevel=0)
    curtain = lib.mat_fabric("BlackCurtain", (0.05, 0.02, 0.025), dirt=0.2, sheen=0.5)
    back = lib.plane((W, H), (0, 8.5, H / 2), curtain, name="Curtain")
    sub = back.modifiers.new("Sub", "SUBSURF")
    sub.subdivision_type = "SIMPLE"
    sub.levels = sub.render_levels = 5
    lib.wave(back, 0.12, 0.35, axis_x=True)
    for x in (-W / 2, W / 2):
        lib.box((0.15, L, H), (x, L / 2, H / 2), lib.mat_wall("DramaWall", (0.2, 0.18, 0.17), (0.1, 0.09, 0.09)), bevel=0)
    # Yurt walls with a door gap facing the camera (-Y).
    felt = lib.mat_fabric("YurtFelt", (0.72, 0.66, 0.55), dirt=0.55, scale=60)
    cx, cy = YURT_C
    wall = lib.tube(YURT_R, YURT_R, YURT_WALL, 0.0, (cx, cy), 64, 12, "YurtWall")
    gap = math.asin(DOOR_HALF / YURT_R)
    lib.delete_faces(wall, lambda c: abs(math.atan2(c.y - cy, c.x - cx) + math.pi / 2) < gap)
    wall.data.materials.append(felt)
    lib.solidify(wall, 0.05)
    roof = lib.tube(YURT_R + 0.08, 0.32, YURT_WALL, YURT_WALL + 1.1, (cx, cy), 64, 10, "YurtRoof")
    roof.data.materials.append(felt)
    lib.solidify(roof, 0.05)
    wood = lib.mat_wood("YurtWood", (0.45, 0.16, 0.06), 0.4)
    lib.torus(0.32, 0.05, (cx, cy, YURT_WALL + 1.1), wood, name="Crown")
    band = lib.mat_stripes("YurtBand", (0.55, 0.08, 0.06), (0.1, 0.15, 0.4), count=24)
    lib.cyl(YURT_R + 0.06, 0.22, (cx, cy, YURT_WALL - 0.15), band, verts=64, name="Band")
    rope = lib.mat_plain("Rope", (0.25, 0.18, 0.1), 0.9)
    for z in (0.6, 1.4):
        lib.torus(YURT_R + 0.06, 0.02, (cx, cy, z), rope, name="Rope")
    # Painted door frame and a felt flap swung open on the left post.
    dy = cy - YURT_R * math.cos(gap)
    for sx in (-1, 1):
        lib.box((0.1, 0.12, DOOR_H), (cx + sx * (DOOR_HALF + 0.05), dy, DOOR_H / 2), wood, bevel=0.01, name="DoorPost")
    lib.box((2 * DOOR_HALF + 0.2, 0.12, 0.12), (cx, dy, DOOR_H + 0.06), wood, bevel=0.01, name="Lintel")
    hinge = lib.empty("FlapHinge", (cx - DOOR_HALF, dy - 0.07, 0))
    fl = lib.plane((2 * DOOR_HALF, DOOR_H), (cx, dy - 0.07, DOOR_H / 2), lib.mat_fabric("Flap", (0.6, 0.12, 0.08), dirt=0.5),
                   hinge, name="Flap")
    sub = fl.modifiers.new("Sub", "SUBSURF")
    sub.subdivision_type = "SIMPLE"
    sub.levels = sub.render_levels = 4
    lib.wave(fl, 0.03, 0.2)
    hinge.rotation_euler = (0, 0, math.radians(-100 * flap))
    # Light: a dim stage work light on the yurt, and a lantern glow inside.
    lib.spot_light((-2.0, 1.8, 4.2), (cx, dy, 1.4), 2500, 45, (1.0, 0.85, 0.65), 0.6, 0.2, name="WorkLight")
    lib.point_light((2.0, 1.0, 3.5), 40, (0.6, 0.7, 1.0), 0.5, name="Fill")
    lib.point_light((cx - 0.25, cy - 1.35, 1.75), 45, (1.0, 0.6, 0.3), 0.15, name="Lantern")
    lib.framed(lib.TEX / "deck_p39.jpg", (-W / 2 + 0.02, 4.0, 2.2), 1.1, rot=(0, 0, -math.pi / 2),
               name="KhanPoster")


def yurt_camera():
    return lib.camera((0.6, 1.5, 2.5), (0.25, 4.6, 2.0), lens=22)
