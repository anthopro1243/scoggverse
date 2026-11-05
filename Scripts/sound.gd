extends Node
## Sound autoload: keeps every sound loaded (they're small OGGs), applies the volume settings,
## and plays the title-screen music across the menu screens.
##
## Buses (res://default_bus_layout.tres): Master > Music, Sfx. Under Sfx: Ambience, Left / Right
## (panned to a door), Far / FarLeft / FarRight (muffled: things far down the halls), and Voice
## (phone-line EQ, for the nightly call). The bus effects work on desktop; the web build plays
## sounds as Web Audio samples, which honor the buses' volumes but skip their effects.
##
## Never add buses at runtime (AudioServer.add_bus): in Godot 4.6's web sample playback that
## scrambles the browser's copy of the bus list and cuts Master off the speakers, so the web
## build goes silent. Loading the layout file builds the browser's buses correctly.

const DIR := "res://Audio/"
const LOOPS: Array[String] = ["amb_office", "amb_cams", "fan", "light_buzz", "gallop", "march", "menu", "phone_line"]

var _streams: Dictionary[String, AudioStream] = {}
var _menu: AudioStreamPlayer
var _ui: AudioStreamPlayer


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	if AudioServer.get_bus_index(&"Sfx") == -1:
		push_error("Audio buses missing: res://default_bus_layout.tres didn't load")
	for file in ResourceLoader.list_directory(DIR):
		if file.ends_with(".ogg"):
			var s := load(DIR + file) as AudioStream
			if s is AudioStreamOggVorbis:
				(s as AudioStreamOggVorbis).loop = LOOPS.has(file.get_basename())
			_streams[file.get_basename()] = s
	_menu = AudioStreamPlayer.new()
	_menu.bus = &"Music"
	_menu.stream = stream("menu")
	_menu.volume_db = GameConfig.MENU_MUSIC_DB
	add_child(_menu)
	_ui = AudioStreamPlayer.new()
	_ui.bus = &"Sfx"
	_ui.stream = stream("ui_click")
	_ui.volume_db = GameConfig.SOUND_DB.get("ui_click", -12.0)
	add_child(_ui)
	apply(Game.settings)


## A loaded sound by name (Audio/<name>.ogg), or null.
func stream(sound: String) -> AudioStream:
	return _streams.get(sound)


func has_sound(sound: String) -> bool:
	return _streams.has(sound)


## Applies the volume sliders to the buses.
func apply(s: Settings) -> void:
	AudioServer.set_bus_volume_db(0, Settings.to_db(s.master))
	AudioServer.set_bus_volume_db(AudioServer.get_bus_index(&"Music"), Settings.to_db(s.music))
	AudioServer.set_bus_volume_db(AudioServer.get_bus_index(&"Sfx"), Settings.to_db(s.sfx))


## The title-screen loop: on for the menus, off once a night starts.
func menu_music(on: bool) -> void:
	if on and not _menu.playing and _menu.stream:
		_menu.play()
	elif not on and _menu.playing:
		_menu.stop()


func menu_music_playing() -> bool:
	return _menu.playing


func ui_click() -> void:
	if _ui.stream:
		_ui.play()

