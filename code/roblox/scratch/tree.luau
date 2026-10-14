local fs = require("@lune/fs")
local roblox = require("@lune/roblox")
local process = require("@lune/process")
local game = roblox.deserializePlace(fs.readFile(process.args[1]))
local function walk(inst, d)
	if d > 0 then print(string.rep("  ", d) .. inst.Name .. " [" .. inst.ClassName .. "]") end
	for _, c in inst:GetChildren() do walk(c, d + 1) end
end
for _, svc in { "ReplicatedStorage", "ServerScriptService", "StarterPlayer", "Workspace" } do
	print(svc); walk(game:GetService(svc), 0)
end
