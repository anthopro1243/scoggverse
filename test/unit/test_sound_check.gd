extends GutTest
## The Sound check page lists every sound in the game, each on a real bus at its game level.

const BUSES: Array[String] = ["Sfx", "Music", "Ambience", "Left", "Right", "Far", "FarLeft", "FarRight", "Voice"]


func _files() -> Array[String]:
	var out: Array[String] = []
	for f in ResourceLoader.list_directory("res://Audio/"):
		if f.ends_with(".ogg"):
			out.append(f.get_basename())
	return out


func test_every_sound_file_has_a_button() -> void:
	var listed := SoundCheck.SOUNDS.map(func(s: Array) -> String: return s[0])
	assert_gt(_files().size(), 30)
	for f in _files():
		assert_true(listed.has(f), "%s is on the sound check page" % f)


func test_the_march_and_menu_loop_are_there() -> void:
	var listed := SoundCheck.SOUNDS.map(func(s: Array) -> String: return s[0])
	assert_true(listed.has("march"))
	assert_true(listed.has("menu"))


func test_no_button_for_a_missing_file() -> void:
	for s in SoundCheck.SOUNDS:
		assert_true(_files().has(s[0]), "%s.ogg exists" % s[0])


func test_each_sound_uses_a_real_bus_and_a_sane_level() -> void:
	for s in SoundCheck.SOUNDS:
		assert_true(BUSES.has(s[2]), "%s plays on bus %s" % [s[0], s[2]])
		var db := SoundCheck.level_db(s[0])
		assert_true(db <= 0.0 and db > -40.0, "%s level %.1f dB" % [s[0], db])


func test_screams_and_doors_play_at_their_game_levels() -> void:
	assert_eq(SoundCheck.level_db("scream_uncle_scogg"), GameConfig.SOUND_DB["scream"])
	assert_eq(SoundCheck.level_db("door_close"), GameConfig.SOUND_DB["door_close"])
	assert_eq(SoundCheck.level_db("menu"), GameConfig.MENU_MUSIC_DB)


func test_real_steps_get_their_lift_and_scrapes_do_not() -> void:
	var corner: float = GameConfig.STEP_DB[Rooms.LEFT_CORNER]
	assert_eq(SoundCheck.level_db("steps_1"), corner + GameConfig.STEP_FILE_DB["steps_1"])
	assert_eq(SoundCheck.level_db("scrape_1"), corner, "a scrape plays at its room level")
	for file in GameConfig.STEP_FILE_DB:
		assert_true(GameConfig.STEP_DB[Rooms.LEFT_DOOR] + GameConfig.STEP_FILE_DB[file] <= -1.0,
			"%s at a door stays under -1 dB" % file)
