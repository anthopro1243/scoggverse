"""Shared Blender helpers for the Scoggatronics art: render setup, procedural materials,
mesh helpers and school props.

Everything is modeled from primitives and textured procedurally (no third-party assets).
Units are meters; a character stands at the origin facing -Y unless rotated.
"""
import json
import math
import random
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Vector

ROOT = Path(__file__).resolve().parents[3]
CFG = json.loads((ROOT / "tools/art/config.json").read_text())
FONTS = ROOT / "tools/art/fonts"
TEX = ROOT / "art/textures"
FACES = ROOT / "art/faces"


# ---------------------------------------------------------------- scene / render

def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_render(size: tuple[int, int], quality: str, transparent: bool = False) -> None:
    q = CFG["quality"][quality]
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = q["samples"]
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.use_denoising = CFG["denoise"]
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except TypeError:
        pass
    sc.cycles.max_bounces = 6
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 1.0
    if CFG.get("threads"):
        sc.render.threads_mode = "FIXED"
        sc.render.threads = CFG["threads"]
    sc.render.resolution_x = max(16, int(size[0] * q["scale"]))
    sc.render.resolution_y = max(16, int(size[1] * q["scale"]))
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = transparent
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    sc.view_settings.exposure = 0.0


def world(color=(0.005, 0.006, 0.008), strength: float = 1.0) -> None:
    w = bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    nodes = w.node_tree.nodes if w.node_tree else None
    if nodes is None:
        w.use_nodes = True
        nodes = w.node_tree.nodes
    bg = nodes.get("Background") or nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (*color, 1)
    bg.inputs["Strength"].default_value = strength
    out = nodes.get("World Output") or nodes.new("ShaderNodeOutputWorld")
    w.node_tree.links.new(bg.outputs[0], out.inputs[0])


def camera(loc, look_at, lens: float = 18.0, sensor: float = 36.0, name: str = "Cam", ortho: float = 0.0):
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam_data.sensor_width = sensor
    cam_data.sensor_fit = "HORIZONTAL"
    cam_data.clip_start = 0.05
    cam_data.clip_end = 200
    if ortho:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = ortho
    cam = bpy.data.objects.new(name, cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = Vector(loc)
    aim(cam, look_at)
    bpy.context.scene.camera = cam
    return cam


def aim(obj, target) -> None:
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def render(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def project(cam, point) -> tuple[float, float]:
    """World point -> (u, v) in 0-1 image space, v down."""
    from bpy_extras.object_utils import world_to_camera_view
    co = world_to_camera_view(bpy.context.scene, cam, Vector(point))
    return co.x, 1 - co.y


# ---------------------------------------------------------------- lights

def point_light(loc, power: float, color=(1.0, 0.85, 0.65), radius: float = 0.05, name: str = "Point"):
    ld = bpy.data.lights.new(name, "POINT")
    ld.energy = power
    ld.color = color
    ld.shadow_soft_size = radius
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = Vector(loc)
    return ob


def spot_light(loc, target, power: float, angle_deg: float = 60, color=(1.0, 0.9, 0.75), blend: float = 0.4,
               radius: float = 0.05, name: str = "Spot"):
    ld = bpy.data.lights.new(name, "SPOT")
    ld.energy = power
    ld.color = color
    ld.spot_size = math.radians(angle_deg)
    ld.spot_blend = blend
    ld.shadow_soft_size = radius
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = Vector(loc)
    aim(ob, target)
    return ob


def area_light(loc, target, power: float, size: float = 1.0, color=(0.8, 0.9, 1.0), name: str = "Area"):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = power
    ld.color = color
    ld.size = size
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = Vector(loc)
    aim(ob, target)
    return ob


# ---------------------------------------------------------------- materials

def _mat(name: str):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    if bsdf is None:
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(bsdf.outputs[0], out.inputs[0])
    return m, nt, bsdf


def _noise(nt, scale: float, detail: float = 6.0, rough: float = 0.6, coord: str = "Object"):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    nt.links.new(tc.outputs[coord], n.inputs["Vector"])
    return n


def _ramp(nt, src, stops):
    r = nt.nodes.new("ShaderNodeValToRGB")
    els = r.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], (*stops[0][1], 1)
    els[1].position, els[1].color = stops[-1][0], (*stops[-1][1], 1)
    for pos, col in stops[1:-1]:
        e = els.new(pos)
        e.color = (*col, 1)
    nt.links.new(src, r.inputs["Fac"])
    return r


def _mix(nt, fac, a, b, blend: str = "MIX"):
    m = nt.nodes.new("ShaderNodeMix")
    m.data_type = "RGBA"
    m.blend_type = blend
    if isinstance(fac, float):
        m.inputs[0].default_value = fac
    else:
        nt.links.new(fac, m.inputs[0])
    for idx, v in ((6, a), (7, b)):
        if isinstance(v, tuple):
            m.inputs[idx].default_value = (*v, 1) if len(v) == 3 else v
        else:
            nt.links.new(v, m.inputs[idx])
    return m.outputs[2]


def _bump(nt, bsdf, height_src, strength: float, distance: float = 0.02):
    b = nt.nodes.new("ShaderNodeBump")
    b.inputs["Strength"].default_value = strength
    b.inputs["Distance"].default_value = distance
    nt.links.new(height_src, b.inputs["Height"])
    nt.links.new(b.outputs["Normal"], bsdf.inputs["Normal"])


_cache: dict = {}


def mat_metal(name: str, color, rust: float = 0.35, rough: float = 0.45, scale: float = 6.0):
    """Worn metal: grime and rust in the low spots, bright scratches, rubbed edges."""
    key = ("metal", name)
    if key in _cache:
        return _cache[key]
    m, nt, bsdf = _mat(name)
    n = _noise(nt, scale, 8, 0.65)
    grime = _ramp(nt, n.outputs["Fac"], [(0.35, (0, 0, 0)), (0.65, (1, 1, 1))])
    rust_col = _mix(nt, grime.outputs["Color"], (0.16, 0.06, 0.025), tuple(color))
    n2 = _noise(nt, scale * 4, 4, 0.5)
    dirt = _ramp(nt, n2.outputs["Fac"], [(0.3, (0.45, 0.42, 0.38)), (0.7, (1, 1, 1))])
    col = _mix(nt, 1.0, rust_col, dirt.outputs["Color"], "MULTIPLY")
    col = _mix(nt, 1.0 - rust, col, tuple(color))
    # Scratches: thin bright streaks from a stretched, distorted wave.
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale * 3, scale * 0.4, scale * 3)
    mp.inputs["Rotation"].default_value = (0.4, 0.7, 0.2)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    wv = nt.nodes.new("ShaderNodeTexWave")
    wv.inputs["Scale"].default_value = 3.0
    wv.inputs["Distortion"].default_value = 12.0
    wv.inputs["Detail"].default_value = 4.0
    nt.links.new(mp.outputs["Vector"], wv.inputs["Vector"])
    scr = _ramp(nt, wv.outputs["Fac"], [(0.0, (0, 0, 0)), (0.93, (0, 0, 0)), (0.97, (1, 1, 1))])
    col = _mix(nt, scr.outputs["Color"], col, tuple(min(1.0, c * 1.8 + 0.15) for c in color))
    # Rubbed edges (Cycles pointiness).
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    edge = _ramp(nt, geo.outputs["Pointiness"], [(0.5, (0, 0, 0)), (0.56, (1, 1, 1))])
    col = _mix(nt, edge.outputs["Color"], col, tuple(min(1.0, c * 1.5 + 0.1) for c in color))
    nt.links.new(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Metallic"].default_value = 0.85
    rr = _ramp(nt, n.outputs["Fac"], [(0.3, (rough + 0.3,) * 3), (0.7, (max(0.1, rough - 0.2),) * 3)])
    nt.links.new(rr.outputs["Color"], bsdf.inputs["Roughness"])
    _bump(nt, bsdf, n2.outputs["Fac"], 0.3)
    _cache[key] = m
    return m


def mat_fabric(name: str, color, rough: float = 0.85, scale: float = 40.0, dirt: float = 0.35, sheen: float = 0.3):
    key = ("fabric", name)
    if key in _cache:
        return _cache[key]
    m, nt, bsdf = _mat(name)
    n = _noise(nt, 3.0, 5, 0.6)
    d = _ramp(nt, n.outputs["Fac"], [(0.3, (1 - dirt,) * 3), (0.7, (1, 1, 1))])
    col = _mix(nt, 1.0, tuple(color), d.outputs["Color"], "MULTIPLY")
    nt.links.new(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    try:
        bsdf.inputs["Sheen Weight"].default_value = sheen
    except KeyError:
        pass
    weave = _noise(nt, scale, 2, 0.4)
    _bump(nt, bsdf, weave.outputs["Fac"], 0.15)
    _cache[key] = m
    return m


def mat_plain(name: str, color, rough: float = 0.6, metal: float = 0.0, emit=None, emit_strength: float = 0.0):
    key = ("plain", name)
    if key in _cache:
        return _cache[key]
    m, nt, bsdf = _mat(name)
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    _cache[key] = m
    return m


def mat_emit(name: str, color, strength: float):
    key = ("emit", name)
    if key in _cache:
        return _cache[key]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1)
    e.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], out.inputs[0])
    _cache[key] = m
    return m


def mat_image(name: str, path: Path, rough: float = 0.7, alpha: bool = False, dirt: float = 0.25,
              emit: float = 0.0, darken: float = 1.0):
    """An image (poster, face mask, flyer) printed on paper or plastic, a little grimy."""
    key = ("image", name)
    if key in _cache:
        return _cache[key]
    m, nt, bsdf = _mat(name)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(path), check_existing=True)
    tex.extension = "CLIP"
    n = _noise(nt, 4.0, 6, 0.6, "UV")
    d = _ramp(nt, n.outputs["Fac"], [(0.25, (1 - dirt,) * 3), (0.7, (darken,) * 3)])
    col = _mix(nt, 1.0, tex.outputs["Color"], d.outputs["Color"], "MULTIPLY")
    nt.links.new(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    if alpha:
        nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    if emit:
        nt.links.new(col, bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emit
    _cache[key] = m
    return m


def mat_checker(name: str, a, b, scale: float = 1.0, rough: float = 0.35):
    """Checkered school tile floor, scuffed."""
    key = ("checker", name)
    if key in _cache:
        return _cache[key]
    m, nt, bsdf = _mat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    ch = nt.nodes.new("ShaderNodeTexChecker")
    ch.inputs["Color1"].default_value = (*a, 1)
    ch.inputs["Color2"].default_value = (*b, 1)
    ch.inputs["Scale"].default_value = scale
    nt.links.new(tc.outputs["Object"], ch.inputs["Vector"])
    n = _noise(nt, 2.0, 8, 0.7)
    d = _ramp(nt, n.outputs["Fac"], [(0.3, (0.55,) * 3), (0.75, (1, 1, 1))])
    col = _mix(nt, 1.0, ch.outputs["Color"], d.outputs["Color"], "MULTIPLY")
    nt.links.new(col, bsdf.inputs["Base Color"])
    rr = _ramp(nt, n.outputs["Fac"], [(0.3, (rough + 0.4,) * 3), (0.75, (rough,) * 3)])
    nt.links.new(rr.outputs["Color"], bsdf.inputs["Roughness"])
    _cache[key] = m
    return m


def mat_wall(name: str, color, low=None, rough: float = 0.85, stain: float = 0.35):
    """Painted cinder-block wall with a darker stripe below (low = color of the lower half)."""
    key = ("wall", name)
    if key in _cache:
        return _cache[key]
    m, nt, bsdf = _mat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.inputs["Color1"].default_value = (*color, 1)
    br.inputs["Color2"].default_value = (*[c * 0.94 for c in color], 1)
    br.inputs["Mortar"].default_value = (*[c * 0.8 for c in color], 1)
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = 0.008
    br.inputs["Brick Width"].default_value = 0.4
    br.inputs["Row Height"].default_value = 0.2
    nt.links.new(tc.outputs["Object"], br.inputs["Vector"])
    base = br.outputs["Color"]
    if low is not None:
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Object"], sep.inputs[0])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = 1.0
        mr.inputs["From Max"].default_value = 1.02
        nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
        base = _mix(nt, mr.outputs["Result"], tuple(low), base)
    n = _noise(nt, 1.5, 8, 0.7)
    d = _ramp(nt, n.outputs["Fac"], [(0.3, (1 - stain,) * 3), (0.75, (1, 1, 1))])
    col = _mix(nt, 1.0, base, d.outputs["Color"], "MULTIPLY")
    nt.links.new(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    _bump(nt, bsdf, br.outputs["Fac"], 0.3)
    _cache[key] = m
    return m


def mat_wood(name: str, color=(0.32, 0.18, 0.09), rough: float = 0.5):
    """Wood grain: noise stretched along X, scuffed."""
    key = ("wood", name)
    if key in _cache:
        return _cache[key]
    m, nt, bsdf = _mat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.5, 30, 30)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 2.0
    n.inputs["Detail"].default_value = 10
    n.inputs["Distortion"].default_value = 1.5
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
    r = _ramp(nt, n.outputs["Fac"], [(0.3, tuple(c * 0.55 for c in color)), (0.7, tuple(color))])
    nt.links.new(r.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    _bump(nt, bsdf, n.outputs["Fac"], 0.1)
    _cache[key] = m
    return m


def mat_stripes(name: str, a, b, count: float = 6.0, axis: str = "Z"):
    """Vertical stripes (Uncle Scogg's trousers)."""
    key = ("stripes", name)
    if key in _cache:
        return _cache[key]
    m, nt, bsdf = _mat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    math_n = nt.nodes.new("ShaderNodeMath")
    math_n.operation = "SINE"
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = count * 6.283
    # Stripes around the leg: use the angle of the object-space XY position.
    at = nt.nodes.new("ShaderNodeMath")
    at.operation = "ARCTAN2"
    nt.links.new(sep.outputs["Y"], at.inputs[0])
    nt.links.new(sep.outputs["X"], at.inputs[1])
    div = nt.nodes.new("ShaderNodeMath")
    div.operation = "DIVIDE"
    div.inputs[1].default_value = 6.283
    nt.links.new(at.outputs[0], div.inputs[0])
    nt.links.new(div.outputs[0], mul.inputs[0])
    nt.links.new(mul.outputs[0], math_n.inputs[0])
    gt = nt.nodes.new("ShaderNodeMath")
    gt.operation = "GREATER_THAN"
    gt.inputs[1].default_value = 0.0
    nt.links.new(math_n.outputs[0], gt.inputs[0])
    col = _mix(nt, gt.outputs[0], tuple(a), tuple(b))
    n = _noise(nt, 3.0, 5, 0.6)
    d = _ramp(nt, n.outputs["Fac"], [(0.3, (0.7,) * 3), (0.7, (1, 1, 1))])
    col = _mix(nt, 1.0, col, d.outputs["Color"], "MULTIPLY")
    nt.links.new(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    _cache[key] = m
    return m


def mat_fur(name: str, color):
    """Fur hat brim: noisy, very bumpy fabric."""
    key = ("fur", name)
    if key in _cache:
        return _cache[key]
    m, nt, bsdf = _mat(name)
    n = _noise(nt, 120.0, 4, 0.7)
    r = _ramp(nt, n.outputs["Fac"], [(0.3, tuple(c * 0.4 for c in color)), (0.7, tuple(color))])
    nt.links.new(r.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.95
    try:
        bsdf.inputs["Sheen Weight"].default_value = 0.8
    except KeyError:
        pass
    _bump(nt, bsdf, n.outputs["Fac"], 1.0, 0.05)
    _cache[key] = m
    return m


# ---------------------------------------------------------------- meshes

def _link(ob, parent=None):
    if ob.name not in bpy.context.scene.collection.objects:
        pass
    if parent is not None:
        ob.parent = parent
        ob.matrix_parent_inverse = parent.matrix_world.inverted()
    return ob


def _finish(ob, mat, parent=None, bevel: float = 0.0, subsurf: int = 0, smooth: bool = True):
    if mat is not None:
        ob.data.materials.append(mat)
    if smooth and hasattr(ob.data, "polygons"):
        for p in ob.data.polygons:
            p.use_smooth = True
    if bevel:
        b = ob.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = 3
        b.limit_method = "ANGLE"
    if subsurf:
        s = ob.modifiers.new("Subsurf", "SUBSURF")
        s.levels = subsurf
        s.render_levels = subsurf
    return _link(ob, parent)


def box(size, loc, mat=None, parent=None, rot=(0, 0, 0), bevel: float = 0.01, subsurf: int = 0, name: str = "Box"):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(ob, mat, parent, bevel, subsurf, smooth=subsurf > 0)


def sphere(radius, loc, mat=None, parent=None, scale=(1, 1, 1), segments: int = 24, name: str = "Sphere"):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=segments // 2, radius=radius, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(ob, mat, parent)


def cyl(radius, depth, loc, mat=None, parent=None, rot=(0, 0, 0), verts: int = 24, radius2=None, bevel: float = 0.0,
        name: str = "Cyl"):
    if radius2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius, radius2=radius2, depth=depth, location=loc,
                                        rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    return _finish(ob, mat, parent, bevel)


def cyl_between(a, b, radius, mat=None, parent=None, radius2=None, verts: int = 16, name: str = "Limb"):
    a, b = Vector(a), Vector(b)
    d = b - a
    ob = cyl(radius, d.length, (a + b) / 2, mat, None, verts=verts, radius2=radius2, name=name)
    ob.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    return _link(ob, parent)


def torus(major, minor, loc, mat=None, parent=None, rot=(0, 0, 0), name: str = "Torus"):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc, rotation=rot,
                                     major_segments=32, minor_segments=12)
    ob = bpy.context.active_object
    ob.name = name
    return _finish(ob, mat, parent)


def plane(size, loc, mat=None, parent=None, rot=(0, 0, 0), name: str = "Plane"):
    """A w x h plane facing -Y (rot rotates it from there). UVs cover the whole image."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=(math.pi / 2, 0, 0))
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ob.rotation_euler = Euler(rot)
    return _finish(ob, mat, parent, smooth=False)


def text(body: str, loc, size: float, mat, rot=(math.pi / 2, 0, 0), font_file: str = "DejaVuSans-Bold.ttf",
         align: str = "CENTER", extrude: float = 0.0, parent=None):
    cu = bpy.data.curves.new("Text", "FONT")
    cu.body = body
    cu.size = size
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.extrude = extrude
    cu.font = bpy.data.fonts.load(str(FONTS / font_file), check_existing=True)
    ob = bpy.data.objects.new("Text", cu)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = Vector(loc)
    ob.rotation_euler = Euler(rot)
    ob.data.materials.append(mat)
    return _link(ob, parent)


def star_mesh(radius: float, loc, mat, rot=(math.pi / 2, 0, 0), depth: float = 0.004, parent=None):
    verts = []
    for i in range(10):
        r = radius if i % 2 == 0 else radius * 0.42
        a = math.pi / 2 + i * math.pi / 5
        verts.append((r * math.cos(a), r * math.sin(a), 0))
    me = bpy.data.meshes.new("Star")
    me.from_pydata(verts + [(0, 0, 0)], [], [(i, (i + 1) % 10, 10) for i in range(10)])
    ob = bpy.data.objects.new("Star", me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = Vector(loc)
    ob.rotation_euler = Euler(rot)
    ob.data.materials.append(mat)
    sol = ob.modifiers.new("Solid", "SOLIDIFY")
    sol.thickness = depth
    return _link(ob, parent)


def wave(ob, height: float = 0.02, width: float = 0.25, speed_time: float = 0.0, axis_x: bool = True):
    """Cloth folds."""
    w = ob.modifiers.new("Folds", "WAVE")
    w.use_x = axis_x
    w.use_y = not axis_x
    w.height = height
    w.width = width
    w.narrowness = 1.2
    w.time_offset = speed_time
    w.use_normal = True
    return w


def _put(holder, loc, rot=(0, 0, 0), parent=None):
    """Moves a prop built around the origin into place (children were built in its local space)."""
    holder.location = Vector(loc)
    holder.rotation_euler = Euler(rot)
    if parent is not None:
        holder.parent = parent
    return holder


def empty(name: str, loc, parent=None):
    ob = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = Vector(loc)
    if parent is not None:
        bpy.context.view_layer.update()
    _link(ob, parent)
    bpy.context.view_layer.update()  # children parented right after need a fresh matrix_world
    return ob


# ---------------------------------------------------------------- mesh edits

def delete_faces(ob, pred) -> None:
    """Deletes faces whose object-space center passes pred(Vector)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if pred(f.calc_center_median())], context="FACES")
    bm.to_mesh(ob.data)
    bm.free()


def tube(r_top: float, r_bottom: float, z_top: float, z_bottom: float, center=(0, 0), nv: int = 48, nh: int = 30,
         name: str = "Tube"):
    """An open tube (no caps), for cloth skirts, coats and togas. World space."""
    bm = bmesh.new()
    rings = []
    for j in range(nh + 1):
        t = j / nh
        z = z_top + (z_bottom - z_top) * t
        r = r_top + (r_bottom - r_top) * t
        rings.append([bm.verts.new((center[0] + r * math.cos(2 * math.pi * i / nv),
                                    center[1] + r * math.sin(2 * math.pi * i / nv), z)) for i in range(nv)])
    for j in range(nh):
        for i in range(nv):
            a, b = rings[j][i], rings[j][(i + 1) % nv]
            c, d = rings[j + 1][(i + 1) % nv], rings[j + 1][i]
            bm.faces.new((a, b, c, d))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def solidify(ob, t: float = 0.008) -> None:
    m = ob.modifiers.new("Solid", "SOLIDIFY")
    m.thickness = t
    s = ob.modifiers.new("Sub", "SUBSURF")
    s.levels = s.render_levels = 1


# ---------------------------------------------------------------- hands


# ---------------------------------------------------------------- props

def framed(img: Path, center, width: float, rot=(0, 0, 0), frame_mat=None, name: str = "Poster", glare: bool = True,
           parent=None):
    """A framed poster facing -Y before rotation; height follows the image's aspect."""
    im = bpy.data.images.load(str(img), check_existing=True)
    h = width * im.size[1] / max(1, im.size[0])
    holder = empty(name, (0, 0, 0))
    plane((width, h), (0, -0.012, 0), mat_image(f"Img_{img.stem}", img, rough=0.35 if glare else 0.8), holder,
          name=name + "Img")
    fm = frame_mat or mat_wood("Frame", (0.15, 0.08, 0.04), 0.4)
    t = 0.035
    for dx, dz, w, hh in ((0, h / 2 + t / 2, width + 2 * t, t), (0, -h / 2 - t / 2, width + 2 * t, t),
                          (width / 2 + t / 2, 0, t, h), (-width / 2 - t / 2, 0, t, h)):
        box((w, 0.03, hh), (dx, -0.005, dz), fm, holder, bevel=0.004, name=name + "Frame")
    return _put(holder, center, rot, parent)


def paper_sheet(img: Path, center, width: float, rot=(0, 0, 0), name: str = "Paper", parent=None, tilt: float = 0.0):
    im = bpy.data.images.load(str(img), check_existing=True)
    h = width * im.size[1] / max(1, im.size[0])
    holder = empty(name, (0, 0, 0))
    pl = plane((width, h), (0, -0.004, 0), mat_image(f"Img_{img.stem}", img, rough=0.85, dirt=0.3), holder,
               rot=(0, math.radians(tilt), 0), name=name)
    tack = mat_plain("Tack", (0.7, 0.1, 0.1), 0.3)
    sphere(0.008, (0, -0.008, h / 2 - 0.02), tack, holder, segments=8, name="Tack")
    return _put(holder, center, rot, parent)


def desk(loc, mat_top=None, mat_leg=None, w: float = 1.2, d: float = 0.6, h: float = 0.76, parent=None):
    top = mat_top or mat_wood("DeskTop", (0.4, 0.27, 0.15))
    leg = mat_leg or mat_metal("DeskLeg", (0.3, 0.3, 0.3), rust=0.3)
    x, y, z = loc
    box((w, d, 0.04), (x, y, z + h), top, parent, bevel=0.005, name="DeskTop")
    for dx in (-w / 2 + 0.05, w / 2 - 0.05):
        for dy in (-d / 2 + 0.05, d / 2 - 0.05):
            cyl(0.018, h, (x + dx, y + dy, z + h / 2), leg, parent, verts=10, name="DeskLeg")


def school_desk(loc, yaw: float = 0.0):
    """A student desk-chair combo."""
    holder = empty("SchoolDesk", (0, 0, 0))
    top = mat_plain("DeskLaminate", (0.55, 0.42, 0.28), 0.5)
    frame = mat_metal("DeskFrame", (0.25, 0.25, 0.27), rust=0.3)
    seat = mat_plain("SeatPlastic", (0.12, 0.2, 0.35), 0.5)
    box((0.6, 0.45, 0.03), (0, -0.1, 0.74), top, holder, bevel=0.005)
    box((0.42, 0.4, 0.03), (0, 0.35, 0.45), seat, holder, bevel=0.01)
    box((0.42, 0.03, 0.35), (0, 0.56, 0.66), seat, holder, bevel=0.01)
    for dx in (-0.2, 0.2):
        cyl(0.012, 0.74, (dx, -0.25, 0.37), frame, holder, verts=8)
        cyl(0.012, 0.45, (dx, 0.5, 0.22), frame, holder, verts=8)
        cyl_between((dx, -0.25, 0.05), (dx, 0.5, 0.05), 0.012, frame, holder, verts=8)
    return _put(holder, loc, (0, 0, math.radians(yaw)))


def lockers(start, count: int, along=(1, 0, 0), facing_yaw: float = 0.0, color=(0.15, 0.25, 0.4)):
    mat = mat_metal("Locker", color, rust=0.25, rough=0.4, scale=3)
    dark = mat_plain("LockerVent", (0.02, 0.02, 0.02), 0.8)
    holder = empty("Lockers", (0, 0, 0))
    for i in range(count):
        x = i * 0.42
        box((0.4, 0.45, 1.8), (x, 0, 0.9), mat, holder, bevel=0.005)
        for k in range(4):
            box((0.22, 0.01, 0.015), (x, -0.228, 1.6 - k * 0.04), dark, holder, bevel=0.0)
        box((0.03, 0.02, 0.1), (x + 0.13, -0.235, 1.0), mat_metal("Handle", (0.5, 0.5, 0.5)), holder, bevel=0.003)
    return _put(holder, start, (0, 0, math.radians(facing_yaw)))


def fluorescent(loc, on: bool, length: float = 1.2, power: float = 40.0, color=(0.85, 0.95, 1.0)):
    housing = mat_metal("Housing", (0.6, 0.6, 0.6), rust=0.1)
    box((length, 0.25, 0.06), loc, housing, bevel=0.01, name="Fixture")
    tube = mat_emit("TubeOn", color, 6.0) if on else mat_plain("TubeOff", (0.6, 0.6, 0.6), 0.3)
    box((length * 0.95, 0.18, 0.01), (loc[0], loc[1], loc[2] - 0.035), tube, bevel=0.0, name="Tube")
    if on:
        area_light((loc[0], loc[1], loc[2] - 0.06), (loc[0], loc[1], 0), power, size=length, color=color,
                   name="FluoLight")


def scogg_bucks(loc, count: int, spread: float = 0.25, seed: int = 1, parent=None):
    """Loose Scogg Buck bills (p. 17's "In Scogg We Trust" $20) on a surface."""
    rnd = random.Random(seed)
    m = mat_image("Bill", TEX / "scogg_buck.png", rough=0.8, dirt=0.25)
    for i in range(count):
        p = (loc[0] + rnd.uniform(-spread, spread), loc[1] + rnd.uniform(-spread, spread), loc[2] + 0.001 * i)
        b = plane((0.156, 0.104), p, m, parent, rot=(-math.pi / 2, 0, rnd.uniform(0, math.pi)), name="Bill")


def crt_monitor(loc, yaw: float = 0.0, glow=(0.3, 0.55, 0.7), strength: float = 0.5, parent=None):
    holder = empty("CRT", (0, 0, 0))
    plastic = mat_plain("CRTPlastic", (0.55, 0.52, 0.45), 0.6)
    box((0.42, 0.4, 0.36), (0, 0.08, 0.18), plastic, holder, bevel=0.03)
    box((0.3, 0.25, 0.28), (0, 0.3, 0.17), plastic, holder, bevel=0.03)
    screen = mat_emit(f"CRTScreen{strength}", glow, strength)
    box((0.32, 0.01, 0.25), (0, -0.125, 0.2), screen, holder, bevel=0.01)
    return _put(holder, loc, (0, 0, math.radians(yaw)), parent)


def desk_fan(loc, yaw: float = 0.0, parent=None):
    holder = empty("Fan", (0, 0, 0))
    metal = mat_metal("FanMetal", (0.3, 0.32, 0.3), rust=0.4)
    cyl(0.1, 0.03, (0, 0, 0.015), metal, holder, verts=24)
    cyl(0.015, 0.25, (0, 0, 0.14), metal, holder, verts=8)
    torus(0.15, 0.008, (0, -0.02, 0.32), metal, holder, rot=(math.pi / 2, 0, 0))
    sphere(0.05, (0, 0.03, 0.32), metal, holder, scale=(1, 1.3, 1))
    for i in range(4):
        a = i * math.pi / 2 + 0.3
        blade = box((0.06, 0.005, 0.12), (0.07 * math.sin(a), -0.03, 0.32 + 0.07 * math.cos(a)), metal, holder,
                    rot=(0, a, 0), bevel=0.0)
    for i in range(10):  # cage wires
        a = i * math.pi / 5
        cyl_between((0, -0.06, 0.32), (0.15 * math.sin(a), -0.02, 0.32 + 0.15 * math.cos(a)), 0.003, metal, holder,
                    verts=6)
    return _put(holder, loc, (0, 0, math.radians(yaw)), parent)
