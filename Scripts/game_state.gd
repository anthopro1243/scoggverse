extends Node
## Autoload "Game": the saved progress, the player's settings, and which night to play next.
## Both are saved to user:// (the browser's IndexedDB on the web build).

const SAVE_PATH := "user://save.cfg"
const NIGHT_SCENE := "res://Scenes/Nights/nights.tscn"
const TITLE_SCENE := "res://Scenes/Title/title.tscn"

var progress := Progress.new()
var settings: Settings = Settings.load_from()
var pending_night: int = 1
var custom_levels: Dictionary = {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS # F works while paused too
	progress.load_from(SAVE_PATH)


## F toggles full screen anywhere. The web build starts windowed (so it sits in its page or an
## embed) and only goes full screen when asked; a key press is the gesture browsers require.
func _unhandled_key_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key and key.pressed and not key.echo and key.keycode == KEY_F:
		var full := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if full else DisplayServer.WINDOW_MODE_FULLSCREEN)


func save() -> void:
	progress.save(SAVE_PATH)


## Saves the settings and applies the volumes right away.
func save_settings() -> void:
	settings.save()
	Sound.apply(settings)


func play_night(p_night: int) -> void:
	pending_night = clampi(p_night, 1, GameConfig.LAST_NIGHT)
	custom_levels = {}
	get_tree().change_scene_to_file(NIGHT_SCENE)


func play_custom(levels: Dictionary) -> void:
	pending_night = GameConfig.CUSTOM_NIGHT
	custom_levels = levels.duplicate()
	get_tree().change_scene_to_file(NIGHT_SCENE)


func continue_game() -> void:
	play_night(progress.night)


func new_game() -> void:
	progress.new_game()
	save()
	play_night(1)


func to_title() -> void:
	get_tree().paused = false
	get_tree().change_scene_to_file(TITLE_SCENE)


## Called by the night when 6 AM arrives; returns the bucks earned and any unlock.
func record_win(p_night: int, power_percent: int) -> Dictionary:
	var earned := progress.record_win(p_night, power_percent, custom_levels)
	save()
	return earned


static func night_title(p_night: int) -> String:
	return "Custom Night" if p_night == GameConfig.CUSTOM_NIGHT else "Night %d" % p_night
