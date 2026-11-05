extends GutTest
## The cosmetic scares: hallucination flashes, camera glitches, the Scoggipede and the rare scare.

const PLAYING := NightSim.State.PLAYING
const DT := 0.05


func _sure(e: ScareEvents) -> ScareEvents:
	# Chance 20/s with dt 0.05 makes every roll succeed.
	e.hallucination_chance = 0.0
	e.glitch_chance = 0.0
	e.scoggipede_chance = 0.0
	e.rare_scare_chance = 0.0
	return e


func test_hallucination_happens_when_rolled() -> void:
	var e := _sure(ScareEvents.new(1))
	e.hallucination_chance = 20.0
	assert_eq(e.step(DT, 0.0, PLAYING, false, Rooms.STAGE), [ScareEvents.HALLUCINATION])


func test_hallucination_waits_for_its_cooldown() -> void:
	var e := _sure(ScareEvents.new(1))
	e.hallucination_chance = 20.0
	e.step(DT, 10.0, PLAYING, false, Rooms.STAGE)
	assert_eq(e.step(DT, 10.0 + GameConfig.HALLUCINATION_COOLDOWN - 1.0, PLAYING, false, Rooms.STAGE), [])
	assert_eq(e.step(DT, 10.0 + GameConfig.HALLUCINATION_COOLDOWN, PLAYING, false, Rooms.STAGE), [ScareEvents.HALLUCINATION])


func test_nothing_happens_once_the_night_is_over_or_dark() -> void:
	var e := ScareEvents.new(1)
	e.hallucination_chance = 20.0
	e.glitch_chance = 20.0
	e.rare_scare_chance = 20.0
	for state in [NightSim.State.POWER_OUT, NightSim.State.WON, NightSim.State.LOST]:
		assert_eq(e.step(DT, 0.0, state, true, Rooms.LEFT_CORNER), [], "state %d" % state)


func test_glitch_only_on_the_cameras() -> void:
	var e := _sure(ScareEvents.new(2))
	e.glitch_chance = 20.0
	assert_eq(e.step(DT, 0.0, PLAYING, true, Rooms.LEFT_HALL), [ScareEvents.GLITCH])
	assert_eq(e.step(DT, 0.0, PLAYING, false, Rooms.LEFT_HALL), [])


func test_scoggipede_only_while_watching_cam_7() -> void:
	var e := _sure(ScareEvents.new(3))
	e.scoggipede_chance = 20.0
	assert_eq(e.step(DT, 0.0, PLAYING, true, Rooms.LEFT_HALL), [])
	assert_eq(e.step(DT, 0.0, PLAYING, false, Rooms.LEFT_CORNER), [])
	assert_eq(e.step(DT, 0.0, PLAYING, true, Rooms.LEFT_CORNER), [ScareEvents.SCOGGIPEDE])
	assert_eq(e.step(DT, 1.0, PLAYING, true, Rooms.LEFT_CORNER), [], "cooldown")


func test_rare_scare_at_most_once_a_night_and_only_in_the_office() -> void:
	var e := _sure(ScareEvents.new(4))
	e.rare_scare_chance = 20.0
	assert_eq(e.step(DT, 0.0, PLAYING, true, Rooms.STAGE), [], "not on the cameras")
	assert_eq(e.step(DT, 1.0, PLAYING, false, Rooms.STAGE), [ScareEvents.RARE_SCARE])
	for i in 100:
		assert_eq(e.step(DT, 2.0 + i, PLAYING, false, Rooms.STAGE), [])


func test_default_chances_are_rare() -> void:
	# Over a whole night (9 minutes) with the real chances: a few glitches, a hallucination or two.
	var e := ScareEvents.new(5)
	var counts := {ScareEvents.HALLUCINATION: 0, ScareEvents.GLITCH: 0, ScareEvents.RARE_SCARE: 0}
	var t := 0.0
	while t < GameConfig.SECONDS_PER_HOUR * 6:
		for ev in e.step(DT, t, PLAYING, fmod(t, 20.0) < 10.0, Rooms.STAGE):
			counts[ev] = counts.get(ev, 0) + 1
		t += DT
	assert_between(counts[ScareEvents.HALLUCINATION], 0, 4)
	assert_between(counts[ScareEvents.GLITCH], 1, 15)
	assert_lte(counts[ScareEvents.RARE_SCARE], 1)
