extends SceneTree
## Headless night simulator: plays N nights with DecentPlayer and reports win rate,
## power left and causes of death as a Markdown table.
##   godot --headless -s tools/night_sim.gd -- --nights=1000 --night=1 --out=docs/sim/night_sim.md

const STEP: float = 0.1

var nights := 1000
var night := 1
var base_seed := 1000
var out_path := ""
var player_kind := "well"
var levels := {} # --levels=leader,left,right,sprinter overrides the night table


func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		var kv := arg.trim_prefix("--").split("=")
		if kv.size() != 2:
			continue
		match kv[0]:
			"nights": nights = int(kv[1])
			"night": night = int(kv[1])
			"seed": base_seed = int(kv[1])
			"out": out_path = kv[1]
			"player": player_kind = kv[1]
			"levels":
				var v := kv[1].split(",")
				levels = {"leader": int(v[0]), "left_hall": int(v[1]), "right_hall": int(v[2]), "sprinter": int(v[3])}
	var start := Time.get_ticks_msec()
	var wins := 0
	var power_wins := 0.0
	var power_all := 0.0
	var deaths: Dictionary[String, int] = {}
	var death_times := 0.0
	for i in nights:
		var sim := NightSim.new(night, levels, base_seed + i)
		var player := DecentPlayer.new()
		player.attach(sim, base_seed + i + 500000)
		if player_kind == "doors_shut":
			sim.set_door(Rooms.Side.LEFT, true)
			sim.set_door(Rooms.Side.RIGHT, true)
		while not sim.is_finished():
			if player_kind == "well":
				player.update(sim)
			sim.step(STEP)
		player.release()
		power_all += sim.power.percent()
		if sim.state == NightSim.State.WON:
			wins += 1
			power_wins += sim.power.percent()
		else:
			deaths[sim.death_cause] = deaths.get(sim.death_cause, 0) + 1
			death_times += sim.time
	var losses := nights - wins
	var top := "none"
	var top_count := 0
	for cause in deaths:
		if deaths[cause] > top_count:
			top = cause
			top_count = deaths[cause]
	var lines: Array[String] = []
	lines.append("| Night | AI levels (leader / left / right / sprinter) | Nights | Win rate | Avg power left (wins) | Avg power left (all) | Most common death |")
	lines.append("|---|---|---|---|---|---|---|")
	var lv: Dictionary = levels if not levels.is_empty() else GameConfig.levels_for(night)
	lines.append("| %d | %d / %d / %d / %d | %d | %.1f%% | %s | %.1f%% | %s |" % [
		night, lv.leader, lv.left_hall, lv.right_hall, lv.sprinter, nights,
		100.0 * wins / nights,
		("%.1f%%" % (power_wins / wins)) if wins > 0 else "-",
		power_all / nights,
		("%s (%d of %d deaths)" % [top, top_count, losses]) if losses > 0 else "none",
	])
	if losses > 0:
		lines.append("")
		lines.append("Deaths by cause (average time of death %s):" % _clock(death_times / losses))
		lines.append("")
		lines.append("| Cause | Deaths |")
		lines.append("|---|---|")
		var causes := deaths.keys()
		causes.sort_custom(func(a, b): return deaths[a] > deaths[b])
		for cause in causes:
			lines.append("| %s | %d |" % [cause, deaths[cause]])
	var report := "\n".join(lines)
	print(report)
	print("(%d nights in %.1f s)" % [nights, (Time.get_ticks_msec() - start) / 1000.0])
	if out_path != "":
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out_path).get_base_dir())
		var f := FileAccess.open(out_path, FileAccess.WRITE)
		f.store_string(report + "\n")
	quit(0)


func _clock(seconds: float) -> String:
	var h := int(seconds / GameConfig.SECONDS_PER_HOUR)
	var m := int(fmod(seconds, GameConfig.SECONDS_PER_HOUR) / GameConfig.SECONDS_PER_HOUR * 60.0)
	return "%d:%02d AM" % [12 if h == 0 else h, m]
