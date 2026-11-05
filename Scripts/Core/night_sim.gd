class_name NightSim
extends RefCounted
## One night of the game as pure state. The night scene, the GUT tests and the
## headless simulator all drive this same class with step(dt) and the player actions.

signal hour_changed(hour: int)
signal got_in(bot: Bot)
signal attacked(bot: Bot, cause: String)
signal won
signal power_out_started
signal sprinter_blocked

enum State {PLAYING, POWER_OUT, WON, LOST}

var rng := RandomNumberGenerator.new()
var night: int
var time: float = 0.0
var state: int = State.PLAYING
var clock := NightClock.new()
var power := PowerSystem.new()

var doors: Array[bool] = [false, false] # indexed by Rooms.Side
var light_side: int = -1 # -1 = both lights off
var tablet_up: bool = false
var cam: int = Rooms.STAGE

var left_bot: HallBot
var right_bot: HallBot
var leader: LeaderBot
var sprinter: SprinterBot
var bots: Array[Bot] = []

var inside: Array[HallBot] = []
var inside_timer: float = 0.0
var killer: Bot
var death_cause: String = ""

var power_out_time: float = 0.0
var power_out_attack_at: float = 0.0
var leader_at_dark_door: bool = false


func _init(p_night: int = 1, levels: Dictionary = {}, p_seed: int = -1) -> void:
	night = p_night
	if levels.is_empty():
		levels = GameConfig.levels_for(p_night)
	if p_seed >= 0:
		rng.seed = p_seed
	else:
		rng.randomize()
	left_bot = HallBot.new("left_hall", GameConfig.NAME_LEFT_HALL, GameConfig.TIMER_LEFT_HALL,
		levels.get("left_hall", 0), Rooms.Side.LEFT, Rooms.LEFT_ROUTE, Rooms.CAFETERIA)
	right_bot = HallBot.new("right_hall", GameConfig.NAME_RIGHT_HALL, GameConfig.TIMER_RIGHT_HALL,
		levels.get("right_hall", 0), Rooms.Side.RIGHT, Rooms.RIGHT_ROUTE, Rooms.CAFETERIA)
	leader = LeaderBot.new("leader", GameConfig.NAME_LEADER, GameConfig.TIMER_LEADER,
		levels.get("leader", 0), Rooms.Side.RIGHT, Rooms.LEADER_ROUTE, Rooms.RIGHT_HALL)
	sprinter = SprinterBot.new("sprinter", GameConfig.NAME_SPRINTER, GameConfig.TIMER_SPRINTER,
		levels.get("sprinter", 0))
	bots = [leader, left_bot, right_bot, sprinter]


func step(dt: float) -> void:
	if is_finished():
		return
	time += dt
	for h in clock.advance(dt):
		_apply_ramp(h)
		hour_changed.emit(h)
	if clock.is_over():
		state = State.WON
		won.emit()
		return
	if state == State.POWER_OUT:
		_step_power_out(dt)
		return
	power.drain(dt, usage(), night)
	if power.is_out():
		_start_power_out()
		return
	for b in bots:
		b.tick(dt, self)
		if state != State.PLAYING:
			return
	if not inside.is_empty():
		inside_timer += dt
		if inside_timer >= GameConfig.INSIDE_FORCE_ATTACK_SECONDS and not tablet_up:
			attack(inside[0])


# --- Player actions (return false when the action isn't possible right now) ---

## Doors and lights only work with the tablet down, as in FNAF.
func set_door(side: int, closed: bool) -> bool:
	if state != State.PLAYING or tablet_up or is_side_jammed(side):
		return false
	doors[side] = closed
	return true


func toggle_door(side: int) -> bool:
	return set_door(side, not doors[side])


func set_light(side: int, on: bool) -> bool:
	if state != State.PLAYING or is_side_jammed(side) or (on and tablet_up):
		return false
	if on:
		light_side = side
	elif light_side == side:
		light_side = -1
	return true


func toggle_light(side: int) -> bool:
	return set_light(side, light_side != side)


func set_tablet(up: bool) -> bool:
	if up == tablet_up:
		return true
	if up:
		if state != State.PLAYING:
			return false
		tablet_up = true
		light_side = -1
		return true
	tablet_up = false
	if state == State.PLAYING:
		sprinter.on_tablet_lowered(self)
		if not inside.is_empty():
			attack(inside[0])
	return true


func set_cam(room: int) -> void:
	if room in Rooms.CAMS:
		cam = room


# --- Queries ---

func is_finished() -> bool:
	return state == State.WON or state == State.LOST


func is_door_closed(side: int) -> bool:
	return doors[side]


func is_watching(room: int) -> bool:
	return state == State.PLAYING and tablet_up and cam == room


## A bot that got in on this side jams that side's door and light, as in FNAF.
func is_side_jammed(side: int) -> bool:
	for b in inside:
		if b.side == side:
			return true
	return false


func bots_in(room: int) -> Array[Bot]:
	var found: Array[Bot] = []
	for b in bots:
		if b.room == room:
			found.append(b)
	return found


func bots_at_door(side: int) -> Array[Bot]:
	return bots_in(Rooms.door_of(side))


func usage() -> int:
	if state != State.PLAYING:
		return 0
	return PowerSystem.usage(doors.count(true), light_side != -1, tablet_up)


# --- Events from bots ---

func bot_got_in(bot: HallBot) -> void:
	if inside.is_empty():
		inside_timer = 0.0
	inside.append(bot)
	if light_side == bot.side:
		light_side = -1
	got_in.emit(bot)


func attack(bot: Bot, cause: String = "") -> void:
	if is_finished():
		return
	state = State.LOST
	killer = bot
	death_cause = cause if cause != "" else bot.display_name
	attacked.emit(bot, death_cause)


# --- Internals ---

func _apply_ramp(h: int) -> void:
	if h in GameConfig.RAMP_HOURS_LEFT_HALL:
		left_bot.raise_level()
	if h in GameConfig.RAMP_HOURS_RIGHT_HALL:
		right_bot.raise_level()
	if h in GameConfig.RAMP_HOURS_SPRINTER:
		sprinter.raise_level()


func _start_power_out() -> void:
	state = State.POWER_OUT
	doors = [false, false]
	light_side = -1
	tablet_up = false
	power_out_time = 0.0
	leader_at_dark_door = false
	power_out_attack_at = GameConfig.POWER_OUT_APPEAR_SECONDS + rng.randf_range(
		GameConfig.POWER_OUT_ATTACK_MIN, GameConfig.POWER_OUT_ATTACK_MAX)
	power_out_started.emit()


func _step_power_out(dt: float) -> void:
	power_out_time += dt
	if not leader_at_dark_door and power_out_time >= GameConfig.POWER_OUT_APPEAR_SECONDS:
		leader_at_dark_door = true
		leader.room = Rooms.LEFT_DOOR
	if power_out_time >= power_out_attack_at:
		attack(leader, "%s (power out)" % leader.display_name)
