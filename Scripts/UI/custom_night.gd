extends Control
## Custom Night: an AI level from 0 to 20 for each bot, then Start.

signal closed
signal start_pressed(levels: Dictionary)

const ROWS: Array[Array] = [
	["leader", "Uncle Scogg", "the boss; sneaks in from CAM 9"],
	["left_hall", "Scoggcrates", "comes to the left door"],
	["right_hall", "Scogga Lisa", "comes to the right door"],
	["sprinter", "Scoggis Khan", "sprints from the curtain"],
]
const SLIDER_X := 760.0
const SLIDER_W := 640.0

var _sliders: Dictionary[String, HSlider] = {}
var _values: Dictionary[String, Label] = {}
var _bucks: Label


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(BotStyle.rect(Rect2(0, 0, 1920, 1080), Color(0.04, 0.04, 0.05)))
	var title := BotStyle.label("Custom Night", 80)
	title.position = Vector2(80, 50)
	add_child(title)
	var hint := BotStyle.label("Pick each robot's AI level: 0 = stays put, 20 = relentless.", 32, Color(0.75, 0.75, 0.75))
	hint.position = Vector2(80, 160)
	add_child(hint)

	var y := 260.0
	for row in ROWS:
		var id: String = row[0]
		add_child(BotStyle.rect(Rect2(80, y + 12, 36, 36), BotStyle.COLORS[id]))
		var bot_name := BotStyle.label(row[1], 44)
		bot_name.position = Vector2(140, y)
		add_child(bot_name)
		var what := BotStyle.label(row[2], 24, Color(0.65, 0.65, 0.65))
		what.position = Vector2(140, y + 58)
		add_child(what)
		add_child(_small_button("–", Vector2(SLIDER_X - 90, y), func() -> void: _sliders[id].value -= 1))
		var slider := HSlider.new()
		slider.min_value = 0
		slider.max_value = GameConfig.AI_LEVEL_MAX
		slider.step = 1
		slider.position = Vector2(SLIDER_X, y + 10)
		slider.size = Vector2(SLIDER_W, 60)
		slider.focus_mode = Control.FOCUS_NONE
		slider.value_changed.connect(func(_v: float) -> void: _refresh())
		add_child(slider)
		_sliders[id] = slider
		add_child(_small_button("+", Vector2(SLIDER_X + SLIDER_W + 20, y), func() -> void: _sliders[id].value += 1))
		var value := BotStyle.label("0", 52, Color(1, 0.85, 0.35))
		value.position = Vector2(SLIDER_X + SLIDER_W + 120, y - 2)
		add_child(value)
		_values[id] = value
		y += 140.0

	_bucks = BotStyle.label("", 34, Color(1, 0.85, 0.35))
	_bucks.position = Vector2(80, 840)
	add_child(_bucks)
	add_child(_wide_button("Back", Vector2(80, 930), func() -> void: closed.emit()))
	add_child(_wide_button("Start", Vector2(1440, 930), func() -> void: start_pressed.emit(levels())))
	_refresh()


func levels() -> Dictionary:
	var out := {}
	for id in _sliders:
		out[id] = int(_sliders[id].value)
	return out


func set_levels(p_levels: Dictionary) -> void:
	for id in p_levels:
		if _sliders.has(id):
			_sliders[id].value = p_levels[id]


func _refresh() -> void:
	for id in _sliders:
		_values[id].text = str(int(_sliders[id].value))
	var bucks := Progress.bucks_for(GameConfig.CUSTOM_NIGHT, 0, levels())
	_bucks.text = "Survive it for %d Scogg Bucks (+ power bonus)" % bucks.base


func _small_button(text: String, pos: Vector2, action: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.position = pos
	b.size = Vector2(72, 72)
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 44)
	b.pressed.connect(action)
	return b


func _wide_button(text: String, pos: Vector2, action: Callable) -> Button:
	var b := _small_button(text, pos, action)
	b.size = Vector2(400, 100)
	b.add_theme_font_size_override("font_size", 48)
	return b
