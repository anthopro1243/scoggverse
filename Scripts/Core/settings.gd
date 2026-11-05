class_name Settings
extends RefCounted
## Player settings: volumes, screen shake and reduced flashing. Saved apart from progress
## (user://settings.cfg), so a New Game or a broken save never resets them.

const PATH := "user://settings.cfg"

var master: float = 1.0 # 0-1 for each volume slider
var music: float = 0.8
var sfx: float = 1.0
var screen_shake: bool = true
var reduce_flashing: bool = false


## Slider value (0-1) to bus volume in dB; 0 is silent.
static func to_db(value: float) -> float:
	return -80.0 if value <= 0.001 else linear_to_db(clampf(value, 0.0, 1.0))


func to_dict() -> Dictionary:
	return {"master": master, "music": music, "sfx": sfx, "screen_shake": screen_shake, "reduce_flashing": reduce_flashing}


static func from_dict(d: Dictionary) -> Settings:
	var s := Settings.new()
	s.master = clampf(float(d.get("master", s.master)), 0.0, 1.0)
	s.music = clampf(float(d.get("music", s.music)), 0.0, 1.0)
	s.sfx = clampf(float(d.get("sfx", s.sfx)), 0.0, 1.0)
	s.screen_shake = bool(d.get("screen_shake", s.screen_shake))
	s.reduce_flashing = bool(d.get("reduce_flashing", s.reduce_flashing))
	return s


func save(path: String = PATH) -> void:
	var cfg := ConfigFile.new()
	for k in to_dict():
		cfg.set_value("settings", k, to_dict()[k])
	cfg.save(path)


static func load_from(path: String = PATH) -> Settings:
	var cfg := ConfigFile.new()
	if cfg.load(path) != OK:
		return Settings.new()
	var d := {}
	for k in cfg.get_section_keys("settings") if cfg.has_section("settings") else []:
		d[k] = cfg.get_value("settings", k)
	return from_dict(d)
