## Design notes

### Admiral Redclaw (`admiral_redclaw`, Fort McHenry)
A cooked-orange crab admiral of 1812, broad as a cannon carriage. Silhouette: an oversized black bicorne worn athwart (it is the shape
that reads from the far flagship deck), a wide flat carapace with two side spikes that becomes his shoulders, a crimson tailcoat with
split tails, white breeches and black riding boots, and two very different arms: a giant pincer on the left and a brass rocket-cannon
for a right forearm. Palette: shell orange (steamed red when angry), crimson coat, white facings and cross-belts, gold epaulettes and
cockade, black hat and boots. Attacks: **rocket barrage** (plants, swings the cannon to a firing line, three recoil kicks: a ranged
volley), **claw sweep** (coils the pincer over the shoulder, then a flat 170° sweep that snaps shut), **broadside slam** (hops with the
cannon raised and drives it muzzle-first into the deck: a ground ring). No flag, regiment, insignia or real person.

### Big Jimmy (`big_jimmy`, National Aquarium tank)
A giant Maryland blue crab, a male "jimmy", 3.6 m across the spines. Silhouette: a wide, flat, dusky blue-olive carapace with the long
lateral spines and a row of front teeth, stalk eyes, two big azure claws held up in front of his face with cream fingertips (a male's
claws are blue, no red tips), eight legs (three walking pairs and the flat swimmer paddles at the back) and a white belly with the
male's narrow T-shaped apron. He hovers a hand's width off the tank floor (underwater). Steamed red when angry. Attacks: **pincer
crush** (both claws swing wide open, then clamp together at full reach), **sideways rush** (swings half side-on and charges crabwise,
the leading claw sweeping across), **belly slam** (rears up on the back legs showing the soft belly, claws high, then drops his whole
body flat: a bubble ring). Knock-down: the crab flip, rolled over the tail onto his back with the legs folded up and pedalling.

### Voltage Vic (`voltage_vic`, Power Plant)
An electric-eel DJ. Silhouette: a long olive-green eel head on a long neck, pale yellow underjaw and a wide grin, a fin crest and a
dorsal fin, magenta headphones and a cyan LED visor; a purple track suit with electric-yellow stripes, an original lightning-bolt
pendant on a gold chain, white high-tops with neon soles. Sparks crackle round both hands: glow parts (`K.basicMat`, transparent) whose
opacity follows `K.NIGHT.value` and flares on every attack's active beats. Attacks sit on whole beats at 130 BPM: **bass drop**
(2 beats: fists high on beat 1, both slam down on beat 2: a shock ring), **zap scratch** (2 beats: the left hand scratches while the right
cocks back, then fires straight at the target on beat 2: a lightning bolt), **club spin** (3 beats: a crouch on beat 1, a full
electrified spin over beats 2–3, the hips carry the turn so no tilt wrap is involved). Rhythm-mode hook: `buildVoltageVic({ THREE,
stage: true })` adds a DJ booth (58 parts with it) and `J.pose(name, u)` snaps idle / atk1–3 at any tempo.

### Arabber Al (`arabber_al`, Fells Point)
A street-produce arabber and his souped-up horse-cart, in one module (`J.vehicle` under `J.root`, merged with him). Al: flat cap,
dark shades, a handlebar mustache, rolled shirt sleeves and a green apron, seated on the bench. The wagon: red side boards, three
crates heaped with strawberries, oranges and melons, red-rimmed wheels with gold discs and chrome hubs, chrome side pipes. The pony: a
stocky dappled original pony with a dark mane and a red plume. Attacks: **melon lob** (half-stands, cocks a melon behind his head and
lobs it overhand: ranged), **rein-snap ram** (stands in the footboard and cracks the reins two-handed while the pony rears; the cart
rams forward: `move: 8`), **strawberry shower** (twists back to the crates and flings a 180° arc of fruit). `run` is the cart driving
(pony gallop and wheel spin in `animateBoss`); `down` knocks him flat on his back into his own produce. `META.radius` (2.0 m) covers the
whole rig, pony to tailboard. Car-chase hook: `buildArabberAl()` (THREE from `window.K` / `window.THREE`) or `buildArabberAl(deps)`
returns `{ root, update(dt, { t, state, throwK }), J }`; `throwK` drives the lob.

### Chef Crabcake (`chef_crabcake`, Four Seasons kitchen)
A classic Maryland blue crab in chef's whites (HOMAGE: blue crab, steamed red when angry, a mallet and an original seasoning tin).
Silhouette: the wide bright-blue carapace is his face, with the lateral spines and stalk eyes, under a tall toque; a round
double-breasted chef coat with two button rows, a red neckerchief and a cream apron; blue crab forearms and claws gripping a wooden
crab mallet each; and one little walking leg out of his left side holding his seasoning tin. The tin is original: forest green with a
cream band and red/green lettering "CHEF'S CRAB DUST", drawn on a 256×128 canvas (the one mapped material, cached per kit, never on a
failed draw). Nothing in it echoes a real seasoning brand's colours or layout. Angry: blue goes through a cooking brown to steamed red.
Attacks: **seasoning blind** (twists the tin leg back, then lunges and fans a blinding cloud with the left mallet), **mallet drumroll**
(both mallets high, then alternating overhead smashes, right then left), **sidestep sweep** (a crabwise sidestep, then a flat
190° backhand sweep).

### The Pool Shark (`pool_shark`, Pendry pier pool deck)
A big grey-blue shark hustler. Silhouette: a heavy shark head with a long snout, white underjaw and a toothy grin, black shades and a
straw porkpie with a navy band; an open teal cabana shirt with a palm-and-hibiscus print (drawn on a 128² canvas: the one mapped
material) over a white belly, a gold chain, coral swim trunks, flip-flops; a dorsal fin up the back and a tail fin flat at the small
of it; a long pool cue (thin, no shadow). Attacks: **break shot** (bends over a bridge hand with the cue level, draws back and jabs:
`move: 1.5`), **cue sweep** (cocks the cue over the shoulder like a bat, then a flat 180° swing), **belly flop** (crouch, a leap with the
arms spread, and a face-down flop with the head turned: the splash ring). In the knock-down and the flop the cue lies back along the
arm, which keeps him inside the 2.6 culling sphere.
