import json,os
N={
"oriole-park-camden-yards":("Oriole Park at Camden Yards (+ B&O Warehouse)","""- Footprint: open, asymmetric ballpark bowl; seating horseshoe wraps home plate (SW corner) with the outfield open to the NE toward downtown skyline. The B&O Warehouse is a very long, thin bar (about 1,000 ft / 300 m, only ~51 ft deep) running along right field behind Eutaw Street.
- Height: stands about 4-5 stories; light towers taller (green steel lattice tops). Warehouse is 8 stories.
- Materials/colours: red-orange brick with arched window bays and green-painted steel trusses, railings and seats (dark green). Warehouse: dark red-brown brick, rows of small rectangular windows, flat roof.
- Signature: Eutaw Street - a brick-paved pedestrian street between warehouse and right-field stands (the "brick hallway"); old-style brick arch gates; scoreboard over center field; clock. Real logos must be replaced with blank/original signs.
- Water: not on the water. Sits ~2 blocks west of the Inner Harbor near the stadium; downtown skyline faces outfield.
- Night: stadium light towers bright white; warehouse windows lit warm.""","warehouse_*, eutaw_*, brick_* = Eutaw St / B&O Warehouse; front_* / night_* = ballpark; aerial_1 = context."),
"mt-bank-stadium":("M&T Bank Stadium","""- Footprint: oval/rounded-rectangle bowl, closed all round, oriented roughly N-S; huge surface parking lots around it; just south of Camden Yards across a lot (the two stadiums are neighbours).
- Height: ~10-12 stories to top of the upper deck, with cantilevered steel canopy/roof trusses over the upper seats.
- Materials/colours: brick base and towers at the corners (red-brown), large glass curtain-wall entries, grey/white steel frame; seating purple (team colour - keep generic in game).
- Signature: name board on the top truss above the main north entrance (replace with blank/original sign), big ramp towers at corners, light rigs on top of the canopy.
- Water: not on the water; south of Camden Yards near I-395/I-95 ramps (aerial_1 shows the highway tangle).
- Night: canopy lit purple / red / blue washes; glowing upper rim.""","aerial_1 overhead; aerial_2 north facade at dusk; exterior_1 / night_1 night crowd shots."),
"maryland-science-center":("Maryland Science Center (+ IMAX)","""- Footprint: chunky, irregular cluster on the SW corner of the harbor basin (Key Hwy / Light St). Original 1976 block is a heavy brutalist brick box; the newer east wing is glass and curved metal.
- Height: 3-5 stories; a round planetarium/observatory drum on the roof (exterior_1 shows a cylinder).
- Materials/colours: dark red/brown brick, big blue-glass curtain walls, silver ribbed metal-clad curved wing; red-brick plaza with wide steps down to the promenade.
- Signature: tall spiky stainless-steel kinetic sculpture (crossing rods) at the glass entrance; yellow box canopy marking the IMAX entrance (msc_web_1 / msc_web_3); round observatory dome.
- Water: north face looks straight across the basin to downtown (the WTC and Harborplace); entrance plaza and steps meet the brick promenade.
- Night: glass wing glows from inside.""","exterior_1 aerial from the harbor; msc_web_1/3 = IMAX/entrance; msc_web_2 = aerial over basin."),
"federal-hill":("Federal Hill Park","""- Footprint: a steep, high grassy bluff (~80 ft above the water) on the south side of the basin, flat-topped park with paths, a few trees and a playground; steep slope faces north to the harbor, with a stair up the slope.
- Height: hill ~8 stories tall relative to promenade; rowhouses ring the top on the south/east.
- Materials/colours: green lawn, brick paths, black Civil War cannon on concrete plinths pointing at downtown, a flagpole and a stone monument/obelisk.
- Signature: cannons + panoramic skyline view (perfect "climb for the view" spot); marina/Rash Field below at the foot (park_3).
- Water: north face overlooks the Inner Harbor; Science Center is just west/below.
- Night: view_1 shows the night skyline from the top.""","park_1 cannon & skyline; park_3 aerial of hill + Rash Field + marina."),
"domino-sugar":("Domino Sugar refinery + rooftop sign","""- Footprint: dense block of connected refinery buildings on the Locust Point waterfront (south shore, east of Federal Hill), with a pier and a big conveyor/crane gantry on the water side.
- Height: main brick blocks ~8-10 stories; tall white smokestacks/chimneys rise above; white cylindrical concrete silos next to it.
- Materials/colours: dark brown/red brick, rows of small windows, white silos, steel gantry; steam often rising.
- Sign: huge rooftop sign on a steel lattice frame, two lines of script - 'Domino' over 'Sugars' - in a swashy italic script with a box border. Day: letters look gold/orange-yellow on open frame. Night: glowing red (bright red-orange neon/LED) outline box and letters; reflects as a red streak across the water. In-game use an original name in the same script style.
- Water: faces north/north-west across the harbor toward Harbor East / Fells Point and the Pendry pool.""","sign_night_web_1/2 & sign_2 = night sign closeups; sign_1 / refinery_2 = day; night_1/2 = distance context."),
"under-armour":("Under Armour (Tide Point HQ / Locust Point)","""- Footprint: Tide Point is a campus of 3-4 long old industrial brick buildings on a squared-off pier at the water's edge in Locust Point, just east of Domino; landscaped promenade around the pier edge (tidepoint_web_1 aerial).
- Height: 3-5 stories each; flat roofs, rooftop sign on top.
- Materials/colours: red-brown brick, big multi-pane industrial windows, white trim, rooftop sign in big block capitals on a white frame (use an original brand in game); red accent panels (harboreast_1/2 show a modern grey + red-band building).
- Signature: rooftop block-letter sign, waterfront promenade, bold red-and-black accent colour.
- Water: the pier faces north into the harbor's NW Branch channel, looking at Fells Point / Canton.
- NOTE: no usable photos of the Harbor East brand store were found (search failed twice); the HQ has also moved to Port Covington. Model the generic Tide Point campus.""","tidepoint_web_1 aerial; tidepoint_web_2 rooftop sign; harboreast_1/2 grey+red modern block near Domino."),
"fort-mchenry":("Fort McHenry","""- Footprint: five-pointed star fort (pentagon with bastion points), low grassy earthwork ramparts topped with brick walls, inside a ring ditch; open lawns all around on the tip of the Locust Point peninsula.
- Height: walls ~1-2 stories; inside a parade ground with a ring of 1-2 storey red-brick barracks with white-railed porches and pale roofs.
- Materials/colours: green grass slopes, red brick, white trim, gravel paths, a very tall flagpole with an oversized US flag in the middle; cannons on the ramparts; a sally-port arched gate (fort_2).
- Water: surrounded by water on three sides (Patapsco River); looks back NW toward the Inner Harbor.
- Night: mostly dark; flag floodlit.""","aerial_web_1/2 = star plan (aerial_web_2 has stock watermark, reference only); fort_1 parade ground; fort_2 sally port."),
"national-aquarium":("National Aquarium","""- Footprint: two buildings on Pier 3 and Pier 4 at the north side of the harbor, linked by a covered footbridge over the water (the red-trussed bridge). Main building: chunky concrete block with steep glass triangular rooftop pyramids.
- Height: ~6-7 stories + glass pyramid peak.
- Materials/colours: raw grey concrete, navy blue and red banded panels, steep sawtooth glass pyramid roofs (green-glowing at night), a colourful mosaic patch of squares on the facade (exterior_3); red-frame glass pavilion at the water.
- Signature: triangular glass pyramid roof; blue wave graphics; drum-shaped blue-and-red marine mammal pavilion (exterior_1).
- Water: on piers, water on three sides; faces south to Science Center and Federal Hill.
- Night: pyramids lit green/purple from inside, blue wave light line (night_1 aerial).""","night_1 is an excellent night aerial of the whole Pier 3/4 area."),
"power-plant":("Power Plant (Hard Rock / bookstore building)","""- Footprint: large rectangular old power station on Pier 4, just east of the aquarium, with a smaller arched-window wing on its east end.
- Height: ~5-6 stories brick hall + four tall black cylindrical smokestacks in a row on top (stack tops ~12+ stories).
- Materials/colours: red-orange brick, arched windows with green frames, cream stone trim/cornices, green awnings.
- Signature: the four black smokestacks; a giant electric guitar sign stuck on the roof in front of the stacks (replace with an original giant guitar-shaped sign); big rooftop lettering signs on the facade.
- Water: on a pier, water on south and west; boardwalk around the water edge; the lightship and dragon boats dock beside it (exterior_3).
- Night: guitar and signs glow red/neon; Power Plant Live area (night_1) is a block north with blue neon.""","exterior_2 front from water; exterior_3 with lightship + dragon boats; exterior_1 from above (shows 4 stacks)."),
"four-seasons-harbor-east":("Four Seasons Baltimore (Harbor East)","""- Footprint: tall rectangular glass tower on a podium at the waterfront of Harbor East, between the Legg Mason/Transamerica tower and the condo towers.
- Height: ~22-24 stories (hotel + residences), slim stepped tower.
- Materials/colours: blue-grey/green glass curtain wall, pale tan/limestone podium (fs_web_3 shows stone base with hotel name carved), with a rooftop terrace setback.
- Signature: stepped glass massing; tan stone podium; Harbor East circle with a gold statue (exterior_1).
- Water: south face looks onto the marina/harbor between Inner Harbor and Fells Point.""","fs_web_2 waterfront skyline (Four Seasons is the glass tower); exterior_3 tower close-up; fs_web_3 entrance podium; exterior_2 neighbour towers at night. THIN on clean facade-only views."),
"fells-point":("Fells Point (Broadway Square, Thames St)","""- Footprint: grid of 18th-19th c. rowhouse streets on the waterfront. Broadway runs N-S into a wide brick square (Broadway Square) ending at the water; Thames St runs E-W along the waterfront.
- Height: 2-4 storey rowhouses, a few 5-6 storey warehouses.
- Materials/colours: red/orange brick, some painted (yellow, cream, green), white trim, green awnings, black iron lampposts with lantern heads, grey granite Belgian-block cobblestones on Thames St, brick pavements.
- Signature: cobblestone Thames St; Broadway median square with trees and lamp posts; old 'Recreation Pier' (Pendry) on Thames St; big rooftop 'Terminal' style signs on brick warehouses (thames_2).
- Water: south side of Thames St opens onto the harbor/piers.
- Night: warm yellow lanterns on cobbles (thames_2).""","Broadway Square only 1 good shot."),
"sagamore-pendry":("Sagamore Pendry (Recreation Pier)","""- Footprint: long rectangular pier building projecting into the water at the foot of Broadway in Fells Point; the street-side head house is the grand facade, the pier shed runs behind it out over the water; inner courtyard (pendry_2); pool deck at the far water end.
- Height: 3-4 stories at the head house; pier sheds 2 stories.
- Materials/colours: red brick with white/cream stone columns, pilasters and balustrades; carved crest in pediment; huge round arch carriage entrance in the base; banners between columns.
- Signature: Beaux-Arts head house with big archway, pool deck with turquoise rectangular pool, navy loungers and a small bar box, looking directly across water to the Domino sign (pool_web_1/2). No rooftop pool exists - the pool is on the pier end at water level.
- Water: pier surrounded by water on 3 sides; street facade faces north onto Thames St.""","Rooftop-specific search failed twice; the pool is on the pier deck instead."),
"harborplace":("Harborplace pavilions","""- Footprint: two long low pavilions forming an L at the NW corner of the basin: Light Street Pavilion (west side, runs N-S) and Pratt Street Pavilion (north side, runs E-W), with an amphitheatre between at the corner.
- Height: 2 stories, with green/dark pitched roofs and glazed upper clerestory.
- Materials/colours: dark green-painted steel framing, lots of glass, light-grey/green hip roofs with small cupolas, red-brick promenade; striped awnings in older shots.
- Signature: glassy market-shed look, colourful shop signs; brick promenade with the USS Constellation moored at the corner.
- Water: south/east sides face the water; street sides face Pratt St and Light St.
- NOTE: currently mostly vacant and slated for redevelopment (pratt_web_4 is a 2026 photo).""","THIN: Wikimedia had few clean shots; 2 web photos fill in."),
"uss-constellation":("USS Constellation","""- Footprint: 3-masted sloop-of-war, ~180 ft long, moored on a pier at the Inner Harbor's NW corner next to Harborplace and the WTC.
- Height: masts ~ 10-12 stories tall with yards (cross spars) and rigging.
- Colours: black hull with a white band of gunports (painted black squares), green-copper bottom, dark wood/black rigging, gold figurehead/stern details; flags flying.
- Water: hull parallel to the pier; WTC rises right behind it (ship_1 / con_2).""",""),
"world-trade-center":("World Trade Center Baltimore","""- Footprint: regular pentagon (five-sided), set on a pier edge at the NW corner of the basin next to the Constellation; sits on a raised plinth over the water.
- Height: 28 stories, ~405 ft; tallest pentagonal building in the world.
- Materials/colours: alternating vertical bands of tan/brown precast concrete and dark tinted window strips running the full height (strong vertical stripes); top floor observation level ('Top of the World') slightly recessed.
- Water: two-three of the pentagon's faces overlook the water.
- Night: window bands lit; top often lit.""",""),
"washington-monument":("Washington Monument (Mount Vernon Place)","""- Footprint: square stone base (with fence) at the centre of a cross-shaped arrangement of four park squares (Mount Vernon Place); historic townhouses and a dark Gothic church spire (Methodist church) around it.
- Height: 178 ft column (~16-18 stories) + statue of Washington on top.
- Materials/colours: white/cream marble, plain Doric column, rectangular plinth with inscriptions; black iron fence; bronze equestrian statue nearby; fountain in the south park (monument_1).
- Water: inland, several blocks north of the harbor (up Charles St).
- Night: column floodlit white (mtvernon_2).""","mvp_2 is a vintage postcard showing the square layout."),
"inner-harbor-overview":("Inner Harbor overview","""- Basin roughly rectangular, open to the east. West side: Harborplace Light St pavilion + Science Center (SW). North: Pratt St pavilion, WTC, Constellation, aquarium piers, Power Plant. South: Federal Hill + marina/Rash Field. East: Harbor East towers, then Fells Point.
- Brick promenade runs right round the water edge.
- aerial_1 = best whole-basin shot (from SE); aerial_2 = marina from above; over_1 = WTC/Constellation corner from the water; over_2 = aquarium footbridge; panorama_1 = night skyline from Federal Hill.""",""),
"dragon-paddle-boats":("Dragon paddle boats","""- Small 2-4 seat pedal boats with a tall swan-like dragon head and neck at the front; hull ~2.5 m long.
- Colours: glossy green, blue, teal and purple hulls/necks with red/pink spiky fins along the neck and back, yellow/gold eyes and trim.
- Moored in tight rows at a dock beside the Power Plant / aquarium on the north side of the basin.""",""),
}
for slug,(title,body,photonote) in N.items():
    src=json.load(open(f"{slug}/sources.json"))
    imgs=sorted(f for f in os.listdir(slug) if f.endswith(".jpg") and f!="contact_sheet.jpg")
    lines=[f"# {title} - modelling notes","","Internal modelling reference only; never ship these photos in the game. Heights/sizes are approximate.","",body,""]
    if photonote: lines+=[f"Photos: {photonote}",""]
    lines+=["## Sources",""]
    for f in imgs:
        s=src.get(f,{}); lines.append(f"- {f}: {s.get('page','(unknown)')}")
    open(f"{slug}/NOTES.md","w").write("\n".join(lines)+"\n")
print("ok")
