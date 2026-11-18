# World Extension Facade + Roof Variety Pack (`Queue 4 Task 3`)

> `18` distinct transparent WebP building pieces at Palm City's exact `2 px / wu` scale with `#210f2e` dark-plum ink contours and 255° WSW sunlit bevel cues. Built for Fable task 11 (`shell_layout.json`); zero edits to core `src/` or `assets/`.

## 1. Audit Summary (Before Baking)

- **Existing Core Buildings (`assets/manifest.json` -> `buildings`):** `16` sprites (`apartments`, `club`, `diner`, `garage`, `hospital`, `hotel`, `house1..3`, `motel`, `office`, `police`, `shops`, `villa1..3`), all `2 px / wu`, `ox = -w/2`, `oy = -h/2`, `240..480 px` wide.
- **Extension Reference Geography (`shots/extension-refs/`):** `README.md` + `sat-overview-corridor.jpg`, `sat-causeway-detail.jpg`, `sat-downtown-detail.jpg`, `map-causeway-streets.jpg`, `map-downtown-streets.jpg` (Miami Beach west shore -> MacArthur Causeway -> Watson Island -> downtown waterfront + airport strip). Per README, real Street View was skipped intentionally so the shell matches Palm City's painted aesthetic.

## 2. Manifest Metrics (`2 px / wu`)

| Sprite File | Group | Pixel Size (`w×h`) | World Footprint (`wu`) | Origin (`ox, oy`) | KB | Visual Summary |
|---|---|---:|---:|---:|---:|---|
| `bld_ext_dt_biscayne_tower.webp` | Downtown Mid-Rises | `340×320` | `170×160` | `-170, -160` | 7.6 | Tiered Art-Deco peach/limestone setback mid-rise w/ turquoise atrium skylight & helipad roof |
| `bld_ext_dt_brickell_glass.webp` | Downtown Mid-Rises | `380×300` | `190×150` | `-190, -150` | 10.8 | Twin-wing cerulean curtain-wall tower block w/ champagne mullions & rooftop solar arrays |
| `bld_ext_dt_flagler_deco.webp` | Downtown Mid-Rises | `300×280` | `150×140` | `-150, -140` | 7.5 | Coral & cream MiMo commercial block w/ scalloped roof parapet, striped marquee & water tank |
| `bld_ext_dt_bayfront_hotel.webp` | Downtown Mid-Rises | `420×270` | `210×135` | `-210, -135` | 6.3 | L-shaped bayfront resort mid-rise w/ terracotta barrel-tile terrace & sapphire courtyard deck |
| `bld_ext_dt_metro_bank.webp` | Downtown Mid-Rises | `320×320` | `160×160` | `-160, -160` | 6.3 | Chamfered octal stone plaza block w/ bronze skylight lantern & perimeter fins |
| `bld_ext_dt_marina_condo.webp` | Downtown Mid-Rises | `440×250` | `220×125` | `-220, -125` | 8.7 | Terraced waterfront condo bar w/ curved seafoam balcony ledges & twin penthouses |
| `bld_ext_cw_yacht_club.webp` | Causeway Low Blocks | `360×240` | `180×120` | `-180, -120` | 5.9 | Stucco island yacht clubhouse w/ standing-seam teal hipped roof & harbor timber canopy |
| `bld_ext_cw_ferry_terminal.webp` | Causeway Low Blocks | `460×210` | `230×105` | `-230, -105` | 8.1 | Sawtooth Watson Island ferry concourse w/ vaulted turquoise skylights & boarding awnings |
| `bld_ext_cw_tiki_bar.webp` | Causeway Low Blocks | `260×220` | `130×110` | `-130, -110` | 5.7 | Octagonal palm-thatch tiki pavilion joined to coral-stucco bar annex & wooden deck apron |
| `bld_ext_cw_bait_tackle.webp` | Causeway Low Blocks | `240×190` | `120×95` | `-120, -95` | 3.1 | Weathered mint & driftwood causeway bait shop w/ ribbed metal shed roof & striped awning |
| `bld_ext_cw_seaplane_base.webp` | Causeway Low Blocks | `390×250` | `195×125` | `-195, -125` | 5.6 | Watson Island arched barrel seaplane terminal w/ checkered beacon & bay-door apron |
| `bld_ext_cw_boathouse.webp` | Causeway Low Blocks | `310×220` | `155×110` | `-155, -110` | 4.0 | Twin-bay coral-trim marina dry-stack shed w/ sliding gantry rails & translucent panels |
| `bld_ext_ap_concourse.webp` | Airport Strip | `520×240` | `260×120` | `-260, -120` | 7.4 | Ribbed cream concrete terminal concourse spine w/ 4 cantilevered jetways & blue observation glass |
| `bld_ext_ap_control_tower.webp` | Airport Strip | `240×240` | `120×120` | `-120, -120` | 5.6 | Flared airport tower base w/ octal green-tinted ATC glass cab & catwalk rail |
| `bld_ext_ap_hangar_tropics.webp` | Airport Strip | `440×310` | `220×155` | `-220, -155` | 4.7 | Arched barrel aviation hangar w/ sunburst gold racing stripes & parted steel doors |
| `bld_ext_ap_cargo_depot.webp` | Airport Strip | `480×220` | `240×110` | `-240, -110` | 6.9 | Long flat air-freight strip block w/ 6 loading bays, hazard bumpers & turbine vents |
| `bld_ext_ap_rental_plaza.webp` | Airport Strip | `360×210` | `180×105` | `-180, -105` | 4.3 | Googie boomerang car-rental check-in canopy w/ Miami teal fins & island kiosks |
| `bld_ext_ap_radar_station.webp` | Airport Strip | `220×220` | `110×110` | `-110, -110` | 4.6 | White geodesic dome radar bunker on octal concrete pad w/ aviation red beacon |

## 3. Contact Sheet

- [extension-facades-sheet.png](./extension-facades-sheet.png)
- **Rebuild:** `node tools/build_extension_facades.mjs` (from `games/palm-city/`)
