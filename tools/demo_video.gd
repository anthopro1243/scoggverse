extends SceneTree
## A ~35 s demo with sound for the PR: title, Night 1 starting (intro card, the phone ringing,
## the first caption), Scoggcrates in the lit left doorway and the door slamming on him, then
## the power going out, the march in the dark, the silence and Uncle Scogg's jumpscare.
## Recorded with Godot's Movie Maker (picture + game audio), through tools/demo_video.sh:
##   godot --path . --write-movie out.avi --fixed-fps 30 --resolution 1280x720 -s tools/demo_video.gd

const NIGHT_SCENE := "res://Scenes/Nights/nights.tscn"
const MARCH_SECONDS := 9.0 # how long Uncle Scogg's march plays before he attacks

var game: Node


func _initialize() -> void:
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


func _wait(seconds: float) -> void:
	await create_timer(seconds).timeout


func _run() -> void:
	game.progress = Progress.new()
	var title: Control = load("res://Scenes/Title/title.tscn").instantiate()
	root.add_child(title)
	await _wait(2.5)
	title.queue_free()

	game.pending_night = 1
	var night: Node = load(NIGHT_SCENE).instantiate()
	root.add_child(night)
	var c: Node = night.get_node("NightController")
	var sim: NightSim = c.sim
	for b in sim.bots:
		b.interval = 1.0e9 # nothing moves on its own; the demo places Scoggcrates itself
	var office: Sprite2D = night.get_node("OfficeElements/Office")
	# Intro card (3 s), the phone rings (1 s + 4.6 s), the first caption.
	await _wait(3.0 + GameConfig.VOICEMAIL_DELAY_SECONDS + GameConfig.VOICEMAIL_RING_SECONDS + 3.5)
	c.mute_call()
	await _wait(0.6)

	# Scoggcrates in the left doorway: light on, then slam the door.
	office.scroll_amount = office.scroll_clamp
	sim.left_bot.room = Rooms.LEFT_DOOR
	await _wait(0.6)
	c.press_light(Rooms.Side.LEFT)
	await _wait(1.4)
	c.press_light(Rooms.Side.LEFT)
	c.press_door(Rooms.Side.LEFT)
	await _wait(1.6)
	sim.left_bot.room = Rooms.CAFETERIA
	c.press_door(Rooms.Side.LEFT) # open again, so the dark doorway shows him
	await _wait(0.8)

	# Power out: dark, Uncle Scogg's march in the doorway, it sags, silence, jumpscare.
	sim.power.units = 0.0
	await process_frame
	await process_frame
	sim.power_out_attack_at = GameConfig.POWER_OUT_APPEAR_SECONDS + MARCH_SECONDS
	await _wait(GameConfig.POWER_OUT_APPEAR_SECONDS + MARCH_SECONDS + GameConfig.JUMPSCARE_SILENCE_SECONDS + 3.5)
	quit()
