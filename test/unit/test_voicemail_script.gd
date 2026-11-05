extends GutTest
## The nightly voicemail: which nights get a call, caption timing, and stretching to a recording.


func test_nights_one_to_five_have_calls() -> void:
	for n in range(1, GameConfig.VOICEMAIL_NIGHTS + 1):
		assert_gt(VoicemailScript.lines_for(n).size(), 0, "night %d has a call" % n)


func test_no_call_on_night_six_or_custom() -> void:
	assert_eq(VoicemailScript.lines_for(6), [])
	assert_eq(VoicemailScript.lines_for(7), [])


func test_night_one_ends_with_the_catchphrase() -> void:
	var lines := VoicemailScript.lines_for(1)
	assert_string_contains(lines[lines.size() - 1].to_lower(), "don't deny yourself an education")


func test_night_one_teaches_every_control() -> void:
	var text := " ".join(VoicemailScript.lines_for(1))
	for key in ["A and D", "Q and E", "Space", "Camera 5"]:
		assert_string_contains(text, key)


func test_directions_are_bracketed_sounds() -> void:
	assert_true(VoicemailScript.is_direction("[static]"))
	assert_false(VoicemailScript.is_direction("Hello? [static]"))
	assert_false(VoicemailScript.is_direction("Hello"))


func test_short_lines_stay_up_a_minimum_time() -> void:
	var min_s := GameConfig.CAPTION_MIN_SECONDS + GameConfig.CAPTION_GAP_SECONDS
	assert_almost_eq(VoicemailScript.line_seconds("Hi."), min_s, 0.0001)
	assert_gt(VoicemailScript.line_seconds(VoicemailScript.lines_for(1)[3]), min_s, "a long line gets more reading time")


func test_timeline_starts_at_zero_and_increases() -> void:
	var t := VoicemailScript.timeline(1)
	var starts: Array[float] = t["starts"]
	assert_eq(starts.size(), VoicemailScript.lines_for(1).size())
	assert_eq(starts[0], 0.0)
	for i in range(1, starts.size()):
		assert_gt(starts[i], starts[i - 1])
	assert_gt(t["end"], starts[starts.size() - 1])


func test_timeline_stretches_to_a_recording() -> void:
	var t := VoicemailScript.timeline(2, 60.0)
	assert_eq(t["end"], 60.0)
	var plain := VoicemailScript.timeline(2)
	var k := 60.0 / float(plain["end"])
	assert_almost_eq(t["starts"][3], plain["starts"][3] * k, 0.0001)


func test_no_call_means_an_empty_timeline() -> void:
	assert_eq(VoicemailScript.timeline(6), {"starts": [], "end": 0.0})
