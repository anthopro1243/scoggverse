class_name HallBot
extends Bot
## Walks a camera route to one door. At the door, its next move either gets it in
## (door open) or sends it back down the route (door closed).

var side: int
var route: Dictionary[int, Array]
var retreat_room: int


func _init(p_id: String, p_name: String, p_interval: float, p_level: int,
		p_side: int, p_route: Dictionary[int, Array], p_retreat: int) -> void:
	super(p_id, p_name, p_interval, p_level)
	side = p_side
	route = p_route
	retreat_room = p_retreat


func move(sim: NightSim) -> void:
	if room == Rooms.INSIDE:
		return
	if room == Rooms.door_of(side):
		if sim.is_door_closed(side):
			room = retreat_room
		else:
			room = Rooms.INSIDE
			sim.bot_got_in(self)
		return
	var options: Array = route[room]
	room = options[sim.rng.randi_range(0, options.size() - 1)]
