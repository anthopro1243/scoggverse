extends CanvasLayer
## Pause menu (Esc or the II button): resume, How to Play, restart, quit to title.
## Pausing stops the whole night with SceneTree.paused; this layer keeps running.

signal restart_pressed
signal title_pressed

const HowToPlay := preload("res://Scripts/UI/how_to_play.gd")
const SettingsMenu := preload("res://Scripts/UI/settings_menu.gd")

var _panel: Control
var _how: Control


func _ready() -> void:
	layer = 30
	process_mode = Node.PROCESS_MODE_ALWAYS
	_panel = Control.new()
	_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	_panel.visible = false
	add_child(_panel)
	_panel.add_child(BotStyle.rect(Rect2(0, 0, 1920, 1080), Color(0, 0, 0, 0.8)))
	var title := BotStyle.label("Paused", 110)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.position = Vector2(0, 170)
	title.size = Vector2(1920, 150)
	_panel.add_child(title)
	var y := 340.0
	for item in [["Resume", resume], ["How to Play", _show_how_to_play], ["Settings", _show_settings],
			["Restart night", func() -> void: _leave(restart_pressed)],
			["Quit to title", func() -> void: _leave(title_pressed)]]:
		var b := Button.new()
		b.text = item[0]
		b.position = Vector2(710, y)
		b.size = Vector2(500, 95)
		b.focus_mode = Control.FOCUS_NONE
		b.add_theme_font_size_override("font_size", 44)
		b.pressed.connect(item[1])
		_panel.add_child(b)
		y += 120.0


func is_open() -> bool:
	return _panel.visible


func is_showing_how_to_play() -> bool:
	return _how != null


func open() -> void:
	_panel.visible = true
	get_tree().paused = true


func resume() -> void:
	if _how:
		_how.queue_free()
		_how = null
	_panel.visible = false
	get_tree().paused = false


func _unhandled_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key and key.pressed and not key.echo and key.keycode == KEY_ESCAPE and is_open():
		if _how:
			_how.queue_free()
			_how = null
		else:
			resume()
		get_viewport().set_input_as_handled()


func _show_settings() -> void:
	_open_overlay(SettingsMenu.new())


func _show_how_to_play() -> void:
	_open_overlay(HowToPlay.new())


func _open_overlay(screen: Control) -> void:
	_how = screen
	_how.closed.connect(func() -> void:
		_how.queue_free()
		_how = null)
	add_child(_how)


func _leave(sig: Signal) -> void:
	get_tree().paused = false
	sig.emit()
