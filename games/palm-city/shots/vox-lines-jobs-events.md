# Palm City — Jobs & City Events Voice Lines (35 Hooks Draft)

**Status:** Draft for owner approval -> Moth's next TTS round (`assets/audio/voice/`). Text only.  
**Tone Rule:** Deadpan municipal/corporate/hospitality professionals vs. absurd street chaos; barks <= 10 words; satire played 100% straight.  
**Sources:** `jobs-spec.md` (`23` `VOX_JOB_*` hooks) + `events-spec.md` (`12` `VOX_EVT_*` hooks).

## Cast Guide (6 Recurring Deadpan Voices)

| Speaker Tag | Persona & Delivery Note |
| :--- | :--- |
| `DISPATCH` | Police / transit radio dispatcher. Flat, bored, clinical even during armored pileups. |
| `FOREMAN` | Impound & demolition contractor. Speaks strictly in OSHA, billing, and tonnage terms. |
| `FARE_VIP` | Backseat Palm City client. Passive-aggressive commuter manners while flying over curbs. |
| `FED_FARE` | Undercover federal agent posing as a cab fare. Mild politeness snapping straight into a badge pull. |
| `HEIST_CREW` | Armed bank crew in the passenger seat. Unnervingly polite and procedural mid-chase. |
| `INSPECTOR` | City transit / property claims adjuster logging urban collateral damage in real time. |
| `VALET_LEAD` | Oceanview Hotel head valet. Luxury hospitality snob treating tire smoke as minor etiquette friction. |

*(Note: `FARE_CHAOS` joins `FARE_VIP` and `FED_FARE` for the high-speed cab fare archetype.)*

---

## Voice Lines Table (All 35 Hooks)

| Hook ID | Speaker | Line | Trigger |
| :--- | :--- | :--- | :--- |
| `VOX_JOB_TAXI_START` | `DISPATCH` | "Meter active. Try not to invoice the suspension again." | Player starts Taxi run |
| `VOX_JOB_TAXI_PICKUP_CHILL` | `FARE_CHAOS` | "My parole officer checks GPS. Floor it past lights." | Speed/Chaos fare enters cab |
| `VOX_JOB_TAXI_PICKUP_VIP` | `FARE_VIP` | "Two stars off for harsh braking. Proceed carefully." | Smooth VIP fare enters cab |
| `VOX_JOB_TAXI_MOOD_LOW` | `FARE_VIP` | "Sidewalks are legally pedestrian infrastructure, driver." | Fare mood drops below `25` |
| `VOX_JOB_TAXI_FED_REVEAL` | `FED_FARE` | "I lied about accounting. Pull over. Federal warrant." | `wanted >= 3` undercover Fed blows cover |
| `VOX_JOB_TAXI_DROP_CLEAN` | `FARE_VIP` | "Adequate trauma avoidance. Submitting four stars." | High-mood fare drop-off (`mood >= 75`) |
| `VOX_JOB_TOW_START` | `FOREMAN` | "Defaulted leases on South Palm. Repossess before brunch." | Tow contract accepted at Garage/board |
| `VOX_JOB_TOW_HOOKED` | `FOREMAN` | "Winch engaged. Owners rarely waive liability politely." | Tow cable latches onto target car |
| `VOX_JOB_TOW_WEAPON_HIT` | `DISPATCH` | "Unit report: weaponized sedan approaching patrol vehicle." | Swung payload smashes cop car or prop |
| `VOX_JOB_TOW_SLINGSHOT` | `FOREMAN` | "Release confirmed. That sedan technically qualifies as ordnance." | High-speed release slingshots payload |
| `VOX_JOB_TOW_SNAP` | `FOREMAN` | "Cable sheared. Physics billed the towing company again." | Over-tension snaps tow cable |
| `VOX_JOB_TOW_DELIVERED` | `FOREMAN` | "Lot received. Please leave any attached bumpers outside." | Target settles inside Garage drop apron |
| `VOX_JOB_BUS_START` | `DISPATCH` | "Coastal Route Four live. Municipal insurance remains suspended." | Bus route begins |
| `VOX_JOB_BUS_BOARD` | `INSPECTOR` | "Doors cycling. Please step over any active pursuit debris." | Doors open cleanly inside curb box |
| `VOX_JOB_BUS_SKIP_WARN` | `INSPECTOR` | "Stop skipped. Seven commuters just filed complaints mid-sprint." | Bus pulls out before dwell bar fills |
| `VOX_JOB_BUS_RUSH` | `DISPATCH` | "Forty seconds ahead of schedule despite felony traffic." | Hits full stop combo under timer |
| `VOX_JOB_BUS_FINISH` | `INSPECTOR` | "Route completed. Only minimal structural complaints logged today." | Completes full 6-stop loop |
| `VOX_JOB_GETAWAY_ALARM` | `HEIST_CREW` | "Vault cleared. Teller asked for our validation ticket." | Crew exits heist with duffel bags |
| `VOX_JOB_GETAWAY_SPIKES` | `DISPATCH` | "Deployment confirmed: titanium spike belt on Ocean Boulevard." | Patrol deploys spike strip ahead |
| `VOX_JOB_GETAWAY_TIRE_BLOWN` | `HEIST_CREW` | "Front right tire is sparks now. Steer accordingly." | Getaway car rolls over spikes |
| `VOX_JOB_GETAWAY_DECOY` | `HEIST_CREW` | "Dropping bait bills. Watch civil servants abandon pursuit." | Cash decoy bundle dropped |
| `VOX_JOB_GETAWAY_TANDEM_BAIL` | `HEIST_CREW` | "Exiting vehicle. Please tell me this skateboard has brakes." | Driver and crew bail onto skateboard |
| `VOX_JOB_GETAWAY_CLEAR` | `HEIST_CREW` | "Safehouse perimeter clear. Nobody check my resting pulse." | Reaches safehouse and shakes tail |
| `VOX_EVT_WRECK_START` | `INSPECTOR` | "Urban renewal permit approved. Forty-five seconds, zero survivors." | Countdown `3-2-1-GO` begins |
| `VOX_EVT_WRECK_DOMINO` | `FOREMAN` | "Sequential structural failure achieved. Very tidy detonation." | Domino Anchor ignites >= 3-object chain |
| `VOX_EVT_WRECK_CHAIN_5X` | `INSPECTOR` | "Five-times property depreciation recorded inside one city block." | Combo multiplier hits `5x` or higher |
| `VOX_EVT_WRECK_10S` | `INSPECTOR` | "Ten seconds before zoning enforcement arrives with citations." | `10.0 s` remaining warning |
| `VOX_EVT_WRECK_GOLD` | `FOREMAN` | "Gold target met. Insurer has left the municipality." | Round ends with Gold medal score |
| `VOX_EVT_WRECK_BUSTED` | `DISPATCH` | "Suspect detained. Please complete demolition assessment by Monday." | Busted mid-event |
| `VOX_EVT_VALET_START` | `VALET_LEAD` | "Keys transferred. Our guests prefer no kinetic entries." | Valet run starts |
| `VOX_EVT_VALET_MINT` | `VALET_LEAD` | "Zero microns of paint lost. Unsettlingly graceful." | Clean bay lock with zero paint scuffs |
| `VOX_EVT_VALET_DRIFT` | `VALET_LEAD` | "Sideways entry accepted. Guests mistook it for flair." | `2.5x` slide-in park locked |
| `VOX_EVT_VALET_JTURN` | `VALET_LEAD` | "A hundred-eighty reverse bay lock. Astonishingly unnecessary." | `5x` J-Turn Park verified |
| `VOX_EVT_VALET_SCRAPE` | `VALET_LEAD` | "That fender belonged to a yacht broker. Embarrassing." | Clips flanking car / loses Mint bonus |
| `VOX_EVT_VALET_COMPLETE` | `VALET_LEAD` | "Every vehicle docked. Only minor tire smoke remains." | Clears all bays before timer |
