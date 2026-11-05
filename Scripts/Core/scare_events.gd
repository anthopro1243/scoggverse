class_name ScareEvents
extends RefCounted
## Rolls the cosmetic scares each step: hallucination flashes, camera glitch frames, the
## Scoggipede crawling across CAM 7, and the rare Absolute Scoggema flash. They never touch the
## night's rules; the scene just shows them. Plain class so it can be tested headless.

enum {NONE, HALLUCINATION, GLITCH, SCOGGIPEDE, RARE_SCARE}

var rng := RandomNumberGenerator.new()
var hallucination_ready_at: float = 0.0
var scoggipede_ready_at: float = 0.0
var rare_scare_done: bool = false

## Chances per second (overridable in tests).
var hallucination_chance: float = GameConfig.HALLUCINATION_CHANCE_PER_SECOND
var glitch_chance: float = GameConfig.GLITCH_CHANCE_PER_SECOND
var scoggipede_chance: float = GameConfig.SCOGGIPEDE_CHANCE_PER_SECOND
var rare_scare_chance: float = GameConfig.RARE_SCARE_CHANCE_PER_SECOND


func _init(p_seed: int = -1) -> void:
	if p_seed >= 0:
		rng.seed = p_seed
	else:
		rng.randomize()


## What happens this step (at most one event). time is the night's clock in seconds.
func step(dt: float, time: float, sim_state: int, tablet_up: bool, cam: int) -> Array[int]:
	var out: Array[int] = []
	if sim_state != NightSim.State.PLAYING:
		return out
	if time >= hallucination_ready_at and _roll(hallucination_chance, dt):
		hallucination_ready_at = time + GameConfig.HALLUCINATION_COOLDOWN
		out.append(HALLUCINATION)
	elif tablet_up and cam == Rooms.LEFT_CORNER and time >= scoggipede_ready_at and _roll(scoggipede_chance, dt):
		scoggipede_ready_at = time + GameConfig.SCOGGIPEDE_COOLDOWN
		out.append(SCOGGIPEDE)
	elif tablet_up and _roll(glitch_chance, dt):
		out.append(GLITCH)
	elif not tablet_up and not rare_scare_done and _roll(rare_scare_chance, dt):
		rare_scare_done = true
		out.append(RARE_SCARE)
	return out


func _roll(chance_per_second: float, dt: float) -> bool:
	return chance_per_second > 0.0 and rng.randf() < chance_per_second * dt
