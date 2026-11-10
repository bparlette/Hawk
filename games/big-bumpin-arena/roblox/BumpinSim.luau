-- BIG BUMPIN' ARENA! : the match simulation in Luau, for Roblox.
--
-- This is a port of the web build's sim (src/world.js, game.js, bots.js) with one deliberate difference: the web
-- build steps Matter.js, which does not exist in Roblox, so this file carries its own small 2D physics (circles
-- against wall segments, posts and furniture; impulse response with spin). Tuning numbers and arena shapes come
-- from BumpinData.luau, which is GENERATED from the JS source, so the two builds share one set of data.
-- It is deterministic (same seed + same inputs = same match) and has no Roblox dependencies, so it also runs
-- headless under lune for tests. Units are the web build's: pixels and 1/60 s ticks. RobloxDriver.luau maps them to studs.
local Data = if script then require(script.Parent.BumpinData) else require("./BumpinData")
local CFG, HZ = Data.cfg, Data.HZ

local sin, cos, sqrt, abs, min, max, atan2, floor = math.sin, math.cos, math.sqrt, math.abs, math.min, math.max, math.atan2, math.floor
local function hypot(x, y) return sqrt(x * x + y * y) end
local function clamp(v, a, b) return if v < a then a elseif v > b then b else v end
local function wrap(a) return atan2(sin(a), cos(a)) end
local function sign(v) return if v > 0 then 1 elseif v < 0 then -1 else 0 end

-- mulberry32, bit-for-bit the same generator as the web build
local band, bxor, bor, rshift, lshift = bit32.band, bit32.bxor, bit32.bor, bit32.rshift, bit32.lshift
local function imul(a, b)
	local ah, al, bh, bl = rshift(a, 16), band(a, 0xFFFF), rshift(b, 16), band(b, 0xFFFF)
	return band(al * bl + lshift(band(ah * bl + al * bh, 0xFFFF), 16), 0xFFFFFFFF)
end
local function rng(seed)
	local a = band(floor(seed), 0xFFFFFFFF)
	return function()
		a = band(a + 0x6D2B79F5, 0xFFFFFFFF)
		local t = imul(bxor(a, rshift(a, 15)), bor(1, a))
		t = bxor(band(t + imul(bxor(t, rshift(t, 7)), bor(61, t)), 0xFFFFFFFF), t)
		return bxor(t, rshift(t, 14)) / 4294967296
	end
end

local Sim = {}
Sim.__index = Sim
Sim.TEAMS = { "RED", "BLUE" }
Sim.Data = Data

-- ------------------------------------------------------------------------------------------------ construction
local function inField(A, x, y)
	local c, p = false, A.field
	local j = #p
	for i = 1, #p do
		local xi, yi, xj, yj = p[i][1], p[i][2], p[j][1], p[j][2]
		if (yi > y) ~= (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi then c = not c end
		j = i
	end
	return c
end
Sim.inField = inField

--- opts: { seed, arena, surface, hazards = { pads, tilt }, seconds, skill = { red, blue }, teams = { {cls, cls}, {cls, cls} } }
function Sim.new(opts)
	opts = opts or {}
	local self = setmetatable({}, Sim)
	self.seed = opts.seed or 1
	self.rand = rng(self.seed)
	local A = Data.arenas[opts.arena or "rink"] or Data.arenas.rink
	self.arena = A
	self.surfaceName = if opts.surface and CFG.surfaces[opts.surface] then opts.surface else A.surface
	self.surface = CFG.surfaces[self.surfaceName]
	self.hazards = { pads = opts.hazards and opts.hazards.pads or false, tilt = opts.hazards and opts.hazards.tilt or false }
	self.skill = opts.skill or { 0.8, 0.8 }
	-- static colliders: one segment per outline edge (normal pointing into the arena), goal posts, furniture
	self.segs, self.posts = {}, {}
	local p, area = A.poly, 0
	for i = 1, #p do local q = p[i % #p + 1]; area += p[i][1] * q[2] - q[1] * p[i][2] end
	local s = if area > 0 then 1 else -1
	for i = 1, #p do
		local a, b = p[i], p[i % #p + 1]
		local dx, dy = b[1] - a[1], b[2] - a[2]
		local len = hypot(dx, dy)
		if len > 0.5 then table.insert(self.segs, { ax = a[1], ay = a[2], bx = b[1], by = b[2], nx = -dy / len * s, ny = dx / len * s, e = CFG.restitution.wall }) end
	end
	for _, g in A.goals do
		table.insert(self.posts, { x = g.x, y = g.y - g.half, r = CFG.rink.postR, e = CFG.restitution.wall })
		table.insert(self.posts, { x = g.x, y = g.y + g.half, r = CFG.rink.postR, e = CFG.restitution.wall })
		-- the lip: cars stop at the goal line, the ball rolls through
		table.insert(self.segs, { ax = g.x, ay = g.y - g.half, bx = g.x, by = g.y + g.half, nx = -g.dir, ny = 0, e = CFG.restitution.wall, carOnly = true })
	end
	for _, o in A.obstacles do
		local bouncy = o.kind == "tires" or o.kind == "carousel" or o.kind == "bollard"
		local e = if bouncy then 0.95 else CFG.restitution.wall
		if o.r then table.insert(self.posts, { x = o.x, y = o.y, r = o.r, e = e })
		else -- a box: four edges, normals pointing out of it
			local c, sn, hw, hh = cos(o.angle or 0), sin(o.angle or 0), o.w / 2, o.h / 2
			local function pt(lx, ly) return o.x + lx * c - ly * sn, o.y + lx * sn + ly * c end
			local cs = { { -hw, -hh }, { hw, -hh }, { hw, hh }, { -hw, hh } }
			for i = 1, 4 do
				local ax, ay = pt(cs[i][1], cs[i][2]); local bx, by = pt(cs[i % 4 + 1][1], cs[i % 4 + 1][2])
				local dx, dy = bx - ax, by - ay; local len = hypot(dx, dy)
				table.insert(self.segs, { ax = ax, ay = ay, bx = bx, by = by, nx = dy / len, ny = -dx / len, e = e, solid = true })
			end
		end
	end
	self.zones = {}
	local m, d = CFG.ball.r * 0.55, A.netDepth + 10
	for _, g in A.goals do
		table.insert(self.zones, { scoringTeam = 1 - g.team, x0 = if g.dir < 0 then g.x - d else g.x + m, x1 = if g.dir < 0 then g.x - m else g.x + d, y0 = g.y - g.half, y1 = g.y + g.half })
	end
	self.ball = { x = A.cx, y = A.cy, vx = 0, vy = 0, r = CFG.ball.r, m = CFG.ball.mass, heat = 0, curve = 0, laser = 0, lastHit = -999, lastStrike = nil, stuck = 0, px = A.cx, py = A.cy }
	self.cars, self.bots = {}, {}
	for team = 0, 1 do
		for slot, sp in A.spawns do
			local cls = if opts.teams then opts.teams[team + 1][slot] else sp.cls
			local C = CFG.classes[cls]
			local x = if team == 0 then sp.x else A.w - sp.x
			local y = if team == 0 then A.cy + sp.y else A.cy - sp.y
			local car = { index = #self.cars + 1, team = team, clsName = cls, cls = C, x = x, y = y, a = if team == 0 then 0 else math.pi, vx = 0, vy = 0, w = 0,
				m = C.mass, I = C.mass * (C.len * C.len + C.wid * C.wid) / 12 * C.inertia, spawn = { x = x, y = y, a = if team == 0 then 0 else math.pi },
				role = if slot == 1 then "chaser" else "sweeper", name = Sim.TEAMS[team + 1] .. " " .. slot,
				turbo = 1, turboOn = false, drafting = false, slip = 0, drift = false, throttle = 0, steer = 0, shuntT = 0, shuntHot = 0, shuntDir = 0, shuntCd = 0,
				spinT = 0, immune = 0, flatT = 0, padT = 0, pitT = 0, pitAt = nil, _shunt = 0, px = x, py = y, pa = 0 }
			table.insert(self.cars, car)
			table.insert(self.bots, { stuck = 0, rev = 0, revSteer = 1, aim = 0, rand = rng(self.seed * 7919 + #self.cars + floor(self.rand() * 1e6)) })
		end
	end
	self.sweepers = {}
	for _, sw in A.sweepers do table.insert(self.sweepers, { x = sw.x, y = sw.y, len = sw.len, speed = sw.speed, r = sw.r, a = 0 }) end
	self.score = { 0, 0 }
	self.ticks, self.clock, self.overtime = 0, (opts.seconds or CFG.match.seconds) * HZ, false
	self.state, self.timer, self.winner = "kickoff", CFG.match.kickoffTicks, nil
	self.lastTouch, self.lastGoal, self.goals = { false, false }, nil, {}
	self.stats = { shots = { 0, 0 }, shunts = { 0, 0 }, spinOuts = { 0, 0 }, topSpeed = { 0, 0 } }
	self.events, self._contacts = {}, {}
	self.live, self.tiltOn = false, false
	self:_faceOff()
	return self
end

function Sim:_faceOff()
	local b, A = self.ball, self.arena
	self.faceOffs = (self.faceOffs or 0) + 1
	local spot = A.kick[self.faceOffs % 2 + 1] -- the ball spot alternates when the arena's centre is occupied
	b.x, b.y, b.vx, b.vy, b.heat, b.curve, b.laser, b.lastStrike, b.stuck = spot[1], spot[2], 0, 0, 0, 0, 0, nil, 0
	for _, c in self.cars do
		c.x, c.y, c.a, c.vx, c.vy, c.w = c.spawn.x, c.spawn.y, c.spawn.a, 0, 0, 0
		c.slip, c.turboOn, c.drift, c.shuntT, c.spinT, c.flatT, c.immune, c.padT, c.pitT = 0, false, false, 0, 0, 0, 0, 0, 0
	end
	self.lastTouch = { false, false }
	for _, mem in self.bots do mem.aim = (mem.rand() - 0.5) * 2; mem.stuck = 0; mem.rev = 0 end
end

function Sim:secondsLeft() return math.ceil(self.clock / HZ) end
local function push(self, e) table.insert(self.events, e) end

-- ------------------------------------------------------------------------------------------------ cars
function Sim:spinOut(car, by, turns)
	if car.spinT > 0 or car.immune > 0 then return false end
	local S = CFG.spin
	car.spinT = floor(S.ticks * (turns or 1) + 0.5); car.immune = car.spinT + S.immune
	car.w = S.rate * (if self.rand() < 0.5 then -1 else 1); car.vx *= S.speedKeep; car.vy *= S.speedKeep
	if by and by.team ~= car.team then self.stats.spinOuts[by.team + 1] += 1 end
	push(self, { type = "spin", car = car.index, by = by and by.index, x = car.x, y = car.y })
	return true
end

-- Handling: the same recipe as the web build. Forward speed is only ever added to and sideways speed only decays,
-- so whatever a ram or a shunt put into the car stays in the car.
function Sim:_drive(car, inp)
	local c, K, T, S = car.cls, CFG.car, CFG.turbo, self.surface
	local fx, fy = cos(car.a), sin(car.a)
	local vf, vl = car.vx * fx + car.vy * fy, -car.vx * fy + car.vy * fx
	for _, k in { "slip", "shuntCd", "immune", "padT", "shuntHot" } do if car[k] > 0 then car[k] -= 1 end end
	if car.shuntT > 0 then car.shuntT -= 1; if car.shuntT == 0 then car.shuntDir = 0 end end
	if car.pitT > 0 then car.pitT -= 1; car.vx, car.vy, car.w = 0, 0, 0; car.turboOn = false; return end
	if not inp then
		car.vx *= 0.86; car.vy *= 0.86; car.w *= 0.8; car.turboOn, car.drift, car.throttle, car.steer, car._shunt = false, false, 0, 0, 0
		return
	end
	if car.spinT > 0 or car.flatT > 0 then
		local spinning = car.spinT > 0
		if car.spinT > 0 then car.spinT -= 1 end
		if car.flatT > 0 then car.flatT -= 1 end
		vl -= vl * K.driftRate * S.grip; vf -= vf * 0.02
		car.vx, car.vy = fx * vf - fy * vl, fy * vf + fx * vl
		car.w *= if spinning then 0.985 else 0.9
		car.turboOn, car.drift, car.throttle, car.steer, car._shunt = false, false, 0, 0, inp.shunt or 0
		return
	end
	local throttle, steer = clamp(inp.throttle or 0, -1, 1), clamp(inp.steer or 0, -1, 1)
	car.throttle, car.steer, car.drift = throttle, steer, inp.brake and true or false
	local sh = inp.shunt or 0
	if sh ~= 0 and car._shunt == 0 and car.shuntCd == 0 and self.live then
		car.shuntT, car.shuntHot, car.shuntDir, car.shuntCd = CFG.shunt.ticks, 12, sh, CFG.shunt.cooldown
		vl += sh * CFG.shunt.speed; self.stats.shunts[car.team + 1] += 1
		push(self, { type = "shunt", car = car.index, dir = sh, x = car.x, y = car.y })
	end
	car._shunt = sh
	if inp.turbo and throttle > 0 and car.turbo > (if car.turboOn then 0 else T.minStart) then
		car.turboOn = true; car.turbo = max(0, car.turbo - 1 / T.drainTicks)
	else
		car.turboOn = false; car.turbo = min(1, car.turbo + (if car.drafting then T.draftBonus else 1) / T.regenTicks)
	end
	local top = c.maxSpeed * S.top * (if car.turboOn then T.speed else 1) * (if car.padT > 0 then CFG.hazards.padPush.top else 1)
	local acc = c.accel * S.accel * (if car.turboOn then T.accel else 1)
	if throttle > 0 then if vf < top then vf = min(top, vf + acc * throttle) end
	elseif throttle < 0 then
		if vf > 0.05 then vf = max(0, vf + c.brake * S.accel * throttle) elseif vf > -c.maxSpeed * K.reverse then vf += acc * 0.8 * throttle end
	else vf -= vf * K.coast * S.coast end
	if vf > top then vf -= (vf - top) * 0.04 end
	if car.drift then vf -= vf * 0.012 end
	local hold = if car.slip > 0 then K.slipFactor + (1 - K.slipFactor) * (1 - car.slip / K.slipTicks) else 1
	if car.shuntT == 0 then vl -= vl * min(0.9, if car.drift then K.driftRate * S.drift else K.gripRate * S.grip) * hold end
	car.vx, car.vy = fx * vf - fy * vl, fy * vf + fx * vl
	local speedF = max(K.pivot, min(1, abs(vf) / (c.maxSpeed * 0.45)))
	local want = steer * c.turn * S.steer * speedF * (if vf < -0.3 then -1 else 1) * (if car.drift then K.driftTurn else 1)
	car.w += (want - car.w) * K.steerResponse * hold
end

function Sim:_drafting()
	local D = CFG.turbo.draft
	for _, c in self.cars do
		c.drafting = false
		for _, m in self.cars do
			if m ~= c and m.team == c.team then
				local ms = hypot(m.vx, m.vy)
				if ms >= D.minSpeed and hypot(c.vx, c.vy) >= D.minSpeed then
					local dx, dy, ux, uy = c.x - m.x, c.y - m.y, m.vx / ms, m.vy / ms
					local behind, side = -(dx * ux + dy * uy), abs(-dx * uy + dy * ux)
					if behind > D.near and behind < D.far and side < D.lateral and abs(wrap(c.a - atan2(uy, ux))) < D.maxAngle then c.drafting = true end
				end
			end
		end
	end
end

-- ------------------------------------------------------------------------------------------------ physics
-- A car collides as two circles, one over each axle; that is close to its rounded bumper and keeps the maths tiny.
local function carCircles(car)
	local d, r = car.cls.len / 2 - car.cls.wid / 2, car.cls.wid / 2
	local fx, fy = cos(car.a), sin(car.a)
	return car.x + fx * d, car.y + fy * d, car.x - fx * d, car.y - fy * d, r
end
-- Circle against a segment. Returns nx, ny (push direction), depth, or nil. Walls are one-sided (nx,ny = their inward normal).
local function segHit(px, py, r, s)
	local dx, dy = s.bx - s.ax, s.by - s.ay
	local t = clamp(((px - s.ax) * dx + (py - s.ay) * dy) / (dx * dx + dy * dy), 0, 1)
	local qx, qy = s.ax + dx * t, s.ay + dy * t
	local ox, oy = px - qx, py - qy
	local side = (px - s.ax) * s.nx + (py - s.ay) * s.ny
	if not s.solid and not s.carOnly and side < 0 and t > 0 and t < 1 then return s.nx, s.ny, r - side end -- got behind a wall: straight back in
	local d = hypot(ox, oy)
	if d >= r then return nil end
	if s.solid and side < 0 then return nil end -- inside a box edge's back side: another edge handles it
	if d < 1e-6 then return s.nx, s.ny, r end
	return ox / d, oy / d, r - d
end
-- Impulse on a car at a contact point against something immovable.
local function carStatic(car, cx, cy, nx, ny, depth, e)
	car.x += nx * depth; car.y += ny * depth
	local rx, ry = cx - car.x, cy - car.y
	local vn = (car.vx - car.w * ry) * nx + (car.vy + car.w * rx) * ny
	if vn >= 0 then return 0 end
	local rn = rx * ny - ry * nx
	local j = -(1 + e) * vn / (1 / car.m + rn * rn / car.I)
	car.vx += j * nx / car.m; car.vy += j * ny / car.m; car.w += j * rn / car.I
	return -vn
end

function Sim:_collide()
	local ball, RE = self.ball, CFG.restitution
	local seen = {}
	for pass = 1, 2 do
		-- cars against the arena
		for _, c in self.cars do
			if c.pitT == 0 then
				for k = 1, 2 do
					local fx1, fy1, bx1, by1, r = carCircles(c)
					local px, py = if k == 1 then fx1 else bx1, if k == 1 then fy1 else by1
					for _, s in self.segs do
						local nx, ny, depth = segHit(px, py, r, s)
						if nx then
							local f = carStatic(c, px - nx * r, py - ny * r, nx, ny, depth, max(s.e, RE.car))
							if pass == 1 and f > 1.2 and not s.carOnly then table.insert(self._contacts, { kind = "car-wall", car = c, force = f, x = px - nx * r, y = py - ny * r }) end
							px += nx * depth; py += ny * depth
						end
					end
					for _, o in self.posts do
						local dx, dy = px - o.x, py - o.y; local d = hypot(dx, dy)
						if d < r + o.r and d > 1e-6 then
							local nx, ny = dx / d, dy / d
							local f = carStatic(c, px - nx * r, py - ny * r, nx, ny, r + o.r - d, max(o.e, RE.car))
							if pass == 1 and f > 1.2 then table.insert(self._contacts, { kind = "car-wall", car = c, force = f, x = o.x + nx * o.r, y = o.y + ny * o.r }) end
							px += nx * (r + o.r - d); py += ny * (r + o.r - d)
						end
					end
				end
			end
		end
		-- car against car
		for i = 1, #self.cars do for j = i + 1, #self.cars do
			local A, B = self.cars[i], self.cars[j]
			if A.pitT == 0 and B.pitT == 0 and hypot(A.x - B.x, A.y - B.y) < (A.cls.len + B.cls.len) / 2 + 4 then
				local a1x, a1y, a2x, a2y, ar = carCircles(A); local b1x, b1y, b2x, b2y, br = carCircles(B)
				for _, pr in { { a1x, a1y, b1x, b1y }, { a1x, a1y, b2x, b2y }, { a2x, a2y, b1x, b1y }, { a2x, a2y, b2x, b2y } } do
					local dx, dy = pr[3] - pr[1], pr[4] - pr[2]; local d = hypot(dx, dy)
					if d < ar + br and d > 1e-6 then
						local nx, ny, depth = dx / d, dy / d, ar + br - d
						local cx, cy = pr[1] + nx * ar, pr[2] + ny * ar
						local key = i * 10 + j
						if not seen[key] then seen[key] = { kind = "car-car", a = A, b = B, vax = A.vx, vay = A.vy, vbx = B.vx, vby = B.vy, force = 0, x = cx, y = cy }; table.insert(self._contacts, seen[key]) end
						local wa, wb = B.m / (A.m + B.m), A.m / (A.m + B.m)
						A.x -= nx * depth * wa; A.y -= ny * depth * wa; B.x += nx * depth * wb; B.y += ny * depth * wb
						local rax, ray, rbx, rby = cx - A.x, cy - A.y, cx - B.x, cy - B.y
						local vn = ((B.vx - B.w * rby) - (A.vx - A.w * ray)) * nx + ((B.vy + B.w * rbx) - (A.vy + A.w * rax)) * ny
						if vn < 0 then
							local ran, rbn = rax * ny - ray * nx, rbx * ny - rby * nx
							local jj = -(1 + RE.car) * vn / (1 / A.m + 1 / B.m + ran * ran / A.I + rbn * rbn / B.I)
							A.vx -= jj * nx / A.m; A.vy -= jj * ny / A.m; A.w -= jj * ran / A.I
							B.vx += jj * nx / B.m; B.vy += jj * ny / B.m; B.w += jj * rbn / B.I
							seen[key].force = max(seen[key].force, -vn)
						end
					end
				end
			end
		end end
		-- ball against cars
		for _, c in self.cars do
			if c.pitT == 0 then
				local f1x, f1y, b1x, b1y, r = carCircles(c)
				for _, pr in { { f1x, f1y }, { b1x, b1y } } do
					local dx, dy = ball.x - pr[1], ball.y - pr[2]; local d = hypot(dx, dy)
					if d < r + ball.r and d > 1e-6 then
						local nx, ny, depth = dx / d, dy / d, r + ball.r - d
						local key = 100 + c.index
						if not seen[key] then seen[key] = { kind = "ball-car", car = c, cvx = c.vx, cvy = c.vy, cw = c.w, bvx = ball.vx, bvy = ball.vy, force = 0, x = pr[1] + nx * r, y = pr[2] + ny * r }; table.insert(self._contacts, seen[key]) end
						local wb = c.m / (c.m + ball.m)
						ball.x += nx * depth * wb; ball.y += ny * depth * wb; c.x -= nx * depth * (1 - wb); c.y -= ny * depth * (1 - wb)
						local cx, cy = pr[1] + nx * r, pr[2] + ny * r
						local rx, ry = cx - c.x, cy - c.y
						local vn = (ball.vx - (c.vx - c.w * ry)) * nx + (ball.vy - (c.vy + c.w * rx)) * ny
						if vn < 0 then
							local rn = rx * ny - ry * nx
							local jj = -(1 + RE.ball) * vn / (1 / c.m + 1 / ball.m + rn * rn / c.I)
							c.vx -= jj * nx / c.m; c.vy -= jj * ny / c.m; c.w -= jj * rn / c.I
							ball.vx += jj * nx / ball.m; ball.vy += jj * ny / ball.m
							seen[key].force = max(seen[key].force, -vn)
						end
					end
				end
			end
		end
		-- ball against the arena
		for _, s in self.segs do
			if not s.carOnly then
				local nx, ny, depth = segHit(ball.x, ball.y, ball.r, s)
				if nx then
					ball.x += nx * depth; ball.y += ny * depth
					local vn = ball.vx * nx + ball.vy * ny
					if vn < 0 then
						local e = max(s.e, RE.ball); ball.vx -= (1 + e) * vn * nx; ball.vy -= (1 + e) * vn * ny
						if pass == 1 then table.insert(self._contacts, { kind = "ball-wall", force = -vn, x = ball.x - nx * ball.r, y = ball.y - ny * ball.r }) end
					end
				end
			end
		end
		for _, o in self.posts do
			local dx, dy = ball.x - o.x, ball.y - o.y; local d = hypot(dx, dy)
			if d < ball.r + o.r and d > 1e-6 then
				local nx, ny = dx / d, dy / d
				ball.x += nx * (ball.r + o.r - d); ball.y += ny * (ball.r + o.r - d)
				local vn = ball.vx * nx + ball.vy * ny
				if vn < 0 then local e = max(o.e, RE.ball); ball.vx -= (1 + e) * vn * nx; ball.vy -= (1 + e) * vn * ny; if pass == 1 then table.insert(self._contacts, { kind = "ball-wall", force = -vn, x = o.x + nx * o.r, y = o.y + ny * o.r }) end end
			end
		end
	end
end

-- T-bone: hit an opponent's flank or rear quarter at speed (a shunt, or a full-charge ram with your nose) and they spin out.
function Sim:_tbone(att, vic, vax, vay, vvx, vvy, force)
	local S = CFG.spin
	if att.team == vic.team then return end
	local dx, dy = att.x - vic.x, att.y - vic.y
	if abs(wrap(atan2(dy, dx) - vic.a)) < S.flank then return end
	local nose = abs(wrap(atan2(-dy, -dx) - att.a)) < 0.75
	local charge = nose and force >= S.chargeForce and hypot(vax, vay) > hypot(vvx, vvy)
	if att.shuntHot > 0 or charge then self:spinOut(vic, att) end
end

function Sim:_ballContact(c)
	local car, ball, H, C, O = c.car, self.ball, CFG.heat, CFG.curve, CFG.oneTimer
	local nx, ny = ball.x - car.x, ball.y - car.y
	local d = hypot(nx, ny); if d < 1e-6 then return end
	nx /= d; ny /= d
	local carIn, ballIn, preSpeed = c.cvx * nx + c.cvy * ny, -(c.bvx * nx + c.bvy * ny), hypot(c.bvx, c.bvy)
	if not (carIn > 0.8 and carIn >= ballIn - 0.5) then
		local front = abs(wrap(atan2(ny, nx) - car.a)) < 1.05
		if ball.heat >= 0.999 and ballIn >= H.blockForce and front and car.flatT == 0 then -- a front-on block of a full-heat ball: flattened
			local s = if preSpeed > 0 then preSpeed else 1
			car.flatT = H.flatTicks; car.slip = CFG.car.slipTicks; car.vx, car.vy = c.bvx / s * H.knock, c.bvy / s * H.knock
			ball.vx, ball.vy, ball.heat = c.bvx * 0.55, c.bvy * 0.55, 0.4
			push(self, { type = "flatten", car = car.index, x = car.x, y = car.y })
		end
		return
	end
	local punch = c.force * car.cls.punch
	ball.vx += nx * punch; ball.vy += ny * punch
	if self.ticks - ball.lastHit >= H.hitGap then
		if preSpeed > H.stopSpeed then ball.heat = min(1, ball.heat + H.step); ball.vx *= 1 + H.boost; ball.vy *= 1 + H.boost else ball.heat = 0 end
		local swipe = (c.cvx - c.bvx) * -ny + (c.cvy - c.bvy) * nx + c.cw * d * 0.6
		ball.curve = if abs(swipe) > C.minSwipe then clamp(swipe * C.gain, -C.max, C.max) else 0
		local L = ball.lastStrike
		if L and L.team == car.team and L.car ~= car.index and self.ticks - L.tick <= O.window then
			ball.vx *= O.boost; ball.vy *= O.boost; ball.curve = 0; ball.laser = O.laserTicks
			push(self, { type = "onetimer", car = car.index, from = L.car, x = ball.x, y = ball.y })
		end
		ball.lastStrike = { car = car.index, team = car.team, tick = self.ticks }; ball.lastHit = self.ticks
		local G = self.arena.goals[2 - car.team] -- the goal this team attacks
		if ball.vx * G.dir > 3 and hypot(ball.vx, ball.vy) > 5 then
			local yAt = ball.y + ball.vy * ((G.x - ball.x) / ball.vx)
			if abs(yAt - G.y) < G.half + 30 then self.stats.shots[car.team + 1] += 1 end
		end
		push(self, { type = "strike", car = car.index, heat = ball.heat, curve = ball.curve })
	end
end

function Sim:_resolve()
	local K = CFG.car
	for _, c in self._contacts do
		if c.force > 0 then
			local cars = if c.car then { c.car.index } elseif c.a then { c.a.index, c.b.index } else {}
			push(self, { type = "hit", kind = c.kind, x = c.x, y = c.y, force = c.force, cars = cars })
		end
		if c.kind == "ball-wall" then self.ball.curve *= CFG.curve.wallKeep
		elseif c.kind == "car-wall" then if c.force > K.slipImpact then c.car.slip = K.slipTicks end
		elseif c.kind == "car-car" then
			if c.force > K.slipImpact then c.a.slip = K.slipTicks; c.b.slip = K.slipTicks end
			self:_tbone(c.a, c.b, c.vax, c.vay, c.vbx, c.vby, c.force); self:_tbone(c.b, c.a, c.vbx, c.vby, c.vax, c.vay, c.force)
		elseif c.kind == "ball-car" then
			if self.live then self.lastTouch[c.car.team + 1] = { car = c.car.index, tick = self.ticks } end
			self:_ballContact(c)
		end
	end
end

function Sim:_landscape()
	local A, ball = self.arena, self.ball
	for _, s in self.sweepers do -- a boom arm turning about its pivot bats away whatever it meets
		s.a += s.speed
		local ux, uy = cos(s.a), sin(s.a)
		local function hit(b, rad, car)
			local px, py = b.x - s.x, b.y - s.y
			local u = clamp(px * ux + py * uy, -s.len, s.len)
			local nx, ny = px - ux * u, py - uy * u
			local d, mn = hypot(nx, ny), s.r + rad
			if d >= mn or d < 1e-6 then return end
			nx /= d; ny /= d
			local rel = (b.vx + uy * s.speed * u) * nx + (b.vy - ux * s.speed * u) * ny
			b.x, b.y = s.x + ux * u + nx * mn, s.y + uy * u + ny * mn
			if rel < 0 then
				b.vx -= 1.8 * rel * nx; b.vy -= 1.8 * rel * ny
				if car and -rel > CFG.car.slipImpact then car.slip = CFG.car.slipTicks end
				if -rel > 1.2 then push(self, { type = "hit", kind = if car then "car-wall" else "ball-wall", x = s.x + ux * u, y = s.y + uy * u, force = -rel, cars = if car then { car.index } else {} }) end
			end
		end
		for _, c in self.cars do if c.pitT == 0 then hit(c, c.cls.wid / 2 + 6, c) end end
		hit(ball, ball.r, nil)
	end
	if self.live then
		for _, p in A.pits do -- a car that drives into a hole is fished out onto its own face-off spot
			for _, c in self.cars do
				if c.pitT == 0 and hypot(c.x - p.x, c.y - p.y) <= p.r - 8 then
					c.pitT, c.pitAt, c.spinT, c.flatT, c.immune = 80, { x = p.x, y = p.y, tick = self.ticks }, 0, 0, 140
					c.x, c.y, c.a, c.vx, c.vy, c.w = c.spawn.x, c.spawn.y, c.spawn.a, 0, 0, 0
					push(self, { type = "pit", car = c.index, x = p.x, y = p.y })
				end
			end
		end
	end
	if self.hazards.pads then
		for _, z in A.pads do
			local function inside(b) return b.x > z.x0 and b.x < z.x1 and b.y > z.y0 and b.y < z.y1 end
			for _, c in self.cars do if inside(c) then c.padT = 30; c.vx += z.dir * CFG.hazards.padPush.car end end
			if inside(ball) then ball.vx += z.dir * CFG.hazards.padPush.ball end
		end
	end
	if self.hazards.tilt and self.tiltOn then
		ball.vx += sign(ball.x - A.cx) * CFG.hazards.tilt.ball
		for _, c in self.cars do c.vx += sign(c.x - A.cx) * CFG.hazards.tilt.car end
	end
end

function Sim:_step(inputs)
	local ball, A = self.ball, self.arena
	table.clear(self._contacts)
	ball.px, ball.py = ball.x, ball.y
	for _, c in self.cars do c.px, c.py, c.pa = c.x, c.y, c.a end
	self:_drafting()
	for i, c in self.cars do self:_drive(c, inputs[i]) end
	-- ball: english, heat, rolling resistance
	if ball.laser > 0 then ball.laser -= 1 end
	local sp = hypot(ball.vx, ball.vy)
	if ball.curve ~= 0 and sp > 1 and ball.laser == 0 then local cc, ss = cos(ball.curve), sin(ball.curve); ball.vx, ball.vy = ball.vx * cc - ball.vy * ss, ball.vx * ss + ball.vy * cc end
	ball.curve *= CFG.curve.decay; if abs(ball.curve) < 0.0005 then ball.curve = 0 end
	if sp < CFG.heat.stopSpeed then ball.heat = max(0, ball.heat - 0.03) elseif self.ticks - ball.lastHit > CFG.heat.freeTicks then ball.heat = max(0, ball.heat - CFG.heat.decay) end
	local air = 1 - CFG.ball.frictionAir * self.surface.ballAir * (if ball.laser > 0 then 0.25 else 1)
	ball.vx *= air; ball.vy *= air
	-- integrate, then sort out who hit what
	ball.x += ball.vx; ball.y += ball.vy
	for _, c in self.cars do if c.pitT == 0 then c.x += c.vx; c.y += c.vy; c.a += c.w end end
	self:_collide()
	self:_resolve()
	self:_landscape()
	sp = hypot(ball.vx, ball.vy)
	local cap = CFG.ball.maxSpeed * (1 + CFG.heat.capBonus * ball.heat) * (if ball.laser > 0 then CFG.oneTimer.boost else 1)
	if sp > cap then ball.vx, ball.vy = ball.vx / sp * cap, ball.vy / sp * cap end
	local off = hypot(ball.x - A.cx, ball.y - A.cy)
	if sp < 0.25 and off > 170 then ball.stuck += 1 else ball.stuck = 0 end
	if ball.stuck > CFG.ball.stuckTicks then ball.vx, ball.vy, ball.stuck = (A.cx - ball.x) / off * 3, (A.cy - ball.y) / off * 3, 0 end
	for _, c in self.cars do
		local s = hypot(c.vx, c.vy)
		if s > CFG.car.hardCap then c.vx, c.vy = c.vx / s * CFG.car.hardCap, c.vy / s * CFG.car.hardCap; s = CFG.car.hardCap end
		if self.live and s > self.stats.topSpeed[c.team + 1] then self.stats.topSpeed[c.team + 1] = s end
	end
end

-- ------------------------------------------------------------------------------------------------ bots
function Sim:_bot(car, mem)
	local A, R, ball = self.arena, self.arena.bounds, self.ball
	local dir = if car.team == 0 then 1 else -1
	local mate; for _, c in self.cars do if c.team == car.team and c ~= car then mate = c end end
	local og, mine = A.goals[2 - car.team], A.goals[car.team + 1]
	local oppX, oppY = og.x, og.y + mem.aim * og.half * 0.55
	local d0 = hypot(ball.x - car.x, ball.y - car.y)
	local lead = clamp(d0 / (car.cls.maxSpeed * 1.4), 0, 26)
	local bx, by = clamp(ball.x + ball.vx * lead, R.left + 20, R.right - 20), clamp(ball.y + ball.vy * lead, R.top + 20, R.bottom - 20)
	local dMe = hypot(bx - car.x, by - car.y)
	local dMate = if mate then hypot(bx - mate.x, by - mate.y) else 1e9
	local role = car.role
	if role == "sweeper" and (hypot(bx - mine.x, by - mine.y) < 330 or ((bx - A.cx) * dir < -60 and dMe < dMate * 0.85)) then role = "chaser" end
	local tx, ty, turbo, arrive = 0, 0, false, false
	if role == "chaser" then
		local gx, gy = oppX - bx, oppY - by; local gl = hypot(gx, gy); if gl < 1e-6 then gl = 1 end; gx /= gl; gy /= gl
		local rx, ry = car.x - bx, car.y - by
		local along, lat, reach = rx * gx + ry * gy, -rx * gy + ry * gx, CFG.ball.r + car.cls.len / 2
		if along < -8 and abs(lat) < 26 + -along * 0.55 then tx, ty, turbo = bx + gx * 60, by + gy * 60, dMe > 70
		elseif along >= -8 then local side = if lat >= 0 then 1 else -1; tx, ty, turbo = bx - gx * (reach + 50) - gy * side * (reach + 40), by - gy * (reach + 50) + gx * side * (reach + 40), dMe > 260
		else tx, ty, turbo = bx - gx * (reach + 14), by - gy * (reach + 14), dMe > 240 end
	else
		tx, ty = mine.x + (bx - mine.x) * 0.36, mine.y + (by - mine.y) * 0.36
		tx = if dir > 0 then max(tx, mine.x + 120) else min(tx, mine.x - 120); arrive = true
	end
	tx, ty = clamp(tx, R.left + 34, R.right - 34), clamp(ty, R.top + 34, R.bottom - 34)
	for _ = 1, 8 do if inField(A, tx, ty) then break end; tx += (A.cx - tx) * 0.2; ty += (A.cy - ty) * 0.2 end
	local speed, dist, skill = hypot(car.vx, car.vy), hypot(tx - car.x, ty - car.y), self.skill[car.team + 1]
	if mem.rev > 0 then mem.rev -= 1; return { throttle = -1, steer = mem.revSteer } end
	if arrive and dist < 40 then mem.stuck = 0; return { throttle = 0, steer = clamp(wrap(atan2(by - car.y, bx - car.x) - car.a) * 2, -1, 1) } end
	local diff = wrap(atan2(ty - car.y, tx - car.x) - car.a); local ad = abs(diff)
	local throttle = if ad < 1.25 then 1 elseif ad > 2.35 and dist < 170 then -1 else 0.5
	local steer = clamp(diff * 3, -1, 1)
	local fx, fy, look = cos(car.a), sin(car.a), 150 + speed * 9
	for _, o in A.blockers do -- steer round the furniture
		local ox, oy = o.x - car.x, o.y - car.y
		local f, r, need = ox * fx + oy * fy, -ox * fy + oy * fx, o.r + car.cls.wid / 2 + (if o.pit then 30 else 16)
		if f >= 0 and f <= look + o.r and abs(r) <= need and hypot(tx - o.x, ty - o.y) >= o.r + 20 and not (o.soft and abs(r) > need * 0.5) then
			steer = clamp(steer - (if r >= 0 then 1 else -1) * (if o.pit then 1.6 else 1.1), -1, 1)
			if o.pit and f < o.r + 90 then throttle = min(throttle, 0.4) end
			break
		end
	end
	if throttle < 0 then steer = -steer end
	if speed < 0.35 then mem.stuck += 1; if mem.stuck > 45 then mem.stuck = 0; mem.rev = 26; mem.revSteer = if mem.rand() < 0.5 then -1 else 1 end else mem.stuck = 0 end
	local out = { throttle = if throttle > 0 then throttle * (0.72 + 0.28 * skill) else throttle, steer = steer, turbo = turbo and ad < 0.5 and skill > 0.35, brake = ad > 1.0 and speed > 3.6, shunt = 0 }
	if mem.rand() <= 0.03 + 0.09 * skill and car.shuntCd == 0 then -- T-bone the car alongside
		for _, f in self.cars do
			if f.team ~= car.team and f.spinT == 0 and f.immune == 0 then
				local ox, oy = f.x - car.x, f.y - car.y
				local lf, lr = ox * fx + oy * fy, -ox * fy + oy * fx
				if abs(lf) < car.cls.len * 0.55 and abs(lr) < car.cls.wid / 2 + f.cls.wid / 2 + 34 then out.shunt = if lr >= 0 then 1 else -1; break end
			end
		end
	end
	return out
end

-- ------------------------------------------------------------------------------------------------ match
--- Advance one tick. humans = { [carIndex] = { throttle, steer, turbo, brake, shunt } }; every other car is a bot.
function Sim:tick(humans)
	humans = humans or {}
	table.clear(self.events); self.ticks += 1
	local live = self.state == "play"
	self.live = live; self.tiltOn = self.overtime or self.clock <= CFG.hazards.tilt.lastTicks
	local inputs = {}
	for i, c in self.cars do inputs[i] = if live then (humans[i] or self:_bot(c, self.bots[i])) else false end
	for i = 1, #inputs do if inputs[i] == false then inputs[i] = nil end end
	self:_step(inputs)
	if self.state == "play" then
		local b = self.ball
		for _, z in self.zones do
			if b.x > z.x0 and b.x < z.x1 and b.y > z.y0 and b.y < z.y1 then self:_goal(z.scoringTeam); return end
		end
		if not self.overtime then
			self.clock -= 1
			if self.clock <= 0 then
				self.clock = 0
				if self.score[1] == self.score[2] then self.overtime = true; push(self, { type = "overtime" }) else self:_finish() end
			end
		end
	elseif self.state == "kickoff" or self.state == "faceoff" then
		if self.timer % HZ == 0 and self.timer > 0 then push(self, { type = "count", n = self.timer / HZ }) end
		self.timer -= 1
		if self.timer <= 0 then self.state = "play"; push(self, { type = "go" }) end
	elseif self.state == "goal" then
		self.timer -= 1
		if self.timer <= 0 then
			if self.overtime then self:_finish(); return end
			self:_faceOff(); self.state = "faceoff"; self.timer = CFG.match.faceoffTicks; push(self, { type = "kickoff" })
		end
	end
end

-- The scoring team's last toucher gets the goal, unless that touch is more than 5 s old (or never happened):
-- then it is an own goal by the other team's last toucher.
function Sim:_goal(team)
	local mine, theirs = self.lastTouch[team + 1], self.lastTouch[2 - team]
	local fresh = mine and self.ticks - mine.tick <= CFG.match.ownGoalTicks
	local ownGoal = (not fresh) and theirs and true or false
	local scorer = if fresh then mine.car elseif theirs then theirs.car elseif mine then mine.car else nil
	self.score[team + 1] += 1
	self.lastGoal = { team = team, scorer = scorer, ownGoal = ownGoal, tick = self.ticks, name = if scorer then self.cars[scorer].name else Sim.TEAMS[team + 1] }
	table.insert(self.goals, self.lastGoal)
	self.state, self.timer = "goal", CFG.match.celebrateTicks
	push(self, { type = "goal", team = team, scorer = scorer, ownGoal = ownGoal, name = self.lastGoal.name })
end
function Sim:_finish()
	self.state = "over"
	self.winner = if self.score[1] == self.score[2] then nil elseif self.score[1] > self.score[2] then 0 else 1
	push(self, { type = "over", winner = self.winner })
end

--- Compact state for determinism checks.
function Sim:digest()
	local t = { self.ticks, self.score[1], self.score[2], self.state, string.format("%.3f,%.3f,%.3f", self.ball.x, self.ball.y, self.ball.heat) }
	for _, c in self.cars do table.insert(t, string.format("%.3f,%.3f,%.3f", c.x, c.y, c.a)) end
	return table.concat(t, "|")
end

return Sim
