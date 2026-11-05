extends RefCounted
## Shared helpers for the night tests.

const ZERO := {"leader": 0, "left_hall": 0, "right_hall": 0, "sprinter": 0}


static func make_sim(levels: Dictionary = ZERO, night: int = 1, p_seed: int = 7) -> NightSim:
	var merged := ZERO.duplicate()
	merged.merge(levels, true)
	return NightSim.new(night, merged, p_seed)


## Steps the sim in small increments, like the game does.
static func run(sim: NightSim, seconds: float, dt: float = 0.05) -> void:
	var t := 0.0
	while t < seconds - 0.0001 and not sim.is_finished():
		sim.step(dt)
		t += dt


## Stops every bot from taking turns, so long clock tests can't end in an attack.
static func freeze_bots(sim: NightSim) -> NightSim:
	for b in sim.bots:
		b.interval = 1.0e9
	return sim
