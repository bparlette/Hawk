# Palm City — Voice Pack Manifest

**Script: LINES.md v2.1** (50 lines). Generated with Gemini TTS (model `gemini-3.8-flash-tts`) via the Gemini API CLI wrapper. One voice per role, consistent across all of that role's lines.

**v2.1 regeneration:** six lines were swapped in the v2.1 script review and regenerated with the new text — **cop01, cop03, get01, get03, ped04, rad04**. All other lines match v2 text.

**FAILED lines: none.** All 50 lines generated and verified (duration > 0.3 s, sane file size).

## Casting

| Role | Gemini voice | Notes |
|---|---|---|
| COP | Algenib | gravelly male — traffic stops & siege lines (cop*, sig*) |
| DISPATCH | Erinome | calm female — police dispatch (dsp*) |
| TOURIST | Laomedeia | cheerful female — taxi fares (tax01–02) |
| FED | Charon | flat male — undercover fares (tax03–04) |
| LOCAL | Iapetus | brisk male — local fares (tax05–06) |
| NANA | Gacrux | older female — bus passengers (bus*) |
| LOTGUY | Umbriel | bored male — tow lot (tow*) |
| ROBBER | Fenrir | young excitable male — getaway fares (get*) |
| VALET | Schedar | smooth male — valet job (val01) |
| HYPE | Puck | announcer male — WRECK IT! event (wrk*) |
| PEDF | Autonoe | female pedestrian (ped01, ped03, ped05) |
| PEDM | Zubenelgenubi | male pedestrian (ped02, ped04) |
| HERO | Aoede | young breezy — the player character (her*) |
| DJ | Algieba | smooth warm male — radio DJ (rad01–04) |
| AD | Sadachbia | bright ad read (rad05) |

## Processing

- All lines: silence-trimmed (both ends), loudness-normalized (EBU R128, −16 LUFS), 44.1 kHz mono.
- **DISPATCH (dsp01–dsp06):** radio treatment on the main file (band-pass 800 Hz–3 kHz + compression); unfiltered copy kept as `<id>-clean.ogg`.
- **DJ (rad01–rad04):** warm FM treatment (low-shelf lift + gentle compression). **rad05 (AD)** ships clean.
- Formats: `audio/<id>.ogg` (Vorbis q5, primary deliverable) + `audio-m4a/<id>.m4a` (AAC 96k mirror for iOS Safari, which cannot play ogg). Raw 24 kHz WAVs in `raw/`.

## Lines

| ID | Role | Voice | Line (v2.1 text) | Duration | Size (ogg) |
|---|---|---|---|---|---|
| cop01 | COP | Algenib | "Palm City PD! Pull over and explain that turn!" | 3.02 s | 31 KB |
| cop02 | COP | Algenib | "He's driving on the beach! That sand was imported!" | 3.08 s | 32 KB |
| cop03 | COP | Algenib | "Stop the vehicle! My shift ends in four minutes!" | 4.00 s | 39 KB |
| cop04 | COP | Algenib | "Dispatch, he's driving like the rental's insured!" | 2.45 s | 27 KB |
| cop05 | COP | Algenib | "Run all you want — the spotlight loves this part." | 4.00 s | 42 KB |
| cop06 | COP | Algenib | "That's MY hood you're standing on!" | 1.77 s | 20 KB |
| dsp01 | DISPATCH | Erinome | "All units: suspect is sunburned, armed with a skateboard, and making poor choices." | 5.80 s | 51 KB + dsp01-clean.ogg (56 KB) |
| dsp02 | DISPATCH | Erinome | "Be advised, the tow truck is now towing... us." | 4.10 s | 37 KB + dsp02-clean.ogg (40 KB) |
| dsp03 | DISPATCH | Erinome | "Suspect has entered the motel. The one with the furniture. Godspeed." | 4.50 s | 41 KB + dsp03-clean.ogg (45 KB) |
| dsp04 | DISPATCH | Erinome | "Air support is airborne. The beach has been notified." | 2.67 s | 26 KB + dsp04-clean.ogg (29 KB) |
| dsp05 | DISPATCH | Erinome | "Heat level falling. If he survives the stairs, let him go. He's earned it." | 4.60 s | 40 KB + dsp05-clean.ogg (43 KB) |
| dsp06 | DISPATCH | Erinome | "Update: the suspect is now giving our officers a lift. This is not a drill." | 4.60 s | 45 KB + dsp06-clean.ogg (51 KB) |
| sig01 | COP | Algenib | "We know you're in there! The vending machine gave you up!" | 3.05 s | 31 KB |
| sig02 | COP | Algenib | "Stairs are SLIPPERY — who iced the stairs?!" | 3.00 s | 33 KB |
| sig03 | COP | Algenib | "He's got furniture. Repeat, he has weaponized the furniture." | 3.19 s | 34 KB |
| sig04 | COP | Algenib | "Send the ram. And a mop." | 2.26 s | 24 KB |
| sig05 | COP | Algenib | "Roof! He's on the roof! Of course he's on the roof!" | 3.72 s | 35 KB |
| sig06 | COP | Algenib | "He dropped the SIGN. The neon one. On the cars." | 4.70 s | 45 KB |
| tax01 | TOURIST | Laomedeia | "Faster! I tipped the last driver for a jump like that!" | 3.10 s | 31 KB |
| tax02 | TOURIST | Laomedeia | "Five stars! I almost lost my hat AND my deposit!" | 3.88 s | 41 KB |
| tax03 | FED | Charon | "Nice driving. Hypothetically. This conversation never happened." | 4.20 s | 44 KB |
| tax04 | FED | Charon | "Take the alley. Trust me. I know things about alleys." | 4.00 s | 44 KB |
| tax05 | LOCAL | Iapetus | "Airport. My flight's in an hour and so is my wedding." | 3.00 s | 36 KB |
| tax06 | LOCAL | Iapetus | "You drive like my ex. She had a boat too." | 2.64 s | 27 KB |
| bus01 | NANA | Gacrux | "Young man, this is a bus route, not a demolition derby." | 3.87 s | 43 KB |
| bus02 | NANA | Gacrux | "Miss my stop and I swear on my beach chair—" | 2.28 s | 28 KB |
| bus03 | NANA | Gacrux | "My hip! ...The other one says go again." | 3.48 s | 35 KB |
| tow01 | LOTGUY | Umbriel | "You towed a police car. There's a form for that. There isn't. I lied." | 5.30 s | 52 KB |
| tow02 | LOTGUY | Umbriel | "Park it anywhere. 'Anywhere' is doing a lot of work in that sentence." | 4.50 s | 54 KB |
| tow03 | LOTGUY | Umbriel | "That's the mayor's car. Again. He'll be thrilled. Again." | 6.10 s | 56 KB |
| get01 | ROBBER | Fenrir | "Floor it! My parole officer thinks I'm at a dentist!" | 2.61 s | 28 KB |
| get02 | ROBBER | Fenrir | "Spikes out! Sorry, officers — budget cuts!" | 3.21 s | 31 KB |
| get03 | ROBBER | Fenrir | "The dashboard's on fire! Grab the bag, leave the receipt!" | 2.88 s | 30 KB |
| get04 | ROBBER | Fenrir | "If we live, I'm buying a boat. A slow one." | 3.35 s | 32 KB |
| val01 | VALET | Schedar | "Sir. That was a 180. Into the exact slot. I'm not even mad." | 4.60 s | 50 KB |
| wrk01 | HYPE | Puck | "WRECK IT! Sixty seconds! Everything must go — especially the umbrellas!" | 5.30 s | 51 KB |
| wrk02 | HYPE | Puck | "DOMINO! The awning took the hydrant, the hydrant took my heart!" | 4.40 s | 42 KB |
| ped01 | PEDF | Autonoe | "My smoothie!" | 1.43 s | 16 KB |
| ped02 | PEDM | Zubenelgenubi | "I just WAXED that board!" | 1.93 s | 22 KB |
| ped03 | PEDF | Autonoe | "Is that man towing a police car?!" | 2.27 s | 24 KB |
| ped04 | PEDM | Zubenelgenubi | "Watch it! I'm double-parked!" | 2.13 s | 22 KB |
| ped05 | PEDF | Autonoe | "I'm not moving. I paid for this beach chair." | 3.08 s | 32 KB |
| her01 | HERO | Aoede | "Sorry! Nice car, though." | 2.41 s | 24 KB |
| her02 | HERO | Aoede | "Totally meant to do that." | 1.57 s | 20 KB |
| her03 | HERO | Aoede | "Beautiful day for it." | 1.00 s | 13 KB |
| rad01 | DJ | Algieba | "You're on Palm City FM — sun's down, neon's up, and somebody is towing a police car past the Solana. This is your city." | 10.50 s | 106 KB |
| rad02 | DJ | Algieba | "Traffic report: don't. Weather: golden. Police scanner: entertaining." | 5.40 s | 51 KB |
| rad03 | DJ | Algieba | "This one's for the guy on the skateboard. You know what you did." | 4.90 s | 48 KB |
| rad04 | DJ | Algieba | "Stay hydrated, stay golden, and if the chopper spotlight finds you — try to look expensive." | 5.80 s | 58 KB |
| rad05 | AD | Sadachbia | "The Solana Hotel: now with forty percent fewer crime scenes! Book the Siege Suite — furniture included, barricades complimentary." | 8.90 s | 83 KB |

## Production note

Generation ran Nov 15–16, 2026 against the Gemini free tier (3 requests/min for this TTS model). The project's daily TTS quota was exhausted on Nov 15 (hundreds of HTTP 429 responses; only sporadic successes leaked through shared fleet contention). The remaining lines completed within minutes of the daily quota reset at midnight Pacific (08:00 UTC, Nov 16). No audio was faked and no other TTS tool was substituted.
