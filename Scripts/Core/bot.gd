class_name Bot
extends RefCounted
## A bot gets a turn every `interval` seconds. On its turn it moves if a 1-20 roll is <= its AI level.

var id: String
var display_name: String
var ai_level: int = 0
var interval: float
var room: int = Rooms.STAGE
var _turn_timer: float = 0.0


func _init(p_id: String, p_name: String, p_interval: float, p_level: int) -> void:
	id = p_id
	display_name = p_name
	interval = p_interval
	ai_level = clampi(p_level, GameConfig.AI_LEVEL_MIN, GameConfig.AI_LEVEL_MAX)


func raise_level(amount: int = 1) -> void:
	ai_level = clampi(ai_level + amount, GameConfig.AI_LEVEL_MIN, GameConfig.AI_LEVEL_MAX)


func tick(dt: float, sim: NightSim) -> void:
	_turn_timer += dt
	while _turn_timer >= interval:
		_turn_timer -= interval
		take_turn(sim)


## One movement opportunity: skipped if the bot can't act right now, otherwise roll.
func take_turn(sim: NightSim) -> void:
	if not can_take_turn(sim):
		return
	if GameConfig.passes_roll(ai_level, sim.rng.randi_range(GameConfig.ROLL_MIN, GameConfig.ROLL_MAX)):
		move(sim)


func can_take_turn(_sim: NightSim) -> bool:
	return true


func move(_sim: NightSim) -> void:
	pass
