Measured output in headless Chromium against https://five-nights-at-scoggies.vercel.app/embed.html: every node feeding `ctx.destination` tapped, folded to stereo like the speakers, and metered on the audio thread (an AudioWorklet that sees every sample). RMS is the loudest 2048-sample (43–46 ms) window over both channels; peak is the largest sample on either channel (1.0 = full scale). Pass: RMS ≥ 0.01 (−40 dBFS) and peak ≤ 1; the door slam's and camera click's peaks must also be at least 1.5× the peak of the room tone under them.

AudioContext: running, 48000 Hz, 2 node(s) feeding the speakers.

| Moment | RMS | dBFS | Peak | Result |
|---|---|---|---|---|
| Menu music (title screen)  | 0.1107 | -19.1 | 0.227 | ✅ |
| Phone call (ring, pickup, line)  | 0.1361 | -17.3 | 0.372 | ✅ |
| Office ambience (room tone + fan)  | 0.0852 | -21.4 | 0.177 | ✅ |
| Door close (peak 3.9× the room tone's; adds 0.2830 RMS) | 0.2956 | -10.6 | 0.682 | ✅ |
| Camera switch (peak 3.1× the camera room tone's; adds 0.1161 RMS) | 0.1476 | -16.6 | 0.489 | ✅ |
| Jumpscare scream (Scoggcrates)  | 0.5309 | -5.5 | 0.756 | ✅ |
| Power-down  | 0.2750 | -11.2 | 0.714 | ✅ |
| Power-out march  | 0.1537 | -16.3 | 0.341 | ✅ |
| Power-out scream (Uncle Scogg)  | 0.5240 | -5.6 | 0.792 | ✅ |
| 6 AM chime  | 0.2173 | -13.3 | 0.456 | ✅ |
| Console errors | | | | ✅ none |

**PASS**
