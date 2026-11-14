extends Control
## Credits: the tools and libraries, and where the music and sounds come from. The classmates'
## slides are used with Dr. Scoggins' OK and, per the deck's rules, their makers aren't credited.

signal closed

const TEXT := """[b]Five Nights at Scoggy's[/b]
A free, non-commercial fan parody of [i]Five Nights at Freddy's[/i] by Scott Cawthon (not affiliated or endorsed). Only its rules and numbers are copied. Starring Dr. Scoggins, who approved it.

[color=#ffd95a]Made with[/color]
•  [b]Godot Engine[/b] (MIT license), godotengine.org
•  [b]Cupcakes Framework[/b] by [b]Oplexitie[/b] (MIT license): the office, tablet and camera systems
•  [b]Blender[/b] (GPL): the rooms
•  Fonts: Special Elite by Astigmatic (Apache License 2.0) for the headings, Open Sans (Godot's built-in font, SIL Open Font License) and DejaVu (free license)

[color=#ffd95a]Pictures[/color]
The cutouts are from the class's Scogg Files slides.

[color=#ffd95a]Sound and music[/color]
Every sound is made in code, no recordings. The nightly call is captions over a phone-line sound.
The power-out march is [b]The Stars and Stripes Forever[/b] by John Philip Sousa (1896, public domain), played on a synthesized music box from the notes of the Mutopia Project's public-domain edition.

Don't deny yourself an education."""


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(BotStyle.rect(Rect2(0, 0, 1920, 1080), Color(0.04, 0.04, 0.05)))  # solid: the title screen must not show through
	var title := BotStyle.label("Credits", 72)
	title.position = Vector2(160, 50)
	add_child(title)
	var t := RichTextLabel.new()
	t.bbcode_enabled = true
	t.scroll_active = false
	t.position = Vector2(160, 160)
	t.size = Vector2(1600, 800)
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for font in ["normal_font_size", "bold_font_size", "italics_font_size"]:
		t.add_theme_font_size_override(font, 28)
	t.text = TEXT
	add_child(t)
	var back := Button.new()
	back.text = "Back"
	back.position = Vector2(1640, 950)
	back.size = Vector2(220, 90)
	back.focus_mode = Control.FOCUS_NONE
	back.add_theme_font_size_override("font_size", 40)
	back.pressed.connect(func() -> void: closed.emit())
	add_child(back)
