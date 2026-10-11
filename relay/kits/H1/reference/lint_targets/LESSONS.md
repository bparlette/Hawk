# Bugs from round 1 the lint script must catch
- outline:false parts without shadow:false (Harbor Rats whiskers cast shadows; stray ink line).
- Texture cache keyed on K (Harbor Rats fur cache); must be K.QUAL || K.THREE || K and never cache null.
- README "about 34 hulls" (measured 28-29), "clips slightly" (0.66 m): unmeasured numbers.
- export const META in every file: concatenation collided (Task A/B m13).
- frustumCulled = false on the dragon-boat paddles (Task B m8).
- Unguarded global fallback PROP_TILES (Task B m5); a cache written onto a kit function (m6).
