class_name VoicemailScript
extends RefCounted
## The nightly call from "Dr. Scoggins", shown as captions over a muffled phone line (no voice
## is synthesized). Night 1 teaches the controls; later calls get shorter and more ominous.
## Lines in [brackets] are sounds on the line, not words (see Voicemail.LINE_SOUNDS).
##
## Real recordings can replace the phone-line sound later: drop assets/voice/night1.ogg ...
## night5.ogg into the project and the call plays them, with the captions spread over their length.

const RECORDING := "res://assets/voice/night%d.ogg"

const CALLS: Dictionary[int, Array] = {
	1: [
		"Hello? Hello, hello! Okay, good. It's Dr. Scoggins. Welcome to your first night shift.",
		"Quick quiz before we start. ...Kidding. Okay, tonight:",
		"Remember the cardboard standees from the slide project? At night they get... restless. They wander the halls.",
		"You've got two doors. A and D shut them. Q and E switch on the hall lights, so you can see who's standing in the doorway.",
		"Doors and lights use power, and you don't get much of it. Unlimited wants, limited resources. We went over this the first week.",
		"Space, or the bar at the bottom of the screen, pulls up the cameras. Check them a lot.",
		"Keep an eye on Camera 5, the Drama Room. Scoggis Khan does not like being ignored.",
		"If somebody's in the doorway, shut the door. When they leave, open it back up so you're not wasting power.",
		"Make it to 6 AM and you earn Scogg Bucks. Don't hand them out too fast, though. Inflation.",
		"Alright, that's the lesson. And remember: don't deny yourself an education.",
	],
	2: [
		"Hey, hey! You made it. Honestly didn't expect that. Nice work.",
		"Heads up: Scoggcrates and Scogga Lisa get more active tonight. Very persistent. Like a student who says \"I don't know.\"",
		"And you know my rule on \"I don't know.\" Two zeros in the gradebook. They don't take no for an answer either.",
		"Remember R-TIPES? Demand shifters? Tonight, demand for you is... high.",
		"If the light shows somebody at the door, don't stare. Shut it.",
		"Check Camera 5 now and then. Khan hates being watched.",
		"Don't deny yourself an education, or a door.",
	],
	3: [
		"Night three, so you're past the halfway point of the unit. This is usually where people stop doing their active recall.",
		"Uncle Scogg has been leaving the stage lately. He's on the poster by your desk. If the poster's empty... he's out.",
		"Supply shifters: ROTTEN. Resource costs, Other goods, Taxes... sorry. I'm stalling. Weird week.",
		"Keep your power up. Talk tomorrow.",
	],
	4: [
		"Hey, if you're hearing this, good.",
		"The Scogg Bucks are inflating. They started at ten dollars each. Now they're worth a dollar-something.",
		"If the power goes out, you'll hear music. Something patriotic. Don't move. Don't...",
		"[banging]",
		"...Is that the door? That is not on the lesson plan.",
		"[music box]",
		"Don't deny yourself an ed—",
	],
	5: [
		"[static]",
		"...brace yourselves.",
		"[static]",
		"...exam time.",
	],
}


static func lines_for(night: int) -> Array:
	return CALLS.get(night, [])


static func is_direction(line: String) -> bool:
	return line.begins_with("[") and line.ends_with("]")


## How long a caption stays up: reading time at CAPTION_WORDS_PER_SECOND, at least
## CAPTION_MIN_SECONDS, plus a short gap.
static func line_seconds(line: String) -> float:
	var words := line.split(" ", false).size()
	return maxf(GameConfig.CAPTION_MIN_SECONDS, words / GameConfig.CAPTION_WORDS_PER_SECOND) + GameConfig.CAPTION_GAP_SECONDS


## When each caption starts (seconds after pickup) and when the call ends. If a recording of
## `length` seconds exists, the same timeline is stretched to fit it.
static func timeline(night: int, length: float = 0.0) -> Dictionary:
	var starts: Array[float] = []
	var total := 0.0
	for line in lines_for(night):
		starts.append(total)
		total += line_seconds(line)
	if length > 0.0 and total > 0.0:
		var k := length / total
		for i in starts.size():
			starts[i] *= k
		total = length
	return {"starts": starts, "end": total}
