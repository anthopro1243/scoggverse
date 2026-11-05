extends Node
## ArtCache autoload: keeps the rendered art loaded so nothing decodes mid-night.
##
## The loading screen preloads everything except the jumpscare frames (~120 MB of textures),
## a few files per frame with a progress bar. Jumpscare frames are big (8 per bot, full screen),
## so they're "warmed" only for a bot that's about to attack: one that got inside, Scoggis Khan
## starting his run, Uncle Scogg at power out. They load a frame at a time and are dropped
## when the night ends.

const JUMP_PREFIX := "scares/jump_"
const SUBDIRS: Array[String] = ["ui", "office", "cams", "scares"]
const BUDGET_MS := 12 # loading time allowed per frame

var _tex: Dictionary[String, Texture2D] = {}
var _warm: Array[String] = []


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS


## Every art path the loading screen preloads (relative to Graphics/Scogg/, no extension).
func manifest() -> Array[String]:
	var out: Array[String] = []
	for sub in SUBDIRS:
		for file in ResourceLoader.list_directory(ArtLayout.DIR + sub):
			if file.ends_with(".webp"):
				var path := sub + "/" + file.get_basename()
				if not path.begins_with(JUMP_PREFIX):
					out.append(path)
	return out


## Loads paths[from..] for up to BUDGET_MS; returns the next index (== size when done).
func preload_some(paths: Array[String], from: int) -> int:
	var start := Time.get_ticks_msec()
	var i := from
	while i < paths.size() and (i == from or Time.get_ticks_msec() - start < BUDGET_MS):
		texture(paths[i])
		i += 1
	return i


## A texture from Graphics/Scogg/ (cached), or null if missing.
func texture(path: String) -> Texture2D:
	if _tex.has(path):
		return _tex[path]
	var full := ArtLayout.DIR + path + ".webp"
	var t: Texture2D = load(full) as Texture2D if ResourceLoader.exists(full) else null
	if t:
		_tex[path] = t
	return t


func is_loaded(path: String) -> bool:
	return _tex.has(path)


## Queue a bot's jumpscare frames to load in the background (one per frame).
func warm_jumpscare(art_name: String) -> void:
	for i in ArtLayout.JUMPSCARE_FRAMES:
		var p := "%s%s_%d" % [JUMP_PREFIX, art_name, i]
		if not _tex.has(p) and not _warm.has(p):
			_warm.append(p)


func jumpscare_ready(art_name: String) -> bool:
	for i in ArtLayout.JUMPSCARE_FRAMES:
		if not _tex.has("%s%s_%d" % [JUMP_PREFIX, art_name, i]):
			return false
	return true


## Drops the jumpscare frames (end of a night).
func release_jumpscares() -> void:
	_warm.clear()
	for k in _tex.keys():
		if k.begins_with(JUMP_PREFIX):
			_tex.erase(k)


func _process(_delta: float) -> void:
	if not _warm.is_empty():
		texture(_warm.pop_front())
