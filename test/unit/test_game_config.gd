extends GutTest
## The spec numbers and the FNAF movement roll.


func test_bot_timers_match_fnaf1() -> void:
	assert_eq(GameConfig.TIMER_LEADER, 3.02)
	assert_eq(GameConfig.TIMER_LEFT_HALL, 4.97)
	assert_eq(GameConfig.TIMER_RIGHT_HALL, 4.98)
	assert_eq(GameConfig.TIMER_SPRINTER, 5.01)


func test_night_is_six_hours_of_90_seconds() -> void:
	var hours := GameConfig.NIGHT_END_HOUR - GameConfig.NIGHT_START_HOUR
	assert_eq(hours * GameConfig.SECONDS_PER_HOUR, 540.0)


func test_roll_rule_boundaries() -> void:
	# AI 0 never moves, AI 20 always moves, otherwise roll <= level.
	for roll in range(GameConfig.ROLL_MIN, GameConfig.ROLL_MAX + 1):
		assert_false(GameConfig.passes_roll(0, roll), "AI 0 moved on roll %d" % roll)
		assert_true(GameConfig.passes_roll(20, roll), "AI 20 stayed on roll %d" % roll)
	assert_true(GameConfig.passes_roll(7, 7))
	assert_false(GameConfig.passes_roll(7, 8))


func test_passive_drain_by_night() -> void:
	assert_eq(GameConfig.passive_drain_interval(1), 0.0)
	assert_eq(GameConfig.passive_drain_interval(2), 6.0)
	assert_eq(GameConfig.passive_drain_interval(3), 5.0)
	assert_eq(GameConfig.passive_drain_interval(4), 4.0)
	assert_eq(GameConfig.passive_drain_interval(5), 3.0)
	assert_eq(GameConfig.passive_drain_interval(6), 3.0)
