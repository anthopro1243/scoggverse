extends Node2D
## The camera feed: the rendered room with a see-through layer for each bot in it, the yurt's
## stages on CAM 5, Scoggis Khan mid-sprint on CAM 6, the Scoggipede crawling across CAM 7, and
## glitch frames. On top: live grain, scanlines, flicker, the REC dot and a timestamp.
## Lives under CameraElements so Cupcakes' CRT and static sit on top.

signal feed_changed # bots moved in the watched room, or the camera switched

const FEED := Rect2(361, 147, 1199, 890)
const MAX_BOTS := 3
const GRAIN_FRAMES := 4
const GRAIN_SIZE := Vector2i(300, 223)

var _feed: Node2D
var _base: Sprite2D
var _bots: Array[Sprite2D] = []
var _glitch: Sprite2D
var _p59: Sprite2D
var _crawler: Sprite2D
var _grain: TextureRect
var _grain_tex: Array[ImageTexture] = []
var _title: Label
var _rec: Label
var _stamp: Label
var _signature := ""
var _cam_key := ""
var _shown_bots: Array[String] = []

var _flicker_left: float = 0.0
var _glitch_left: float = 0.0
var _p59_left: float = 0.0
var _crawl_t: float = -1.0
var _blink: float = 0.0
var _grain_i: int = 0


func _ready() -> void:
	z_index = 15 # same layer as the room sprites, so the CRT back-buffer copy picks it up
	add_child(BotStyle.rect(FEED, Color(0.02, 0.025, 0.02)))
	_feed = Node2D.new()
	_feed.position = FEED.position
	add_child(_feed)
	_base = Sprite2D.new()
	_base.centered = false
	_feed.add_child(_base)
	for i in MAX_BOTS:
		var s := Sprite2D.new()
		s.centered = false
		s.visible = false
		_feed.add_child(s)
		_bots.append(s)
	_crawler = BotStyle.sprite("cams/scoggipede", Vector2.ZERO)
	_feed.add_child(_crawler)
	_glitch = Sprite2D.new()
	_glitch.centered = false
	_glitch.visible = false
	_feed.add_child(_glitch)
	_p59 = BotStyle.sprite("scares/halluc_p59", Vector2.ZERO)
	_feed.add_child(_p59)

	# Live film effects over the picture.
	var rng := RandomNumberGenerator.new()
	for f in GRAIN_FRAMES:
		var img := Image.create(GRAIN_SIZE.x, GRAIN_SIZE.y, false, Image.FORMAT_L8)
		for y in GRAIN_SIZE.y:
			for x in GRAIN_SIZE.x:
				img.set_pixel(x, y, Color.from_hsv(0, 0, rng.randf()))
		_grain_tex.append(ImageTexture.create_from_image(img))
	_grain = TextureRect.new()
	_grain.texture = _grain_tex[0]
	_grain.size = FEED.size
	_grain.stretch_mode = TextureRect.STRETCH_SCALE
	_grain.modulate = Color(1, 1, 1, 0.13)
	_grain.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_feed.add_child(_grain)
	var lines := Image.create(4, 4, false, Image.FORMAT_LA8)
	for y in 4:
		for x in 4:
			lines.set_pixel(x, y, Color(0, 0, 0, 0.5 if y < 2 else 0.0))
	var scan := TextureRect.new()
	scan.texture = ImageTexture.create_from_image(lines)
	scan.size = FEED.size
	scan.stretch_mode = TextureRect.STRETCH_TILE
	scan.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	scan.modulate = Color(1, 1, 1, 0.45)
	scan.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_feed.add_child(scan)

	_title = BotStyle.label("", 44, Color(0.85, 0.9, 0.85))
	_title.position = FEED.position + Vector2(40, 30)
	add_child(_title)
	_rec = BotStyle.label("● REC", 36, Color(0.95, 0.12, 0.1))
	_rec.position = FEED.position + Vector2(FEED.size.x - 190, 30)
	add_child(_rec)
	_stamp = BotStyle.label("", 30, Color(0.85, 0.9, 0.85))
	_stamp.position = FEED.position + Vector2(FEED.size.x - 260, FEED.size.y - 70)
	add_child(_stamp)


func _process(delta: float) -> void:
	_blink += delta
	_rec.visible = fmod(_blink, 1.0) < 0.6
	_grain_i = (_grain_i + 1) % GRAIN_FRAMES
	_grain.texture = _grain_tex[_grain_i]
	_grain.position = Vector2(randf_range(-6, 6), randf_range(-6, 6))
	var reduce := Game.settings.reduce_flashing
	var level := GameConfig.REDUCED_CAM_LEVEL
	if not reduce:
		if _flicker_left <= 0.0 and randf() < GameConfig.CAM_FLICKER_CHANCE_PER_SECOND * delta:
			_flicker_left = randf_range(0.04, 0.12)
		_flicker_left -= delta
		level = GameConfig.CAM_FLICKER_DIM if _flicker_left > 0.0 else randf_range(0.93, 1.0)
	_feed.modulate = Color(level, level, level)
	_glitch_left -= delta
	_glitch.visible = _glitch_left > 0.0
	_glitch.modulate.a = GameConfig.REDUCED_FLASH_ALPHA if reduce else 1.0
	_p59_left -= delta
	_p59.visible = _p59_left > 0.0
	if _p59.visible:
		_p59.modulate.a = ScareFx.envelope(_p59_left, GameConfig.HALLUCINATION_SECONDS, reduce)
	if _crawl_t >= 0.0:
		_crawl_t += delta
		var t := _crawl_t / GameConfig.SCOGGIPEDE_CRAWL_SECONDS
		if t >= 1.0:
			_crawl_t = -1.0
		else:
			var w := 380.0
			_crawler.position = Vector2(lerpf(FEED.size.x + 20, -w - 20, t), FEED.size.y * 0.66 + sin(_crawl_t * 9.0) * 4.0)
	_crawler.visible = _crawl_t >= 0.0 and _cam_key == "cam7"


func refresh(sim: NightSim) -> void:
	var room := sim.cam
	_cam_key = "cam" + Rooms.CAM_LABELS.get(room, "1")
	_title.text = Rooms.cam_title(room)
	_stamp.text = _timestamp(sim.time)
	var stage := -1
	if room == Rooms.CURTAIN:
		stage = GameConfig.SPRINTER_LAST_STAGE if sim.sprinter.running else sim.sprinter.stage
		_set_tex(_base, "cams/cam5_s%d" % stage)
	else:
		_set_tex(_base, "cams/" + _cam_key)
	var shown: Array[Bot] = []
	for b in sim.bots_in(room):
		if b != sim.sprinter or sim.sprinter.running:
			shown.append(b)
	_shown_bots.clear()
	var layers: Dictionary = ArtLayout.CAM_BOTS.get(_cam_key, {})
	var used := 0
	for b in shown:
		var art := BotStyle.art_of(b)
		if not layers.has(art) or used >= MAX_BOTS:
			continue
		var s := _bots[used]
		_set_tex(s, "cams/%s__%s" % [_cam_key, art])
		s.position = layers[art]
		s.visible = true
		_shown_bots.append(art)
		used += 1
	for i in range(used, MAX_BOTS):
		_bots[i].visible = false
	var signature := "%d|%s|%d|%s" % [room, shown, stage, sim.sprinter.running]
	if signature != _signature:
		_signature = signature
		feed_changed.emit()


## A standee flashes for a frame or two in a spot it isn't (a bot that isn't in this room).
func glitch() -> void:
	var layers: Dictionary = ArtLayout.CAM_BOTS.get(_cam_key, {})
	var choices: Array = layers.keys().filter(func(a: String) -> bool: return not _shown_bots.has(a))
	if choices.is_empty():
		return
	var art: String = choices[randi() % choices.size()]
	_set_tex(_glitch, "cams/%s__%s" % [_cam_key, art])
	_glitch.position = layers[art]
	_glitch_left = GameConfig.GLITCH_SECONDS


func start_scoggipede() -> void:
	_crawl_t = 0.0


## p. 59 flashes over the feed (with the static burst).
func flash_p59() -> void:
	_p59_left = ScareFx.duration(GameConfig.HALLUCINATION_SECONDS, Game.settings.reduce_flashing)


## True while the Scoggipede is crossing CAM 7 (for the playtest).
func crawling() -> bool:
	return _crawl_t >= 0.0


## Art names of the standees on the feed right now (for the playtest).
func shown_bots() -> Array[String]:
	return _shown_bots


func _set_tex(s: Sprite2D, path: String) -> void:
	if s.get_meta("path", "") != path:
		s.set_meta("path", path)
		s.texture = BotStyle.art(path)


## The feed's timestamp from the night clock: 12:00:00 AM at the start, 6 AM at the end.
static func _timestamp(time: float) -> String:
	var total := int(time / GameConfig.SECONDS_PER_HOUR * 3600.0)
	var h := GameConfig.NIGHT_START_HOUR + total / 3600
	var shown_h := 12 if h % 12 == 0 else h % 12
	return "%d:%02d:%02d AM" % [shown_h, (total / 60) % 60, total % 60]
