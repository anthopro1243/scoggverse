class_name SoundCheck
extends Control
## Sound check (from Settings): a button for every sound in the game, so it can be heard on its
## own. Each plays on the bus and at the level the game uses (so door sounds come from the left,
## far footsteps are muffled, the call has its phone-line EQ). Loops toggle on and off.
## Any Audio/*.ogg missing from SOUNDS still gets a button, under its file name.

signal closed

## [file, label, bus]. Grouped the way they turn up in a night.
const SOUNDS: Array[Array] = [
	["amb_office", "Office room tone", "Ambience"], ["fan", "Desk fan", "Ambience"],
	["amb_cams", "Camera room tone", "Ambience"], ["light_buzz", "Hall light buzz", "Left"],
	["door_close", "Door slam", "Left"], ["door_open", "Door open", "Left"],
	["light_on", "Light on", "Left"], ["light_off", "Light off", "Left"],
	["denied", "Jammed button", "Left"], ["tablet_up", "Tablet up", "Sfx"],
	["tablet_down", "Tablet down", "Sfx"], ["cam_switch", "Camera switch", "Sfx"],
	["cam_garble", "Feed garble", "Sfx"], ["steps_1", "Footsteps 1 (near)", "Left"],
	["steps_2", "Footsteps 2 (far)", "FarLeft"], ["scrape_1", "Cardboard scrape 1", "Right"],
	["scrape_2", "Cardboard scrape 2", "FarRight"], ["steps_heavy", "Uncle Scogg's steps", "Right"],
	["gallop", "Scoggis Khan's gallop", "Left"], ["door_bang", "Khan bangs on the door", "Left"],
	["scuttle", "Scoggipede", "FarLeft"], ["whisper", "Hallucination whisper", "Sfx"],
	["glitch", "Camera glitch", "Sfx"], ["sting_scoggema", "Absolute Scoggema sting", "Sfx"],
	["scream_scoggcrates", "Scream: Scoggcrates", "Sfx"], ["scream_scogga_lisa", "Scream: Scogga Lisa", "Sfx"],
	["scream_scoggis_khan", "Scream: Scoggis Khan", "Sfx"], ["scream_uncle_scogg", "Scream: Uncle Scogg", "Sfx"],
	["power_down", "Power out", "Sfx"], ["march", "Power-out march", "Music"],
	["phone_ring", "Phone ring", "Sfx"], ["phone_pickup", "Phone pickup", "Sfx"],
	["phone_line", "Phone line (call)", "Voice"], ["phone_hangup", "Phone hang-up", "Voice"],
	["chime_6am", "6 AM chime", "Music"], ["menu", "Menu music", "Music"],
	["ui_click", "Menu click", "Sfx"],
]
## Loop levels that don't live in SOUND_DB.
const LOOP_DB: Dictionary[String, float] = {
	"amb_office": GameConfig.AMB_OFFICE_DB, "fan": GameConfig.AMB_FAN_DB,
	"amb_cams": GameConfig.AMB_CAMS_DB, "menu": GameConfig.MENU_MUSIC_DB,
}
## Preloaded, not the autoload name, so tool scripts run with -s (no autoloads) can use this page.
const SoundScript := preload("res://Scripts/sound.gd")
const COLS := 4
const ORIGIN := Vector2(110, 170)
const CELL := Vector2(430, 76)
const BUTTON := Vector2(410, 64)

var _player: AudioStreamPlayer # one-shots (a new press cuts the last one)
var _loops: Dictionary[String, AudioStreamPlayer] = {}
var _buttons: Dictionary[String, Button] = {}
var _menu_was_on := false
var _sound: Node
## Sounds pressed, in order (for the playtest).
var played: Array[String] = []


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	process_mode = Node.PROCESS_MODE_ALWAYS # works from the pause menu too
	add_to_group("sound_check")
	_sound = get_node("/root/Sound")
	_menu_was_on = _sound.has_method("menu_music") and _sound.menu_music_playing()
	_menu(false)
	add_child(BotStyle.rect(Rect2(0, 0, 1920, 1080), Color(0.04, 0.04, 0.05)))
	var title := BotStyle.label("Sound test", 64)
	title.position = Vector2(ORIGIN.x, 50)
	add_child(title)
	var hint := BotStyle.label("Click one to hear it.", 24, Color(0.6, 0.6, 0.6))
	hint.position = Vector2(ORIGIN.x + 430, 82)
	add_child(hint)
	_player = AudioStreamPlayer.new()
	add_child(_player)
	var i := 0
	for item in all_sounds():
		var file: String = item[0]
		var b := Button.new()
		b.text = ("↻ " if is_loop(file) else "") + str(item[1])
		b.position = ORIGIN + Vector2(i % COLS * CELL.x, i / COLS * CELL.y)
		b.size = BUTTON
		b.focus_mode = Control.FOCUS_NONE
		b.toggle_mode = is_loop(file)
		b.add_theme_font_size_override("font_size", 26)
		b.pressed.connect(_press.bind(file, str(item[2])))
		add_child(b)
		_buttons[file] = b
		i += 1
	var stop := _button("Stop all", Vector2(1380, 950))
	stop.pressed.connect(stop_all)
	_button("Back", Vector2(1640, 950)).pressed.connect(func() -> void:
		stop_all()
		_menu(_menu_was_on)
		closed.emit())


func _menu(on: bool) -> void:
	if _sound.has_method("menu_music"): # the screenshot tool's stand-in has no script
		_sound.menu_music(on)


func _button(text: String, pos: Vector2) -> Button:
	var b := Button.new()
	b.text = text
	b.position = pos
	b.size = Vector2(220, 90)
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 36)
	add_child(b)
	return b


## SOUNDS plus any Audio/*.ogg it doesn't list.
static func all_sounds() -> Array[Array]:
	var out: Array[Array] = SOUNDS.duplicate()
	var listed := SOUNDS.map(func(s: Array) -> String: return s[0])
	for file in ResourceLoader.list_directory(SoundScript.DIR):
		if file.ends_with(".ogg") and not listed.has(file.get_basename()):
			out.append([file.get_basename(), file.get_basename(), "Sfx"])
	return out


static func is_loop(file: String) -> bool:
	return SoundScript.LOOPS.has(file)


## The level a sound plays at in the game.
static func level_db(file: String) -> float:
	if LOOP_DB.has(file):
		return LOOP_DB[file]
	if file.begins_with("scream_"):
		return GameConfig.SOUND_DB["scream"]
	if file.begins_with("steps_") or file.begins_with("scrape_"):
		return GameConfig.STEP_DB[Rooms.LEFT_CORNER]
	return GameConfig.SOUND_DB.get(file, -6.0)


func _press(file: String, bus: String) -> void:
	played.append(file)
	var stream: AudioStream = _sound.stream(file) if _sound.has_method("stream") else null
	if stream == null:
		return
	if is_loop(file):
		if _loops.has(file):
			_loops[file].queue_free()
			_loops.erase(file)
			return
		var p := AudioStreamPlayer.new()
		p.stream = stream
		p.bus = StringName(bus)
		p.volume_db = level_db(file)
		add_child(p)
		p.play()
		_loops[file] = p
	else:
		_player.stop()
		_player.stream = stream
		_player.bus = StringName(bus)
		_player.volume_db = level_db(file)
		_player.play()


func stop_all() -> void:
	_player.stop()
	for f in _loops:
		_loops[f].queue_free()
		_buttons[f].set_pressed_no_signal(false)
	_loops.clear()


## For the playtest: each button's rect in screen pixels, what's been pressed, loops playing.
func state() -> Dictionary:
	var rects := {}
	for f in _buttons:
		var r := _buttons[f].get_global_rect()
		rects[f] = [r.position.x, r.position.y, r.size.x, r.size.y]
	return {"rects": rects, "played": played, "loops": _loops.keys(), "one_shot": _player.playing}
