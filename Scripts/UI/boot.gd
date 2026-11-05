extends Control
## Loading screen (the main scene): preloads the art into ArtCache a few files per frame with a
## progress bar, then opens the title. The engine download itself shows the browser's own bar
## before this; this covers decoding the textures, so the title and the night never stall on it.

const BAR := Rect2(560, 640, 800, 18)

var _paths: Array[String] = []
var _next: int = 0
var _fill: ColorRect
var _label: Label


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(BotStyle.rect(Rect2(0, 0, 1920, 1080), Color(0.03, 0.03, 0.04)))
	_center("FIVE NIGHTS AT SCOGGY'S", 64, 430, Color(0.85, 0.85, 0.85))
	_center("Don't deny yourself an education.", 28, 520, Color(0.55, 0.55, 0.55))
	add_child(BotStyle.rect(BAR.grow(3), Color(0.25, 0.25, 0.27)))
	add_child(BotStyle.rect(BAR, Color(0.08, 0.08, 0.09)))
	_fill = BotStyle.rect(Rect2(BAR.position, Vector2(0, BAR.size.y)), Color(0.85, 0.15, 0.15))
	add_child(_fill)
	_label = _center("Loading...", 26, 680, Color(0.7, 0.7, 0.7))
	_paths = ArtCache.manifest()


func _process(_delta: float) -> void:
	_next = ArtCache.preload_some(_paths, _next)
	var f := 1.0 if _paths.is_empty() else float(_next) / _paths.size()
	_fill.size.x = BAR.size.x * f
	_label.text = "Loading...  %d%%" % int(f * 100)
	if _next >= _paths.size():
		set_process(false)
		Game.to_title()


## Fraction loaded (for the playtest).
func progress() -> float:
	return 1.0 if _paths.is_empty() else float(_next) / _paths.size()


func _center(text: String, size: int, y: float, color: Color) -> Label:
	var l := BotStyle.label(text, size, color)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.position = Vector2(0, y)
	l.size = Vector2(1920, size * 1.4)
	add_child(l)
	return l
