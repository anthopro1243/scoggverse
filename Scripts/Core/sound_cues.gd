class_name SoundCues
extends RefCounted
## Turns changes in a night's state into sound cues (pure logic, no audio, so GUT can test it).
## Call step(sim) once per frame; it compares with the last frame and returns the cues (the tablet's
## own flip sounds come from the tablet's animation signals instead):
##   {"sound": "door_close", "bus": "Left"}        a door slammed (or "door_open")
##   {"sound": "light_on"/"light_off", "bus": ...}  a hall light
##   {"sound": "cam_switch"}                        a different camera while the tablet is up
##   {"sound": "step", "bot": id, "db": ..., "bus": ...}  a bot moved (louder the closer)
##   {"sound": "cam_garble"}                        a bot moved in or out of the watched room
##   {"sound": "gallop_start"} / {"sound": "gallop_stop"}   Scoggis Khan's run
##   {"sound": "power_down"}                        the power just went out
##   {"sound": "march_start"}                       Uncle Scogg reached the dark doorway

const SIDE_BUS: Array[String] = ["Left", "Right"]
const LEFT_ROOMS: Array[int] = [Rooms.LEFT_HALL, Rooms.LEFT_CORNER, Rooms.LEFT_DOOR]
const RIGHT_ROOMS: Array[int] = [Rooms.RIGHT_HALL, Rooms.RIGHT_CORNER, Rooms.RIGHT_DOOR]
const NEAR_ROOMS: Array[int] = [Rooms.LEFT_CORNER, Rooms.LEFT_DOOR, Rooms.RIGHT_CORNER, Rooms.RIGHT_DOOR]

var _primed: bool = false
var _doors: Array[bool] = [false, false]
var _light: int = -1
var _tablet: bool = false
var _cam: int = -1
var _rooms: Dictionary[String, int] = {}
var _running: bool = false
var _state: int = NightSim.State.PLAYING
var _leader_door: bool = false


func step(sim: NightSim) -> Array[Dictionary]:
	var cues: Array[Dictionary] = []
	if not _primed:
		_remember(sim)
		_primed = true
		return cues
	var playing := sim.state == NightSim.State.PLAYING
	if playing:
		for side in 2:
			if sim.doors[side] != _doors[side]:
				cues.append({"sound": "door_close" if sim.doors[side] else "door_open", "bus": SIDE_BUS[side]})
		if sim.light_side != _light:
			if _light != -1:
				cues.append({"sound": "light_off", "bus": SIDE_BUS[_light]})
			if sim.light_side != -1:
				cues.append({"sound": "light_on", "bus": SIDE_BUS[sim.light_side]})
		if sim.tablet_up and _tablet and sim.cam != _cam:
			cues.append({"sound": "cam_switch"})
		for b in sim.bots:
			var was: int = _rooms.get(b.id, b.room)
			if b.room == was or b.room == Rooms.INSIDE or (b == sim.sprinter and sim.sprinter.running):
				continue
			cues.append({"sound": "step", "bot": b.id, "db": step_db(b.room), "bus": room_bus(b.room)})
			if sim.tablet_up and (b.room == sim.cam or was == sim.cam):
				cues.append({"sound": "cam_garble"})
	if sim.sprinter.running != _running:
		cues.append({"sound": "gallop_start" if sim.sprinter.running else "gallop_stop"})
	if sim.state == NightSim.State.POWER_OUT and _state == NightSim.State.PLAYING:
		cues.append({"sound": "power_down"})
	if sim.leader_at_dark_door and not _leader_door and sim.state == NightSim.State.POWER_OUT:
		cues.append({"sound": "march_start"})
	_remember(sim)
	return cues


## How loud a bot's footsteps are from the room it moved into (dB).
static func step_db(room: int) -> float:
	return GameConfig.STEP_DB.get(room, GameConfig.STEP_FAR_DB)


## Which bus a sound from this room plays on: panned to its side, muffled when far.
static func room_bus(room: int) -> String:
	var near := NEAR_ROOMS.has(room)
	if LEFT_ROOMS.has(room):
		return "Left" if near else "FarLeft"
	if RIGHT_ROOMS.has(room):
		return "Right" if near else "FarRight"
	return "Far"


## The power-out march's pitch with this many seconds left before Uncle Scogg attacks:
## normal until MARCH_SLOW_SECONDS before, then sagging down to MARCH_MIN_PITCH.
static func march_pitch(seconds_left: float) -> float:
	var u := clampf(1.0 - seconds_left / GameConfig.MARCH_SLOW_SECONDS, 0.0, 1.0)
	return lerpf(1.0, GameConfig.MARCH_MIN_PITCH, u * u)


## How long to hold the silence before a jumpscare, given how long it's already been silent.
static func silence_delay(silent_for: float) -> float:
	return maxf(0.0, GameConfig.JUMPSCARE_SILENCE_SECONDS - silent_for)


## Scoggis Khan's gallop level as he runs (progress 0 = left the curtain, 1 = at the door).
static func gallop_db(progress: float) -> float:
	return lerpf(GameConfig.GALLOP_START_DB, GameConfig.SOUND_DB["gallop"], clampf(progress, 0.0, 1.0))


func _remember(sim: NightSim) -> void:
	_doors = sim.doors.duplicate()
	_light = sim.light_side
	_tablet = sim.tablet_up
	_cam = sim.cam
	for b in sim.bots:
		_rooms[b.id] = b.room
	_running = sim.sprinter.running
	_state = sim.state
	_leader_door = sim.leader_at_dark_door
