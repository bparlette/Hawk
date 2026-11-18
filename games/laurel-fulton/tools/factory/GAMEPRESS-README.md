# city-factory — a whole top-down city game from a few statements

Write a short spec about **your** neighbourhood: the people, where they live, what they drive, the places that
matter. Run one command. You get a playable phone game on the **real roads** of that place:
- **Pick your player**, then **rally the crew**: drive to each house, they come out, dap you up, and follow in their
  own cars.
- **Meet at the place you named.**
- **Speed bumps launch you**, and the convoy airs right behind you.
- **Climb the meet-up's roof** on foot (GET OUT): dumpster → HVAC box → grab the parapet, look out over the parked
  convoy, then run off any edge.

The engine is the Laurel/Fulton build of the Palm City game (Hawk `games/laurel-fulton/`), exported here by
`export_gamepress.py`. Filed by Opus, Nov 17 2026.

## The spec (`examples/savage.spec` is a complete one)

```
city   "Savage" bbox 39.122 -76.846 39.152 -76.806          # S W N E — the area to build
poi    mill "Savage Mill"                                    # a place, by its real OpenStreetMap name
person alex "Alex" street "Baltimore Street" car "1988 Ford Mustang red" traits bass
person rio  "Rio"  street "Foundry Street" car "1986 Pontiac Firebird two-tone black/gold" traits headlights:yellow
person kit  "Kit"  street "Foundry Street" car "1989 Ford Escort green"
house  "The Foundry Street house" rio kit                    # people who share a house: one stop, one label
mission rally meet "Savage Mill"                             # where the convoy ends up
```

**traits:** `bass` (the car shakes and throws sound rings) · `underglow:blue` · `sputter` (a broken exhaust coughing waves)
· `fire` (a burning parked car) · `headlights:yellow|blue|white`.

**Cars:** make, model and colour are matched to the nearest real body in the library, then given the stated paint,
two-tone and lamps:
- Camaro/Firebird; Mustang; Celica/Supra/Prelude
- Cavalier (rounded '95+ or boxy older); Astro/Caravan/any van
- Camry/Accord/sedans; Tracer/Escort/hatchbacks; Brougham/Town Car/land yachts

**Addresses:**
- **Optional `number <n>`** on a person puts their house at the exact OpenStreetMap address point. Numbers are
  **private**: the factory writes them only to `data/addresses.local.json`. Keep that file out of git, and put the
  numbers in a private copy of your spec, not a committed one.
- **Without a number**, the house sits at the middle address of the street.

## Run it

```
cd tools/city-factory
python3 tools/factory/city_factory.py examples/savage.spec ../../games/savage --bpy <python-with-bpy>
```

- **Blender for the cars:** `python3 -m venv bpyenv && bpyenv/bin/pip install bpy`.
- **Without `--bpy`,** everything except the car sprites is built.
- **Output:** `<out>/play.html` + `data/` + `assets/cars/` + `FACTORY.md` (what was built: every person and how they
  were placed).

### Pipeline steps

Each step is a tool in `tools/`, pointed at the city by `$LF_ROOT`:

| # | step | tool |
|---|---|---|
| 1 | parse the spec | the factory |
| 2 | real OSM roads + places, fetched in tiles from the OSM main API | `osm_fetch.py` |
| 3 | geocode the people + the meet-up | `roster_build.py` |
| 4 | drivable road graph: bridges as two levels, every curve and cul-de-sac kept | `osm_graph.py` |
| 5 | building footprints, lots, parks + the "hero" tier (homes, places) | `osm_areas.py` |
| 6 | speed bumps on residential streets only | `bumps_build.py` |
| 6b | the meet-up building made CLIMBABLE: its real OSM outline (multipolygons + courtyards), a dumpster → HVAC → ledge-grab chain, a dressed roof; skipped if OSM has no outline | `roof_build.py` |
| 7 | cars baked top-down in the house style (Blender, Palm City's paint + ink) | `bake_fleet.py` |
| 8 | the page | the factory |

## Prove it

From `tools/city-factory/`:

- **The rally:** `LF_ROOT=<out> node tools/spec_l2.mjs [player]` runs the whole rally headless, using joystick input
  only. Every stop and the convoy are checked: no teleports, the cars stay on the streets, spacing holds, and the run
  finishes.
- **In a browser:** `CHROME=<chromium> node tools/factory/smoke_city.mjs <out-folder-name>` boots the page from the
  folder above it. It picks a player with a real tap, runs the rally to the finish, and writes screenshots to
  `<out>/shots/`.

Both were green on the Savage example when this was filed. In Savage, the convoy was off the road 3.9–4.9% of the
time against a 5% limit; old mill-town alleys are narrow.

## Limits (honest)
- **Extent:** one bounding box. The OSM main API caps each tile at 50,000 nodes, so the factory fetches up to 6×6
  tiles (~16 km). Extending a city is a new bbox and a re-run.
- **Car shapes:** cars are the nearest library body, not a bespoke model. Nothing outside the eight families exists
  yet; a new family is a new entry in `bake_fleet.py`'s `CARS`.
- **Missing places:** a POI or meet-up must be an OSM-named place inside the box. If it isn't found, the build fails
  loudly.
- **Look:** the world look is the Laurel sample's (painted roads, faded footprints, hero homes). Hero art, trees and
  Street View homes are later work in the source project.
