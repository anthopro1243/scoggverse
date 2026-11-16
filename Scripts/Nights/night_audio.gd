extends Node
## The night's sound. Loops: the office room tone and desk fan, the emptier camera room tone
## (crossfaded with the tablet), a hall light's buzz, Scoggis Khan's gallop, and the power-out
## march. One-shots come from SoundCues (doors, lights, tablet, footsteps...) and from the
## controller (scares, screams, 6 AM). Every sound played is logged for the playtest.
##
## Silence before every jumpscare: the ambience fades out once a bot is inside, and any attack
## cuts it at once; the controller holds the scare until it's been quiet for
## JUMPSCARE_SILENCE_SECONDS (silence_delay()).

const POOL_SIZE := 10
const STEP_SOUNDS: Array[String] = ["steps_1", "steps_2", "scrape_1", "scrape_2"]
const LOG_SIZE := 200
const OFFICE_UNDER_TABLET := 0.3 # office room tone level while the tablet is up

var _cues := SoundCues.new()
var _amb_office: AudioStreamPlayer
var _amb_fan: AudioStreamPlayer
var _amb_cams: AudioStreamPlayer
var _buzz: AudioStreamPlayer
var _gallop: AudioStreamPlayer
var _march: AudioStreamPlayer
var _pool: Array[AudioStreamPlayer] = []
var _pool_i: int = 0

var _level: float = 1.0 # ambience level 0-1 (0 = the silence before a scare)
var _office_mix: float = 1.0
var _silenced: bool = false
var _silent_since_ms: int = -1
var _log: Array[Dictionary] = []
var _time: float = 0.0


func _ready() -> void:
	_amb_office = _loop("amb_office", &"Ambience")
	_amb_fan = _loop("fan", &"Ambience")
	_amb_cams = _loop("amb_cams", &"Ambience")
	_buzz = _loop("light_buzz", &"Left")
	_gallop = _loop("gallop", &"Left")
	_march = _loop("march", &"Music")
	for i in POOL_SIZE:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_pool.append(p)
	for p in [_amb_office, _amb_fan, _amb_cams]:
		p.volume_db = -80.0
		if p.stream:
			p.play()
	_log_event("amb_office", "Ambience")


func _loop(sound: String, bus: StringName) -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.stream = Sound.stream(sound)
	p.bus = bus
	add_child(p)
	return p


## Called every frame by the controller.
func refresh(sim: NightSim, delta: float) -> void:
	_time = sim.time
	for cue in _cues.step(sim):
		_on_cue(cue, sim)
	# Ambience: office tone and fan, or the camera tone while the tablet is up; all of it fades
	# to silence once something is inside, and dies with the power.
	var want := 1.0 if sim.state == NightSim.State.PLAYING and sim.inside.is_empty() and not _silenced else 0.0
	_level = move_toward(_level, want, delta / GameConfig.HUM_FADE_SECONDS)
	if _silenced or sim.state != NightSim.State.PLAYING:
		_level = minf(_level, want)
	# The march and the gallop aren't silence: an attack during them still gets the quiet beat.
	var quiet := _level <= 0.001 and not _march.playing and not _gallop.playing
	if quiet and _silent_since_ms < 0:
		_silent_since_ms = Time.get_ticks_msec()
	elif not quiet:
		_silent_since_ms = -1
	_office_mix = move_toward(_office_mix, OFFICE_UNDER_TABLET if sim.tablet_up else 1.0, delta / GameConfig.AMB_FADE_SECONDS)
	var cams_mix := 1.0 - (_office_mix - OFFICE_UNDER_TABLET) / (1.0 - OFFICE_UNDER_TABLET)
	_amb_office.volume_db = GameConfig.AMB_OFFICE_DB + _lin(_level * _office_mix)
	_amb_fan.volume_db = GameConfig.AMB_FAN_DB + _lin(_level * _office_mix)
	_amb_cams.volume_db = GameConfig.AMB_CAMS_DB + _lin(_level * cams_mix)
	# A lit hall light buzzes on its side.
	var lit := sim.state == NightSim.State.PLAYING and sim.light_side != -1 and not _silenced
	if lit:
		_buzz.bus = SoundCues.SIDE_BUS[sim.light_side]
		_buzz.volume_db = GameConfig.SOUND_DB["light_buzz"]
		if not _buzz.playing and _buzz.stream:
			_buzz.play()
	elif _buzz.playing:
		_buzz.stop()
	# Scoggis Khan's gallop swells as he nears the door.
	if _gallop.playing:
		_gallop.volume_db = SoundCues.gallop_db(sim.sprinter.run_progress())
	# The march slows and sags in pitch before Uncle Scogg attacks.
	if _march.playing:
		var left := sim.power_out_attack_at - sim.power_out_time
		var pitch := SoundCues.march_pitch(left)
		if pitch < 1.0:
			pitch *= 1.0 + GameConfig.MARCH_WOBBLE * sin(sim.power_out_time * 11.0)
		_march.pitch_scale = maxf(pitch, 0.05)


func _on_cue(cue: Dictionary, sim: NightSim) -> void:
	var s: String = cue.sound
	match s:
		"step":
			var file := "steps_heavy" if cue.bot == "leader" else STEP_SOUNDS[randi() % STEP_SOUNDS.size()]
			play(file, cue.db + GameConfig.STEP_FILE_DB.get(file, 0.0), cue.bus, randf_range(0.94, 1.06), "step")
		"gallop_start":
			_gallop.volume_db = GameConfig.GALLOP_START_DB
			if _gallop.stream:
				_gallop.play()
			_log_event("gallop", "Left")
			ArtCache.warm_jumpscare("scoggis_khan")
		"gallop_stop":
			_gallop.stop()
		"power_down":
			_silence_loops()
			play("power_down", GameConfig.SOUND_DB["power_down"], "Sfx")
			ArtCache.warm_jumpscare("uncle_scogg")
		"march_start":
			_march.pitch_scale = 1.0
			_march.volume_db = GameConfig.SOUND_DB["march"]
			if _march.stream:
				_march.play()
			_log_event("march", "Music")
		_:
			play(s, GameConfig.SOUND_DB.get(s, -6.0), cue.get("bus", "Sfx"))


## Plays a one-shot sound (Audio/<file>.ogg). `logged_as` names it in the log (default: file).
func play(file: String, volume_db: float = 0.0, bus: String = "Sfx", pitch: float = 1.0, logged_as: String = "") -> void:
	var stream := Sound.stream(file)
	_log_event(logged_as if logged_as != "" else file, bus, volume_db, file)
	if stream == null:
		return
	var p := _pool[_pool_i]
	_pool_i = (_pool_i + 1) % _pool.size()
	p.stream = stream
	p.bus = StringName(bus)
	p.volume_db = volume_db
	p.pitch_scale = pitch
	p.play()


## Stops a one-shot that's still playing (e.g. the phone ringing when the call is muted).
func stop_sound(file: String) -> void:
	for p in _pool:
		if p.playing and p.stream and p.stream.resource_path.get_file().get_basename() == file:
			p.stop()


## A named one-shot at its configured level.
func cue(sound: String, bus: String = "Sfx") -> void:
	play(sound, GameConfig.SOUND_DB.get(sound, -6.0), bus)


## An attack: cut everything to silence now (the controller then waits silence_delay()).
func silence_now() -> void:
	_silenced = true
	_level = 0.0
	_silence_loops()
	_march.stop()
	_gallop.stop()
	for p in _pool:
		if p.playing and p.stream and p.stream.resource_path.get_file().begins_with("phone"):
			p.stop()
	_log_event("silence", "Sfx")


## Seconds of quiet so far (real time; 0 if the ambience is still audible).
func silent_for() -> float:
	return 0.0 if _silent_since_ms < 0 else (Time.get_ticks_msec() - _silent_since_ms) / 1000.0


## The jumpscare scream for a bot's art name, in sync with the first frame.
func scream(art_name: String) -> void:
	play("scream_" + art_name, GameConfig.SOUND_DB["scream"], "Sfx", 1.0, "scream")


func win() -> void:
	silence_now()
	cue("chime_6am", "Music")


## Power-out march state for the playtest.
func march_pitch() -> float:
	return _march.pitch_scale if _march.playing else 0.0


func stop_all() -> void:
	_silence_loops()
	_march.stop()
	_gallop.stop()
	_buzz.stop()


## Ambience level 0-1 (for the playtest: 0 means the silence before a scare).
func hum_level() -> float:
	return _level


## What's been played, oldest first (for the playtest): {t, sound, file, bus, db}.
func events() -> Array[Dictionary]:
	return _log


## Loops playing right now (for the playtest).
func loops() -> Dictionary:
	return {
		"office": _amb_office.playing and _level * _office_mix > 0.5,
		"fan": _amb_fan.playing and _level * _office_mix > 0.5,
		"cams": _amb_cams.playing and _level * (1.0 - _office_mix) > 0.3,
		"light_buzz": _buzz.playing,
		"gallop": _gallop.playing,
		"march": _march.playing,
	}


func log_event(sound: String, bus: String = "Sfx") -> void:
	_log_event(sound, bus)


func _silence_loops() -> void:
	_level = 0.0
	for p in [_amb_office, _amb_fan, _amb_cams]:
		p.volume_db = -80.0
	_buzz.stop()


func _log_event(sound: String, bus: String, db: float = 0.0, file: String = "") -> void:
	_log.append({"t": snappedf(_time, 0.01), "ms": Time.get_ticks_msec(), "sound": sound,
		"file": file if file != "" else sound, "bus": bus, "db": db})
	if _log.size() > LOG_SIZE:
		_log.pop_front()


static func _lin(v: float) -> float:
	return linear_to_db(maxf(v, 0.0001))
