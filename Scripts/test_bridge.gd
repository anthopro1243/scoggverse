extends Node
## Test hook for the browser playtests. Does nothing unless the page URL has ?test=1.
## Then it publishes window.fnasState (JSON) every frame:
##   observe: only what a player can see on screen right now (drives the scripted player)
##   truth:   hidden state, used only to check results
## and ?speed=N runs the game N times faster (Engine.time_scale).
## Test-only commands (set window.fnasCmd from the page, used to check menus and saves
## without sitting through whole nights): "dawn" jumps the clock to just before 6 AM,
## "reset_save" wipes saved progress, "progress:N" sets the Continue night to N, "scare:N"
## fires a cosmetic scare now (ScareEvents: 1 hallucination, 2 glitch, 3 Scoggipede, 4 rare scare),
## "place:<bot id>:<room>" moves a bot (Rooms enum value), "getin:<bot id>" puts a hall bot or
## the leader inside the office, "attack:<bot id>" makes that bot attack now, "mute_call"
## presses the voicemail's Mute call button, "power_out" drains the power to 0 now and "sprint"
## starts Scoggis Khan's run down the left hall.
## In a night, fnasState.audio is the sound event log ({t, ms, sound, file, bus, db}, oldest
## first), the loops playing, the march pitch, the seconds of silence and the voicemail state.

var enabled: bool = false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	if not OS.has_feature("web"):
		return
	var query := str(JavaScriptBridge.eval("window.location.search", true))
	var params := {}
	for pair in query.trim_prefix("?").split("&", false):
		var kv := pair.split("=")
		params[kv[0]] = kv[1] if kv.size() > 1 else ""
	enabled = params.get("test", "") == "1"
	if enabled and params.has("speed"):
		Engine.time_scale = clampf(float(params.speed), 0.1, 20.0)


func _process(_delta: float) -> void:
	if enabled:
		_run_command(str(JavaScriptBridge.eval("(function(){var c=window.fnasCmd||'';window.fnasCmd='';return c;})()", true)))
		JavaScriptBridge.eval("window.fnasState = %s;" % JSON.stringify(JSON.stringify(snapshot())), true)


func _run_command(cmd: String) -> void:
	if cmd == "":
		return
	var c := get_tree().get_first_node_in_group("night_controller")
	if cmd == "dawn" and c:
		c.sim.clock.elapsed = maxf(c.sim.clock.elapsed, GameConfig.SECONDS_PER_HOUR * GameConfig.NIGHT_END_HOUR - 1.0)
	elif cmd.begins_with("scare:") and c:
		c.force_scare(int(cmd.trim_prefix("scare:")))
	elif cmd.begins_with("place:") and c:
		var parts := cmd.split(":")
		_bot(c.sim, parts[1]).room = int(parts[2])
	elif cmd.begins_with("getin:") and c:
		var b := _bot(c.sim, cmd.trim_prefix("getin:"))
		b.room = Rooms.INSIDE
		c.sim.bot_got_in(b)
	elif cmd.begins_with("attack:") and c:
		c.sim.attack(_bot(c.sim, cmd.trim_prefix("attack:")))
	elif cmd == "mute_call" and c:
		c.mute_call()
	elif cmd == "power_out" and c:
		c.sim.power.units = 0.0
	elif cmd == "sprint" and c:
		c.sim.sprinter.start_run()
	elif cmd == "reset_save":
		Game.progress = Progress.new()
		Game.save()
	elif cmd.begins_with("progress:"):
		var n := int(cmd.trim_prefix("progress:"))
		Game.progress.night = clampi(n, 1, GameConfig.LAST_NIGHT)
		Game.progress.best_night = maxi(Game.progress.best_night, Game.progress.night)
		Game.save()


func _bot(sim: NightSim, id: String) -> Bot:
	for b in sim.bots:
		if b.id == id:
			return b
	return sim.left_bot


func snapshot() -> Dictionary:
	var scene := get_tree().current_scene
	var out := {"scene": scene.name if scene else "", "time_scale": Engine.time_scale, "fps": Engine.get_frames_per_second()}
	out["progress"] = Game.progress.to_dict()
	if scene and scene.has_method("is_showing_how_to_play"):
		out["how_to_play"] = scene.is_showing_how_to_play()
	if scene and scene.has_method("buttons_shown"):
		out["title_buttons"] = scene.buttons_shown()
		out["custom_screen"] = scene.is_showing_custom_night()
		out["custom_levels"] = scene.custom_night_levels()
	var check := get_tree().get_first_node_in_group("sound_check")
	if check:
		out["sound_check"] = check.state()
	var c := get_tree().get_first_node_in_group("night_controller")
	if c == null:
		return out
	var sim: NightSim = c.sim
	var watching_curtain := sim.is_watching(Rooms.CURTAIN)
	var cam_bots: Array[String] = []
	if sim.tablet_up and sim.state == NightSim.State.PLAYING:
		for b in sim.bots_in(sim.cam):
			if b != sim.sprinter or sim.sprinter.running:
				cam_bots.append(b.display_name)
	var lit_bot := ""
	if sim.light_side != -1 and not sim.bots_at_door(sim.light_side).is_empty():
		lit_bot = sim.bots_at_door(sim.light_side)[0].display_name
	out["observe"] = {
		"state": ["playing", "power_out", "won", "lost"][sim.state],
		"clock": sim.clock.display_text(),
		"night": sim.night,
		"night_title": Game.night_title(sim.night),
		"power": sim.power.percent(),
		"usage": sim.usage(),
		"tablet_up": sim.tablet_up,
		"cam": Rooms.CAM_LABELS.get(sim.cam, ""),
		"cam_bots": cam_bots,
		"curtain_stage": sim.sprinter.stage if watching_curtain else -1,
		"curtain_empty": watching_curtain and (sim.sprinter.stage >= GameConfig.SPRINTER_LAST_STAGE or sim.sprinter.running),
		"light_side": sim.light_side,
		"lit_door_bot": lit_bot,
		"doors": sim.doors,
		"jammed": [sim.is_side_jammed(0), sim.is_side_jammed(1)],
		"leader_eyes": sim.state == NightSim.State.POWER_OUT and sim.leader_at_dark_door,
		"ending": c.ending_shown(),
		"paused": c.is_paused(),
		"pause_how_to_play": c._pause.is_showing_how_to_play(),
	}
	out["art"] = c.art_state()
	out["audio"] = c.audio_state()
	var rooms := {}
	for b in sim.bots:
		rooms[b.display_name] = Rooms.NAMES.get(b.room, "?")
	out["truth"] = {
		"time": sim.time,
		"rooms": rooms,
		"levels": {"leader": sim.leader.ai_level, "left": sim.left_bot.ai_level, "right": sim.right_bot.ai_level, "sprinter": sim.sprinter.ai_level},
		"sprinter_stage": sim.sprinter.stage,
		"sprinter_running": sim.sprinter.running,
		"sprinter_hits": sim.sprinter.door_hits,
		"death_cause": sim.death_cause,
		"power_units": sim.power.units,
	}
	return out
