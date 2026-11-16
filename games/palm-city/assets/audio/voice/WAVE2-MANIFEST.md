# Palm City — Voice Pack WAVE 2 Manifest (Jobs/Events + Destruction/Siege)

**Status: PARTIAL — 17 of 71 lines generated.** The Gemini free-tier daily TTS quota
was already largely spent (wave-1 mop-up earlier today); generation ran against
HTTP 429 (`too_many_requests`, "retry in ~17h" = midnight-Pacific reset) with
sporadic successes leaking through shared fleet contention — the same pattern as
wave 1. Two full round-robin passes were run; the remaining 54 hooks are listed
below as NOT GENERATED. No other TTS engine was substituted and no audio was faked.
To finish after the quota reset: `python3 wave2_pipeline.py gen` then
`python3 wave2_pipeline.py post` in this folder (idempotent — existing WAVs skip).

Generated with Gemini TTS (model `gemini-3.8-flash-tts`) via the Gemini API CLI
wrapper, same pipeline as wave 1 (`wave2_pipeline.py` mirrors `generate.py` /
`gen_loop.py` / `postprocess.py`).

## Casting

| Speaker | Gemini voice | Notes |
|---|---|---|
| DISPATCH | Erinome | RETURNING wave-1 voice — radio lines |
| INSPECTOR | Pulcherrima | forward female — claims adjuster. NOTE: the cast guides call INSPECTOR a returning wave-1 voice, but INSPECTOR does not appear in wave 1's MANIFEST.md casting or files; cast fresh here. |
| FOREMAN | Alnilam | firm male — impound/demolition contractor, OSHA & billing speak |
| FARE_VIP | Despina | smooth female — passive-aggressive backseat client |
| FED_FARE | Orus | firm male — undercover fed posing as a fare |
| FARE_CHAOS | Enceladus | breathy male — jittery chaos fare |
| HEIST_CREW | Sadaltager | knowledgeable male — unnervingly polite, procedural crew |
| VALET_LEAD | Achird | friendly male — luxury hospitality snob, head valet |
| BYSTANDER | Callirrhoe | easy-going female — calmly inconvenienced boardwalk local |
| NIGHT_CLERK | Kore | firm female — unbothered motel front-desk clerk |
| SWAT_LEAD | Rasalgethi | informative male — tactical breach commander |

## Processing

- All lines: silence-trimmed (both ends), loudness-normalized (EBU R128, −16 LUFS), 44.1 kHz mono — identical chain to wave 1.
- **DISPATCH lines:** radio treatment on the main file (band-pass 800 Hz–3 kHz + compression); unfiltered copy kept as `<id>-clean.ogg` — same as wave 1's dsp files. (In wave 2 the treatment keys on the DISPATCH speaker, since filenames no longer carry the `dsp` prefix.)
- Formats: `audio/<id>.ogg` (Vorbis q5) + `audio-m4a/<id>.m4a` (AAC 96k). Raw 24 kHz WAVs in `raw/`.
- Verification: every output ffprobe-checked — duration > 0.3 s, correct codec, 44100 Hz, mono. 36/36 files pass.

## Generated lines (17/71)

| Hook | Speaker | Voice | Line | Duration | Files |
|---|---|---|---|---|---|
| VOX_JOB_TAXI_START | DISPATCH | Erinome | "Meter active. Try not to invoice the suspension again." | 3.38 s | job_taxi_start.ogg (33 KB) + job_taxi_start.m4a + job_taxi_start-clean.ogg (36 KB) |
| VOX_JOB_TAXI_PICKUP_CHILL | FARE_CHAOS | Enceladus | "My parole officer checks GPS. Floor it past lights." | 3.42 s | job_taxi_pickup_chill.ogg (35 KB) + job_taxi_pickup_chill.m4a |
| VOX_JOB_TAXI_MOOD_LOW | FARE_VIP | Despina | "Sidewalks are legally pedestrian infrastructure, driver." | 3.57 s | job_taxi_mood_low.ogg (36 KB) + job_taxi_mood_low.m4a |
| VOX_JOB_TAXI_DROP_CLEAN | FARE_VIP | Despina | "Adequate trauma avoidance. Submitting four stars." | 4.20 s | job_taxi_drop_clean.ogg (40 KB) + job_taxi_drop_clean.m4a |
| VOX_JOB_TOW_START | FOREMAN | Alnilam | "Defaulted leases on South Palm. Repossess before brunch." | 3.87 s | job_tow_start.ogg (38 KB) + job_tow_start.m4a |
| VOX_JOB_TOW_HOOKED | FOREMAN | Alnilam | "Winch engaged. Owners rarely waive liability politely." | 4.00 s | job_tow_hooked.ogg (42 KB) + job_tow_hooked.m4a |
| VOX_JOB_TOW_DELIVERED | FOREMAN | Alnilam | "Lot received. Please leave any attached bumpers outside." | 4.00 s | job_tow_delivered.ogg (42 KB) + job_tow_delivered.m4a |
| VOX_JOB_BUS_SKIP_WARN | INSPECTOR | Pulcherrima | "Stop skipped. Seven commuters just filed complaints mid-sprint." | 3.90 s | job_bus_skip_warn.ogg (44 KB) + job_bus_skip_warn.m4a |
| VOX_JOB_BUS_FINISH | INSPECTOR | Pulcherrima | "Route completed. Only minimal structural complaints logged today." | 4.30 s | job_bus_finish.ogg (48 KB) + job_bus_finish.m4a |
| VOX_JOB_GETAWAY_TANDEM_BAIL | HEIST_CREW | Sadaltager | "Exiting vehicle. Please tell me this skateboard has brakes." | 3.79 s | job_getaway_tandem_bail.ogg (39 KB) + job_getaway_tandem_bail.m4a |
| VOX_EVT_VALET_MINT | VALET_LEAD | Achird | "Zero microns of paint lost. Unsettlingly graceful." | 4.20 s | evt_valet_mint.ogg (42 KB) + evt_valet_mint.m4a |
| VOX_EVT_VALET_SCRAPE | VALET_LEAD | Achird | "That fender belonged to a yacht broker. Embarrassing." | 3.28 s | evt_valet_scrape.ogg (35 KB) + evt_valet_scrape.m4a |
| VOX_DEST_STALL_CRUSH | BYSTANDER | Callirrhoe | "All beachfront souvenirs are now half off." | 2.97 s | dest_stall_crush.ogg (34 KB) + dest_stall_crush.m4a |
| VOX_DEST_TOWER_DROP | DISPATCH | Erinome | "Lifeguard visibility has dropped to ankle height." | 3.14 s | dest_tower_drop.ogg (32 KB) + dest_tower_drop.m4a + dest_tower_drop-clean.ogg (33 KB) |
| VOX_PALM_SNAP_NEAR | BYSTANDER | Callirrhoe | "My iced matcha was directly under that frond." | 2.60 s | palm_snap_near.ogg (29 KB) + palm_snap_near.m4a |
| VOX_PALM_SNAP_CAR | BYSTANDER | Callirrhoe | "Nature reclaiming the hatchback right on cue." | 2.70 s | palm_snap_car.ogg (30 KB) + palm_snap_car.m4a |
| VOX_SWAT_ARRIVE | SWAT_LEAD | Rasalgethi | "Tactical teams staging outside Palm City Motel." | 2.59 s | swat_arrive.ogg (29 KB) + swat_arrive.m4a |

## NOT GENERATED — quota exhausted (54/71)

| Hook | Speaker | Voice (cast) | Line |
|---|---|---|---|
| VOX_JOB_TAXI_PICKUP_VIP | FARE_VIP | Despina | "Two stars off for harsh braking. Proceed carefully." |
| VOX_JOB_TAXI_FED_REVEAL | FED_FARE | Orus | "I lied about accounting. Pull over. Federal warrant." |
| VOX_JOB_TOW_WEAPON_HIT | DISPATCH | Erinome | "Unit report: weaponized sedan approaching patrol vehicle." |
| VOX_JOB_TOW_SLINGSHOT | FOREMAN | Alnilam | "Release confirmed. That sedan technically qualifies as ordnance." |
| VOX_JOB_TOW_SNAP | FOREMAN | Alnilam | "Cable sheared. Physics billed the towing company again." |
| VOX_JOB_BUS_START | DISPATCH | Erinome | "Coastal Route Four live. Municipal insurance remains suspended." |
| VOX_JOB_BUS_BOARD | INSPECTOR | Pulcherrima | "Doors cycling. Please step over any active pursuit debris." |
| VOX_JOB_BUS_RUSH | DISPATCH | Erinome | "Forty seconds ahead of schedule despite felony traffic." |
| VOX_JOB_GETAWAY_ALARM | HEIST_CREW | Sadaltager | "Vault cleared. Teller asked for our validation ticket." |
| VOX_JOB_GETAWAY_SPIKES | DISPATCH | Erinome | "Deployment confirmed: titanium spike belt on Ocean Boulevard." |
| VOX_JOB_GETAWAY_TIRE_BLOWN | HEIST_CREW | Sadaltager | "Front right tire is sparks now. Steer accordingly." |
| VOX_JOB_GETAWAY_DECOY | HEIST_CREW | Sadaltager | "Dropping bait bills. Watch civil servants abandon pursuit." |
| VOX_JOB_GETAWAY_CLEAR | HEIST_CREW | Sadaltager | "Safehouse perimeter clear. Nobody check my resting pulse." |
| VOX_EVT_WRECK_START | INSPECTOR | Pulcherrima | "Urban renewal permit approved. Forty-five seconds, zero survivors." |
| VOX_EVT_WRECK_DOMINO | FOREMAN | Alnilam | "Sequential structural failure achieved. Very tidy detonation." |
| VOX_EVT_WRECK_CHAIN_5X | INSPECTOR | Pulcherrima | "Five-times property depreciation recorded inside one city block." |
| VOX_EVT_WRECK_10S | INSPECTOR | Pulcherrima | "Ten seconds before zoning enforcement arrives with citations." |
| VOX_EVT_WRECK_GOLD | FOREMAN | Alnilam | "Gold target met. Insurer has left the municipality." |
| VOX_EVT_WRECK_BUSTED | DISPATCH | Erinome | "Suspect detained. Please complete demolition assessment by Monday." |
| VOX_EVT_VALET_START | VALET_LEAD | Achird | "Keys transferred. Our guests prefer no kinetic entries." |
| VOX_EVT_VALET_DRIFT | VALET_LEAD | Achird | "Sideways entry accepted. Guests mistook it for flair." |
| VOX_EVT_VALET_JTURN | VALET_LEAD | Achird | "A hundred-eighty reverse bay lock. Astonishingly unnecessary." |
| VOX_EVT_VALET_COMPLETE | VALET_LEAD | Achird | "Every vehicle docked. Only minor tire smoke remains." |
| VOX_DEST_CAR_SMASH | INSPECTOR | Pulcherrima | "That sedan is legally structural compost now." |
| VOX_DEST_CAR_SMOKE | BYSTANDER | Callirrhoe | "Free oil diffuser on third avenue." |
| VOX_DEST_GLASS_SHOP | INSPECTOR | Pulcherrima | "Display bay opened without architectural clearance." |
| VOX_DEST_AWNING_TEAR | BYSTANDER | Callirrhoe | "Great, now the patio cafe has no shade." |
| VOX_DEST_NEON_FALL | DISPATCH | Erinome | "Club signage relocated itself to curbside asphalt." |
| VOX_DEST_FENCE_BREACH | BYSTANDER | Callirrhoe | "Driveway widened ahead of schedule, thanks." |
| VOX_DEST_HYDRANT_GEYSER | DISPATCH | Erinome | "Unauthorized coastal fountain active at fourth street." |
| VOX_DEST_BENCH_SPLIT | INSPECTOR | Pulcherrima | "Single park bench now counts as two stools." |
| VOX_PALM_SNAP_DRY | BYSTANDER | Callirrhoe | "Honest question, did the palm cut me off?" |
| VOX_PALM_SNAP_TOURIST | BYSTANDER | Callirrhoe | "Brochure promised gentle tropical breeze, not timber." |
| VOX_PALM_SNAP_JOGGER | BYSTANDER | Callirrhoe | "Hurdlers train for less than this commute." |
| VOX_PALM_SNAP_SHADE | BYSTANDER | Callirrhoe | "Well, there goes my afternoon reading spot." |
| VOX_PALM_SNAP_MULTI | DISPATCH | Erinome | "Advisory: rapid deforestation reported along Ocean Drive." |
| VOX_PALM_SNAP_CIVIC | INSPECTOR | Pulcherrima | "Arborist invoice exceeds the sedan's bluebook value." |
| VOX_SWAT_DOOR_BREACH | SWAT_LEAD | Rasalgethi | "Lobby entry clear. Watch for cheap carpet." |
| VOX_SWAT_LADDER_UP | SWAT_LEAD | Rasalgethi | "Raising extension ladder to floor two balcony." |
| VOX_SWAT_SHIELD_ADV | SWAT_LEAD | Rasalgethi | "Ballistic shield leading corridor push. Stay tight." |
| VOX_SWAT_FLANK_STAIRS | SWAT_LEAD | Rasalgethi | "Fire escape team moving up external flights." |
| VOX_SWAT_FLASHBANG | SWAT_LEAD | Rasalgethi | "Breaching room two-oh-four. Eyes clear, masks down." |
| VOX_SWAT_SNIPER_PING | SWAT_LEAD | Rasalgethi | "Chopper overwatch tracking silhouette near roof hatch." |
| VOX_SWAT_STUNNED | SWAT_LEAD | Rasalgethi | "Point man downed by domestic hospitality equipment." |
| VOX_SWAT_RETREAT | SWAT_LEAD | Rasalgethi | "Negative containment. Suspect slipped the roof hatch." |
| VOX_SIEGE_START | NIGHT_CLERK | Kore | "Check-in closes early when SWAT surrounds reception." |
| VOX_SIEGE_TRAP_VEND | NIGHT_CLERK | Kore | "Please note vending snacks remain seventy-five cents." |
| VOX_SIEGE_TRAP_TV | SWAT_LEAD | Rasalgethi | "Contact neutralized via zenith tube television set." |
| VOX_SIEGE_TRAP_CART | NIGHT_CLERK | Kore | "Housekeeping bills extra for tactical laundry delays." |
| VOX_SIEGE_TRAP_AC | NIGHT_CLERK | Kore | "Window unit warranty definitely voids after vertical drop." |
| VOX_SIEGE_TRAP_FUSE | SWAT_LEAD | Rasalgethi | "Corridor power lost. Somebody pulled the mains." |
| VOX_SIEGE_BARRICADE | NIGHT_CLERK | Kore | "Kindly stack that dresser near the exit." |
| VOX_SIEGE_FLOOR_CLEAR | NIGHT_CLERK | Kore | "Floor two vacated. Housekeeping appreciates your urgency." |
| VOX_SIEGE_ROOF_ESCAPE | DISPATCH | Erinome | "Suspect exited skyward. Roof hatch left open." |

## Production note

Generation ran Nov 16, 2026. Wave-1's remaining lines had consumed most of the
day's free-tier TTS quota that morning; wave 2 began against a near-spent quota.
Round 1 leaked 14 successes of 70 attempts, round 2 a further 3 of 57 (plus 1
pre-flight test line = 17 total). The 429 responses quoted a ~17–18 h retry window,
matching the midnight-Pacific daily reset that completed wave 1. The remaining 54
hooks should generate quickly once the quota resets.
