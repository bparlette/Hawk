# Live at Eleven (partial-level prototype)

Live: https://shellshock-live-at-eleven.surge.sh

An original game idea built on the Cel City bake-off engine (copied from ../ss3d-bakeoff/i_cel; that folder is untouched).
**The camera is a character.** A WKRK 8 Action News crew (a camera operator plus reporter Dana Vex) follows the masked hero BLADE
on foot, and the game view is their camera feed. Goal: "Make the 11 o'clock news". Beat the 5-man gang at 5th & Grand and reach
a peak rating of 70 before the broadcast clock runs from 10:57:00 to 11:00:00 PM (sped up: 165 game seconds).

## Systems
- **Broadcast look**: WKRK 8 station bug with the broadcast clock, a LIVE bug with a blinking dot, REC timecode, a lower-third chyron whose
  headlines react to events (news / hype / hostile / alert styles, plus Dana Vex quotes), a scrolling ticker, scanlines, vignette, handheld sway, and static.
- **Crew NPC** (`07_news.js` updateCrew): it walks to a spot behind the hero along a bearing you steer with Q/E, drag or the right stick.
  It is slower than the hero (5.2 vs 6.6 m/s), steers around cars and props, stays on the streets, and rides the zoom to keep the hero framed.
  The render camera sits just in front of the lens on the operator's shoulder, and the controls follow what the camera sees.
- **Crew knockdown**: thugs can break off to attack the crew ("NO CAMERAS!"). One camera-shy thug is guaranteed per broadcast after your first takedown (once the clock passes 25 s);
  after that it only happens if the crew crowds the fight. When the crew is down, the feed falls to the asphalt, tilted and shaking, with static and a
  "WE'RE EXPERIENCING TECHNICAL DIFFICULTIES" card. Walk to the crew and press E (or tap HELP) to help them up ("WE'RE BACK").
- **Ratings** (0-100): only hits and takedowns the camera actually sees count. The hero must be in frame with a clear line of sight (buildings and cars block it).
  The centre box (frame guides) gives ×2 GOOD FRAME. Off-camera hits show "OFF CAMERA" with the reason (out of frame, view blocked, no feed).
  Ratings decay when nothing happens for 3 s, twice as fast with no feed. Viewers climb with ratings and style (combos, air slashes, takedowns).
- **Instant replay**: a takedown on camera that is heavy (spin slash or air slash), part of a 4+ combo, or on the bruiser freezes the live action and plays the last
  ~1.35 s at about half speed from a low orbiting "angle 2", with a REPLAY bug, letterbox and a wipe. The best replay is captured as a thumbnail for the end card.
- **Consequences**: at 65+ ratings the corner bystanders cheer ("WOO!") and toss a pizza slice (+30 HP) every 12 s. At 22 or below the chyron turns hostile
  and bystanders boo. Below 15 for 2 s, one police cruiser comes in (from another street, through the intersection). The officer chases on foot at 5.2 m/s.
  You can't fight cops: outrun the officer (more than 11 m away for 1.5 s), or survive 14 s, and the police give up. Getting caught means 3 s detained and -10 ratings.
- **End**: the "THAT'S OUR STORY" sign-off card shows Dana Vex's sign-off, a headline grade (A+ to F), peak and final ratings, peak viewers, KOs, best combo, replays,
  crew knockdowns, police outcome and the best-replay thumbnail. R or the button replays.

## Controls
Desktop: WASD/arrows move, J attack (3-hit combo, soft lock-on), K/Space jump (J in the air = air slash), Q/E or mouse drag to direct the crew around you,
E (or F) to help the crew up. Gamepad: left stick, right stick to direct the crew, X/B attack, A jump.
Phone: floating stick on the left, SLASH / JUMP buttons, ◀ ▶ (or drag) to direct the crew, HELP button (appears when the crew is down).

## Files
src/0*.js -> ./build.sh -> site/game.js (ES module, three r160). 07_news.js has everything new (crew, camera, ratings, chyron, replay, bystanders, police, end card).
09_main.js has the loop and the test autopilot. Tests: bot.js (`?bot=1&sim=N` autopilot: loiters until the police come, kites the officer, fights the gang,
lets the camera-shy thug drop the crew, swings while the feed is down to show off-camera, then helps the crew up). probe.js prints errors. deploy.sh deploys.
