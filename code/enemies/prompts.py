import json
T=("Photoreal live-action video game character sprite sheet on a solid pure chroma green #00FF00 background. The SAME character shown 8 times, full body, "
"in two rows of four with wide green gaps between every figure so no figures touch or overlap and nothing is cut off at the image edges. Character: {desc} "
"Photographic lighting and detail matching the reference images. Every figure faces RIGHT, side/three-quarter view like a classic arcade beat-'em-up. "
"Top row left to right: 1 idle fighting stance, 2 walking stride left leg forward, 3 walking stride right leg forward, 4 {attack}. "
"Bottom row left to right: 5 {jump}, 6 hurt recoiling backwards with head snapped back, 7 knocked out lying flat on his back on the ground (horizontal, head to the right), 8 {special}. "
"Even studio lighting, sharp focus, no cast shadows, no text, no labels, no numbers, no ground line, no watermark.")
C={}
def add(k,desc,attack,special,jump="jump kick in mid air, both feet off the ground"):
    C[k]=T.format(desc=desc,attack=attack,special=special,jump=jump)
L="low sliding tackle dash forward to the right, body low to the ground"
add('street_weapon',"1980s New York street punk gang member, bleached spiky hair, black leather jacket with safety pins, red bandana, ripped jeans, high-top sneakers, holding a wooden baseball bat.","swinging the baseball bat forward in a big horizontal swing","overhand throwing a glass bottle forward, bottle leaving his hand")
add('street_big',"huge muscular 1980s street gang bruiser, shaved head, goatee, sleeveless black leather vest, tattoos, heavy jeans, steel-toe boots, a revolver holstered on his hip.","throwing a massive haymaker punch forward","aiming a revolver forward at arm's length, firing with a muzzle flash")
add('sewer_light',"wiry sewer-dwelling mutant man with grey-green mottled skin, rat-like ears and a long thin tail, ragged stained overalls, bare clawed feet, hunched feral posture.","lunging claw swipe forward",L)
add('sewer_weapon',"sewer mutant with warty grey-green skin and a bald head, wearing a torn rubber wader suit and hard hat, holding a rusty iron pipe.","swinging the rusty pipe forward overhead","overhand throwing a dripping ball of green sludge forward")
add('sewer_big',"hulking sewer mutant brute covered in dripping green slime, bulging muscles, torn sewer-worker coveralls, carrying a rusty sludge sprayer tank on his back with a nozzle hose.","throwing a massive slimy haymaker punch forward","aiming the sludge sprayer nozzle forward spraying a jet of green sludge","jumping heavily in mid air, both feet off the ground")
add('biker_light',"1980s highway biker gang punk, black open-face motorcycle helmet, mirrored aviator sunglasses, studded black leather jacket, fingerless gloves, leather pants, biker boots.","throwing a fast punch forward",L)
add('biker_weapon',"1980s highway biker gang member, long hair, red bandana, denim cut-off vest with patches over a leather jacket, swinging a heavy steel motorcycle chain.","whipping the steel chain forward","overhand throwing a big wrench forward")
add('biker_big',"enormous bearded 1980s biker, bald head, round sunglasses, black leather vest with skull patch, huge tattooed arms, a sawed-off shotgun.","throwing a massive haymaker punch forward","firing the sawed-off shotgun forward from the hip with a muzzle flash","jumping heavily in mid air, both feet off the ground")
add('dock_light',"New York dockworker thug, navy knit beanie, stubble, grimy navy peacoat, cargo work trousers, heavy work boots, fists wrapped in tape.","throwing a hard punch forward",L)
add('dock_weapon',"dockworker thug in a yellow rain slicker and rubber boots, flat cap, holding a steel cargo hook.","slashing the cargo hook forward","overhand throwing a steel cargo hook forward")
add('dock_big',"massive dock longshoreman brute in grimy denim overalls over a striped shirt, thick forearms, wool cap, holding a heavy industrial nail gun.","throwing a massive haymaker punch forward","aiming the nail gun forward and firing","jumping heavily in mid air, both feet off the ground")
