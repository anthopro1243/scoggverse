Measured output in headless Chromium against https://five-nights-at-scoggies.vercel.app/play/ (the game in the Play page's iframe): every node feeding `ctx.destination` tapped, folded to stereo like the speakers, and metered on the audio thread (an AudioWorklet that sees every sample). RMS is the loudest 2048-sample (43–46 ms) window over both channels; peak is the largest sample on either channel (1.0 = full scale). Pass: RMS ≥ 0.01 (−40 dBFS) and peak ≤ 1; the door slam's and camera click's peaks must also be at least 1.5× the peak of the room tone under them.

AudioContext: running, 48000 Hz, 2 node(s) feeding the speakers.

| Moment | RMS | dBFS | Peak | Result |
|---|---|---|---|---|
| Menu music (title screen)  | 0.1107 | -19.1 | 0.227 | ✅ |
| Phone call (ring, pickup, line)  | 0.1361 | -17.3 | 0.386 | ✅ |
| Office ambience (room tone + fan)  | 0.0852 | -21.4 | 0.177 | ✅ |
| Door close (peak 3.7× the room tone's; adds 0.2838 RMS) | 0.2963 | -10.6 | 0.660 | ✅ |
| Camera switch (peak 2.7× the camera room tone's; adds 0.1056 RMS) | 0.1417 | -17.0 | 0.461 | ✅ |
| Jumpscare scream (Scoggcrates)  | 0.5309 | -5.5 | 0.756 | ✅ |
| Power-down  | 0.2750 | -11.2 | 0.714 | ✅ |
| Power-out march  | 0.1546 | -16.2 | 0.353 | ✅ |
| Power-out scream (Uncle Scogg)  | 0.5240 | -5.6 | 0.792 | ✅ |
| 6 AM chime  | 0.2173 | -13.3 | 0.456 | ✅ |
| Volume sliders (menu music) (Master 0 → 0.0000, back to 100 → 0.0982; Music 0 → 0.0000, back to 80 → 0.0993) | 0.0948 | -20.5 | 0.167 | ✅ |
| Console errors | | | | ✅ none |

Settings > Sound check, each sound alone (L−R: left minus right channel level in dB; 0 = centered):

| Sound | RMS | dBFS | Peak | L−R dB | Result |
|---|---|---|---|---|---|
| amb_cams | 0.1232 | -18.2 | 0.179 | 0.0 | ✅ |
| amb_office | 0.0826 | -21.7 | 0.148 | 0.0 | ✅ |
| cam_garble | 0.0548 | -25.2 | 0.287 | 0.0 | ✅ |
| cam_switch | 0.1044 | -19.6 | 0.366 | 0.0 | ✅ |
| chime_6am | 0.2173 | -13.3 | 0.456 | 0.0 | ✅ |
| denied | 0.2833 | -11.0 | 0.363 | 0.0 | ✅ |
| door_bang | 0.3505 | -9.1 | 0.801 | 0.0 | ✅ |
| door_close | 0.2830 | -11.0 | 0.618 | 0.0 | ✅ |
| door_open | 0.1741 | -15.2 | 0.437 | 0.0 | ✅ |
| fan | 0.0194 | -34.3 | 0.075 | 0.0 | ✅ |
| gallop | 0.3563 | -9.0 | 0.693 | 0.0 | ✅ |
| glitch | 0.0427 | -27.4 | 0.135 | 0.0 | ✅ |
| light_buzz | 0.0750 | -22.5 | 0.110 | 0.0 | ✅ |
| light_off | 0.0268 | -31.4 | 0.246 | 0.0 | ✅ |
| light_on | 0.0516 | -25.7 | 0.204 | 0.0 | ✅ |
| march | 0.1540 | -16.2 | 0.346 | 0.0 | ✅ |
| menu | 0.0995 | -20.0 | 0.167 | 0.0 | ✅ |
| phone_hangup | 0.0275 | -31.2 | 0.246 | 0.0 | ✅ |
| phone_line | 0.0229 | -32.8 | 0.175 | 0.0 | ✅ |
| phone_pickup | 0.0915 | -20.8 | 0.269 | 0.0 | ✅ |
| phone_ring | 0.1081 | -19.3 | 0.276 | 0.0 | ✅ |
| power_down | 0.2750 | -11.2 | 0.714 | 0.0 | ✅ |
| scrape_1 | 0.0875 | -21.2 | 0.282 | 0.0 | ✅ |
| scrape_2 | 0.0796 | -22.0 | 0.265 | 0.0 | ✅ |
| scream_scogga_lisa | 0.5025 | -6.0 | 0.789 | 0.0 | ✅ |
| scream_scoggcrates | 0.5309 | -5.5 | 0.756 | 0.0 | ✅ |
| scream_scoggis_khan | 0.4989 | -6.0 | 0.878 | 0.0 | ✅ |
| scream_uncle_scogg | 0.5240 | -5.6 | 0.792 | 0.0 | ✅ |
| scuttle | 0.0295 | -30.6 | 0.190 | 0.0 | ✅ |
| steps_1 | 0.1249 | -18.1 | 0.284 | 0.0 | ✅ |
| steps_2 | 0.1522 | -16.4 | 0.283 | 0.0 | ✅ |
| steps_heavy | 0.1612 | -15.9 | 0.287 | 0.0 | ✅ |
| sting_scoggema | 0.3407 | -9.4 | 0.650 | 0.0 | ✅ |
| tablet_down | 0.0257 | -31.8 | 0.267 | 0.0 | ✅ |
| tablet_up | 0.1076 | -19.4 | 0.398 | 0.0 | ✅ |
| ui_click | 0.0183 | -34.7 | 0.159 | 0.0 | ✅ |
| whisper | 0.1286 | -17.8 | 0.465 | 0.0 | ✅ |

**PASS**
