# buildRowhouse overrides (rowkit_rowhouse.js, `opts`)
- front: 'formstone' | 'brick' | 'permastone'
- variant: 0..3 (formstone tiles fs_0..fs_3; permastone ps_(variant % 3))
- paint: boolean (brick only; painted tiles pt_(variant % 4))
- brick: 0..5 -> br_red, br_tan, br_plum, br_grey, br_green, br_sand
- corniceColor: '#c9b48a' '#4f5a52' '#5a4f5c' '#8a4a3a' '#a4907a' '#9ab0b8' '#c49a9a' (RH_CORNICE)
- doorColor: 0..3 (door_0..door_3) · screens: boolean · floors: 3 | 4
- NEW (integration will add): trim, awning, awningStripe (hex)
# Sign boards (rowkit_tiles.js): board(bg, border, text, ink, fontSize) on a 256x64 tile (4:1); e.g. board('#2f5a3a', '#eae6dc', 'CORNER MARKET', '#ffe08a', 38)
