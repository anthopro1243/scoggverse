extends Control
## Title screen: Continue / New Game / Custom Night (once unlocked) / How to Play,
## with the saved Scogg Bucks and best night.

const HowToPlay := preload("res://Scripts/UI/how_to_play.gd")
const CustomNight := preload("res://Scripts/UI/custom_night.gd")
const SettingsMenu := preload("res://Scripts/UI/settings_menu.gd")
const Credits := preload("res://Scripts/UI/credits.gd")

## The menu sits on the left; Uncle Scogg stands in the art on the right.
const LEFT_X := 130.0

var _overlay: Control
var _buttons: Array[String] = []


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	Sound.menu_music(true)
	add_child(BotStyle.rect(Rect2(0, 0, 1920, 1080), Color(0.03, 0.03, 0.04)))
	var art := BotStyle.art("ui/title") # Uncle Scogg's standee on the dark stage (p. 61)
	if art:
		var bg := TextureRect.new()
		bg.texture = art
		bg.size = Vector2(1920, 1080)
		bg.stretch_mode = TextureRect.STRETCH_SCALE
		bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(bg)
	_left("FIVE NIGHTS AT", 80, 90, Color(0.85, 0.85, 0.85))
	_left("SCOGGY'S", 150, 170, Color(0.9, 0.15, 0.15))
	_left("a fan parody", 34, 350, Color(0.6, 0.6, 0.6))
	var p := Game.progress
	var y := 490.0
	if p.night > 1:
		_button("Continue  (Night %d)" % p.night, y, Game.continue_game)
		y += 105.0
	_button("New Game", y, Game.new_game)
	y += 105.0
	if p.custom_unlocked:
		_button("Custom Night", y, show_custom_night)
		y += 105.0
	_button("How to Play", y, show_how_to_play)
	_button("Settings", 960.0, func() -> void: _open(SettingsMenu.new()), Vector2(290, 64), 32)
	_button("Credits", 960.0, func() -> void: _open(Credits.new()), Vector2(290, 64), 32, LEFT_X + 310.0)
	_left("Scogg Bucks: %d     ·     Best: Night %d" % [p.scogg_bucks, p.best_night], 30, 905, Color(1, 0.85, 0.35))
	_center("Fan-made and free. Not affiliated with Five Nights at Freddy's or Scott Cawthon.", 22, 1030, Color(0.45, 0.45, 0.45))


## Button labels on the title, for the playtest.
func buttons_shown() -> Array[String]:
	return _buttons


func show_how_to_play() -> void:
	_open(HowToPlay.new())


func show_custom_night() -> void:
	var screen: Control = CustomNight.new()
	screen.start_pressed.connect(Game.play_custom)
	_open(screen)


func is_showing_how_to_play() -> bool:
	return _overlay != null and _overlay.get_script() == HowToPlay


func is_showing_custom_night() -> bool:
	return _overlay != null and _overlay.get_script() == CustomNight


func custom_night_levels() -> Dictionary:
	return _overlay.levels() if is_showing_custom_night() else {}


func _open(screen: Control) -> void:
	_overlay = screen
	screen.closed.connect(func() -> void:
		screen.queue_free()
		_overlay = null)
	add_child(screen)


func _center(text: String, size: int, y: float, color: Color) -> void:
	var l := BotStyle.label(text, size, color)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.position = Vector2(0, y)
	l.size = Vector2(1920, size * 1.4)
	add_child(l)


func _left(text: String, size: int, y: float, color: Color) -> void:
	var l := BotStyle.label(text, size, color)
	l.position = Vector2(LEFT_X, y)
	add_child(l)


func _button(text: String, y: float, action: Callable, size := Vector2(600, 95), font := 46, x := LEFT_X) -> void:
	var b := Button.new()
	b.text = text
	b.position = Vector2(x, y)
	b.size = size
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", font)
	b.pressed.connect(action)
	add_child(b)
	_buttons.append(text)
