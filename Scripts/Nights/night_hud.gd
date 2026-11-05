extends CanvasLayer
## Screen-space HUD: clock and night, power and usage bars, door and light buttons,
## and the camera map while the tablet is up.

signal door_pressed(side: int)
signal light_pressed(side: int)
signal cam_pressed(room: int)
signal pause_pressed

const MAP_ORIGIN := Vector2(1150, 690)
const MAP_CELL := Vector2(118, 62)
const MAP_GAP := Vector2(10, 12)
## Our own camera map layout: room -> grid cell (column, row).
const MAP_CELLS: Dictionary[int, Vector2i] = {
	Rooms.CURTAIN: Vector2i(0, 0), Rooms.STAGE: Vector2i(1, 0),
	Rooms.LIBRARY: Vector2i(0, 1), Rooms.CAFETERIA: Vector2i(1, 1), Rooms.LOUNGE: Vector2i(2, 1),
	Rooms.LEFT_HALL: Vector2i(0, 2), Rooms.RIGHT_HALL: Vector2i(2, 2),
	Rooms.LEFT_CORNER: Vector2i(0, 3), Rooms.RIGHT_CORNER: Vector2i(2, 3),
}
const USAGE_COLORS: Array[Color] = [Color(0.3, 0.85, 0.3), Color(0.3, 0.85, 0.3), Color(0.9, 0.85, 0.25), Color(0.95, 0.5, 0.2), Color(0.9, 0.2, 0.2)]

var _clock: Label
var _night: Label
var _power: Label
var _bars: Array[ColorRect] = []
var _controls: Control
var _door_buttons: Array[Button] = []
var _light_buttons: Array[Button] = []
var _map: Control
var _cam_buttons: Dictionary[int, Button] = {}
var _hint: Label
var _controls_always: Array[Button] = []


func _ready() -> void:
	layer = 10
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	_clock = BotStyle.label("12 AM", 64)
	_clock.position = Vector2(1650, 20)
	root.add_child(_clock)
	_night = BotStyle.label("Night 1", 34)
	_night.position = Vector2(1640, 100)
	root.add_child(_night)

	_power = BotStyle.label("Power left: 99%", 38)
	_power.position = Vector2(40, 950)
	root.add_child(_power)
	var usage := BotStyle.label("Usage:", 38)
	usage.position = Vector2(40, 1000)
	root.add_child(usage)
	for i in GameConfig.USAGE_BARS_SHOWN_MAX:
		var bar := BotStyle.rect(Rect2(170 + i * 34, 1006, 26, 44), USAGE_COLORS[i])
		root.add_child(bar)
		_bars.append(bar)

	_controls = Control.new()
	_controls.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_controls)
	for side in 2:
		var x := 24.0 if side == Rooms.Side.LEFT else 1716.0
		var door := _button("DOOR", Rect2(x, 380, 180, 110))
		door.pressed.connect(func() -> void: door_pressed.emit(side))
		_controls.add_child(door)
		_door_buttons.append(door)
		var light := _button("LIGHT", Rect2(x, 510, 180, 110))
		light.pressed.connect(func() -> void: light_pressed.emit(side))
		_controls.add_child(light)
		_light_buttons.append(light)

	var pause := _button("II", Rect2(24, 20, 70, 60), 30)
	pause.pressed.connect(func() -> void: pause_pressed.emit())
	_controls_always.append(pause)
	root.add_child(pause)
	_hint = BotStyle.label("Keys: A/D doors  Q/E lights  Space cameras  Esc pause  F full screen", 22, Color(0.75, 0.75, 0.75))
	_hint.position = Vector2(112, 36)
	root.add_child(_hint)

	_map = Control.new()
	_map.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_map)
	for room in MAP_CELLS:
		var cell := MAP_CELLS[room]
		var r := room
		var b := _button("CAM %s" % Rooms.CAM_LABELS[room], Rect2(MAP_ORIGIN + Vector2(cell) * (MAP_CELL + MAP_GAP), MAP_CELL), 24)
		b.pressed.connect(func() -> void: cam_pressed.emit(r))
		_map.add_child(b)
		_cam_buttons[room] = b
	var you := BotStyle.rect(Rect2(MAP_ORIGIN + Vector2(1, 3) * (MAP_CELL + MAP_GAP), MAP_CELL), Color(0.25, 0.25, 0.28))
	var you_label := BotStyle.label("YOU", 26)
	you_label.position = Vector2(34, 14)
	you.add_child(you_label)
	_map.add_child(you)


func _button(text: String, r: Rect2, font_size: int = 32) -> Button:
	var b := Button.new()
	b.text = text
	b.position = r.position
	b.size = r.size
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", font_size)
	return b


func refresh(sim: NightSim) -> void:
	_clock.text = sim.clock.display_text()
	_night.text = Game.night_title(sim.night)
	var playing := sim.state == NightSim.State.PLAYING
	_power.text = "Power left: %d%%" % sim.power.percent()
	_power.add_theme_color_override("font_color", Color(1, 0.35, 0.3) if sim.power.percent() < 20 else Color.WHITE)
	var usage := sim.usage()
	for i in _bars.size():
		_bars[i].visible = i < usage
	# Like FNAF, the doors and lights can't be reached while the tablet is up.
	_controls.visible = playing and not sim.tablet_up
	for b in _controls_always:
		b.visible = not sim.is_finished()
	for side in 2:
		var jammed := sim.is_side_jammed(side)
		var door := _door_buttons[side]
		door.disabled = jammed
		door.text = "DOOR\nSHUT" if sim.doors[side] else "DOOR\nopen"
		door.modulate = Color(1, 0.55, 0.45) if sim.doors[side] else Color.WHITE
		var light := _light_buttons[side]
		light.disabled = jammed or sim.tablet_up
		light.text = "LIGHT\nON" if sim.light_side == side else "LIGHT\noff"
		light.modulate = Color(1, 1, 0.6) if sim.light_side == side else Color.WHITE
	_map.visible = playing and sim.tablet_up
	for room in _cam_buttons:
		_cam_buttons[room].modulate = Color(0.45, 1, 0.45) if room == sim.cam else Color.WHITE
	_hint.visible = playing
