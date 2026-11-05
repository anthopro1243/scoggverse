extends GutTest
## Scoggis Khan: curtain stages, camera slowdown, cooldown, run, and the left door.

const H := preload("res://test/unit/sim_helpers.gd")


func _sim() -> NightSim:
	return H.make_sim({"sprinter": 20})


func test_advances_through_stages_when_unwatched() -> void:
	var sim := _sim()
	for i in 3:
		sim.sprinter.take_turn(sim)
	assert_eq(sim.sprinter.stage, 3)
	assert_eq(sim.sprinter.room, Rooms.CURTAIN)


func test_no_progress_while_tablet_up() -> void:
	var sim := _sim()
	sim.set_tablet(true)
	sim.set_cam(Rooms.STAGE) # any camera, not just the curtain
	for i in 20:
		sim.sprinter.take_turn(sim)
	assert_eq(sim.sprinter.stage, 0)


func test_cooldown_after_lowering_tablet() -> void:
	var sim := _sim()
	sim.set_tablet(true)
	sim.set_tablet(false)
	assert_true(sim.sprinter.is_locked(sim))
	sim.sprinter.take_turn(sim)
	assert_eq(sim.sprinter.stage, 0, "moved during the cooldown")
	sim.time += GameConfig.SPRINTER_COOLDOWN_MAX + 0.01
	assert_false(sim.sprinter.is_locked(sim))
	sim.sprinter.take_turn(sim)
	assert_eq(sim.sprinter.stage, 1)


func test_cooldown_is_random_within_range() -> void:
	var sim := _sim()
	var seen := {}
	for i in 50:
		sim.set_tablet(true)
		sim.set_tablet(false)
		var lock: float = sim.sprinter._locked_until - sim.time
		assert_between(lock, GameConfig.SPRINTER_COOLDOWN_MIN, GameConfig.SPRINTER_COOLDOWN_MAX)
		seen[snappedf(lock, 0.1)] = true
	assert_gt(seen.size(), 10, "cooldown isn't random")


func test_runs_after_wait_when_unwatched() -> void:
	var sim := _sim()
	sim.sprinter.stage = 2
	sim.sprinter.take_turn(sim)
	sim.sprinter.tick(GameConfig.SPRINTER_RUN_WAIT - 0.5, sim)
	assert_false(sim.sprinter.running, "ran before the wait was over")
	sim.sprinter.tick(1.0, sim)
	assert_true(sim.sprinter.running)
	assert_eq(sim.sprinter.room, Rooms.LEFT_HALL)


func test_runs_at_once_when_watched_on_left_hall() -> void:
	var sim := _sim()
	sim.sprinter.stage = 2
	sim.sprinter.take_turn(sim)
	sim.set_tablet(true)
	sim.set_cam(Rooms.LEFT_HALL)
	sim.sprinter.tick(0.05, sim)
	assert_true(sim.sprinter.running)


func test_watching_other_cam_doesnt_start_run() -> void:
	var sim := _sim()
	sim.sprinter.stage = 3
	sim.sprinter._run_wait = GameConfig.SPRINTER_RUN_WAIT
	sim.set_tablet(true)
	sim.set_cam(Rooms.CURTAIN)
	sim.sprinter.tick(1.0, sim)
	assert_false(sim.sprinter.running)


func test_closed_door_blocks_and_costs_power() -> void:
	var sim := _sim()
	sim.set_door(Rooms.Side.LEFT, true)
	sim.sprinter.start_run()
	var before := sim.power.units
	watch_signals(sim)
	sim.sprinter.tick(GameConfig.SPRINTER_RUN_SECONDS + 0.01, sim)
	assert_eq(sim.state, NightSim.State.PLAYING)
	assert_almost_eq(sim.power.units, before - GameConfig.SPRINTER_DOOR_DRAIN_FIRST, 0.001)
	assert_has(GameConfig.SPRINTER_RESET_STAGES, sim.sprinter.stage)
	assert_eq(sim.sprinter.room, Rooms.CURTAIN)
	assert_signal_emitted(sim, "sprinter_blocked")
	# The second blocked run costs more.
	before = sim.power.units
	sim.sprinter.start_run()
	sim.sprinter.tick(GameConfig.SPRINTER_RUN_SECONDS + 0.01, sim)
	assert_almost_eq(sim.power.units, before - GameConfig.SPRINTER_DOOR_DRAIN_FIRST - GameConfig.SPRINTER_DOOR_DRAIN_STEP, 0.001)


func test_open_door_means_attack() -> void:
	var sim := _sim()
	sim.sprinter.start_run()
	sim.sprinter.tick(GameConfig.SPRINTER_RUN_SECONDS - 0.1, sim)
	assert_eq(sim.state, NightSim.State.PLAYING, "attacked before arriving")
	sim.sprinter.tick(0.2, sim)
	assert_eq(sim.state, NightSim.State.LOST)
	assert_eq(sim.death_cause, GameConfig.NAME_SPRINTER)


func test_right_door_doesnt_block_sprinter() -> void:
	var sim := _sim()
	sim.set_door(Rooms.Side.RIGHT, true)
	sim.sprinter.start_run()
	sim.sprinter.tick(GameConfig.SPRINTER_RUN_SECONDS + 0.01, sim)
	assert_eq(sim.state, NightSim.State.LOST)
