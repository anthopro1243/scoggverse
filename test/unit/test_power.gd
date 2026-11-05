extends GutTest
## Usage, drain, passive drain and the display.

const H := preload("res://test/unit/sim_helpers.gd")
const R := GameConfig.POWER_UNITS_PER_SECOND_PER_USAGE


func test_starts_at_999_units_shown_as_99() -> void:
	var p := PowerSystem.new()
	assert_eq(p.units, 999.0)
	assert_eq(p.percent(), 99)


func test_usage_adds_one_per_door_light_and_tablet() -> void:
	assert_eq(PowerSystem.usage(0, false, false), 1)
	assert_eq(PowerSystem.usage(1, false, false), 2)
	assert_eq(PowerSystem.usage(2, true, true), 5)


func test_sim_usage_tracks_controls() -> void:
	var sim := H.make_sim()
	assert_eq(sim.usage(), 1)
	sim.set_door(Rooms.Side.LEFT, true)
	sim.set_light(Rooms.Side.RIGHT, true)
	assert_eq(sim.usage(), 3)
	sim.set_tablet(true) # raising the tablet turns the light off
	assert_eq(sim.usage(), 3)
	sim.set_tablet(false)
	sim.set_door(Rooms.Side.LEFT, false)
	assert_eq(sim.usage(), 1)


func test_usage_1_drains_at_the_configured_rate() -> void:
	var p := PowerSystem.new()
	p.drain(10.0, 1, 1)
	assert_almost_eq(p.units, 999.0 - 10.0 * R, 0.01)


func test_usage_4_drains_four_times_as_fast() -> void:
	var p := PowerSystem.new()
	p.drain(10.0, 4, 1)
	assert_almost_eq(p.units, 999.0 - 40.0 * R, 0.01)


func test_no_passive_drain_on_night_1() -> void:
	var p := PowerSystem.new()
	p.drain(60.0, 1, 1)
	assert_almost_eq(p.units, 999.0 - 60.0 * R, 0.01)


func test_passive_drain_every_6_s_on_night_2() -> void:
	var p := PowerSystem.new()
	p.drain(5.9, 1, 2)
	assert_almost_eq(p.units, 999.0 - 5.9 * GameConfig.POWER_UNITS_PER_SECOND_PER_USAGE, 0.01, "passive drain before 6 s")
	p.drain(0.1, 1, 2)
	assert_almost_eq(p.units, 999.0 - 6.0 * R - 1.0, 0.01)


func test_passive_drain_every_3_s_on_night_5_and_later() -> void:
	for night in [5, 6]:
		var p := PowerSystem.new()
		p.drain(30.0, 1, night)
		assert_almost_eq(p.units, 999.0 - 30.0 * R - 10.0, 0.01, "night %d" % night)


func test_power_never_goes_negative() -> void:
	var p := PowerSystem.new()
	p.drain(10000.0, 5, 5)
	assert_eq(p.units, 0.0)
	assert_true(p.is_out())


func test_tablet_drains_power_in_sim() -> void:
	var down := H.make_sim()
	var up := H.make_sim()
	up.set_tablet(true)
	H.run(down, 20.0)
	H.run(up, 20.0)
	assert_almost_eq(down.power.units, 999.0 - 20.0 * GameConfig.POWER_UNITS_PER_SECOND_PER_USAGE, 0.1)
	assert_almost_eq(up.power.units, 999.0 - 40.0 * GameConfig.POWER_UNITS_PER_SECOND_PER_USAGE, 0.1)


func test_only_one_light_at_a_time() -> void:
	var sim := H.make_sim()
	sim.set_light(Rooms.Side.LEFT, true)
	sim.set_light(Rooms.Side.RIGHT, true)
	assert_eq(sim.light_side, Rooms.Side.RIGHT)
	assert_eq(sim.usage(), 2)


func test_light_cant_turn_on_with_tablet_up() -> void:
	var sim := H.make_sim()
	sim.set_tablet(true)
	assert_false(sim.set_light(Rooms.Side.LEFT, true))
	assert_eq(sim.light_side, -1)
