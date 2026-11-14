class_name GameConfig
extends RefCounted
## Every tuning number in the game lives here (see docs/RULES.md, "Mechanics spec").
## Change a number here, never inline in another script.

# --- Night clock ---
const NIGHT_START_HOUR: int = 0 # 12 AM
const NIGHT_END_HOUR: int = 6 # 6 AM
const SECONDS_PER_HOUR: float = 90.0

# --- Movement roll ---
const AI_LEVEL_MIN: int = 0
const AI_LEVEL_MAX: int = 20
const ROLL_MIN: int = 1
const ROLL_MAX: int = 20

# --- Bot turn timers (seconds) ---
const TIMER_LEADER: float = 3.02 # Uncle Scogg
const TIMER_LEFT_HALL: float = 4.97 # Scoggcrates
const TIMER_RIGHT_HALL: float = 4.98 # Scogga Lisa
const TIMER_SPRINTER: float = 5.01 # Scoggis Khan

# --- AI ramp during a night (hour -> +1 AI level) ---
const RAMP_HOURS_LEFT_HALL: Array[int] = [2, 3, 4]
const RAMP_HOURS_RIGHT_HALL: Array[int] = [3, 4]
const RAMP_HOURS_SPRINTER: Array[int] = [3, 4]

## AI levels at 12 AM for each night (the ramps above add to these during the night).
## Modeled on FNAF 1's tables, then tuned with the simulator (see PROGRESS.md, Milestone 2).
const NIGHT_LEVELS: Dictionary[int, Dictionary] = {
	1: {"leader": 0, "left_hall": 1, "right_hall": 1, "sprinter": 0},
	2: {"leader": 0, "left_hall": 3, "right_hall": 1, "sprinter": 1},
	3: {"leader": 1, "left_hall": 4, "right_hall": 7, "sprinter": 4},
	4: {"leader": 3, "left_hall": 5, "right_hall": 7, "sprinter": 8},
	5: {"leader": 4, "left_hall": 8, "right_hall": 9, "sprinter": 7},
	6: {"leader": 3, "left_hall": 8, "right_hall": 9, "sprinter": 12},
}
const CUSTOM_NIGHT: int = 7 # Custom Night uses night 5+ passive drain, like FNAF's 7th night
const LAST_NIGHT: int = 6

# --- Power ---
const POWER_START_UNITS: int = 999 # shown as 99%
## Usage 1 drains 1% (10 units) every 9.6 s, as in FNAF 1; each extra usage bar adds the same again.
const POWER_UNITS_PER_SECOND_PER_USAGE: float = 10.0 / 13.0
const USAGE_BASE: int = 1
const USAGE_PER_DOOR: int = 1
const USAGE_PER_LIGHT: int = 1
const USAGE_TABLET: int = 1
const USAGE_BARS_SHOWN_MAX: int = 5
## Extra passive drain interval in seconds, by night. Nights 5+ use the last entry.
const PASSIVE_DRAIN_INTERVAL: Dictionary[int, float] = {2: 6.0, 3: 5.0, 4: 4.0, 5: 3.0}
const PASSIVE_DRAIN_UNITS: int = 1

# --- Hall bots and leader at the door ---
## Seconds a bot that got in waits for the tablet before it attacks anyway.
const INSIDE_FORCE_ATTACK_SECONDS: float = 30.0

# --- Sprinter (Scoggis Khan) ---
const SPRINTER_LAST_STAGE: int = 3 # 0 hidden, 1 peeking, 2 stepping out, 3 gone
const SPRINTER_COOLDOWN_MIN: float = 0.83 # after lowering the tablet (FNAF: 50 frames)
const SPRINTER_COOLDOWN_MAX: float = 16.67 # (FNAF: 1000 frames)
const SPRINTER_RUN_WAIT: float = 25.0 # leaves the curtain this long after the last stage...
const SPRINTER_RUN_SECONDS: float = 2.5 # ...or at once when watched on the left hall, then takes this long to arrive
const SPRINTER_DOOR_DRAIN_FIRST: int = 10 # power units lost on the first blocked run (1%)
const SPRINTER_DOOR_DRAIN_STEP: int = 50 # extra units each later blocked run (+5%)
const SPRINTER_RESET_STAGES: Array[int] = [0, 1]

# --- Power out ---
const POWER_OUT_APPEAR_SECONDS: float = 3.0 # leader shows up at the left door
const POWER_OUT_ATTACK_MIN: float = 5.0 # then attacks after a random delay in this range
const POWER_OUT_ATTACK_MAX: float = 20.0

# --- Scogg Bucks (earned on the 6 AM screen) ---
const NIGHT_BUCKS: Dictionary[int, int] = {1: 10, 2: 15, 3: 25, 4: 40, 5: 60, 6: 100}
const CUSTOM_BUCKS_PER_LEVEL: int = 2 # Custom Night pays 2 per AI level set (up to 160)
const BUCKS_PER_10_POWER: int = 2 # bonus per full 10% of power left at 6 AM

# --- Presentation ---
const INTRO_CARD_SECONDS: float = 3.0 # "12 AM / Night X" card before the night starts
const JUMPSCARE_SECONDS: float = 1.2
const SIM_STEP_SECONDS: float = 0.05 # fixed step for the night simulation

## Labels this big or bigger use the typewriter heading font (BotStyle.HEADING_FONT).
const HEADING_FONT_MIN_SIZE: int = 64

# --- Scares and flavor (cosmetic: they never change the rules) ---
## Hallucination flash: a slide picture over the view for a few frames (FNAF 1's "IT'S ME" flashes).
const HALLUCINATION_CHANCE_PER_SECOND: float = 1.0 / 600.0
const HALLUCINATION_COOLDOWN: float = 120.0
const HALLUCINATION_SECONDS: float = 0.12
## Camera glitch: a standee shows for 1-2 frames in a room it isn't in.
const GLITCH_CHANCE_PER_SECOND: float = 1.0 / 60.0
const GLITCH_SECONDS: float = 0.07
## The Scoggipede crawls across CAM 7 now and then while it's being watched.
const SCOGGIPEDE_CHANCE_PER_SECOND: float = 1.0 / 25.0
const SCOGGIPEDE_COOLDOWN: float = 90.0
const SCOGGIPEDE_CRAWL_SECONDS: float = 6.0
## The rare scare (Absolute Scoggema): a split-second flash in the office, at most once a night.
const RARE_SCARE_CHANCE_PER_SECOND: float = 1.0 / 3000.0
const RARE_SCARE_SECONDS: float = 0.15
## Camera feed: chance per second the picture dips dark for a moment, and how dark.
const CAM_FLICKER_CHANCE_PER_SECOND: float = 0.8
const CAM_FLICKER_DIM: float = 0.55
## Power out: Uncle Scogg's face flickers into view on this cycle (seconds), lit for the first part.
const POWER_OUT_FLICKER_CYCLE: float = 1.1
const POWER_OUT_FLICKER_LIT: float = 0.32
## Jumpscare animation speed (frames per second); the last frame then holds and shakes.
const JUMPSCARE_FPS: float = 26.0
## The red flash over the jumpscare: strength by frame (off with "reduce flashing").
const JUMPSCARE_RED_FLASH: Dictionary[int, float] = {3: 0.35, 4: 0.9, 5: 0.5}
const JUMPSCARE_SHAKE_PX: float = 26.0
## Audio: the ambience fades out over this long once a bot is inside (silence before the scare).
const HUM_FADE_SECONDS: float = 1.5

# --- Sound (Milestone 4; levels in dB, all sounds synthesized by tools/audio/make_sounds.py) ---
## Every jumpscare comes after at least this much silence: the ambience cuts out, then the scare.
const JUMPSCARE_SILENCE_SECONDS: float = 1.0
## Loops: office room tone, the desk fan, the emptier camera room tone, the menu music.
const AMB_OFFICE_DB: float = -15.0
const AMB_FAN_DB: float = -21.0
const AMB_CAMS_DB: float = -14.0
const AMB_FADE_SECONDS: float = 0.25 # crossfade between office and camera room tone
const MENU_MUSIC_DB: float = -10.0
## How loud each one-shot plays. Measured in the browser (tools/playtest/audio_output.mjs):
## screams at -4 keep their peak under full scale once resampled to 48 kHz (at 0 they reached
## 1.4 and clipped); the camera click at -6 is heard over the camera room tone (at -12 it wasn't).
const SOUND_DB: Dictionary[String, float] = {
	"door_close": -3.0, "door_open": -6.0, "light_on": -8.0, "light_off": -10.0, "light_buzz": -17.0,
	"denied": -8.0, "tablet_up": -6.0, "tablet_down": -8.0, "cam_switch": -6.0, "cam_garble": -10.0,
	"gallop": -2.0, "door_bang": -1.0, "scuttle": -12.0, "power_down": -2.0, "march": -6.0,
	"scream": -4.0, "sting_scoggema": -3.0, "whisper": -6.0, "glitch": -16.0, "chime_6am": -4.0,
	"phone_ring": -9.0, "phone_pickup": -10.0, "phone_line": -12.0, "phone_hangup": -12.0, "voice": -2.0,
	"ui_click": -14.0,
}
## Bot footsteps / cardboard scrapes by the room the bot moved into: louder the closer it is.
## Rooms not listed are far away (quiet and muffled).
const STEP_DB: Dictionary[int, float] = {
	Rooms.LEFT_HALL: -16.0, Rooms.RIGHT_HALL: -16.0, Rooms.LEFT_CORNER: -10.0, Rooms.RIGHT_CORNER: -10.0,
	Rooms.LEFT_DOOR: -4.0, Rooms.RIGHT_DOOR: -4.0,
}
const STEP_FAR_DB: float = -24.0
## Scoggis Khan's gallop swells from this level to SOUND_DB.gallop as he reaches the door.
const GALLOP_START_DB: float = -22.0
## Power out: the march starts when Uncle Scogg reaches the dark doorway, then slows and sags in
## pitch over this many seconds before he attacks, down to this pitch.
const MARCH_SLOW_SECONDS: float = 3.0
const MARCH_MIN_PITCH: float = 0.62
const MARCH_WOBBLE: float = 0.025 # detune wobble while it slows

# --- Nightly voicemail ---
const VOICEMAIL_NIGHTS: int = 5 # nights 1-5 get a call
const VOICEMAIL_DELAY_SECONDS: float = 1.0 # after the night starts, the phone rings
const VOICEMAIL_RING_SECONDS: float = 4.6
const CAPTION_WORDS_PER_SECOND: float = 2.6
const CAPTION_MIN_SECONDS: float = 2.0
const CAPTION_GAP_SECONDS: float = 0.35

# --- Accessibility ---
## With "reduce flashing" on: no red flash, no feed flicker, scare flashes fade in and out
## at this alpha (no jitter), and glitch frames show at it too.
const REDUCED_FLASH_ALPHA: float = 0.45
const REDUCED_FLASH_FADE_SECONDS: float = 0.25
## Camera static: idle strength and the burst when the camera switches (alpha).
const CAM_STATIC_IDLE: float = 0.09
const CAM_STATIC_BURST: float = 0.7
const CAM_STATIC_BURST_REDUCED: float = 0.25
const CAM_STATIC_BURST_SECONDS: float = 0.45 # burst fades to idle over this
const CAM_STATIC_WAVER: float = 0.04 # idle hiss swells by up to this much...
const CAM_STATIC_WAVER_SECONDS: float = 2.0 # ...once per this many seconds
## Reduce flashing: camera feed brightness stays here (no flicker dips), and Uncle Scogg's
## power-out face fades in and out over the flicker cycle instead of blinking.
const REDUCED_CAM_LEVEL: float = 0.96

# --- Structure ---
const STORY_NIGHTS: int = 5
const BONUS_NIGHT: int = 6

# --- Bot names ---
const NAME_LEADER: String = "Uncle Scogg"
const NAME_LEFT_HALL: String = "Scoggcrates"
const NAME_RIGHT_HALL: String = "Scogga Lisa"
const NAME_SPRINTER: String = "Scoggis Khan"
const NAME_RARE_SCARE: String = "Absolute Scoggema"


## FNAF movement rule: a bot moves when a random 1-20 roll is <= its AI level.
static func passes_roll(ai_level: int, roll: int) -> bool:
	return roll <= ai_level


## Starting AI levels for a night (1-6). Custom Night passes its own levels instead.
static func levels_for(night: int) -> Dictionary:
	return NIGHT_LEVELS[clampi(night, 1, LAST_NIGHT)].duplicate()


static func passive_drain_interval(night: int) -> float:
	if night < 2:
		return 0.0
	return PASSIVE_DRAIN_INTERVAL[mini(night, 5)]
