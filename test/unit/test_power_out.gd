extends GutTest
## At 0%: doors open, lights and cameras die, the leader shows up at the left door, then attacks.

const H := preload("res://test/unit/sim_helpers.gd")


func _drained_sim() -> NightSim:
	var sim := H.make_sim()
	sim.set_door(Rooms.Side.LEFT, true)
	sim.set_door(Rooms.Side.RIGHT, true)
	sim.set_tablet(true)
	sim.power.units = 0.01
	sim.step(0.05)
	return sim


func test_power_out_starts_at_zero() -> void:
	var sim := _drained_sim()
	assert_eq(sim.state, NightSim.State.POWER_OUT)


func test_no_power_out_with_power_left() -> void:
	var sim := H.make_sim()
	sim.power.units = 5.0 # shows 0% but isn't empty yet
	sim.step(0.05)
	assert_eq(sim.state, NightSim.State.PLAYING)


func test_doors_open_and_everything_dies() -> void:
	var sim := _drained_sim()
	assert_false(sim.is_door_closed(Rooms.Side.LEFT))
	assert_false(sim.is_door_closed(Rooms.Side.RIGHT))
	assert_false(sim.tablet_up)
	assert_eq(sim.light_side, -1)
	assert_false(sim.set_door(Rooms.Side.LEFT, true), "door works without power")
	assert_false(sim.set_light(Rooms.Side.LEFT, true), "light works without power")
	assert_false(sim.set_tablet(true), "cameras work without power")
	assert_eq(sim.usage(), 0)


func test_leader_appears_at_left_door_after_delay() -> void:
	var sim := _drained_sim()
	H.run(sim, GameConfig.POWER_OUT_APPEAR_SECONDS - 0.5)
	assert_false(sim.leader_at_dark_door, "appeared too early")
	H.run(sim, 1.0)
	assert_true(sim.leader_at_dark_door)
	assert_eq(sim.leader.room, Rooms.LEFT_DOOR)


func test_leader_attacks_after_random_delay() -> void:
	var sim := _drained_sim()
	var attack_at := sim.power_out_attack_at
	assert_between(attack_at, GameConfig.POWER_OUT_APPEAR_SECONDS + GameConfig.POWER_OUT_ATTACK_MIN,
		GameConfig.POWER_OUT_APPEAR_SECONDS + GameConfig.POWER_OUT_ATTACK_MAX)
	H.run(sim, attack_at - 0.3)
	assert_eq(sim.state, NightSim.State.POWER_OUT, "attacked early")
	H.run(sim, 0.5)
	assert_eq(sim.state, NightSim.State.LOST)
	assert_eq(sim.killer, sim.leader)
	assert_string_contains(sim.death_cause, "power out")


func test_other_bots_freeze_in_the_dark() -> void:
	var sim := H.make_sim({"left_hall": 20, "right_hall": 20, "sprinter": 20})
	sim.power.units = 0.01
	sim.step(0.05)
	var rooms := [sim.left_bot.room, sim.right_bot.room, sim.sprinter.stage]
	H.run(sim, GameConfig.POWER_OUT_APPEAR_SECONDS + GameConfig.POWER_OUT_ATTACK_MIN - 0.5)
	assert_eq([sim.left_bot.room, sim.right_bot.room, sim.sprinter.stage], rooms)


func test_6_am_beats_the_power_out_attack() -> void:
	var sim := H.make_sim()
	sim.clock.elapsed = 539.0
	sim.power.units = 0.01
	sim.step(0.05)
	assert_eq(sim.state, NightSim.State.POWER_OUT)
	H.run(sim, 2.0)
	assert_eq(sim.state, NightSim.State.WON)
