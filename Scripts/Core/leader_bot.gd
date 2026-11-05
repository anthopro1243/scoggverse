class_name LeaderBot
extends HallBot
## Uncle Scogg: can't leave the stage until both hall bots have, and only moves
## while the player isn't watching its camera. Like Freddy, it never stands in the
## doorway: from the Right Corner it slips in while the player is on the cameras
## (door open), or goes back to the Right Hall if the right door is shut.


func can_take_turn(sim: NightSim) -> bool:
	if room == Rooms.STAGE and (sim.left_bot.room == Rooms.STAGE or sim.right_bot.room == Rooms.STAGE):
		return false
	return not sim.is_watching(room)


func move(sim: NightSim) -> void:
	if room == Rooms.RIGHT_CORNER:
		if sim.is_door_closed(side):
			room = retreat_room
		elif sim.tablet_up:
			room = Rooms.INSIDE
			sim.bot_got_in(self)
		# With the tablet down the player is in the office looking around, so it waits.
		return
	super(sim)
