extends Control
## "How to Play": controls, what each bot does, and one tip each, in plain words.
## Shown from the title screen and the pause menu.

signal closed

const GOAL := "Survive from 12 AM to 6 AM (about 9 minutes) in your office. Robots roam the school after dark. Keep them out, and don't run out of power."

const CONTROLS: Array[String] = [
	"[b]Doors[/b]: click DOOR on either side (or press A / D). A shut door keeps robots out, but it uses power.",
	"[b]Lights[/b]: click LIGHT (or Q / E) to see who's standing in that doorway. One light at a time.",
	"[b]Cameras[/b]: move the mouse onto the bar at the bottom (or press Space) to raise the tablet. Pick a CAM button (or keys 1–9). Lower it the same way.",
	"You can't use doors or lights while the tablet is up.",
	"[b]Power[/b]: every door, light and the tablet adds a bar of usage (bottom left). At 0% the doors open and the lights die. Nobody wants that.",
	"[b]Esc[/b] pauses the game. [b]F[/b] switches full screen on and off.",
]

const BOTS: Array[Array] = [
	["Scoggcrates", "left_hall", "Wanders the left side of the school and ends up at your LEFT door.",
		"Flick the left light every few seconds. If it's in the doorway, shut the door, and open it again once the doorway is empty."],
	["Scogga Lisa", "right_hall", "Does the same on the right side and comes to your RIGHT door.",
		"Same trick with the right light. Don't leave the door shut longer than you need; it drains power."],
	["Scoggis Khan", "sprinter", "Hides in the yurt on CAM 5 and creeps out when you don't look. Once the yurt is empty, it sprints down the left hall (CAM 6).",
		"Peek at CAM 5 now and then. Yurt empty? Shut the left door right away."],
	["Uncle Scogg", "leader", "The boss. Leaves the stage last and only moves while nobody watches it. From the right corner (CAM 9) it sneaks in while you look at other cameras.",
		"Check CAM 9 first. If it's there, drop the tablet and shut the right door."],
]


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(BotStyle.rect(Rect2(0, 0, 1920, 1080), Color(0.04, 0.04, 0.05)))

	var title := BotStyle.label("How to Play", 72)
	title.position = Vector2(80, 40)
	add_child(title)

	var goal := _text(GOAL, Rect2(80, 150, 1760, 80), 32)
	add_child(goal)

	add_child(_heading("Controls", Vector2(80, 240)))
	add_child(_text("\n".join(CONTROLS.map(func(l: String) -> String: return "•  " + l)), Rect2(80, 300, 800, 640), 27))

	add_child(_heading("The robots", Vector2(960, 240)))
	var y := 300.0
	for b in BOTS:
		var swatch := BotStyle.rect(Rect2(960, y + 6, 26, 26), BotStyle.COLORS[b[1]])
		add_child(swatch)
		var block := _text("[b]%s[/b]  %s\n[color=#9fdc9f]Tip:[/color] %s" % [b[0], b[2], b[3]], Rect2(1000, y, 860, 150), 24)
		add_child(block)
		y += 155.0

	add_child(_text("If a robot gets in, that side's door and light stop working, and it gets you when you lower the tablet.", Rect2(80, 790, 800, 90), 27))
	add_child(_text("[color=#ffd95a]Each night is harder.[/color] Beat Night 5 to unlock Night 6, and Night 6 to unlock Custom Night. Every 6 AM earns Scogg Bucks, with a bonus for power left.", Rect2(80, 890, 800, 130), 27))

	var back := Button.new()
	back.text = "Back"
	back.position = Vector2(1640, 950)
	back.size = Vector2(220, 90)
	back.focus_mode = Control.FOCUS_NONE
	back.add_theme_font_size_override("font_size", 40)
	back.pressed.connect(func() -> void: closed.emit())
	add_child(back)


func _heading(text: String, pos: Vector2) -> Label:
	var l := BotStyle.label(text, 44, Color(1, 0.85, 0.35))
	l.position = pos
	return l


func _text(bbcode: String, r: Rect2, size: int) -> RichTextLabel:
	var t := RichTextLabel.new()
	t.bbcode_enabled = true
	t.fit_content = false
	t.scroll_active = false
	t.position = r.position
	t.size = r.size
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for font in ["normal_font_size", "bold_font_size"]:
		t.add_theme_font_size_override(font, size)
	t.text = bbcode
	return t
