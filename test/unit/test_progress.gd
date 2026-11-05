extends GutTest
## Unlocks, Continue night, saving/loading and Scogg Buck math.

const SAVE := "user://test_progress_save.cfg"

var _no_custom := {}


func after_each() -> void:
	if FileAccess.file_exists(SAVE):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SAVE))


# --- Scogg Bucks ---

func test_harder_nights_pay_more() -> void:
	var prev := 0
	for n in range(1, GameConfig.LAST_NIGHT + 1):
		var bucks: int = Progress.bucks_for(n, 0).base
		assert_gt(bucks, prev, "night %d pays no more than night %d" % [n, n - 1])
		prev = bucks


func test_power_bonus_per_full_10_percent() -> void:
	assert_eq(Progress.bucks_for(1, 0).bonus, 0)
	assert_eq(Progress.bucks_for(1, 9).bonus, 0, "bonus for less than 10%")
	assert_eq(Progress.bucks_for(1, 10).bonus, GameConfig.BUCKS_PER_10_POWER)
	assert_eq(Progress.bucks_for(1, 47).bonus, 4 * GameConfig.BUCKS_PER_10_POWER)
	assert_eq(Progress.bucks_for(1, 99).bonus, 9 * GameConfig.BUCKS_PER_10_POWER)


func test_no_bonus_from_bad_power_values() -> void:
	assert_eq(Progress.bucks_for(1, -40).bonus, 0)
	assert_eq(Progress.bucks_for(1, 500).bonus, 10 * GameConfig.BUCKS_PER_10_POWER)


func test_total_is_base_plus_bonus() -> void:
	var b := Progress.bucks_for(3, 35)
	assert_eq(b.total, GameConfig.NIGHT_BUCKS[3] + 3 * GameConfig.BUCKS_PER_10_POWER)


func test_custom_night_pays_per_level() -> void:
	var levels := {"leader": 20, "left_hall": 20, "right_hall": 20, "sprinter": 20}
	assert_eq(Progress.bucks_for(GameConfig.CUSTOM_NIGHT, 0, levels).base, 80 * GameConfig.CUSTOM_BUCKS_PER_LEVEL)
	assert_eq(Progress.bucks_for(GameConfig.CUSTOM_NIGHT, 0, {"leader": 0, "left_hall": 0, "right_hall": 0, "sprinter": 0}).base, 0)


func test_win_adds_bucks_to_total() -> void:
	var p := Progress.new()
	var earned := p.record_win(1, 45)
	assert_eq(p.scogg_bucks, earned.total)
	p.record_win(2, 0)
	assert_eq(p.scogg_bucks, earned.total + GameConfig.NIGHT_BUCKS[2])


func test_no_bucks_without_a_win() -> void:
	# Bucks only come from record_win; a fresh save has none and losing records nothing.
	assert_eq(Progress.new().scogg_bucks, 0)


# --- Unlocks and Continue ---

func test_winning_a_night_moves_continue_to_the_next() -> void:
	var p := Progress.new()
	p.record_win(1, 50)
	assert_eq(p.night, 2)
	assert_eq(p.best_night, 2)


func test_replaying_an_earlier_night_doesnt_move_continue_back() -> void:
	var p := Progress.new()
	for n in range(1, 5):
		p.record_win(n, 0)
	assert_eq(p.night, 5)
	p.record_win(2, 0)
	assert_eq(p.night, 5)


func test_beating_night_5_unlocks_night_6() -> void:
	var p := Progress.new()
	p.night = 5
	var earned := p.record_win(5, 0)
	assert_eq(earned.unlocked, "night6")
	assert_eq(p.night, 6)
	assert_false(p.custom_unlocked, "Custom Night unlocked by Night 5")


func test_beating_night_6_unlocks_custom_night() -> void:
	var p := Progress.new()
	p.night = 6
	p.best_night = 6
	var earned := p.record_win(6, 0)
	assert_eq(earned.unlocked, "custom")
	assert_true(p.custom_unlocked)
	assert_eq(p.night, 6, "Continue goes past Night 6")


func test_earlier_nights_dont_unlock_custom_night() -> void:
	var p := Progress.new()
	for n in range(1, 6):
		p.record_win(n, 100)
	assert_false(p.custom_unlocked)


func test_custom_night_win_unlocks_nothing_and_keeps_continue() -> void:
	var p := Progress.new()
	p.night = 3
	var earned := p.record_win(GameConfig.CUSTOM_NIGHT, 0, {"leader": 5, "left_hall": 5, "right_hall": 5, "sprinter": 5})
	assert_eq(earned.unlocked, "")
	assert_eq(p.night, 3)


func test_custom_unlock_reported_once() -> void:
	var p := Progress.new()
	p.night = 6
	p.record_win(6, 0)
	assert_eq(p.record_win(6, 0).unlocked, "")


func test_new_game_resets_continue_only() -> void:
	var p := Progress.new()
	p.night = 6
	p.best_night = 6
	p.custom_unlocked = true
	p.scogg_bucks = 300
	p.new_game()
	assert_eq(p.night, 1)
	assert_eq(p.best_night, 6)
	assert_true(p.custom_unlocked)
	assert_eq(p.scogg_bucks, 300)


# --- Saving and loading ---

func test_save_and_load_round_trip() -> void:
	var p := Progress.new()
	p.night = 4
	p.best_night = 5
	p.custom_unlocked = true
	p.scogg_bucks = 123
	assert_eq(p.save(SAVE), OK)
	var q := Progress.new()
	assert_true(q.load_from(SAVE))
	assert_eq(q.to_dict(), p.to_dict())


func test_missing_save_keeps_defaults() -> void:
	var q := Progress.new()
	assert_false(q.load_from("user://does_not_exist.cfg"))
	assert_eq(q.to_dict(), {"night": 1, "best_night": 1, "custom_unlocked": false, "scogg_bucks": 0})


func test_broken_save_keeps_defaults() -> void:
	var f := FileAccess.open(SAVE, FileAccess.WRITE)
	f.store_string("[progress]\nnight = )(\nscogg_bucks = 999\n")
	f.close()
	var q := Progress.new()
	assert_false(q.load_from(SAVE))
	assert_eq(q.night, 1)
	assert_eq(q.scogg_bucks, 0)
	assert_engine_error("ConfigFile parse error")


func test_old_save_key_still_loads() -> void:
	# A save from before the rename keeps its total, and the next save writes the new key.
	var cfg := ConfigFile.new()
	cfg.set_value("progress", "night", 3)
	cfg.set_value("progress", Progress.OLD_BUCKS_KEY, 145)
	cfg.save(SAVE)
	var q := Progress.new()
	assert_true(q.load_from(SAVE))
	assert_eq(q.scogg_bucks, 145)
	assert_eq(q.save(SAVE), OK)
	var saved := ConfigFile.new()
	saved.load(SAVE)
	assert_eq(saved.get_value("progress", Progress.BUCKS_KEY, -1), 145)
	assert_false(saved.has_section_key("progress", Progress.OLD_BUCKS_KEY), "the old key isn't written again")


func test_new_key_wins_over_old_key() -> void:
	# Must-not: a stale old key never overrides the current total.
	var cfg := ConfigFile.new()
	cfg.set_value("progress", Progress.BUCKS_KEY, 20)
	cfg.set_value("progress", Progress.OLD_BUCKS_KEY, 999)
	cfg.save(SAVE)
	var q := Progress.new()
	q.load_from(SAVE)
	assert_eq(q.scogg_bucks, 20)


func test_tampered_save_is_clamped() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("progress", "night", 42)
	cfg.set_value("progress", "best_night", -3)
	cfg.set_value("progress", "scogg_bucks", -100)
	cfg.save(SAVE)
	var q := Progress.new()
	q.load_from(SAVE)
	assert_eq(q.night, GameConfig.LAST_NIGHT)
	assert_eq(q.best_night, GameConfig.LAST_NIGHT, "best night below continue night")
	assert_eq(q.scogg_bucks, 0)
