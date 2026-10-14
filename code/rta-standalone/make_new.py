import sys,re
# make_new.py <shell html(01b.html)> <game.js> <varname> <out.html> <music notes> <step>
shell,game,var,out,notes,step=sys.argv[1:7]
s=open(shell).read()
a=s.index("        var barrelClimb = {")
b=s.index("var GAMES = [barrelClimb];")
g=open(game).read()
s=s[:a]+g+"var GAMES = ["+var+"];"+s[b+len("var GAMES = [barrelClimb];"):]
s=s.replace("<title>Barrel Climb</title>","<title>%s</title>"%var)
# strip the old music line then add new
import re
s=re.sub(r'          if \(state === "play" && !paused && !muted && t % \d+ === 0\) \{ var MUS.*\n','',s)
open(out,'w').write(s)
