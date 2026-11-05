extends CanvasLayer
## The nightly call (Nights 1-5): the desk phone rings, picks up, and Dr. Scoggins' message plays
## as captions over a muffled phone line, with a "Mute call" button like FNAF's. A real recording
## (assets/voice/nightN.ogg) plays instead of the line sound when one exists.

signal finished

## Sounds on the line for the [bracketed] caption lines.
const LINE_SOUNDS: Dictionary[String, String] = {"[banging]": "door_bang", "[music box]": "march", "[static]": "cam_garble"}
const CAPTION_RECT := Rect2(290, 770, 860, 185) # left of the camera map buttons
const MUTE_RECT := Rect2(24, 96, 230, 58)

enum Phase {IDLE, WAITING, RINGING, TALKING, DONE}

var phase: int = Phase.IDLE
var muted: bool = false
var line_index: int = -1

var _audio: Node
var _lines: Array = []
var _starts: Array[float] = []
var _end: float = 0.0
var _t: float = 0.0
var _line: AudioStreamPlayer
var _fx: AudioStreamPlayer # sounds on the line ([banging], [music box], [static])
var _recording: AudioStream
var _panel: ColorRect
var _caption: Label
var _who: Label
var _mute: Button


func _ready() -> void:
	layer = 14
	_line = AudioStreamPlayer.new()
	_line.bus = &"Voice"
	add_child(_line)
	_fx = AudioStreamPlayer.new()
	_fx.bus = &"Voice"
	add_child(_fx)
	_panel = BotStyle.rect(CAPTION_RECT, Color(0, 0, 0, 0.62))
	_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_panel.visible = false
	add_child(_panel)
	_who = BotStyle.label("☎  Dr. Scoggins", 24, Color(1, 0.85, 0.35))
	_who.position = Vector2(24, 10)
	_panel.add_child(_who)
	_caption = BotStyle.label("", 30, Color(0.95, 0.95, 0.95))
	_caption.position = Vector2(24, 44)
	_caption.size = Vector2(CAPTION_RECT.size.x - 48, CAPTION_RECT.size.y - 50)
	_caption.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_panel.add_child(_caption)
	_mute = Button.new()
	_mute.text = "Mute call"
	_mute.position = MUTE_RECT.position
	_mute.size = MUTE_RECT.size
	_mute.focus_mode = Control.FOCUS_NONE
	_mute.add_theme_font_size_override("font_size", 28)
	_mute.visible = false
	_mute.pressed.connect(mute)
	add_child(_mute)


## Starts tonight's call (does nothing on Night 6 / Custom Night).
func start(night: int, audio: Node) -> void:
	_audio = audio
	_lines = VoicemailScript.lines_for(night) if night <= GameConfig.VOICEMAIL_NIGHTS else []
	if _lines.is_empty():
		return
	var path := VoicemailScript.RECORDING % night
	_recording = load(path) as AudioStream if ResourceLoader.exists(path) else null
	var tl := VoicemailScript.timeline(night, _recording.get_length() if _recording else 0.0)
	_starts = tl.starts
	_end = tl.end
	_t = 0.0
	phase = Phase.WAITING


func _process(delta: float) -> void:
	if phase == Phase.IDLE or phase == Phase.DONE:
		return
	_t += delta
	match phase:
		Phase.WAITING:
			if _t >= GameConfig.VOICEMAIL_DELAY_SECONDS:
				_t = 0.0
				phase = Phase.RINGING
				_mute.visible = true
				_audio.cue("phone_ring")
		Phase.RINGING:
			if _t >= GameConfig.VOICEMAIL_RING_SECONDS:
				_t = 0.0
				phase = Phase.TALKING
				_audio.cue("phone_pickup")
				_line.stream = _recording if _recording else Sound.stream("phone_line")
				_line.volume_db = GameConfig.SOUND_DB["voice" if _recording else "phone_line"]
				if _line.stream:
					_line.play()
				_audio.log_event("voice" if _recording else "phone_line", "Voice")
				_panel.visible = true
		Phase.TALKING:
			var i := line_index
			while i + 1 < _starts.size() and _t >= _starts[i + 1]:
				i += 1
			if i != line_index:
				line_index = i
				_show_line(_lines[i])
			if _t >= _end:
				_hang_up()


func _show_line(line: String) -> void:
	var direction := VoicemailScript.is_direction(line)
	_caption.text = line
	_caption.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6) if direction else Color(0.95, 0.95, 0.95))
	_fx.stop()
	if direction and LINE_SOUNDS.has(line):
		_fx.stream = Sound.stream(LINE_SOUNDS[line])
		_fx.volume_db = GameConfig.SOUND_DB["phone_line"] + 4.0
		if _fx.stream:
			_fx.play()
		_audio.log_event(LINE_SOUNDS[line], "Voice")


## The "Mute call" button: hang up now.
func mute() -> void:
	if phase == Phase.IDLE or phase == Phase.DONE:
		return
	muted = true
	_audio.log_event("call_muted", "Voice")
	_hang_up()


## The night ended (attack, power out, 6 AM): cut the call without a sound.
func stop() -> void:
	if phase != Phase.IDLE and phase != Phase.DONE:
		_close()


func _hang_up() -> void:
	var was_talking := phase == Phase.TALKING
	_close()
	if was_talking or muted:
		_audio.cue("phone_hangup", "Voice")


func _close() -> void:
	phase = Phase.DONE
	_audio.stop_sound("phone_ring")
	_line.stop()
	_fx.stop()
	_panel.visible = false
	_mute.visible = false
	finished.emit()


func caption() -> String:
	return _caption.text if _panel.visible else ""


## For the playtest.
func state() -> Dictionary:
	return {"phase": ["idle", "waiting", "ringing", "talking", "done"][phase], "caption": caption(),
		"line": line_index, "lines": _lines.size(), "muted": muted, "recording": _recording != null,
		"mute_button": _mute.visible}
