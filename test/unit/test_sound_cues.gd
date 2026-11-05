extends GutTest
## SoundCues: which sounds a night's changes trigger, and the sound math (step volume, buses,
## the march slowing down, the silence before a jumpscare, the gallop swell).

const H := preload("res://test/unit/sim_helpers.gd")
const L := Rooms.Side.LEFT
const R := Rooms.Side.RIGHT


func _primed(sim: NightSim) -> SoundCues:
	var c := SoundCues.new()
	assert_eq(c.step(sim), [], "first step only remembers the state")
	return c


func _names(cues: Array[Dictionary]) -> Array:
	return cues.map(func(c: Dictionary) -> String: return c["sound"])


func test_door_slam_plays_on_its_side() -> void:
	var sim := H.make_sim()
	var c := _primed(sim)
	sim.set_door(L, true)
	assert_eq(c.step(sim), [{"sound": "door_close", "bus": "Left"}])
	sim.set_door(L, false)
	assert_eq(c.step(sim), [{"sound": "door_open", "bus": "Left"}])
	sim.set_door(R, true)
	assert_eq(c.step(sim), [{"sound": "door_close", "bus": "Right"}])


func test_nothing_plays_when_nothing_changes() -> void:
	var sim := H.make_sim()
	var c := _primed(sim)
	sim.set_door(L, true)
	c.step(sim)
	assert_eq(c.step(sim), [], "a shut door doesn't slam again")
	assert_eq(c.step(sim), [])


func test_lights_switch_with_off_then_on() -> void:
	var sim := H.make_sim()
	var c := _primed(sim)
	sim.set_light(L, true)
	assert_eq(c.step(sim), [{"sound": "light_on", "bus": "Left"}])
	sim.set_light(R, true) # only one light at a time
	assert_eq(c.step(sim), [{"sound": "light_off", "bus": "Left"}, {"sound": "light_on", "bus": "Right"}])


func test_cam_switch_only_while_the_tablet_is_up() -> void:
	var sim := H.make_sim()
	var c := _primed(sim)
	sim.cam = Rooms.CAFETERIA
	assert_false(_names(c.step(sim)).has("cam_switch"), "tablet down: no camera click")
	sim.set_tablet(true)
	c.step(sim)
	sim.set_cam(Rooms.LIBRARY)
	assert_eq(_names(c.step(sim)), ["cam_switch"])


func test_bot_move_plays_a_step_louder_near_the_door() -> void:
	var sim := H.make_sim()
	var c := _primed(sim)
	sim.left_bot.room = Rooms.LEFT_CORNER
	var cues := c.step(sim)
	assert_eq(cues.size(), 1)
	assert_eq(cues[0]["sound"], "step")
	assert_eq(cues[0]["bot"], sim.left_bot.id)
	assert_eq(cues[0]["bus"], "Left")
	assert_eq(cues[0]["db"], GameConfig.STEP_DB[Rooms.LEFT_CORNER])
	assert_gt(SoundCues.step_db(Rooms.LEFT_DOOR), SoundCues.step_db(Rooms.LEFT_HALL))
	assert_gt(SoundCues.step_db(Rooms.LEFT_HALL), SoundCues.step_db(Rooms.CAFETERIA))


func test_no_step_for_getting_in_or_standing_still() -> void:
	var sim := H.make_sim()
	var c := _primed(sim)
	sim.left_bot.room = Rooms.INSIDE
	assert_eq(c.step(sim), [], "getting in is silent (the hum fades instead)")


func test_watched_room_change_garbles_the_feed() -> void:
	var sim := H.make_sim()
	sim.set_tablet(true)
	sim.set_cam(Rooms.LIBRARY)
	var c := _primed(sim)
	sim.left_bot.room = Rooms.LIBRARY
	assert_true(_names(c.step(sim)).has("cam_garble"))
	sim.right_bot.room = Rooms.LOUNGE
	assert_false(_names(c.step(sim)).has("cam_garble"), "a move elsewhere doesn't garble the feed")


func test_rooms_pan_to_their_side_and_muffle_when_far() -> void:
	assert_eq(SoundCues.room_bus(Rooms.LEFT_DOOR), "Left")
	assert_eq(SoundCues.room_bus(Rooms.LEFT_HALL), "FarLeft")
	assert_eq(SoundCues.room_bus(Rooms.RIGHT_CORNER), "Right")
	assert_eq(SoundCues.room_bus(Rooms.RIGHT_HALL), "FarRight")
	assert_eq(SoundCues.room_bus(Rooms.STAGE), "Far")


func test_gallop_starts_and_stops_with_the_run() -> void:
	var sim := H.make_sim()
	var c := _primed(sim)
	sim.sprinter.start_run()
	assert_eq(_names(c.step(sim)), ["gallop_start"])
	assert_eq(_names(c.step(sim)), [], "no restart while running")
	sim.sprinter.running = false
	assert_eq(_names(c.step(sim)), ["gallop_stop"])


func test_gallop_swells_toward_the_door() -> void:
	assert_eq(SoundCues.gallop_db(0.0), GameConfig.GALLOP_START_DB)
	assert_eq(SoundCues.gallop_db(1.0), GameConfig.SOUND_DB["gallop"])
	assert_eq(SoundCues.gallop_db(5.0), GameConfig.SOUND_DB["gallop"], "clamped past the door")


func test_power_out_then_march_in_order() -> void:
	var sim := H.freeze_bots(H.make_sim())
	var c := _primed(sim)
	sim.power.units = 0.0
	sim.step(0.05)
	assert_eq(sim.state, NightSim.State.POWER_OUT)
	assert_eq(_names(c.step(sim)), ["power_down"], "the power dies before the march")
	H.run(sim, GameConfig.POWER_OUT_APPEAR_SECONDS - 0.5)
	assert_false(_names(c.step(sim)).has("march_start"), "no march before he reaches the door")
	H.run(sim, 0.6)
	assert_eq(_names(c.step(sim)), ["march_start"])
	assert_eq(_names(c.step(sim)), [], "the march starts once")


func test_no_door_or_light_sounds_after_power_out() -> void:
	var sim := H.freeze_bots(H.make_sim())
	sim.set_door(L, true)
	sim.set_light(R, true)
	var c := _primed(sim)
	sim.power.units = 0.0
	sim.step(0.05)
	assert_eq(_names(c.step(sim)), ["power_down"], "doors swinging open in the dark don't clank")


func test_march_sags_only_at_the_end() -> void:
	assert_eq(SoundCues.march_pitch(10.0), 1.0)
	assert_eq(SoundCues.march_pitch(GameConfig.MARCH_SLOW_SECONDS), 1.0)
	assert_almost_eq(SoundCues.march_pitch(0.0), GameConfig.MARCH_MIN_PITCH, 0.0001)
	assert_lt(SoundCues.march_pitch(1.0), SoundCues.march_pitch(2.0))


func test_silence_before_a_jumpscare() -> void:
	assert_eq(SoundCues.silence_delay(0.0), GameConfig.JUMPSCARE_SILENCE_SECONDS)
	assert_almost_eq(SoundCues.silence_delay(0.4), GameConfig.JUMPSCARE_SILENCE_SECONDS - 0.4, 0.0001)
	assert_eq(SoundCues.silence_delay(30.0), 0.0, "already silent long enough: no extra wait")
