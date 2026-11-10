# BIG BUMPIN' ARENA! : Roblox port (Luau)

| File | What |
|---|---|
| `BumpinData.luau` | **Generated.** Tuning numbers and all six arenas, exported from the web build's `src/config.js` and `src/arenas.js` by `tools/export-roblox.mjs`. Never edit by hand. |
| `BumpinSim.luau` | The match simulation: handling, turbo and slipstream, shunt, T-bone spin-outs, ball heat, english, one-timers, surfaces, pits, boom arms, speed pads, final-minute tilt, goals, clock, overtime, bots. No Roblox dependencies. |
| `RobloxDriver.luau` | Builds the arena, cars and ball as anchored Parts and steps the sim from Heartbeat. |
| `tests/botmatch.luau` | Headless suite, run with [lune](https://lune-org.github.io/docs). |

```
node games/big-bumpin-arena/tools/export-roblox.mjs      # regenerate BumpinData.luau after changing config or arenas
cd games/big-bumpin-arena/roblox && lune run tests/botmatch.luau
```

`node --test games/big-bumpin-arena/test/` runs both: it fails if the generated data is stale, and runs the
lune suite when lune is installed.

## How it differs from the web build
- **Physics.** The web build steps Matter.js. Roblox has no Matter, so `BumpinSim.luau` carries its own small
  2D physics: each car is two circles (one over each axle), the ball is a circle, walls are the arena outline's
  edges, furniture is circles and boxes. Collisions are impulses with spin. The rules, the tuning numbers and
  the arena data are the same; the collision maths is not, so the two builds are **not tick-identical**.
  Each is deterministic on its own (same seed + inputs = same match).
- **Not ported yet:** the five power-ups (magnet, shockwave, cowcatcher, oil, harpoon) and the pop-up pylons.
  Everything else in the list above is in.
- **Roblox physics is not used.** Every Part is anchored and placed from sim state, so a server can run the
  match authoritatively and every client sees the same thing.

## Putting it in a place
1. Put the three `.luau` files in one folder as ModuleScripts (`BumpinData`, `BumpinSim`, `RobloxDriver`), for
   example under `ServerScriptService/Bumpin`.
2. Server Script:
   ```lua
   local Driver = require(script.Parent.Bumpin.RobloxDriver)
   local match = Driver.new({ arena = "lot", seed = os.time() })
   match:start()
   local input = Instance.new("RemoteEvent"); input.Name = "BumpinInput"; input.Parent = game.ReplicatedStorage
   local seat = {}                                   -- player -> car index (1 = Red 1, 2 = Red 2, 3 = Blue 1, 4 = Blue 2)
   game.Players.PlayerAdded:Connect(function(p) for i = 1, 4 do if not table.find(seat, i) then seat[p] = i; break end end end)
   game.Players.PlayerRemoving:Connect(function(p) if seat[p] then match:setInput(seat[p], nil); seat[p] = nil end end)
   input.OnServerEvent:Connect(function(p, i) if seat[p] and typeof(i) == "table" then
     match:setInput(seat[p], { throttle = math.clamp(tonumber(i.throttle) or 0, -1, 1), steer = math.clamp(tonumber(i.steer) or 0, -1, 1),
       turbo = i.turbo == true, brake = i.brake == true, shunt = math.clamp(tonumber(i.shunt) or 0, -1, 1) }) end end)
   ```
3. LocalScript (StarterPlayerScripts): read keys, send 20 times a second.
   ```lua
   local UIS, input = game:GetService("UserInputService"), game.ReplicatedStorage:WaitForChild("BumpinInput")
   local function down(k) return UIS:IsKeyDown(k) and 1 or 0 end
   while task.wait(0.05) do input:FireServer({
     throttle = down(Enum.KeyCode.W) - down(Enum.KeyCode.S), steer = down(Enum.KeyCode.D) - down(Enum.KeyCode.A),
     turbo = UIS:IsKeyDown(Enum.KeyCode.LeftShift), brake = UIS:IsKeyDown(Enum.KeyCode.Space), shunt = down(Enum.KeyCode.E) - down(Enum.KeyCode.Q) }) end
   ```
   Seats with no player are driven by the built-in bots. The server clamps every input it receives.

Scale: 10 sim pixels to a stud, so Lot 7 is 210 x 130 studs and a kart is 6.8 studs long. Sim `y` maps to `+Z`.

## Status
- `BumpinSim.luau`: tested headlessly. Bots play a full match on all six arenas with both teams scoring;
  determinism, containment (ball cannot leave, cars cannot enter a net) and the rules are checked.
- `RobloxDriver.luau` and the two scripts above: **written but not yet run in Studio.** Expect to adjust
  visuals (it builds plain blocks and cylinders) and to add a camera, UI and sounds from `onEvent`.
