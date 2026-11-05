extends Node
## Runs one night: steps the NightSim at a fixed rate, forwards player input to it,
## and keeps the office, cameras, HUD and endings in sync with its state.

## Set from the Game autoload (Game.pending_night); 7 = Custom Night.
var night: int = 1
@export var office_path: NodePath = ^"../OfficeElements/Office"
@export var tablet_path: NodePath = ^"../TabletElements"
@export var camera_path: NodePath = ^"../CameraElements"

## False freezes the night (the screenshot tool sets up exact moments this way).
var running: bool = true
var sim: NightSim

var _accumulator: float = 0.0
var _office: Sprite2D
var _tablet: Node2D
var _camera: Camera
var _overlay: Node2D
var _cam_view: Node2D
var _hud: CanvasLayer
var _endings: CanvasLayer
var _pause: CanvasLayer
var _scare_fx: CanvasLayer
var _audio: Node
var _voicemail: CanvasLayer
var _scares := ScareEvents.new()
var _intro_active: bool = true


func _ready() -> void:
	add_to_group("night_controller")
	night = Game.pending_night
	sim = NightSim.new(night, Game.custom_levels if night == GameConfig.CUSTOM_NIGHT else {})
	_office = get_node(office_path)
	_tablet = get_node(tablet_path)
	_camera = get_node(camera_path)

	# Our camera feed and map replace Cupcakes' four demo rooms.
	for path in ["CamRooms", "CamButtons", "CamHUD/Map&Border"]:
		_camera.get_node(path).visible = false

	_overlay = preload("res://Scripts/Nights/office_overlay.gd").new()
	_office.add_child(_overlay)
	_cam_view = preload("res://Scripts/Nights/cam_view.gd").new()
	_camera.add_child(_cam_view)
	_camera.move_child(_cam_view, _camera.get_node("CamHUD").get_index())
	_cam_view.feed_changed.connect(_camera.play_static)
	_hud = preload("res://Scripts/Nights/night_hud.gd").new()
	add_child(_hud)
	_endings = preload("res://Scripts/Nights/night_endings.gd").new()
	add_child(_endings)
	_pause = preload("res://Scripts/Nights/pause_menu.gd").new()
	add_child(_pause)
	_scare_fx = preload("res://Scripts/Nights/scare_fx.gd").new()
	add_child(_scare_fx)
	_audio = preload("res://Scripts/Nights/night_audio.gd").new()
	add_child(_audio)
	_voicemail = preload("res://Scripts/Nights/voicemail.gd").new()
	add_child(_voicemail)
	Sound.menu_music(false)

	_hud.door_pressed.connect(press_door)
	_hud.light_pressed.connect(press_light)
	_hud.cam_pressed.connect(select_cam)
	_hud.pause_pressed.connect(pause)
	_endings.intro_done.connect(func() -> void:
		_intro_active = false
		_voicemail.start(night, _audio))
	_endings.retry_pressed.connect(restart)
	_endings.menu_pressed.connect(quit_to_title)
	_endings.next_pressed.connect(_on_next)
	_pause.restart_pressed.connect(restart)
	_pause.title_pressed.connect(quit_to_title)
	_tablet.raising.connect(func() -> void: _audio.cue("tablet_up"))
	_tablet.raised.connect(func() -> void: sim.set_tablet(true))
	_tablet.lowering.connect(func() -> void:
		if sim.state == NightSim.State.PLAYING:
			_audio.cue("tablet_down")
		sim.set_tablet(false))
	sim.power_out_started.connect(_on_power_out)
	sim.attacked.connect(_on_attacked)
	sim.won.connect(_on_won)
	sim.sprinter_blocked.connect(func() -> void: _audio.cue("door_bang", "Left"))
	sim.got_in.connect(func(bot: Bot) -> void: ArtCache.warm_jumpscare(BotStyle.art_of(bot)))
	refresh_now()
	_endings.show_intro(Game.night_title(night))


func _exit_tree() -> void:
	ArtCache.release_jumpscares()


func _process(delta: float) -> void:
	if running and not _intro_active:
		_accumulator += delta
		while _accumulator >= GameConfig.SIM_STEP_SECONDS:
			_accumulator -= GameConfig.SIM_STEP_SECONDS
			sim.step(GameConfig.SIM_STEP_SECONDS)
		if not _pause.is_open():
			for ev in _scares.step(delta, sim.time, sim.state, sim.tablet_up, sim.cam):
				_on_scare(ev)
	refresh_now()
	_audio.refresh(sim, delta)


func _on_scare(ev: int) -> void:
	match ev:
		ScareEvents.HALLUCINATION:
			if sim.tablet_up:
				_cam_view.flash_p59()
				_camera.play_static()
			else:
				var pages := ArtLayout.HALLUCINATIONS
				_scare_fx.hallucinate(pages[randi() % pages.size()])
			_audio.cue("whisper")
		ScareEvents.GLITCH:
			_cam_view.glitch()
			_audio.cue("glitch")
		ScareEvents.SCOGGIPEDE:
			_cam_view.start_scoggipede()
			if sim.tablet_up and sim.cam == Rooms.LEFT_CORNER:
				_audio.cue("scuttle", "FarLeft")
		ScareEvents.RARE_SCARE:
			_scare_fx.rare_scare()
			_audio.cue("sting_scoggema")


func refresh_now() -> void:
	_overlay.refresh(sim)
	_cam_view.refresh(sim)
	_hud.refresh(sim)


func select_cam(room: int) -> void:
	sim.set_cam(room)


## A door button or key. A jammed side (a bot got in) gives a dead buzz instead.
func press_door(side: int) -> void:
	if not sim.toggle_door(side) and sim.state == NightSim.State.PLAYING and sim.is_side_jammed(side):
		_audio.cue("denied", SoundCues.SIDE_BUS[side])


func press_light(side: int) -> void:
	if not sim.toggle_light(side) and sim.state == NightSim.State.PLAYING and sim.is_side_jammed(side):
		_audio.cue("denied", SoundCues.SIDE_BUS[side])


func mute_call() -> void:
	_voicemail.mute()


## The call's state (for the playtest).
func call_state() -> Dictionary:
	return _voicemail.state()


## Sounds played and loops running (for the playtest).
func audio_state() -> Dictionary:
	return {"events": _audio.events(), "loops": _audio.loops(), "march_pitch": snappedf(_audio.march_pitch(), 0.01),
		"silent_for": snappedf(_audio.silent_for(), 0.01), "call": _voicemail.state()}


func restart() -> void:
	get_tree().reload_current_scene()


func quit_to_title() -> void:
	Game.to_title()


func skip_intro() -> void:
	_endings.end_intro()


func pause() -> void:
	if not sim.is_finished() and not _intro_active:
		_pause.open()


func is_paused() -> bool:
	return _pause.is_open()


## Which ending screen is showing: "", "jumpscare", "game_over" or "win".
func ending_shown() -> String:
	return _endings.current


## What the art layers show right now (for the playtest).
func art_state() -> Dictionary:
	return {
		"office_art": _office.texture != null and _office.texture.resource_path.ends_with("office.webp"),
		"office": _overlay.shown(),
		"scoggipede": _cam_view.crawling(),
		"cam_bots": _cam_view.shown_bots(),
		"flash": _scare_fx.current,
		"last_flash": _scare_fx.last,
		"jumpscare_style": _endings.jumpscare_style,
		"jumpscare_frames": _endings.frames_shown,
		"hum": snappedf(_audio.hum_level(), 0.01),
	}


## Test hook: fire a scare event now (ScareEvents.HALLUCINATION etc.).
func force_scare(ev: int) -> void:
	_on_scare(ev)


func _unhandled_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key == null or not key.pressed or key.echo or _intro_active:
		return
	match key.keycode:
		KEY_A: press_door(Rooms.Side.LEFT)
		KEY_D: press_door(Rooms.Side.RIGHT)
		KEY_Q: press_light(Rooms.Side.LEFT)
		KEY_E: press_light(Rooms.Side.RIGHT)
		KEY_SPACE, KEY_S: _tablet.toggle()
		KEY_ESCAPE, KEY_P: pause()
		KEY_R:
			if sim.is_finished():
				restart()
		_:
			var n := key.keycode - KEY_1
			if n >= 0 and n < Rooms.CAMS.size() and sim.tablet_up:
				select_cam(Rooms.CAMS[n])


func _on_power_out() -> void:
	_tablet.locked = true
	_tablet.force_down()
	_voicemail.stop()


func _on_attacked(bot: Bot, cause: String) -> void:
	_tablet.locked = true
	_tablet.force_down()
	_voicemail.stop()
	# Silence first: everything cuts out, then the scare after JUMPSCARE_SILENCE_SECONDS of quiet
	# (at once if it's already been quiet that long, like a bot that got inside). Real time, so
	# the beat stays the same in sped-up playtests.
	var delay := SoundCues.silence_delay(_audio.silent_for())
	var art := BotStyle.art_of(bot)
	ArtCache.warm_jumpscare(art)
	_audio.silence_now()
	_endings.hold_for_jumpscare()
	var show := func() -> void:
		_audio.scream(art)
		_endings.show_jumpscare(bot, cause, sim.clock.display_text(), Game.night_title(night))
	if delay <= 0.0:
		show.call()
	else:
		get_tree().create_timer(delay, true, false, true).timeout.connect(show)


func _on_won() -> void:
	_tablet.locked = true
	_tablet.force_down()
	_voicemail.stop()
	_audio.win()
	var earned := Game.record_win(night, sim.power.percent())
	var next_label := ""
	if night < GameConfig.LAST_NIGHT:
		next_label = "Next Night"
	elif night == GameConfig.CUSTOM_NIGHT:
		next_label = "Play again"
	_endings.show_win(Game.night_title(night), earned, Game.progress.scogg_bucks, next_label)


func _on_next() -> void:
	if night == GameConfig.CUSTOM_NIGHT:
		restart()
	else:
		Game.play_night(night + 1)
