extends GutTest
## Movement roll and each bot's turn timer.

const H := preload("res://test/unit/sim_helpers.gd")


func test_ai_20_bot_moves_on_every_turn() -> void:
	var sim := H.make_sim({"left_hall": 20})
	sim.left_bot.take_turn(sim)
	assert_eq(sim.left_bot.room, Rooms.CAFETERIA)


func test_ai_0_bot_never_moves() -> void:
	var sim := H.make_sim()
	for i in 500:
		sim.left_bot.take_turn(sim)
		sim.right_bot.take_turn(sim)
	assert_eq(sim.left_bot.room, Rooms.STAGE)
	assert_eq(sim.right_bot.room, Rooms.STAGE)


func test_mid_level_moves_about_level_in_20() -> void:
	# AI 5 should pass about 25% of rolls; allow a wide margin.
	var sim := H.make_sim({"left_hall": 5})
	var passes := 0
	for i in 4000:
		if GameConfig.passes_roll(5, sim.rng.randi_range(1, 20)):
			passes += 1
	assert_between(passes, 850, 1150)


func _first_turn_at(bot: Bot, sim: NightSim, interval: float, before_room: int) -> void:
	bot.tick(interval - 0.01, sim)
	assert_eq(bot.room, before_room, "%s moved before %.2f s" % [bot.display_name, interval])
	bot.tick(0.02, sim)
	assert_ne(bot.room, before_room, "%s didn't move at %.2f s" % [bot.display_name, interval])


func test_left_hall_turn_every_4_97_s() -> void:
	var sim := H.make_sim({"left_hall": 20})
	_first_turn_at(sim.left_bot, sim, 4.97, Rooms.STAGE)


func test_right_hall_turn_every_4_98_s() -> void:
	var sim := H.make_sim({"right_hall": 20})
	_first_turn_at(sim.right_bot, sim, 4.98, Rooms.STAGE)


func test_leader_turn_every_3_02_s() -> void:
	var sim := H.make_sim({"leader": 20})
	sim.left_bot.room = Rooms.LIBRARY
	sim.right_bot.room = Rooms.LOUNGE
	_first_turn_at(sim.leader, sim, 3.02, Rooms.STAGE)


func test_sprinter_turn_every_5_01_s() -> void:
	var sim := H.make_sim({"sprinter": 20})
	sim.sprinter.tick(5.0, sim)
	assert_eq(sim.sprinter.stage, 0)
	sim.sprinter.tick(0.02, sim)
	assert_eq(sim.sprinter.stage, 1)


func test_two_turns_in_two_intervals() -> void:
	var sim := H.make_sim({"left_hall": 20})
	sim.left_bot.tick(4.97 * 2 + 0.01, sim)
	assert_ne(sim.left_bot.room, Rooms.STAGE)
	assert_ne(sim.left_bot.room, Rooms.CAFETERIA, "second turn should leave the cafeteria")
