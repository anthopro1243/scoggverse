extends SceneTree
## Plays the night scene on a (virtual) screen and saves labeled PNGs of fixed moments.
## Run through tools/screenshots.sh, which wraps it in xvfb and builds the sheet.
##   godot --path . --windowed --resolution 1920x1080 -s tools/screenshot.gd -- --out=docs/screens/raw --tag=desktop
## Shots are saved at the window size, so a 375 px window shows what a phone sees.
## The night is frozen (controller.running = false) and each moment is set up directly on the sim.

const NIGHT_SCENE := "res://Scenes/Nights/nights.tscn"

var out_dir := "res://docs/screens/raw"
var tag := "desktop"
var shot_index := 0

var night: Node
var controller: Node
var sim: NightSim
var office: Sprite2D
var tablet: Node2D
var game: Node # the Game autoload (added here if running with -s skipped autoloads)


func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):
			out_dir = arg.trim_prefix("--out=")
		elif arg.begins_with("--tag="):
			tag = arg.trim_prefix("--tag=")
	DirAccess.make_dir_recursive_absolute(_abs(out_dir))
	game = root.get_node_or_null("Game")
	if game == null:
		game = load("res://Scripts/game_state.gd").new()
		game.name = "Game"
		root.add_child(game)
	for extra in [["ArtCache", "res://Scripts/art_cache.gd"], ["Sound", "res://Scripts/sound.gd"]]:
		if root.get_node_or_null(extra[0]) == null:
			var n: Node = load(extra[1]).new()
			n.name = extra[0]
			root.add_child(n)
	_run.call_deferred()


func _abs(path: String) -> String:
	return ProjectSettings.globalize_path(path) if path.begins_with("res://") else path


func _load_night(p_night: int = 1) -> void:
	if night:
		night.queue_free()
		await process_frame
	game.pending_night = p_night
	night = load(NIGHT_SCENE).instantiate()
	root.add_child(night)
	controller = night.get_node("NightController")
	controller.running = false
	sim = controller.sim
	sim.rng.seed = 1
	office = night.get_node("OfficeElements/Office")
	tablet = night.get_node("TabletElements")


func _look(where: String) -> void:
	office.scroll_amount = {"left": office.scroll_clamp, "center": 0, "right": -office.scroll_clamp}[where]


func _run() -> void:
	# A player partway through: Continue at Night 3, Custom Night unlocked, some bucks.
	game.progress = Progress.new()
	game.progress.night = 3
	game.progress.best_night = 6
	game.progress.custom_unlocked = true
	game.progress.scogg_bucks = 145
	var title: Control = load("res://Scenes/Title/title.tscn").instantiate()
	root.add_child(title)
	await _wait(0.5)
	await _shot("title")
	title.show_how_to_play()
	await _wait(0.5)
	await _shot("how_to_play")
	title._overlay.closed.emit()
	title.show_custom_night()
	title._overlay.set_levels({"leader": 10, "left_hall": 15, "right_hall": 15, "sprinter": 20})
	await _wait(0.5)
	await _shot("custom_night")
	title._overlay.closed.emit()
	title._open(load("res://Scripts/UI/settings_menu.gd").new())
	await _wait(0.4)
	await _shot("settings")
	var check: Control = load("res://Scripts/UI/sound_check.gd").new()
	title._overlay.add_child(check)
	await _wait(0.4)
	await _shot("sound_check")
	check.closed.emit()
	title._overlay.closed.emit()
	title._open(load("res://Scripts/UI/credits.gd").new())
	await _wait(0.4)
	await _shot("credits")
	title.queue_free()

	await _load_night(3)
	await _wait(0.5)
	await _shot("night_intro")
	controller.skip_intro()
	await _wait(1.0)
	await _shot("office_start")

	# The nightly call, picked up, with its first caption.
	var vm: Node = controller._voicemail
	vm.start(3, controller._audio)
	vm.phase = vm.Phase.RINGING
	vm._t = GameConfig.VOICEMAIL_RING_SECONDS
	await _wait(0.4)
	await _shot("voicemail_captions")
	vm.stop()

	_look("left")
	sim.set_door(Rooms.Side.LEFT, true)
	await _wait(1.0)
	await _shot("left_door_shut")

	sim.set_door(Rooms.Side.LEFT, false)
	sim.left_bot.room = Rooms.LEFT_DOOR
	sim.set_light(Rooms.Side.LEFT, true)
	await _wait(0.3)
	await _shot("left_light_scoggcrates_at_door")

	_look("right")
	sim.set_light(Rooms.Side.LEFT, false)
	sim.right_bot.room = Rooms.RIGHT_DOOR
	sim.set_door(Rooms.Side.RIGHT, true)
	sim.set_light(Rooms.Side.RIGHT, true)
	await _wait(1.0)
	await _shot("right_light_lisa_behind_shut_door")

	_look("center")
	sim.set_light(Rooms.Side.RIGHT, false)
	sim.set_door(Rooms.Side.LEFT, true)
	sim.power.units = 140
	await _wait(1.0)
	await _shot("power_low")

	sim.power.units = 999
	sim.set_door(Rooms.Side.LEFT, false)
	sim.set_door(Rooms.Side.RIGHT, false)
	sim.left_bot.room = Rooms.STAGE
	sim.right_bot.room = Rooms.STAGE
	tablet._on_tablet_button_click()
	await _wait(1.5)
	await _shot("cam_1_stage")

	sim.sprinter.stage = 1
	controller.select_cam(Rooms.CURTAIN)
	await _wait(0.8)
	await _shot("cam_5_yurt_khan_peeking")

	sim.sprinter.start_run()
	controller.select_cam(Rooms.LEFT_HALL)
	await _wait(0.8)
	await _shot("cam_6_khan_running")

	sim.sprinter.running = false
	sim.sprinter.stage = 0
	sim.sprinter.room = Rooms.CURTAIN
	sim.left_bot.room = Rooms.LIBRARY
	sim.right_bot.room = Rooms.LOUNGE
	sim.leader.room = Rooms.RIGHT_CORNER
	controller.select_cam(Rooms.RIGHT_CORNER)
	await _wait(0.8)
	await _shot("cam_9_uncle_in_corner")

	sim.leader.room = Rooms.STAGE
	sim.right_bot.room = Rooms.RIGHT_HALL
	controller.select_cam(Rooms.RIGHT_HALL)
	await _wait(0.8)
	await _shot("cam_8_lisa_close")

	sim.right_bot.room = Rooms.LOUNGE
	sim.left_bot.room = Rooms.LEFT_CORNER
	controller.select_cam(Rooms.LEFT_CORNER)
	controller.force_scare(ScareEvents.SCOGGIPEDE)
	await _wait(2.6)
	await _shot("cam_7_scoggipede_crawling")

	sim.left_bot.room = Rooms.STAGE
	tablet._on_tablet_button_click()
	await _wait(1.0)
	_look("center")
	controller.force_scare(ScareEvents.HALLUCINATION)
	await process_frame
	await _shot("hallucination_flash")
	await _wait(0.4)
	controller.force_scare(ScareEvents.RARE_SCARE)
	await process_frame
	await _shot("rare_scare_absolute_scoggema")
	await _wait(0.4)
	await _wait(1.0)
	_look("left")
	sim.power.units = 0.01
	var t := 0.0
	while t < GameConfig.POWER_OUT_APPEAR_SECONDS + 0.5:
		sim.step(0.05)
		t += 0.05
	await _wait(1.0)
	await _shot("power_out_uncle_at_left_door")

	sim.attack(sim.leader, "%s (power out)" % sim.leader.display_name)
	await _wait(0.35)
	await _shot("jumpscare_flat_uncle")
	await _wait(GameConfig.JUMPSCARE_SECONDS)
	await _shot("game_over")

	await _load_night(3)
	controller.skip_intro()
	await _wait(0.5)
	sim.attack(sim.left_bot)
	await _wait(0.4)
	await _shot("jumpscare_rush_scoggcrates")

	await _load_night(5)
	controller.skip_intro()
	sim.power.units = 427
	sim.clock.elapsed = GameConfig.SECONDS_PER_HOUR * 6 - 0.01
	sim.step(0.05)
	await _wait(0.5)
	await _shot("win_6am_scogg_bucks")

	quit(0)


func _wait(seconds: float) -> void:
	await create_timer(seconds).timeout
	await process_frame
	await process_frame


func _shot(label: String) -> void:
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	var window_size := DisplayServer.window_get_size()
	if image.get_size() != window_size:
		image.resize(window_size.x, window_size.y, Image.INTERPOLATE_BILINEAR)
	shot_index += 1
	var path := "%s/%s_%02d_%s.png" % [out_dir, tag, shot_index, label]
	image.save_png(_abs(path))
	print("screenshot: ", path)
