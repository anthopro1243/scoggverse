extends Node2D

signal raising # the tablet started lifting
signal raised # the tablet finished lifting; cameras are live
signal lowering # the tablet started coming down

const HOVER_FADE_DURATION: float = 0.3

@export_group("Setup")
@export var camera: Camera
@export var office: Node2D

var is_tablet_up: bool = false
var locked: bool = false: # no raising (power out, night over)
	set(value):
		locked = value
		tablet_button.visible = not value
var tweener: Tween
var _last_hover_toggle: int = -10000 # msec

@onready var tablet_button: TextureButton = $Tablet_Button
@onready var tablet_sprite: AnimatedSprite2D = $Tablet_Sprite

func _on_tablet_button_click() -> void:
	# This function handles if the tablet animation should be played fowards or backwards
	if tablet_sprite.is_playing():
		return
	if not is_tablet_up:
		if locked:
			return
		tablet_sprite.play("lift")
		tablet_sprite.visible = true
		office.can_move = false
		raising.emit()
	else:
		tablet_sprite.play_backwards("lift")
		tablet_button.disabled = true
		camera.visible = false
		lowering.emit()

func _tablet_animation_finished() -> void:
	if not is_tablet_up:
		is_tablet_up = true
		camera.visible = true
		camera.play_static()
		raised.emit()
	else:
		is_tablet_up = false
		tablet_sprite.visible = false
		office.can_move = true
		tablet_button.disabled = false

## Like FNAF, moving the mouse onto the bar flips the tablet. A tap on a touch screen
## also sends a press right after; that press is ignored so the tablet doesn't flip back.
func _on_bar_entered() -> void:
	_last_hover_toggle = Time.get_ticks_msec()
	toggle()

func _on_bar_pressed() -> void:
	if Time.get_ticks_msec() - _last_hover_toggle > 400:
		toggle()

func toggle() -> void:
	if not tablet_button.disabled:
		_on_tablet_button_click()

## Drops the tablet at once (power out, jumpscare, night over).
func force_down() -> void:
	var was_up := is_tablet_up and camera.visible
	tablet_sprite.stop()
	tablet_sprite.visible = false
	camera.visible = false
	is_tablet_up = false
	office.can_move = true
	tablet_button.disabled = false
	if was_up:
		lowering.emit()

func _on_tablet_button_hover(alpha: float) -> void:
	if tweener: tweener.kill()
	tweener = create_tween()
	tweener.tween_property(tablet_button, "modulate:a", alpha, HOVER_FADE_DURATION)
