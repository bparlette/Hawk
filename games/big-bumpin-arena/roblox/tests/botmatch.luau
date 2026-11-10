-- Headless tests for the Luau port. Run: lune run tests/botmatch.luau   (from games/big-bumpin-arena/roblox)
local Sim = require("../BumpinSim")
local Data = Sim.Data
local HZ, CFG = Data.HZ, Data.cfg
local fails = 0
local function check(ok, msg) if not ok then fails += 1; print("  FAIL: " .. msg) end end
local function play(sim, maxTicks) local n = 0; while sim.state ~= "over" and n < maxTicks do sim:tick(); n += 1 end end

print("bot match on every arena: both teams score in regulation")
for _, id in Data.order do
	local sim, reg, ot = Sim.new({ seed = 2, arena = id, hazards = { pads = true, tilt = true } }), { 0, 0 }, false
	local n = 0
	while sim.state ~= "over" and n < HZ * 900 do
		ot = sim.overtime; sim:tick(); n += 1
		for _, e in sim.events do if e.type == "goal" and not ot then reg[e.team + 1] += 1 end end
	end
	print(string.format("  %-7s %d-%d on %s  shots %d/%d  spin-outs %d/%d", id, sim.score[1], sim.score[2], sim.surfaceName, sim.stats.shots[1], sim.stats.shots[2], sim.stats.spinOuts[1], sim.stats.spinOuts[2]))
	check(sim.state == "over", id .. ": match did not end"); check(reg[1] >= 1 and reg[2] >= 1, id .. ": a team failed to score")
	check(math.max(sim.stats.topSpeed[1], sim.stats.topSpeed[2]) <= CFG.car.hardCap + 1e-6, id .. ": a car broke the speed cap")
end

print("deterministic: same seed gives the same match, a different seed does not")
local function run(seed) local s = Sim.new({ seed = seed, arena = "lot", seconds = 40 }); for _ = 1, 40 * HZ do s:tick() end; return s:digest() end
check(run(5) == run(5), "same seed diverged"); check(run(5) ~= run(6), "different seeds matched")

print("sealed: a ball fired in 48 directions at top speed never leaves any arena; cars never enter a net")
for _, id in Data.order do
	local A = Data.arenas[id]
	for k = 0, 47 do
		local s = Sim.new({ seed = 9, arena = id }); local a = k / 48 * math.pi * 2
		for _, c in s.cars do c.x, c.y = -3000 - c.index * 400, -3000 end
		s.ball.x, s.ball.y, s.ball.vx, s.ball.vy = A.cx + 60, A.cy + 150, math.cos(a) * CFG.ball.maxSpeed, math.sin(a) * CFG.ball.maxSpeed
		for _ = 1, 300 do s:_step({}) end
		local b = s.ball
		check(b.x > A.L - A.netDepth - 2 and b.x < A.R + A.netDepth + 2 and b.y > A.bounds.top - 2 and b.y < A.bounds.bottom + 2, string.format("%s: ball escaped at angle %d (%.0f, %.0f)", id, k, b.x, b.y))
	end
	local s = Sim.new({ seed = 1, arena = id }); for _ = 1, CFG.match.kickoffTicks do s:tick({ {}, {}, {}, {} }) end
	local car = s.cars[1]; car.x, car.y, car.a, car.vx = A.L + 130, A.cy, math.pi, -6
	for _ = 1, 90 do s:tick({ { throttle = 1, turbo = true }, {}, {}, {} }) end
	check(car.x > A.L, id .. ": car got into the net")
end

print("rules: goal + own goal attribution, golden goal, shunt, T-bone, heat, one-timer, pit")
do
	local idle = function() return { {}, {}, {}, {} } end
	local s = Sim.new({ seed = 3, arena = "rink", seconds = 2 }); local A = s.arena
	for _ = 1, CFG.match.kickoffTicks do s:tick(idle()) end
	check(s.state == "play", "kickoff did not start play")
	for _ = 1, 2 * HZ + 5 do s:tick(idle()) end
	check(s.overtime, "tie at 0:00 did not go to overtime")
	s.lastTouch = { false, { car = 3, tick = s.ticks } }; s.ball.x, s.ball.y, s.ball.vx, s.ball.vy = A.R + 50, A.cy, 0, 0; s:tick(idle())
	check(s.score[1] == 1 and s.lastGoal.ownGoal and s.lastGoal.name == "BLUE 1", "own goal not credited to BLUE 1")
	for _ = 1, CFG.match.celebrateTicks do s:tick(idle()) end
	check(s.state == "over" and s.winner == 0, "golden goal did not end the match")

	s = Sim.new({ seed = 1, arena = "rink" }); for _ = 1, CFG.match.kickoffTicks do s:tick(idle()) end
	local red, mate, blue = s.cars[1], s.cars[2], s.cars[3]
	mate.x, mate.y, s.cars[4].x, s.cars[4].y = 250, 780, 1030, 780
	red.x, red.y, red.a, red.vx, red.vy = 600, 250, 0, 0, 0; blue.x, blue.y, blue.a, blue.vx, blue.vy = 600, 250 + 62, 0, 0, 0
	local spun = false
	for i = 1, 14 do s:tick({ { shunt = if i == 1 then 1 else 0 }, {}, {}, {} }); for _, e in s.events do if e.type == "spin" and e.car == 3 then spun = true end end end
	check(spun and blue.spinT > 0, "shunt into the flank did not spin the opponent"); check(s.stats.shunts[1] == 1 and s.stats.spinOuts[1] == 1, "shunt / spin-out stats")

	s = Sim.new({ seed = 1, arena = "rink", surface = "ice" }); for _ = 1, CFG.match.kickoffTicks do s:tick(idle()) end
	for _, c in s.cars do c.x, c.y = 250 + c.index * 200, 120 end
	local car = s.cars[1]
	for k = 1, 5 do
		s.ball.x, s.ball.y, s.ball.vx, s.ball.vy = 400, 600, 5, 0; car.x, car.y, car.a, car.vx, car.vy, car.w = 320, 600, 0, 9, 0, 0
		for _ = 1, 12 do s:tick(idle()) end
		check(math.abs(s.ball.heat - 0.2 * k) < 1e-6, string.format("heat after strike %d was %.2f", k, s.ball.heat))
	end
	local pass = s.cars[2]
	s.ball.x, s.ball.y, s.ball.vx, s.ball.vy = 500, 500, 0, 0; pass.x, pass.y, pass.a, pass.vx, pass.vy = 400, 500, 0, 4, 0; car.x, car.y = 250, 120
	for _ = 1, 22 do s:tick(idle()) end -- long enough that the next touch is a separate strike
	local bx = s.ball.x; s.ball.vx, s.ball.vy = 3, 0; pass.x, pass.y = 250, 780; car.x, car.y, car.a, car.vx, car.vy = bx - 80, 500, 0, 8, 0
	local one = false; for _ = 1, 10 do s:tick(idle()); for _, e in s.events do if e.type == "onetimer" then one = true end end end
	check(one and s.ball.laser > 0, "one-timer did not fire")

	s = Sim.new({ seed = 1, arena = "pond" }); for _ = 1, CFG.match.kickoffTicks do s:tick(idle()) end
	local pit = s.arena.pits[1]; car = s.cars[1]; car.x, car.y, car.a, car.vx, car.vy = pit.x - 150, pit.y, 0, 6, 0
	local fell = false; for _ = 1, 40 do s:tick({ { throttle = 1 }, {}, {}, {} }); for _, e in s.events do if e.type == "pit" then fell = true end end end
	check(fell and car.pitT > 0 and math.abs(car.x - car.spawn.x) < 2, "car did not fall in the fishing hole and return to its spot")
end

print(if fails == 0 then "ALL PASS" else string.format("%d FAILED", fails))
if fails > 0 then error("tests failed") end
