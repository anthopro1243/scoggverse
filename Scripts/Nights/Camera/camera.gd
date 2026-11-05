@abstract
class_name Camera
extends Node2D

@export var rooms: Array[Array]

var current_feed: int = 0
var all_feeds: Array[Sprite2D]
var all_buttons: Array[TextureButton]

var _static_t: float = 99.0 # seconds since the last static burst

@onready var animtree: AnimationTree = $AnimationTree
@onready var cam_static: CanvasItem = get_node_or_null("CamHUD/CamStatic")

func _ready() -> void:
	_initialize_buttons()
	_initialize_feeds()

func _initialize_buttons() -> void:
	# Adds the camera feeds and buttons into arrays so they can be synced up in 'func _on_click_cam'
	all_feeds.append_array($CamRooms.get_children())
	all_buttons.append_array($CamButtons.get_children())

func _initialize_feeds() -> void:
	# Gets the camera feed id's, then sets them up with the right frame
	update_feeds(type_convert(range(all_feeds.size()), TYPE_PACKED_INT32_ARRAY))

func set_feed(_feed_to_update: int) -> void:
	pass

func update_feeds(feeds_to_update: Array[int]) -> void:
	for i in feeds_to_update:
		set_feed(i)
		if current_feed == i:
			play_static()

func switch_feed(new_feed: int) -> void:
	# This handles camera switching, but blocks it when clicking the same camera button
	if current_feed != new_feed:
		play_static()
		
		all_feeds[current_feed].visible = false
		all_buttons[current_feed].disabled = false
		
		all_feeds[new_feed].visible = true
		all_buttons[new_feed].disabled = true
		
		current_feed = new_feed

func play_static() -> void:
	_static_t = 0.0
	_update_static()

func _process(delta: float) -> void:
	_static_t += delta
	_update_static()

## Static strength from GameConfig: a burst on every switch that fades to a low idle hiss,
## which wavers a little unless "reduce flashing" is on (then the burst is smaller too).
func _update_static() -> void:
	if cam_static == null:
		return
	var reduce := Game.settings.reduce_flashing
	var burst := GameConfig.CAM_STATIC_BURST_REDUCED if reduce else GameConfig.CAM_STATIC_BURST
	var idle := GameConfig.CAM_STATIC_IDLE
	if not reduce:
		idle += GameConfig.CAM_STATIC_WAVER * (0.5 + 0.5 * sin(_static_t * TAU / GameConfig.CAM_STATIC_WAVER_SECONDS))
	var k := clampf(_static_t / GameConfig.CAM_STATIC_BURST_SECONDS, 0.0, 1.0)
	cam_static.modulate.a = lerpf(burst, idle, k)
