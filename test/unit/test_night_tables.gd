extends GutTest
## Per-night AI tables and Custom Night levels.

const IDS := ["leader", "left_hall", "right_hall", "sprinter"]


func test_every_night_1_to_6_has_a_full_table() -> void:
	for n in range(1, GameConfig.LAST_NIGHT + 1):
		var t := GameConfig.levels_for(n)
		for id in IDS:
			assert_true(t.has(id), "night %d missing %s" % [n, id])
			assert_between(int(t[id]), GameConfig.AI_LEVEL_MIN, GameConfig.AI_LEVEL_MAX)


func test_nights_get_harder() -> void:
	# The total starting AI never drops from one story night to the next (Night 6 is the hardest).
	var prev := -1
	for n in range(1, GameConfig.LAST_NIGHT + 1):
		var total := 0
		for v in GameConfig.levels_for(n).values():
			total += int(v)
		assert_gt(total, prev, "night %d isn't harder than night %d" % [n, n - 1])
		prev = total


func test_leader_stays_home_on_nights_1_and_2() -> void:
	# Like Freddy in FNAF 1.
	assert_eq(GameConfig.levels_for(1).leader, 0)
	assert_eq(GameConfig.levels_for(2).leader, 0)
	assert_gt(GameConfig.levels_for(3).leader, 0)


func test_sim_uses_the_nights_table() -> void:
	for n in [1, 4, 6]:
		var sim := NightSim.new(n)
		var t := GameConfig.levels_for(n)
		assert_eq(sim.leader.ai_level, t.leader)
		assert_eq(sim.left_bot.ai_level, t.left_hall)
		assert_eq(sim.right_bot.ai_level, t.right_hall)
		assert_eq(sim.sprinter.ai_level, t.sprinter)


func test_out_of_range_nights_clamp_to_the_table() -> void:
	assert_eq(GameConfig.levels_for(0), GameConfig.levels_for(1))
	assert_eq(GameConfig.levels_for(9), GameConfig.levels_for(6))


func test_custom_night_uses_the_sliders_not_a_table() -> void:
	var levels := {"leader": 20, "left_hall": 0, "right_hall": 7, "sprinter": 13}
	var sim := NightSim.new(GameConfig.CUSTOM_NIGHT, levels)
	assert_eq(sim.leader.ai_level, 20)
	assert_eq(sim.left_bot.ai_level, 0)
	assert_eq(sim.right_bot.ai_level, 7)
	assert_eq(sim.sprinter.ai_level, 13)


func test_custom_levels_clamp_to_0_20() -> void:
	var sim := NightSim.new(GameConfig.CUSTOM_NIGHT, {"leader": 99, "left_hall": -5, "right_hall": 0, "sprinter": 0})
	assert_eq(sim.leader.ai_level, 20)
	assert_eq(sim.left_bot.ai_level, 0)


func test_custom_night_has_night_5_plus_passive_drain() -> void:
	assert_eq(GameConfig.passive_drain_interval(GameConfig.CUSTOM_NIGHT), 3.0)
	assert_eq(GameConfig.passive_drain_interval(1), 0.0)


func test_night_titles() -> void:
	var game := load("res://Scripts/game_state.gd")
	assert_eq(game.night_title(3), "Night 3")
	assert_eq(game.night_title(GameConfig.CUSTOM_NIGHT), "Custom Night")
