extends SceneTree
## Builds one labeled contact sheet from the PNGs tools/screenshot.gd saved.
##   godot --path . -s tools/contact_sheet.gd -- --in=docs/screens/raw --out=docs/screens/contact_sheet.png

const THUMB_WIDTH := 480
const COLUMNS := 4
const PAD := 12
const LABEL_HEIGHT := 28
const BG := Color(0.08, 0.08, 0.09)

var in_dir := "res://docs/screens/raw"
var out_path := "res://docs/screens/contact_sheet.png"


func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--in="):
			in_dir = arg.trim_prefix("--in=")
		elif arg.begins_with("--out="):
			out_path = arg.trim_prefix("--out=")
	_run.call_deferred()


func _abs(path: String) -> String:
	return ProjectSettings.globalize_path(path) if path.begins_with("res://") else path


func _run() -> void:
	var files: Array[String] = []
	for f in DirAccess.get_files_at(_abs(in_dir)):
		if f.ends_with(".png"):
			files.append(f)
	files.sort()
	if files.is_empty():
		push_error("No screenshots in %s" % in_dir)
		quit(1)
		return

	# Desktop shots fill rows of COLUMNS; phone shots (tall) share one row.
	var tiles: Array[Dictionary] = []
	for f in files:
		var img := Image.load_from_file(_abs(in_dir).path_join(f))
		var scale := float(THUMB_WIDTH) / img.get_width()
		if img.get_height() > img.get_width():
			scale = float(THUMB_WIDTH) * 0.5625 * 1.6 / img.get_height()
		img.resize(int(img.get_width() * scale), int(img.get_height() * scale), Image.INTERPOLATE_LANCZOS)
		tiles.append({"label": f.get_basename(), "image": img})

	var x := PAD
	var y := PAD
	var row_h := 0
	var col := 0
	var width := PAD + COLUMNS * (THUMB_WIDTH + PAD)
	var last_tall := false
	for t in tiles:
		var img: Image = t.image
		var tall := img.get_height() > img.get_width()
		if col > 0 and (x + img.get_width() + PAD > width or tall != last_tall):
			x = PAD
			y += row_h + LABEL_HEIGHT + PAD
			row_h = 0
			col = 0
		t.pos = Vector2i(x, y)
		x += img.get_width() + PAD
		row_h = maxi(row_h, img.get_height())
		col += 1
		last_tall = tall
	var height := y + row_h + LABEL_HEIGHT + PAD

	var viewport := SubViewport.new()
	viewport.size = Vector2i(width, height)
	viewport.render_target_update_mode = SubViewport.UPDATE_ONCE
	root.add_child(viewport)
	var bg := ColorRect.new()
	bg.color = BG
	bg.size = Vector2(width, height)
	viewport.add_child(bg)
	for t in tiles:
		var rect := TextureRect.new()
		rect.texture = ImageTexture.create_from_image(t.image)
		rect.position = t.pos
		viewport.add_child(rect)
		var label := Label.new()
		label.text = t.label
		label.position = Vector2(t.pos.x, t.pos.y + t.image.get_height() + 2)
		label.add_theme_font_size_override("font_size", 16 if t.image.get_width() >= THUMB_WIDTH else 12)
		label.size = Vector2(t.image.get_width(), LABEL_HEIGHT)
		label.clip_text = true
		label.add_theme_color_override("font_color", Color(0.9, 0.9, 0.9))
		viewport.add_child(label)

	await RenderingServer.frame_post_draw
	await process_frame
	await RenderingServer.frame_post_draw
	var sheet := viewport.get_texture().get_image()
	DirAccess.make_dir_recursive_absolute(_abs(out_path).get_base_dir())
	sheet.save_png(_abs(out_path))
	print("contact sheet: ", out_path, " (", tiles.size(), " shots)")
	quit(0)
