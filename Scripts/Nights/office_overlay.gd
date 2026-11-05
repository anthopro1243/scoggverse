extends Node2D
## The office art layers over the office render: the lit doorways (with whoever is standing in
## them), the door shutters, the blank Uncle Scogg poster once he has left the stage, and the
## power-out darkness with his face flickering in the left doorway.
## A child of the office sprite, so it pans and warps with the office.

const OFFICE_RECT := Rect2(-540, -210, 3000, 1500)

var _lights: Array[Sprite2D] = []
var _bots: Array[Sprite2D] = []
var _shutters: Array[Sprite2D] = []
var _poster_blank: Sprite2D
var _dark: Sprite2D
var _uncle_lit: Sprite2D
var _uncle_eyes: Sprite2D


func _ready() -> void:
	var base := BotStyle.art("office/office")
	if base:
		(get_parent() as Sprite2D).texture = base
	_poster_blank = _layer("poster_blank")
	for side in 2:
		_lights.append(_layer("light_%d" % side))
		_bots.append(_layer("bot_%d" % side))
		_shutters.append(_layer("shutter_%d" % side))
	_dark = BotStyle.sprite("office/office_dark", OFFICE_RECT.position)
	add_child(_dark)
	_uncle_lit = _layer("uncle_dark_lit")
	_uncle_eyes = _layer("uncle_dark_eyes")


func _layer(key: String) -> Sprite2D:
	var s := BotStyle.sprite("office/" + key, ArtLayout.OFFICE.get(key, Vector2.ZERO))
	add_child(s)
	return s


func refresh(sim: NightSim) -> void:
	var dark := sim.state == NightSim.State.POWER_OUT or (sim.state == NightSim.State.LOST and sim.death_cause.contains("power out"))
	_poster_blank.visible = sim.leader.room != Rooms.STAGE and not dark
	for side in 2:
		var lit := sim.light_side == side and not dark
		_lights[side].visible = lit
		_bots[side].visible = lit and not sim.bots_at_door(side).is_empty()
		_shutters[side].visible = sim.doors[side] and not dark
	_dark.visible = dark
	var at_door := dark and sim.leader_at_dark_door
	# His face flickers into view, lit from below; between flickers only the pupils glow.
	if Game.settings.reduce_flashing:
		# Reduced flashing: the lit face fades in and out over the eyes instead of blinking.
		var phase := sim.power_out_time / GameConfig.POWER_OUT_FLICKER_CYCLE * TAU
		_uncle_eyes.visible = at_door
		_uncle_lit.visible = at_door
		_uncle_lit.modulate.a = 0.5 + 0.5 * sin(phase)
		return
	var on := fmod(sim.power_out_time, GameConfig.POWER_OUT_FLICKER_CYCLE) < GameConfig.POWER_OUT_FLICKER_LIT
	_uncle_lit.modulate.a = 1.0
	_uncle_lit.visible = at_door and on
	_uncle_eyes.visible = at_door and not on


## Which layers are showing (for the playtest).
func shown() -> Array[String]:
	var out: Array[String] = []
	for side in 2:
		if _lights[side].visible:
			out.append("light_%d" % side)
		if _bots[side].visible:
			out.append("bot_%d" % side)
		if _shutters[side].visible:
			out.append("shutter_%d" % side)
	if _dark.visible:
		out.append("dark")
	if _uncle_lit.visible or _uncle_eyes.visible:
		out.append("uncle_dark")
	if _poster_blank.visible:
		out.append("poster_blank")
	return out
