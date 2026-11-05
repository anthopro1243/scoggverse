extends GutTest
## Hall bots walk to their door; a closed door sends them back, an open one lets them in.

const H := preload("res://test/unit/sim_helpers.gd")


func test_left_bot_only_walks_left_route() -> void:
	var sim := H.make_sim({"left_hall": 20})
	var allowed := [Rooms.STAGE, Rooms.CAFETERIA, Rooms.LIBRARY, Rooms.LEFT_HALL, Rooms.LEFT_CORNER, Rooms.LEFT_DOOR, Rooms.INSIDE]
	sim.set_door(Rooms.Side.LEFT, true)
	for i in 300:
		sim.left_bot.take_turn(sim)
		assert_has(allowed, sim.left_bot.room)


func test_right_bot_only_walks_right_route() -> void:
	var sim := H.make_sim({"right_hall": 20})
	var allowed := [Rooms.STAGE, Rooms.CAFETERIA, Rooms.LOUNGE, Rooms.RIGHT_HALL, Rooms.RIGHT_CORNER, Rooms.RIGHT_DOOR, Rooms.INSIDE]
	sim.set_door(Rooms.Side.RIGHT, true)
	for i in 300:
		sim.right_bot.take_turn(sim)
		assert_has(allowed, sim.right_bot.room)


func test_hall_bot_reaches_its_door() -> void:
	var sim := H.make_sim({"left_hall": 20})
	sim.set_door(Rooms.Side.LEFT, true)
	var reached := false
	for i in 300:
		sim.left_bot.take_turn(sim)
		if sim.left_bot.room == Rooms.LEFT_DOOR:
			reached = true
			break
	assert_true(reached)


func test_closed_door_sends_bot_back() -> void:
	for side in [Rooms.Side.LEFT, Rooms.Side.RIGHT]:
		var sim := H.make_sim({"left_hall": 20, "right_hall": 20})
		var bot: HallBot = sim.left_bot if side == Rooms.Side.LEFT else sim.right_bot
		bot.room = Rooms.door_of(side)
		sim.set_door(side, true)
		bot.take_turn(sim)
		assert_eq(bot.room, Rooms.CAFETERIA)
		assert_true(sim.inside.is_empty(), "got in through a closed door")


func test_open_door_lets_bot_in() -> void:
	for side in [Rooms.Side.LEFT, Rooms.Side.RIGHT]:
		var sim := H.make_sim({"left_hall": 20, "right_hall": 20})
		var bot: HallBot = sim.left_bot if side == Rooms.Side.LEFT else sim.right_bot
		bot.room = Rooms.door_of(side)
		bot.take_turn(sim)
		assert_eq(bot.room, Rooms.INSIDE)
		assert_eq(sim.state, NightSim.State.PLAYING, "attacked before the tablet came down")


func test_bot_at_door_with_failed_roll_stays_put() -> void:
	var sim := H.make_sim()
	sim.left_bot.room = Rooms.LEFT_DOOR
	sim.left_bot.take_turn(sim)
	assert_eq(sim.left_bot.room, Rooms.LEFT_DOOR)


func test_bot_inside_attacks_when_tablet_lowered() -> void:
	var sim := H.make_sim({"left_hall": 20})
	sim.set_tablet(true)
	sim.left_bot.room = Rooms.LEFT_DOOR
	sim.left_bot.take_turn(sim)
	H.run(sim, 10.0)
	assert_eq(sim.state, NightSim.State.PLAYING, "attacked while the tablet was still up")
	sim.set_tablet(false)
	assert_eq(sim.state, NightSim.State.LOST)
	assert_eq(sim.death_cause, GameConfig.NAME_LEFT_HALL)


func test_bot_inside_attacks_anyway_if_tablet_never_raised() -> void:
	var sim := H.make_sim({"right_hall": 20})
	sim.right_bot.room = Rooms.RIGHT_DOOR
	sim.right_bot.take_turn(sim)
	H.run(sim, GameConfig.INSIDE_FORCE_ATTACK_SECONDS - 1.0)
	assert_eq(sim.state, NightSim.State.PLAYING)
	H.run(sim, 1.5)
	assert_eq(sim.state, NightSim.State.LOST)
	assert_eq(sim.death_cause, GameConfig.NAME_RIGHT_HALL)


func test_bot_inside_jams_its_side_only() -> void:
	var sim := H.make_sim({"left_hall": 20})
	sim.left_bot.room = Rooms.LEFT_DOOR
	sim.left_bot.take_turn(sim)
	assert_false(sim.set_door(Rooms.Side.LEFT, true), "left door still works")
	assert_false(sim.set_light(Rooms.Side.LEFT, true), "left light still works")
	assert_true(sim.set_door(Rooms.Side.RIGHT, true), "right door jammed too")
	assert_true(sim.set_light(Rooms.Side.RIGHT, true), "right light jammed too")


func test_light_shows_bot_at_door() -> void:
	var sim := H.make_sim()
	sim.right_bot.room = Rooms.RIGHT_DOOR
	assert_eq(sim.bots_at_door(Rooms.Side.RIGHT), [sim.right_bot] as Array[Bot])
	assert_true(sim.bots_at_door(Rooms.Side.LEFT).is_empty())


func test_doors_toggle() -> void:
	var sim := H.make_sim()
	assert_false(sim.is_door_closed(Rooms.Side.LEFT))
	sim.toggle_door(Rooms.Side.LEFT)
	assert_true(sim.is_door_closed(Rooms.Side.LEFT))
	assert_false(sim.is_door_closed(Rooms.Side.RIGHT))
	sim.toggle_door(Rooms.Side.LEFT)
	assert_false(sim.is_door_closed(Rooms.Side.LEFT))


func test_doors_dont_work_with_tablet_up() -> void:
	var sim := H.make_sim()
	sim.set_tablet(true)
	assert_false(sim.set_door(Rooms.Side.LEFT, true))
	assert_false(sim.is_door_closed(Rooms.Side.LEFT))
	sim.set_tablet(false)
	assert_true(sim.set_door(Rooms.Side.LEFT, true))
	assert_true(sim.is_door_closed(Rooms.Side.LEFT))
