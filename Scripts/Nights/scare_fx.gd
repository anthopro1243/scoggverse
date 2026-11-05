class_name ScareFx
extends CanvasLayer
## Full-screen flashes over the office: hallucinations (a slide picture over the view for a few
## frames, with grain) and the rare Absolute Scoggema scare. With "reduce flashing" on they fade
## in and out at a lower alpha and don't jitter.

var _image: TextureRect
var _left: float = 0.0
var _seconds: float = 0.0 # how long the current flash is held at full strength
var _alpha: float = 1.0
var _reduce := false
## What's flashing ("", "halluc_p08", "scoggema", ...), for the playtest.
var current: String = ""
## The last thing flashed (stays set; the flashes are too short to poll at playtest speed).
var last: String = ""


func _ready() -> void:
	layer = 15
	_image = TextureRect.new()
	_image.size = Vector2(1920, 1080)
	_image.stretch_mode = TextureRect.STRETCH_SCALE
	_image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_image.visible = false
	add_child(_image)


func _process(delta: float) -> void:
	if _left > 0.0:
		_left -= delta
		if _reduce:
			_image.position = Vector2.ZERO
		else: # a little jitter while it's up
			_image.position = Vector2(randf_range(-8, 8), randf_range(-6, 6))
		_image.modulate.a = _alpha * envelope(_left, _seconds, _reduce)
		if _left <= 0.0:
			_image.visible = false
			current = ""


func hallucinate(page: int) -> void:
	_show("scares/halluc_p%02d" % page, GameConfig.HALLUCINATION_SECONDS, 0.85)


func rare_scare() -> void:
	_show("scares/scoggema", GameConfig.RARE_SCARE_SECONDS, 1.0)


func _show(path: String, seconds: float, alpha: float) -> void:
	_image.texture = BotStyle.art(path)
	if _image.texture == null:
		return
	_reduce = Game.settings.reduce_flashing
	_alpha = alpha
	_seconds = seconds
	_left = duration(seconds, _reduce)
	_image.modulate = Color(1, 1, 1, _alpha * envelope(_left, _seconds, _reduce))
	_image.visible = true
	current = path.get_file()
	last = current


## How long a flash held for `seconds` stays up: with reduced flashing it also fades in and out.
static func duration(seconds: float, reduce: bool) -> float:
	return seconds + 2.0 * GameConfig.REDUCED_FLASH_FADE_SECONDS if reduce else seconds


## A flash's alpha multiplier with `left` seconds to go: 1 normally; with reduced flashing a
## soft ramp up, a hold and a ramp down, capped at REDUCED_FLASH_ALPHA.
static func envelope(left: float, seconds: float, reduce: bool) -> float:
	if not reduce:
		return 1.0
	var fade := GameConfig.REDUCED_FLASH_FADE_SECONDS
	var total := seconds + 2.0 * fade
	var t := total - left
	var k := clampf(minf(t, left) / fade, 0.0, 1.0)
	return GameConfig.REDUCED_FLASH_ALPHA * k
