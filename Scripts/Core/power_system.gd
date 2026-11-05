class_name PowerSystem
extends RefCounted
## Power in internal units (999 = 99.9%). Drains with usage, plus a passive drain from night 2.

var units: float = GameConfig.POWER_START_UNITS
var _passive_timer: float = 0.0


static func usage(doors_closed: int, light_on: bool, tablet_up: bool) -> int:
	return (GameConfig.USAGE_BASE
		+ doors_closed * GameConfig.USAGE_PER_DOOR
		+ (GameConfig.USAGE_PER_LIGHT if light_on else 0)
		+ (GameConfig.USAGE_TABLET if tablet_up else 0))


func drain(dt: float, current_usage: int, night: int) -> void:
	units -= current_usage * GameConfig.POWER_UNITS_PER_SECOND_PER_USAGE * dt
	var interval := GameConfig.passive_drain_interval(night)
	if interval > 0.0:
		_passive_timer += dt
		while _passive_timer >= interval:
			_passive_timer -= interval
			units -= GameConfig.PASSIVE_DRAIN_UNITS
	units = maxf(units, 0.0)


func spend(amount: float) -> void:
	units = maxf(units - amount, 0.0)


func is_out() -> bool:
	return units <= 0.0


## Whole percent, as shown on screen (999 units shows 99%).
func percent() -> int:
	return floori(units / 10.0)
