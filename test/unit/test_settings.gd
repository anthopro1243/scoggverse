extends GutTest
## Settings: defaults, clamping broken values, saving and loading, volume math, and the
## reduce-flashing envelope for scare flashes.

const PATH := "user://test_settings.cfg"


func after_each() -> void:
	DirAccess.remove_absolute(ProjectSettings.globalize_path(PATH))


func test_defaults() -> void:
	var s := Settings.new()
	assert_eq(s.master, 1.0)
	assert_true(s.screen_shake)
	assert_false(s.reduce_flashing, "flashing is on unless the player turns it off")


func test_round_trip_through_a_file() -> void:
	var s := Settings.new()
	s.master = 0.3
	s.music = 0.0
	s.sfx = 0.75
	s.screen_shake = false
	s.reduce_flashing = true
	s.save(PATH)
	assert_eq(Settings.load_from(PATH).to_dict(), s.to_dict())


func test_missing_file_gives_defaults() -> void:
	assert_eq(Settings.load_from("user://does_not_exist.cfg").to_dict(), Settings.new().to_dict())


func test_broken_values_get_clamped() -> void:
	var s := Settings.from_dict({"master": 7.0, "music": -2.0, "sfx": "0.5"})
	assert_eq(s.master, 1.0)
	assert_eq(s.music, 0.0)
	assert_eq(s.sfx, 0.5)
	assert_true(s.screen_shake, "missing keys keep their defaults")


func test_volume_to_db() -> void:
	assert_eq(Settings.to_db(0.0), -80.0, "zero is silent")
	assert_almost_eq(Settings.to_db(1.0), 0.0, 0.001)
	assert_lt(Settings.to_db(0.5), 0.0)
	assert_almost_eq(Settings.to_db(3.0), 0.0, 0.001, "clamped to full")


func test_flashes_unchanged_without_reduce_flashing() -> void:
	assert_eq(ScareFx.duration(0.12, false), 0.12)
	assert_eq(ScareFx.envelope(0.06, 0.12, false), 1.0)


func test_reduced_flashes_fade_in_and_out_softly() -> void:
	var fade := GameConfig.REDUCED_FLASH_FADE_SECONDS
	var total := ScareFx.duration(0.12, true)
	assert_almost_eq(total, 0.12 + 2.0 * fade, 0.0001)
	assert_almost_eq(ScareFx.envelope(total, 0.12, true), 0.0, 0.0001, "starts invisible")
	assert_almost_eq(ScareFx.envelope(total - fade * 0.5, 0.12, true), GameConfig.REDUCED_FLASH_ALPHA * 0.5, 0.0001)
	assert_almost_eq(ScareFx.envelope(total * 0.5, 0.12, true), GameConfig.REDUCED_FLASH_ALPHA, 0.0001, "held at the reduced alpha")
	assert_almost_eq(ScareFx.envelope(0.0, 0.12, true), 0.0, 0.0001, "ends invisible")
	for i in 21:
		assert_true(ScareFx.envelope(total * i / 20.0, 0.12, true) <= GameConfig.REDUCED_FLASH_ALPHA + 0.0001, "never above the cap")
