Before the fix: the live build (`main`, `f104ee5`) served locally, measured with the first version of `audio_output.mjs` (AnalyserNode tap). Every moment and every sound read RMS 0: nothing reached the speakers.

AudioContext: running, 48000 Hz, 2 node(s) feeding the speakers.

| Moment | RMS | dBFS | Peak | Result |
|---|---|---|---|---|
| Menu music (title screen)  | 0.0000 | -inf | 0.000 | ❌ |
| Phone call (ring, pickup, line)  | 0.0000 | -inf | 0.000 | ❌ |
| Office ambience (room tone + fan)  | 0.0000 | -inf | 0.000 | ❌ |
| Door close (room tone alone 0.0000) | 0.0000 | -inf | 0.000 | ❌ |
| Camera switch (camera room tone alone 0.0000) | 0.0000 | -inf | 0.000 | ❌ |
| Jumpscare scream (Scoggcrates)  | 0.0000 | -inf | 0.000 | ❌ |
| Power-down  | 0.0000 | -inf | 0.000 | ❌ |
| Power-out march  | 0.0000 | -inf | 0.000 | ❌ |
| Power-out scream (Uncle Scogg)  | 0.0000 | -inf | 0.000 | ❌ |
| 6 AM chime  | 0.0000 | -inf | 0.000 | ❌ |
| Console errors | | | | ✅ none |

Settings > Sound check, each sound alone:

| Sound | RMS | dBFS | Peak | Result |
|---|---|---|---|---|
| amb_cams | 0.0000 | -inf | 0.000 | ❌ |
| amb_office | 0.0000 | -inf | 0.000 | ❌ |
| cam_garble | 0.0000 | -inf | 0.000 | ❌ |
| cam_switch | 0.0000 | -inf | 0.000 | ❌ |
| chime_6am | 0.0000 | -inf | 0.000 | ❌ |
| denied | 0.0000 | -inf | 0.000 | ❌ |
| door_bang | 0.0000 | -inf | 0.000 | ❌ |
| door_close | 0.0000 | -inf | 0.000 | ❌ |
| door_open | 0.0000 | -inf | 0.000 | ❌ |
| fan | 0.0000 | -inf | 0.000 | ❌ |
| gallop | 0.0000 | -inf | 0.000 | ❌ |
| glitch | 0.0000 | -inf | 0.000 | ❌ |
| light_buzz | 0.0000 | -inf | 0.000 | ❌ |
| light_off | 0.0000 | -inf | 0.000 | ❌ |
| light_on | 0.0000 | -inf | 0.000 | ❌ |
| march | 0.0000 | -inf | 0.000 | ❌ |
| menu | 0.0000 | -inf | 0.000 | ❌ |
| phone_hangup | 0.0000 | -inf | 0.000 | ❌ |
| phone_line | 0.0000 | -inf | 0.000 | ❌ |
| phone_pickup | 0.0000 | -inf | 0.000 | ❌ |
| phone_ring | 0.0000 | -inf | 0.000 | ❌ |
| power_down | 0.0000 | -inf | 0.000 | ❌ |
| scrape_1 | 0.0000 | -inf | 0.000 | ❌ |
| scrape_2 | 0.0000 | -inf | 0.000 | ❌ |
| scream_scogga_lisa | 0.0000 | -inf | 0.000 | ❌ |
| scream_scoggcrates | 0.0000 | -inf | 0.000 | ❌ |
| scream_scoggis_khan | 0.0000 | -inf | 0.000 | ❌ |
| scream_uncle_scogg | 0.0000 | -inf | 0.000 | ❌ |
| scuttle | 0.0000 | -inf | 0.000 | ❌ |
| steps_1 | 0.0000 | -inf | 0.000 | ❌ |
| steps_2 | 0.0000 | -inf | 0.000 | ❌ |
| steps_heavy | 0.0000 | -inf | 0.000 | ❌ |
| sting_scoggema | 0.0000 | -inf | 0.000 | ❌ |
| tablet_down | 0.0000 | -inf | 0.000 | ❌ |
| tablet_up | 0.0000 | -inf | 0.000 | ❌ |
| ui_click | 0.0000 | -inf | 0.000 | ❌ |
| whisper | 0.0000 | -inf | 0.000 | ❌ |

**FAIL**
