class_name BotStyle
extends RefCounted
## Shared look helpers: each bot's art name and fallback color, labels, rects, and cached art loads.

## Sim bot id -> its standee's art name (the files under Graphics/Scogg/ use these).
const ART: Dictionary[String, String] = {
	"leader": "uncle_scogg",
	"left_hall": "scoggcrates",
	"right_hall": "scogga_lisa",
	"sprinter": "scoggis_khan",
}

const COLORS: Dictionary[String, Color] = {
	"leader": Color(0.55, 0.36, 0.2),
	"left_hall": Color(0.48, 0.32, 0.82),
	"right_hall": Color(0.88, 0.76, 0.2),
	"sprinter": Color(0.82, 0.2, 0.2),
}


static func art_of(bot: Bot) -> String:
	return ART.get(bot.id, "")


## A rendered image from Graphics/Scogg/ (path without the .webp), or null if it's missing.
## Goes through the ArtCache autoload when it's there (tool scripts run without autoloads).
static func art(path: String) -> Texture2D:
	var tree := Engine.get_main_loop() as SceneTree
	var cache := tree.root.get_node_or_null(^"ArtCache") if tree else null
	if cache:
		return cache.texture(path)
	var full := ArtLayout.DIR + path + ".webp"
	return load(full) as Texture2D if ResourceLoader.exists(full) else null


## A Sprite2D showing art at a top-left position (hidden until shown).
static func sprite(path: String, pos: Vector2) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = art(path)
	s.centered = false
	s.position = pos
	s.visible = false
	return s


static func color_of(bot: Bot) -> Color:
	return COLORS.get(bot.id, Color.GRAY)


static func label(text: String, size: int, color: Color = Color.WHITE) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", maxi(2, size / 8))
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


static func rect(r: Rect2, color: Color) -> ColorRect:
	var c := ColorRect.new()
	c.position = r.position
	c.size = r.size
	c.color = color
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return c
