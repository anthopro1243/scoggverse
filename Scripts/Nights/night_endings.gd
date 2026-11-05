extends CanvasLayer
## Full-screen cards over the night: the "12 AM / Night X" intro, the jumpscare (each bot's
## rendered frames), the game-over screen (Retry / Menu) and the 6 AM card with the Scogg Buck.

signal intro_done
signal next_pressed # Next Night (or Play again on Custom Night)
signal retry_pressed
signal menu_pressed

## Which card is showing: "", "intro", "silence" (the beat before a jumpscare), "jumpscare",
## "game_over" or "win".
var current: String = ""
## The last jumpscare's style ("rush" or "flat") and how many of its frames have shown (playtest).
var jumpscare_style: String = ""
var frames_shown: int = 0

var _root: Control


func _ready() -> void:
	layer = 20
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.gui_input.connect(func(event: InputEvent) -> void:
		if current == "intro" and event is InputEventMouseButton and event.pressed:
			end_intro())
	add_child(_root)


func _clear() -> void:
	for c in _root.get_children():
		c.queue_free()
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE


func show_intro(night_title: String) -> void:
	_clear()
	current = "intro"
	_root.mouse_filter = Control.MOUSE_FILTER_STOP # click to skip
	_root.add_child(BotStyle.rect(Rect2(0, 0, 1920, 1080), Color.BLACK))
	_add_center("12 AM", 170, 320)
	_add_center(night_title, 72, 560, Color(0.85, 0.85, 0.85))
	_add_center("click to start", 26, 980, Color(0.4, 0.4, 0.4))
	get_tree().create_timer(GameConfig.INTRO_CARD_SECONDS).timeout.connect(end_intro)


func end_intro() -> void:
	if current != "intro":
		return
	_clear()
	current = ""
	intro_done.emit()


func _unhandled_input(event: InputEvent) -> void:
	if current == "intro" and event is InputEventKey and event.pressed:
		end_intro()
		get_viewport().set_input_as_handled()


func show_jumpscare(bot: Bot, cause: String, time_text: String, night_title: String) -> void:
	_clear()
	current = "jumpscare"
	_root.add_child(BotStyle.rect(Rect2(0, 0, 1920, 1080), Color.BLACK))
	var art := BotStyle.art_of(bot)
	jumpscare_style = ArtLayout.JUMPSCARE_STYLE.get(art, "")
	var frames: Array[Texture2D] = []
	for i in ArtLayout.JUMPSCARE_FRAMES:
		var t := BotStyle.art("scares/jump_%s_%d" % [art, i])
		if t:
			frames.append(t)
	var holder := Control.new()
	holder.size = Vector2(1920, 1080)
	_root.add_child(holder)
	var image := TextureRect.new()
	image.size = Vector2(1920, 1080)
	image.stretch_mode = TextureRect.STRETCH_SCALE
	image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	holder.add_child(image)
	var flash := BotStyle.rect(Rect2(-60, -60, 2040, 1200), Color(0.82, 0.0, 0.0, 0.0))
	holder.add_child(flash)
	var reduce := Game.settings.reduce_flashing
	frames_shown = 0
	if frames.is_empty():
		image.texture = null
	else:
		# Play the frames fast, then hold the last one, shaking. Real time even in the sped-up
		# playtest (?speed=N), so recordings catch every frame.
		var step := 1.0 / GameConfig.JUMPSCARE_FPS
		for i in frames.size():
			get_tree().create_timer(i * step, true, false, true).timeout.connect(func() -> void:
				if current == "jumpscare":
					image.texture = frames[i]
					frames_shown = i + 1
					flash.color.a = 0.0 if reduce else 0.55 * GameConfig.JUMPSCARE_RED_FLASH.get(i, 0.0))
	var px := GameConfig.JUMPSCARE_SHAKE_PX if Game.settings.screen_shake else 0.0
	var shake := create_tween().set_ignore_time_scale().set_loops(int(GameConfig.JUMPSCARE_SECONDS / 0.05))
	shake.tween_callback(func() -> void: holder.position = Vector2(randf_range(-px, px), randf_range(-px, px))).set_delay(0.05)
	get_tree().create_timer(GameConfig.JUMPSCARE_SECONDS, true, false, true).timeout.connect(
		func() -> void:
			shake.kill()
			show_game_over(cause, time_text, night_title))


## The quiet beat before a jumpscare: nothing new on screen, input ignored.
func hold_for_jumpscare() -> void:
	current = "silence"


func show_game_over(cause: String, time_text: String, night_title: String) -> void:
	_clear()
	current = "game_over"
	_root.add_child(BotStyle.rect(Rect2(0, 0, 1920, 1080), Color(0.06, 0.0, 0.0)))
	_add_center("GAME OVER", 140, 300, Color(0.9, 0.15, 0.15))
	_add_center("%s  ·  %s got you at %s" % [night_title, cause, time_text], 44, 480)
	_add_buttons(620, [["Retry", retry_pressed], ["Menu", menu_pressed]])


## earned: {base, bonus, total, unlocked} from Progress.record_win.
func show_win(night_title: String, earned: Dictionary, bucks_total: int, next_label: String) -> void:
	_clear()
	current = "win"
	_root.add_child(BotStyle.rect(Rect2(0, 0, 1920, 1080), Color.BLACK))
	_add_center("6 AM", 200, 60)
	_add_center("%s complete" % night_title, 56, 300, Color(0.6, 1.0, 0.6))
	var bill := BotStyle.art("ui/bill")
	if bill:  # the Scogg Buck: p. 17's "In Scogg We Trust" $20
		var r := TextureRect.new()
		r.texture = bill
		r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		r.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		r.position = Vector2(760, 390)
		r.size = Vector2(400, 180)
		r.rotation_degrees = -4.0
		r.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_root.add_child(r)
	_add_center("+%d Scogg Bucks" % earned.total, 64, 570, Color(1, 0.85, 0.35))
	_add_center("%d for the night  +  %d power bonus   ·   Total: %d" % [earned.base, earned.bonus, bucks_total], 34, 660, Color(0.8, 0.8, 0.8))
	match earned.get("unlocked", ""):
		"night6": _add_center("Night 6 unlocked!", 44, 715, Color(1, 0.4, 0.4))
		"custom": _add_center("Custom Night unlocked!", 44, 715, Color(1, 0.4, 0.4))
	var buttons: Array = [["Menu", menu_pressed]]
	if next_label != "":
		buttons.push_front([next_label, next_pressed])
	_add_buttons(790, buttons)


func _add_center(text: String, size: int, y: float, color: Color = Color.WHITE) -> void:
	var l := BotStyle.label(text, size, color)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.position = Vector2(0, y)
	l.size = Vector2(1920, size * 1.4)
	_root.add_child(l)


## Buttons centered in a row; items are [label, signal].
func _add_buttons(y: float, items: Array) -> void:
	var w := 400.0
	var gap := 40.0
	var x := 960.0 - (items.size() * w + (items.size() - 1) * gap) / 2.0
	for item in items:
		var b := Button.new()
		b.text = item[0]
		b.position = Vector2(x, y)
		b.size = Vector2(w, 110)
		b.focus_mode = Control.FOCUS_NONE
		b.add_theme_font_size_override("font_size", 48)
		var sig: Signal = item[1]
		b.pressed.connect(func() -> void: sig.emit())
		_root.add_child(b)
		x += w + gap
