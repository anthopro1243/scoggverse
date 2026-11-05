class_name NightClock
extends RefCounted
## 12 AM to 6 AM at GameConfig.SECONDS_PER_HOUR real seconds per in-game hour.

var elapsed: float = 0.0


## Advances the clock and returns every hour (1-6) that started during this step.
func advance(dt: float) -> Array[int]:
	var before := hour()
	elapsed += dt
	var crossed: Array[int] = []
	for h in range(before + 1, hour() + 1):
		crossed.append(h)
	return crossed


## Hours since 12 AM, 0-6.
func hour() -> int:
	return mini(int(elapsed / GameConfig.SECONDS_PER_HOUR), GameConfig.NIGHT_END_HOUR)


func is_over() -> bool:
	return elapsed >= GameConfig.SECONDS_PER_HOUR * (GameConfig.NIGHT_END_HOUR - GameConfig.NIGHT_START_HOUR)


func display_text() -> String:
	var h := hour()
	return "12 AM" if h == 0 else "%d AM" % h
