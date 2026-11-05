extends GutTest
## 12 AM to 6 AM at 90 s per hour, and the AI ramps.

const H := preload("res://test/unit/sim_helpers.gd")


func test_clock_changes_hour_every_90_s() -> void:
	var clock := NightClock.new()
	clock.advance(89.9)
	assert_eq(clock.display_text(), "12 AM")
	assert_eq(clock.advance(0.2), [1] as Array[int])
	assert_eq(clock.display_text(), "1 AM")
	clock.advance(90.0 * 4)
	assert_eq(clock.display_text(), "5 AM")


func test_night_won_at_6_am() -> void:
	var sim := H.freeze_bots(H.make_sim())
	H.run(sim, 539.0, 0.5)
	assert_eq(sim.state, NightSim.State.PLAYING, "won before 6 AM")
	H.run(sim, 1.5, 0.5)
	assert_eq(sim.state, NightSim.State.WON)
	assert_eq(sim.clock.display_text(), "6 AM")


func test_won_night_stops_simulating() -> void:
	var sim := H.freeze_bots(H.make_sim())
	H.run(sim, 541.0, 0.5)
	var power_at_win := sim.power.units
	sim.step(10.0)
	sim.attack(sim.left_bot)
	assert_eq(sim.state, NightSim.State.WON)
	assert_eq(sim.power.units, power_at_win)


func test_left_hall_ramps_at_2_3_4_am() -> void:
	var sim := H.freeze_bots(H.make_sim())
	H.run(sim, 179.0, 0.5)
	assert_eq(sim.left_bot.ai_level, 0, "ramped before 2 AM")
	H.run(sim, 1.5, 0.5)
	assert_eq(sim.left_bot.ai_level, 1)
	H.run(sim, 90.0, 0.5)
	assert_eq(sim.left_bot.ai_level, 2)
	H.run(sim, 90.0, 0.5)
	assert_eq(sim.left_bot.ai_level, 3)
	H.run(sim, 89.0, 0.5)
	assert_eq(sim.left_bot.ai_level, 3, "ramped at 5 AM")


func test_right_hall_and_sprinter_ramp_at_3_and_4_am_only() -> void:
	var sim := H.freeze_bots(H.make_sim())
	H.run(sim, 181.0, 0.5)
	assert_eq(sim.right_bot.ai_level, 0, "right hall ramped at 2 AM")
	assert_eq(sim.sprinter.ai_level, 0, "sprinter ramped at 2 AM")
	H.run(sim, 90.0, 0.5)
	assert_eq(sim.right_bot.ai_level, 1)
	assert_eq(sim.sprinter.ai_level, 1)
	H.run(sim, 90.0, 0.5)
	assert_eq(sim.right_bot.ai_level, 2)
	assert_eq(sim.sprinter.ai_level, 2)


func test_leader_never_ramps() -> void:
	var sim := H.freeze_bots(H.make_sim())
	H.run(sim, 535.0, 0.5)
	assert_eq(sim.leader.ai_level, 0)


func test_ramp_caps_at_20() -> void:
	var sim := H.make_sim({"left_hall": 20})
	sim.left_bot.raise_level()
	assert_eq(sim.left_bot.ai_level, 20)
