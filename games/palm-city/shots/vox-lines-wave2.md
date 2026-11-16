# Palm City — VOX Wave 2: Destruction & Motel Siege Barks (36 Hooks Draft)

**Status:** **DRAFTS ONLY FOR OWNER APPROVAL** — DO NOT generate TTS audio before explicit owner sign-off (same approval gate as Wave 1 [`vox-lines-jobs-events.md`](vox-lines-jobs-events.md)). Text only.  
**Tone & Length Rule:** Deadpan municipal, hospitality, tactical, and bystander voices played 100% straight against cartoonish street/motel mayhem. **Strictly `≤ 10` words per line.**

---

## Cast Guide (Wave 2 Voices)

| Speaker Tag | Persona & Delivery Note |
| :--- | :--- |
| `BYSTANDER` | Coastal boardwalk locals and tourists. Calmly inconvenienced by catastrophic property damage. |
| `NIGHT_CLERK` | Palm City Motel front-desk clerk. Treats SWAT raids and falling furniture as routine check-in friction. |
| `SWAT_LEAD` | Tactical breach commander on radio. Crisp military brevity undermined by motel appliances. |
| `INSPECTOR` | Returning Wave-1 municipal adjuster logging Phase-1 and Phase-2 structural losses. |
| `DISPATCH` | Returning Wave-1 flat city dispatcher logging civic utility and signage outages. |

---

## Wave 2 Voice Lines Table (36 Hooks)

### 1. Wreck & Phase-2 Destruction Reactions (10 Hooks)

| Hook ID | Speaker | Line | Trigger |
| :--- | :--- | :--- | :--- |
| `VOX_DEST_CAR_SMASH` | `INSPECTOR` | "That sedan is legally structural compost now." | Vehicle reaches Stage-3 crumpled wreck |
| `VOX_DEST_CAR_SMOKE` | `BYSTANDER` | "Free oil diffuser on third avenue." | Player or traffic car engine begins smoking |
| `VOX_DEST_GLASS_SHOP` | `INSPECTOR` | "Display bay opened without architectural clearance." | Storefront glass window shatters (`Stage 3`) |
| `VOX_DEST_AWNING_TEAR` | `BYSTANDER` | "Great, now the patio cafe has no shade." | Striped storefront awning rips free |
| `VOX_DEST_NEON_FALL` | `DISPATCH` | "Club signage relocated itself to curbside asphalt." | Rooftop or blade neon sign drops (`Stage 3`) |
| `VOX_DEST_FENCE_BREACH` | `BYSTANDER` | "Driveway widened ahead of schedule, thanks." | Car punches through residential picket fence |
| `VOX_DEST_HYDRANT_GEYSER` | `DISPATCH` | "Unauthorized coastal fountain active at fourth street." | Fire hydrant shears into geyser (`Stage 2`) |
| `VOX_DEST_STALL_CRUSH` | `BYSTANDER` | "All beachfront souvenirs are now half off." | Market stall canopy collapses on boardwalk |
| `VOX_DEST_BENCH_SPLIT` | `INSPECTOR` | "Single park bench now counts as two stools." | Park bench snaps in half (`Stage 2`) |
| `VOX_DEST_TOWER_DROP` | `DISPATCH` | "Lifeguard visibility has dropped to ankle height." | Lifeguard tower collapses (`Stage 3`) |

### 2. Palm-Snap Bystanders (8 Hooks)

| Hook ID | Speaker | Line | Trigger |
| :--- | :--- | :--- | :--- |
| `VOX_PALM_SNAP_NEAR` | `BYSTANDER` | "My iced matcha was directly under that frond." | Palm snaps within `90 wu` of bystander |
| `VOX_PALM_SNAP_DRY` | `BYSTANDER` | "Honest question, did the palm cut me off?" | Driver clips and snaps beachfront palm trunk |
| `VOX_PALM_SNAP_CAR` | `BYSTANDER` | "Nature reclaiming the hatchback right on cue." | Fallen palm lands atop parked or traffic car |
| `VOX_PALM_SNAP_TOURIST` | `BYSTANDER` | "Brochure promised gentle tropical breeze, not timber." | Tourist ped panics near snapping palm |
| `VOX_PALM_SNAP_JOGGER` | `BYSTANDER` | "Hurdlers train for less than this commute." | Pedestrian vaults or flees freshly downed trunk |
| `VOX_PALM_SNAP_SHADE` | `BYSTANDER` | "Well, there goes my afternoon reading spot." | Beachgoer stands beside freshly split stump |
| `VOX_PALM_SNAP_MULTI` | `DISPATCH` | "Advisory: rapid deforestation reported along Ocean Drive." | `>= 2` palms snapped inside `4.0 s` |
| `VOX_PALM_SNAP_CIVIC` | `INSPECTOR` | "Arborist invoice exceeds the sedan's bluebook value." | High-value palm row cleared in combo |

### 3. SWAT Breach & Exterior Perimeter Callouts (9 Hooks)

| Hook ID | Speaker | Line | Trigger |
| :--- | :--- | :--- | :--- |
| `VOX_SWAT_ARRIVE` | `SWAT_LEAD` | "Tactical teams staging outside Palm City Motel." | SWAT vans lock down street perimeter |
| `VOX_SWAT_DOOR_BREACH` | `SWAT_LEAD` | "Lobby entry clear. Watch for cheap carpet." | First-floor SWAT breach team kicks lobby door |
| `VOX_SWAT_LADDER_UP` | `SWAT_LEAD` | "Raising extension ladder to floor two balcony." | Ladder team deploys against east wall |
| `VOX_SWAT_SHIELD_ADV` | `SWAT_LEAD` | "Ballistic shield leading corridor push. Stay tight." | Shield trooper advances up stairwell |
| `VOX_SWAT_FLANK_STAIRS` | `SWAT_LEAD` | "Fire escape team moving up external flights." | Exterior fire-escape squad climbs floor-to-floor |
| `VOX_SWAT_FLASHBANG` | `SWAT_LEAD` | "Breaching room two-oh-four. Eyes clear, masks down." | SWAT throws flash/smoke into occupied room |
| `VOX_SWAT_SNIPER_PING` | `SWAT_LEAD` | "Chopper overwatch tracking silhouette near roof hatch." | Rooftop spotlight sweeps third-floor hallway |
| `VOX_SWAT_STUNNED` | `SWAT_LEAD` | "Point man downed by domestic hospitality equipment." | SWAT trooper knocked out by trap prop |
| `VOX_SWAT_RETREAT` | `SWAT_LEAD` | "Negative containment. Suspect slipped the roof hatch." | Player escapes down fire escape or roof |

### 4. Motel Siege Trap & Night-Clerk One-Liners (9 Hooks)

| Hook ID | Speaker | Line | Trigger |
| :--- | :--- | :--- | :--- |
| `VOX_SIEGE_START` | `NIGHT_CLERK` | "Check-in closes early when SWAT surrounds reception." | Motel Siege starts; lock-down begins |
| `VOX_SIEGE_TRAP_VEND` | `NIGHT_CLERK` | "Please note vending snacks remain seventy-five cents." | Vending machine topples onto SWAT breacher |
| `VOX_SIEGE_TRAP_TV` | `SWAT_LEAD` | "Contact neutralized via zenith tube television set." | CRT TV thrown or dropped onto pursuer |
| `VOX_SIEGE_TRAP_CART` | `NIGHT_CLERK` | "Housekeeping bills extra for tactical laundry delays." | Rolling linen cart slams corridor squad |
| `VOX_SIEGE_TRAP_AC` | `NIGHT_CLERK` | "Window unit warranty definitely voids after vertical drop." | Exterior AC unit kicked down onto ladder team |
| `VOX_SIEGE_TRAP_FUSE` | `SWAT_LEAD` | "Corridor power lost. Somebody pulled the mains." | Fusebox shorted, stunning nearby SWAT units |
| `VOX_SIEGE_BARRICADE` | `NIGHT_CLERK` | "Kindly stack that dresser near the exit." | Player shoves desk/mattress barricade across doorway |
| `VOX_SIEGE_FLOOR_CLEAR` | `NIGHT_CLERK` | "Floor two vacated. Housekeeping appreciates your urgency." | Wave cleared on upper motel floor |
| `VOX_SIEGE_ROOF_ESCAPE` | `DISPATCH` | "Suspect exited skyward. Roof hatch left open." | Player unlatches roof hatch to clear Siege |
