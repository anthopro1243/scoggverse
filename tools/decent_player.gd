class_name DecentPlayer
extends RefCounted
## A scripted "decent player" for the night simulator. It only reacts to what a
## real player could see or hear: a bot in a doorway while that light is on, the
## camera it is looking at, and the sprinter banging on the left door.
## It keeps a reason for each door and shuts/opens doors to match whenever the tablet is down.
## It plays like an attentive person, not a machine: checks come at uneven intervals, it
## takes a moment to react, and now and then it gets distracted and skips a light check.

const LIGHT_EVERY_MIN: float = 3.5 # seconds between light checks (random in this range)
const LIGHT_EVERY_MAX: float = 6.0
const LIGHT_LOOK: float = 0.3 # how long each light stays on
const CAM_EVERY_MIN: float = 9.0 # seconds between camera checks (random in this range)
const CAM_EVERY_MAX: float = 14.0
const CAM_LOOK: float = 0.6 # how long it looks at each camera
const REACTION_MIN: float = 0.3 # delay between seeing a bot in a doorway and shutting the door
const REACTION_MAX: float = 0.9
const LAPSE_CHANCE: float = 0.08 # chance a light check is skipped
const SPRINTER_GUARD: float = 30.0 # max seconds the left door stays shut for the sprinter

var rng := RandomNumberGenerator.new()

var _queue: Array = [] # [time, Callable], sorted by time
var _next_lights: float = 0.0
var _next_cams: float = 4.0
var _bot_at_door: Array[bool] = [false, false]
var _door_ready_at: Array[float] = [0.0, 0.0] # reaction delay before acting on a sighting
var _leader_in_corner: bool = false
var _sprinter_guard_until: float = -1.0
var _heard_bang: bool = false


func attach(sim: NightSim, p_seed: int = -1) -> void:
	if p_seed >= 0:
		rng.seed = p_seed
	else:
		rng.randomize()
	sim.sprinter_blocked.connect(func() -> void: _heard_bang = true)


## Drops queued actions; their closures hold this player, so call it when the night ends.
func release() -> void:
	_queue.clear()


func update(sim: NightSim) -> void:
	if sim.state != NightSim.State.PLAYING:
		return
	if _heard_bang or (_sprinter_guard_until >= 0.0 and sim.time >= _sprinter_guard_until):
		_heard_bang = false
		_sprinter_guard_until = -1.0
	while not _queue.is_empty() and _queue[0][0] <= sim.time:
		var job: Callable = _queue.pop_front()[1]
		job.call(sim)
		if sim.state != NightSim.State.PLAYING:
			return
	if not sim.tablet_up:
		_match_doors(sim)
	if _queue.is_empty():
		if sim.time >= _next_cams:
			_plan_cams(sim.time)
		elif sim.time >= _next_lights:
			_plan_lights(sim.time)


func wants_door_shut(side: int) -> bool:
	if _bot_at_door[side]:
		return true
	if side == Rooms.Side.LEFT:
		return _sprinter_guard_until >= 0.0
	return _leader_in_corner


func _match_doors(sim: NightSim) -> void:
	for side in 2:
		if sim.time < _door_ready_at[side]:
			continue
		if sim.doors[side] != wants_door_shut(side):
			sim.set_door(side, wants_door_shut(side))


func _at(t: float, job: Callable) -> void:
	_queue.append([t, job])


func _plan_lights(t: float) -> void:
	_next_lights = t + rng.randf_range(LIGHT_EVERY_MIN, LIGHT_EVERY_MAX)
	if rng.randf() < LAPSE_CHANCE:
		return # distracted this time
	for i in 2:
		var side := i
		var on_at := t + i * LIGHT_LOOK
		_at(on_at, func(s: NightSim) -> void: s.set_light(side, true))
		_at(on_at + LIGHT_LOOK, func(s: NightSim) -> void: _look_at_door(s, side))


func _look_at_door(sim: NightSim, side: int) -> void:
	if sim.light_side == side:
		var seen := not sim.bots_at_door(side).is_empty()
		if seen and not _bot_at_door[side]:
			_door_ready_at[side] = sim.time + rng.randf_range(REACTION_MIN, REACTION_MAX)
		_bot_at_door[side] = seen
	sim.set_light(side, false)


func _plan_cams(t: float) -> void:
	_next_cams = t + rng.randf_range(CAM_EVERY_MIN, CAM_EVERY_MAX)
	# Corner first: the leader only gets in while the tablet is up and you're looking elsewhere.
	_at(t, func(s: NightSim) -> void:
		s.set_tablet(true)
		s.set_cam(Rooms.RIGHT_CORNER))
	_at(t + CAM_LOOK, _look_at_corner)
	_at(t + 2.0 * CAM_LOOK, _look_at_curtain)
	_at(t + 3.0 * CAM_LOOK, _look_at_left_hall)


func _look_at_corner(sim: NightSim) -> void:
	if not sim.is_watching(Rooms.RIGHT_CORNER):
		return
	_leader_in_corner = sim.leader in sim.bots_in(Rooms.RIGHT_CORNER)
	if _leader_in_corner and not sim.doors[Rooms.Side.RIGHT]:
		# Drop the tablet and shut the door before it can slip in; finish the round later.
		sim.set_tablet(false)
		_queue.clear()
		_next_cams = sim.time + 1.0
		return
	sim.set_cam(Rooms.CURTAIN)


func _look_at_curtain(sim: NightSim) -> void:
	if sim.is_watching(Rooms.CURTAIN):
		if sim.sprinter.stage >= GameConfig.SPRINTER_LAST_STAGE:
			_sprinter_guard_until = sim.time + SPRINTER_GUARD
		elif sim.sprinter.stage == GameConfig.SPRINTER_LAST_STAGE - 1:
			_next_cams = sim.time + CAM_EVERY_MIN * 0.5
	sim.set_cam(Rooms.LEFT_HALL)


func _look_at_left_hall(sim: NightSim) -> void:
	if sim.is_watching(Rooms.LEFT_HALL) and sim.sprinter.running:
		_sprinter_guard_until = sim.time + SPRINTER_GUARD
	sim.set_tablet(false)
