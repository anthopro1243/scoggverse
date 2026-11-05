extends Control
## Settings: master / music / sound-effect volume, screen shake, and "reduce flashing" for
## photosensitive players, and the Sound check page. Changes apply and save right away. Shown
## from the title and the pause menu.

signal closed

const SLIDERS: Array[Array] = [["Master volume", "master"], ["Music", "music"], ["Sound effects", "sfx"]]
const TOGGLES: Array[Array] = [
	["Screen shake", "screen_shake", "Jumpscares shake the screen."],
	["Reduce flashing", "reduce_flashing", "Less flashing."],
]
const LEFT := 460.0

var _sliders: Dictionary[String, HSlider] = {}
var _toggles: Dictionary[String, CheckButton] = {}


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(BotStyle.rect(Rect2(0, 0, 1920, 1080), Color(0.04, 0.04, 0.05, 0.97)))
	var title := BotStyle.label("Settings", 72)
	title.position = Vector2(LEFT, 90)
	add_child(title)
	var s := Game.settings
	var y := 250.0
	for item in SLIDERS:
		var l := BotStyle.label(item[0], 38)
		l.position = Vector2(LEFT, y)
		add_child(l)
		var sl := HSlider.new()
		sl.min_value = 0
		sl.max_value = 100
		sl.step = 5
		sl.value = round(float(s.get(item[1])) * 100.0)
		sl.position = Vector2(LEFT + 420, y + 12)
		sl.size = Vector2(560, 40)
		sl.focus_mode = Control.FOCUS_NONE
		sl.scale = Vector2(1, 1.4)
		var key: String = item[1]
		sl.value_changed.connect(func(v: float) -> void: _store(key, v / 100.0))
		add_child(sl)
		_sliders[key] = sl
		y += 100.0
	y += 30.0
	for item in TOGGLES:
		var c := CheckButton.new()
		c.text = item[0]
		c.button_pressed = bool(s.get(item[1]))
		c.position = Vector2(LEFT, y)
		c.focus_mode = Control.FOCUS_NONE
		c.add_theme_font_size_override("font_size", 38)
		var key: String = item[1]
		c.toggled.connect(func(on: bool) -> void: _store(key, on))
		add_child(c)
		_toggles[key] = c
		var note := BotStyle.label(item[2], 24, Color(0.6, 0.6, 0.6))
		note.position = Vector2(LEFT + 20, y + 62)
		add_child(note)
		y += 130.0
	var check := Button.new()
	check.text = "Sound test"
	check.position = Vector2(LEFT, y + 10)
	check.size = Vector2(360, 80)
	check.focus_mode = Control.FOCUS_NONE
	check.add_theme_font_size_override("font_size", 36)
	check.pressed.connect(func() -> void:
		var page := SoundCheck.new()
		page.closed.connect(page.queue_free)
		add_child(page))
	add_child(check)
	var back := Button.new()
	back.text = "Back"
	back.position = Vector2(1640, 950)
	back.size = Vector2(220, 90)
	back.focus_mode = Control.FOCUS_NONE
	back.add_theme_font_size_override("font_size", 40)
	back.pressed.connect(func() -> void: closed.emit())
	add_child(back)


func _store(key: String, value: Variant) -> void:
	Game.settings.set(key, value)
	Game.save_settings()


## The on-screen controls (for the playtest): name -> Rect2 in screen pixels.
func control_rects() -> Dictionary:
	var out := {}
	for k in _sliders:
		out[k] = _sliders[k].get_global_rect()
	for k in _toggles:
		out[k] = _toggles[k].get_global_rect()
	return out
