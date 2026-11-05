class_name Progress
extends RefCounted
## Saved progress: the night Continue starts, the best night reached, the Custom Night
## unlock and the Scogg Buck total. Also the Scogg Buck math for a 6 AM win.

const SECTION := "progress"
const BUCKS_KEY := "scogg_bucks"
## Saves from before the currency was renamed (2026-10-05) stored the total under this key.
const OLD_BUCKS_KEY := "scogg_books"

var night: int = 1 # where Continue starts (1-6)
var best_night: int = 1 # highest night reached
var custom_unlocked: bool = false
var scogg_bucks: int = 0


## Scogg Bucks for surviving a night: more for harder nights, plus a bonus for power left.
static func bucks_for(p_night: int, power_percent: int, custom_levels: Dictionary = {}) -> Dictionary:
	var base := 0
	if p_night == GameConfig.CUSTOM_NIGHT:
		for level in custom_levels.values():
			base += int(level) * GameConfig.CUSTOM_BUCKS_PER_LEVEL
	else:
		base = GameConfig.NIGHT_BUCKS.get(p_night, 0)
	var bonus := (clampi(power_percent, 0, 100) / 10) * GameConfig.BUCKS_PER_10_POWER
	return {"base": base, "bonus": bonus, "total": base + bonus}


## Records a 6 AM win and returns the bucks earned plus what it unlocked ("night6", "custom" or "").
func record_win(p_night: int, power_percent: int, custom_levels: Dictionary = {}) -> Dictionary:
	var earned := bucks_for(p_night, power_percent, custom_levels)
	scogg_bucks += earned.total
	var unlocked := ""
	if p_night >= 1 and p_night < GameConfig.LAST_NIGHT:
		var next := p_night + 1
		if next > best_night and next == GameConfig.LAST_NIGHT:
			unlocked = "night6"
		night = maxi(night, next)
		best_night = maxi(best_night, next)
	elif p_night == GameConfig.LAST_NIGHT and not custom_unlocked:
		custom_unlocked = true
		unlocked = "custom"
	earned["unlocked"] = unlocked
	return earned


## New Game starts again from Night 1; the best night, unlocks and bucks are kept.
func new_game() -> void:
	night = 1


func save(path: String) -> Error:
	var cfg := ConfigFile.new()
	cfg.set_value(SECTION, "night", night)
	cfg.set_value(SECTION, "best_night", best_night)
	cfg.set_value(SECTION, "custom_unlocked", custom_unlocked)
	cfg.set_value(SECTION, BUCKS_KEY, scogg_bucks)
	return cfg.save(path)


## Loads a save; a missing or broken file leaves the defaults. Values are clamped to sane ranges.
func load_from(path: String) -> bool:
	var cfg := ConfigFile.new()
	if cfg.load(path) != OK:
		return false
	night = clampi(int(cfg.get_value(SECTION, "night", 1)), 1, GameConfig.LAST_NIGHT)
	best_night = clampi(int(cfg.get_value(SECTION, "best_night", 1)), night, GameConfig.LAST_NIGHT)
	custom_unlocked = bool(cfg.get_value(SECTION, "custom_unlocked", false))
	# Fall back to the old key so a save from before the rename keeps its total.
	var bucks: Variant = cfg.get_value(SECTION, BUCKS_KEY, cfg.get_value(SECTION, OLD_BUCKS_KEY, 0))
	scogg_bucks = maxi(int(bucks), 0)
	return true


func to_dict() -> Dictionary:
	return {"night": night, "best_night": best_night, "custom_unlocked": custom_unlocked, "scogg_bucks": scogg_bucks}
