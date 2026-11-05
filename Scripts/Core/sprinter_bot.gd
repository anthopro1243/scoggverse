class_name SprinterBot
extends Bot
## Scoggis Khan: works through stages behind the curtain, then runs down the left hall.
## Its rolls are skipped while the tablet is up and for a random cooldown after it comes down.

var stage: int = 0
var running: bool = false
var door_hits: int = 0
var _run_wait: float = 0.0
var _run_eta: float = 0.0
var _locked_until: float = 0.0


func _init(p_id: String, p_name: String, p_interval: float, p_level: int) -> void:
	super(p_id, p_name, p_interval, p_level)
	room = Rooms.CURTAIN


func tick(dt: float, sim: NightSim) -> void:
	if running:
		_run_eta -= dt
		if _run_eta <= 0.0:
			_arrive(sim)
		return
	if stage >= GameConfig.SPRINTER_LAST_STAGE:
		_run_wait -= dt
		if _run_wait <= 0.0 or sim.is_watching(Rooms.LEFT_HALL):
			start_run()
		return
	super(dt, sim)


func can_take_turn(sim: NightSim) -> bool:
	return not sim.tablet_up and sim.time >= _locked_until


func move(_sim: NightSim) -> void:
	stage += 1
	if stage >= GameConfig.SPRINTER_LAST_STAGE:
		_run_wait = GameConfig.SPRINTER_RUN_WAIT


func start_run() -> void:
	stage = GameConfig.SPRINTER_LAST_STAGE
	running = true
	room = Rooms.LEFT_HALL
	_run_eta = GameConfig.SPRINTER_RUN_SECONDS


## How far along the hall the run is: 0 when it starts, 1 at the door (0 when not running).
func run_progress() -> float:
	return clampf(1.0 - _run_eta / GameConfig.SPRINTER_RUN_SECONDS, 0.0, 1.0) if running else 0.0


func on_tablet_lowered(sim: NightSim) -> void:
	_locked_until = sim.time + sim.rng.randf_range(GameConfig.SPRINTER_COOLDOWN_MIN, GameConfig.SPRINTER_COOLDOWN_MAX)


func is_locked(sim: NightSim) -> bool:
	return sim.time < _locked_until


func _arrive(sim: NightSim) -> void:
	running = false
	if sim.is_door_closed(Rooms.Side.LEFT):
		sim.power.spend(GameConfig.SPRINTER_DOOR_DRAIN_FIRST + GameConfig.SPRINTER_DOOR_DRAIN_STEP * door_hits)
		door_hits += 1
		var resets := GameConfig.SPRINTER_RESET_STAGES
		stage = resets[sim.rng.randi_range(0, resets.size() - 1)]
		room = Rooms.CURTAIN
		sim.sprinter_blocked.emit()
	else:
		room = Rooms.INSIDE
		sim.attack(self)
