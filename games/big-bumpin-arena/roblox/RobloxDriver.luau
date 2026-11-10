-- RobloxDriver: puts a BumpinSim match into a Roblox place. It builds the arena, cars and ball as Parts, steps the
-- sim at a fixed 60 Hz from Heartbeat, and moves the Parts to match. The sim stays the single source of truth:
-- Roblox physics is not used (every Part is Anchored), so play is deterministic and identical for everyone.
--
-- NOT YET RUN IN STUDIO. The sim it drives is tested headlessly (tests/botmatch.luau); this file is the thin
-- Roblox-facing layer and still needs a first run in a place. Sim units are pixels: PX_PER_STUD of them to a stud.
--
-- Server use (authoritative):   local match = Driver.new({ arena = "lot" }); match:start()
--                               match:setInput(carIndex, { throttle = 1, steer = 0, turbo = false, brake = false, shunt = 0 })
-- Wire setInput to a RemoteEvent fired by each player's LocalScript (see README.md for a 20-line example).
local RunService = game:GetService("RunService")
local Sim = require(script.Parent.BumpinSim)

local PX_PER_STUD = 10
local TEAM = { Color3.fromRGB(255, 59, 78), Color3.fromRGB(30, 123, 255) }
local Driver = {}
Driver.__index = Driver

local function part(parent, size, cf, color, shape, material)
	local p = Instance.new("Part")
	p.Anchored, p.CanCollide, p.TopSurface, p.BottomSurface = true, false, Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	p.Size, p.CFrame, p.Color = size, cf, color
	p.Material = material or Enum.Material.SmoothPlastic
	if shape then p.Shape = shape end
	p.Parent = parent
	return p
end
-- sim (x, y) -> world position. Sim y runs down the screen, which becomes +Z.
local function pos(x, y, h) return Vector3.new(x / PX_PER_STUD, h or 0, y / PX_PER_STUD) end

--- opts: everything Sim.new takes (seed, arena, surface, hazards, seconds, skill, teams) plus parent (default workspace) and origin (CFrame).
function Driver.new(opts)
	opts = opts or {}
	local self = setmetatable({}, Driver)
	self.sim = Sim.new(opts)
	self.inputs, self.acc, self.conn = {}, 0, nil
	self.onEvent = opts.onEvent -- optional function(event) for sounds, effects and UI
	local A, cfg = self.sim.arena, Sim.Data.cfg
	local root = Instance.new("Model"); root.Name = "BumpinArena_" .. A.id; self.root = root
	local floorColor = ({ asphalt = Color3.fromRGB(180, 194, 230), ice = Color3.fromRGB(185, 236, 242), dirt = Color3.fromRGB(224, 176, 116) })[self.sim.surfaceName]
	part(root, Vector3.new((A.w + 200) / PX_PER_STUD, 1, (A.h + 200) / PX_PER_STUD), CFrame.new(pos(A.cx, A.cy, -0.5)), floorColor, nil, if self.sim.surfaceName == "ice" then Enum.Material.Ice else Enum.Material.Concrete).Name = "Floor"
	-- walls: one slab per outline edge, standing outside the line
	local wallH, t = 5, cfg.rink.wall / PX_PER_STUD
	for _, s in self.sim.segs do
		if not s.carOnly and not s.solid then
			local len = math.sqrt((s.bx - s.ax) ^ 2 + (s.by - s.ay) ^ 2) / PX_PER_STUD
			local mid = pos((s.ax + s.bx) / 2 - s.nx * cfg.rink.wall / 2, (s.ay + s.by) / 2 - s.ny * cfg.rink.wall / 2, wallH / 2)
			part(root, Vector3.new(len + t, wallH, t), CFrame.new(mid) * CFrame.Angles(0, -math.atan2(s.by - s.ay, s.bx - s.ax), 0), Color3.fromRGB(70, 100, 238)).Name = "Wall"
		end
	end
	for _, g in A.goals do
		local net = part(root, Vector3.new(A.netDepth / PX_PER_STUD, 0.2, g.half * 2 / PX_PER_STUD), CFrame.new(pos(g.x + g.dir * A.netDepth / 2, g.y, 0.1)), TEAM[g.team + 1])
		net.Name, net.Transparency = "Net", 0.3
	end
	for _, o in A.obstacles do
		if o.r then
			local p = part(root, Vector3.new(6, o.r * 2 / PX_PER_STUD, o.r * 2 / PX_PER_STUD), CFrame.new(pos(o.x, o.y, 3)) * CFrame.Angles(0, 0, math.pi / 2), Color3.fromRGB(138, 90, 52), Enum.PartType.Cylinder)
			p.Name = o.kind
		else
			part(root, Vector3.new(o.w / PX_PER_STUD, 4, o.h / PX_PER_STUD), CFrame.new(pos(o.x, o.y, 2)) * CFrame.Angles(0, -(o.angle or 0), 0), Color3.fromRGB(150, 160, 175)).Name = o.kind
		end
	end
	for _, p in A.pits do
		local hole = part(root, Vector3.new(0.3, p.r * 2 / PX_PER_STUD, p.r * 2 / PX_PER_STUD), CFrame.new(pos(p.x, p.y, 0.05)) * CFrame.Angles(0, 0, math.pi / 2), Color3.fromRGB(8, 30, 60), Enum.PartType.Cylinder)
		hole.Name = "Pit"
	end
	self.booms = {}
	for i, s in self.sim.sweepers do
		self.booms[i] = part(root, Vector3.new(s.len * 2 / PX_PER_STUD, 1.5, s.r * 2 / PX_PER_STUD), CFrame.new(pos(s.x, s.y, 1.5)), Color3.fromRGB(240, 240, 240)); self.booms[i].Name = "Boom"
	end
	self.carParts = {}
	for i, c in self.sim.cars do
		local body = part(root, Vector3.new(c.cls.len / PX_PER_STUD, 2.2, c.cls.wid / PX_PER_STUD), CFrame.new(pos(c.x, c.y, 1.3)), TEAM[c.team + 1]); body.Name = c.name
		local skirt = part(body, Vector3.new(c.cls.len / PX_PER_STUD + 0.5, 0.9, c.cls.wid / PX_PER_STUD + 0.5), body.CFrame * CFrame.new(0, -0.7, 0), Color3.fromRGB(43, 46, 59)); skirt.Name = "Skirt"
		self.carParts[i] = { body = body, skirt = skirt }
	end
	local r = cfg.ball.r / PX_PER_STUD
	self.ballPart = part(root, Vector3.new(r * 2, r * 2, r * 2), CFrame.new(pos(A.cx, A.cy, r)), Color3.fromRGB(255, 210, 31), Enum.PartType.Ball); self.ballPart.Name = "Ball"
	root.Parent = opts.parent or workspace
	if opts.origin then root:PivotTo(opts.origin) end
	return self
end

--- Latest input for a human-driven car (1..4). Cars with no input are bots. Pass nil to hand the car back to a bot.
function Driver:setInput(carIndex, input) self.inputs[carIndex] = input end

--- Advance by real time dt: runs 0..4 fixed sim ticks, then moves the Parts.
function Driver:step(dt)
	local sim = self.sim
	self.acc = math.min(self.acc + math.min(dt, 0.1), 4 / Sim.Data.HZ)
	while self.acc >= 1 / Sim.Data.HZ do
		sim:tick(self.inputs); self.acc -= 1 / Sim.Data.HZ
		if self.onEvent then for _, e in sim.events do self.onEvent(e) end end
	end
	for i, c in sim.cars do
		local cf = CFrame.new(pos(c.x, c.y, 1.3)) * CFrame.Angles(0, -c.a, 0)
		if c.spinT > 0 or c.flatT > 0 then cf *= CFrame.new(0, if c.flatT > 0 then -0.7 else 0, 0) end
		self.carParts[i].body.CFrame = cf; self.carParts[i].skirt.CFrame = cf * CFrame.new(0, -0.7, 0)
		self.carParts[i].body.Transparency = if c.pitT > 0 and math.floor(sim.ticks / 6) % 2 == 0 then 0.7 else 0
	end
	local b, r = sim.ball, Sim.Data.cfg.ball.r / PX_PER_STUD
	self.ballPart.CFrame = CFrame.new(pos(b.x, b.y, r))
	self.ballPart.Color = Color3.fromRGB(255, 210, 31):Lerp(Color3.fromRGB(255, 122, 26), b.heat)
	self.ballPart.Material = if b.heat >= 1 then Enum.Material.Neon else Enum.Material.SmoothPlastic
	for i, s in sim.sweepers do self.booms[i].CFrame = CFrame.new(pos(s.x, s.y, 1.5)) * CFrame.Angles(0, -s.a, 0) end
end

function Driver:start() if not self.conn then self.conn = RunService.Heartbeat:Connect(function(dt) self:step(dt) end) end end
function Driver:stop() if self.conn then self.conn:Disconnect(); self.conn = nil end end
function Driver:destroy() self:stop(); self.root:Destroy() end

return Driver
