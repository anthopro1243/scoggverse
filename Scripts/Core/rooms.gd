class_name Rooms
extends RefCounted
## Our own school map (not FNAF's): camera rooms, the two doors, and bot routes.

enum Side {LEFT, RIGHT}

enum {
	STAGE, CAFETERIA, LIBRARY, LOUNGE, CURTAIN,
	LEFT_HALL, LEFT_CORNER, RIGHT_HALL, RIGHT_CORNER,
	LEFT_DOOR, RIGHT_DOOR, INSIDE,
}

## Rooms with a camera, in button order.
const CAMS: Array[int] = [STAGE, CAFETERIA, LIBRARY, LOUNGE, CURTAIN, LEFT_HALL, LEFT_CORNER, RIGHT_HALL, RIGHT_CORNER]

const NAMES: Dictionary[int, String] = {
	STAGE: "Stage", CAFETERIA: "Cafeteria", LIBRARY: "Library", LOUNGE: "Teachers' Lounge",
	CURTAIN: "Drama Room", LEFT_HALL: "Left Hall", LEFT_CORNER: "Left Corner",
	RIGHT_HALL: "Right Hall", RIGHT_CORNER: "Right Corner",
	LEFT_DOOR: "Left Door", RIGHT_DOOR: "Right Door", INSIDE: "Office",
}

## Scoggcrates wanders the left side; each step picks one neighbour at random.
const LEFT_ROUTE: Dictionary[int, Array] = {
	STAGE: [CAFETERIA],
	CAFETERIA: [LIBRARY, LEFT_HALL],
	LIBRARY: [CAFETERIA, LEFT_HALL],
	LEFT_HALL: [LIBRARY, LEFT_CORNER],
	LEFT_CORNER: [LEFT_HALL, LEFT_DOOR],
}

## Scogga Lisa wanders the right side.
const RIGHT_ROUTE: Dictionary[int, Array] = {
	STAGE: [CAFETERIA],
	CAFETERIA: [LOUNGE, RIGHT_HALL],
	LOUNGE: [CAFETERIA, RIGHT_HALL],
	RIGHT_HALL: [LOUNGE, RIGHT_CORNER],
	RIGHT_CORNER: [RIGHT_HALL, RIGHT_DOOR],
}

## Uncle Scogg walks one fixed path to the Right Corner (it gets in from there; see LeaderBot).
const LEADER_ROUTE: Dictionary[int, Array] = {
	STAGE: [CAFETERIA],
	CAFETERIA: [LOUNGE],
	LOUNGE: [RIGHT_HALL],
	RIGHT_HALL: [RIGHT_CORNER],
}

const CAM_LABELS: Dictionary[int, String] = {
	STAGE: "1", CAFETERIA: "2", LIBRARY: "3", LOUNGE: "4", CURTAIN: "5",
	LEFT_HALL: "6", LEFT_CORNER: "7", RIGHT_HALL: "8", RIGHT_CORNER: "9",
}


static func cam_title(room: int) -> String:
	return "CAM %s  %s" % [CAM_LABELS.get(room, "?"), NAMES[room]]


static func door_of(side: int) -> int:
	return LEFT_DOOR if side == Side.LEFT else RIGHT_DOOR
