extends GutTest
## Uncle Scogg: waits for both hall bots, and only moves while unwatched.

const H := preload("res://test/unit/sim_helpers.gd")


func _sim() -> NightSim:
	return H.make_sim({"leader": 20})


func test_stays_on_stage_while_a_hall_bot_is_there() -> void:
	var sim := _sim()
	for setup in [[Rooms.STAGE, Rooms.STAGE], [Rooms.CAFETERIA, Rooms.STAGE], [Rooms.STAGE, Rooms.LOUNGE]]:
		sim.left_bot.room = setup[0]
		sim.right_bot.room = setup[1]
		for i in 20:
			sim.leader.take_turn(sim)
		assert_eq(sim.leader.room, Rooms.STAGE, "left stage with bots at %s" % [setup])


func test_leaves_stage_once_both_hall_bots_have() -> void:
	var sim := _sim()
	sim.left_bot.room = Rooms.LIBRARY
	sim.right_bot.room = Rooms.LOUNGE
	sim.leader.take_turn(sim)
	assert_eq(sim.leader.room, Rooms.CAFETERIA)


func test_doesnt_move_while_its_camera_is_watched() -> void:
	var sim := _sim()
	sim.left_bot.room = Rooms.LIBRARY
	sim.right_bot.room = Rooms.LOUNGE
	sim.leader.room = Rooms.LOUNGE
	sim.set_tablet(true)
	sim.set_cam(Rooms.LOUNGE)
	for i in 20:
		sim.leader.take_turn(sim)
	assert_eq(sim.leader.room, Rooms.LOUNGE)


func test_moves_when_player_watches_another_camera() -> void:
	var sim := _sim()
	sim.left_bot.room = Rooms.LIBRARY
	sim.right_bot.room = Rooms.LOUNGE
	sim.leader.room = Rooms.LOUNGE
	sim.set_tablet(true)
	sim.set_cam(Rooms.CURTAIN)
	sim.leader.take_turn(sim)
	assert_eq(sim.leader.room, Rooms.RIGHT_HALL)


func test_follows_fixed_route_to_right_corner() -> void:
	var sim := _sim()
	sim.left_bot.room = Rooms.LIBRARY
	sim.right_bot.room = Rooms.LOUNGE
	var path: Array[int] = []
	for i in 4:
		sim.leader.take_turn(sim)
		path.append(sim.leader.room)
	assert_eq(path, [Rooms.CAFETERIA, Rooms.LOUNGE, Rooms.RIGHT_HALL, Rooms.RIGHT_CORNER] as Array[int])


func test_never_stands_in_the_doorway() -> void:
	var sim := _sim()
	sim.left_bot.room = Rooms.LIBRARY
	sim.right_bot.room = Rooms.LOUNGE
	sim.set_door(Rooms.Side.RIGHT, true)
	for i in 300:
		sim.leader.take_turn(sim)
		assert_ne(sim.leader.room, Rooms.RIGHT_DOOR)


func test_shut_right_door_sends_leader_back_from_corner() -> void:
	var sim := _sim()
	sim.leader.room = Rooms.RIGHT_CORNER
	sim.set_door(Rooms.Side.RIGHT, true)
	sim.set_tablet(true)
	sim.set_cam(Rooms.STAGE)
	sim.leader.take_turn(sim)
	assert_eq(sim.leader.room, Rooms.RIGHT_HALL)


func test_slips_in_while_player_is_on_another_camera() -> void:
	var sim := _sim()
	sim.leader.room = Rooms.RIGHT_CORNER
	sim.set_tablet(true)
	sim.set_cam(Rooms.CURTAIN)
	sim.leader.take_turn(sim)
	assert_eq(sim.leader.room, Rooms.INSIDE)
	sim.set_tablet(false)
	assert_eq(sim.death_cause, GameConfig.NAME_LEADER)


func test_waits_in_corner_while_tablet_is_down() -> void:
	var sim := _sim()
	sim.leader.room = Rooms.RIGHT_CORNER
	for i in 50:
		sim.leader.take_turn(sim)
	assert_eq(sim.leader.room, Rooms.RIGHT_CORNER)
	assert_eq(sim.state, NightSim.State.PLAYING)
