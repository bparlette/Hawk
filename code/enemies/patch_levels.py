# python3 patch_levels.py <levels_dir> <N> [<N>...] : add enemySkins to levelN.js (idempotent); L15 converts the elite hack
import json, sys, re
M=json.load(open('/workspace/work/enemies/out/meta.json'))
FAM={2:'street',3:'sewer',4:'biker',5:'dock',6:'snow',7:'scrap',8:'guard',9:'edo',10:'pirate',11:'swamp',12:'trooper',13:'trooper',14:'trooper'}
T='{ purple: "light", blue: "light", dasher: "light", sword: "weapon", star: "weapon", heavy: "big", gunner: "big" }'
def line(fam):
    R='{ '+', '.join('%s: %s'%(r,json.dumps(M[fam][r],separators=(',',':'))) for r in ('light','weapon','big'))+' }'
    return ('    // painted regular enemies (%s family): each type names its own sheet + frames [x,y,w,h,anchorX]; hues stay as the loading fallback\n'
            '    enemySkins: (() => { const IMG = "levels/enemies_%s.png", ENEMY_F = %s, T = %s, o = {}; for (const t in T) o[t] = { img: IMG, frames: ENEMY_F[T[t]] }; return o; })(),\n')%(fam,fam,R,T)
def patch(d,n):
    p='%s/level%d.js'%(d,n); s=open(p).read()
    s=re.sub(r'    // painted regular enemies[^\n]*\n    enemySkins: [^\n]*\n','',s)   # re-run safe
    if n==3 and 'api.hasSkin' not in s:
        old='        if (e.type !== "dasher" || e.state === "fly") continue;\n'
        assert s.count(old)==1
        s=s.replace(old,'        if (e.type !== "dasher" || e.state === "fly" || (api.hasSkin && api.hasSkin(e))) continue; // the painted sewer rat-man has his own tail\n')
    if n==15: s=l15(s); new='    enemySkins: { purple: ELITE_SKIN, blue: ELITE_SKIN, sword: ELITE_SKIN, star: ELITE_SKIN, dasher: ELITE_SKIN, heavy: FOOT_HEAVY, gunner: FOOT_HEAVY }, // Foot Elite + Foot heavy sheets\n'
    else: new=line(FAM[n])
    m=re.search(r'\n(    hues: \{)',s); assert m,p
    s=s[:m.start()+1]+new+s[m.start()+1:]
    open(p,'w').write(s); print('patched',p)
def l15(s):
    if 'ELITE_SKIN' in s and 'eliteSpawn' not in s:
        s=re.sub(r'  const FOOT_HEAVY = [^\n]*\n','',s); s=s.replace('  const ELITE_SKIN = { img: EL_IMG, frames: ELF };\n','  const ELITE_SKIN = { img: EL_IMG, frames: ELF };\n  const FOOT_HEAVY = { img: "levels/enemies_foot.png", frames: %s }; // painted Foot heavy trooper (heavy + gunner)\n' % json.dumps(M['foot']['big'],separators=(',',':')))
        return re.sub(r'    enemySkins: \{ purple: ELITE_SKIN[^\n]*\n','',s)
    a=s.index('  // ---- FOOT ELITE:'); b=s.index('  // ================= SECTION 1')
    ELF=re.search(r'  const ELF = \{[^\n]*\n',s[a:b]).group(0)
    blk=('  // ---- FOOT ELITE: Shredder\'s guard has its own painted sheet (level15_elite.png). It is wired through the engine\'s\n'
         '  // enemySkins hook (see the level def below): the engine picks the frame per state and draws it in every path\n'
         '  // (walk, thrown, fly-at-camera, hit flash). Frames are [x, y, w, h, anchorX] at the engine\'s default skin scale.\n'
         + ELF + '  const ELITE_SKIN = { img: EL_IMG, frames: ELF };\n'
         + '  const FOOT_HEAVY = { img: "levels/enemies_foot.png", frames: %s }; // painted Foot heavy trooper (heavy + gunner)\n\n' % json.dumps(M['foot']['big'],separators=(',',':')))
    s=s[:a]+blk+s[b:]
    s=s.replace('hazards: [elevator, eliteFly], onSpawn: eliteSpawn,','hazards: [elevator],')
    s=s.replace('hazards: [penthouse, eliteFly], onSpawn: eliteSpawn,','hazards: [penthouse],')
    s=s.replace('hazards: [vats, labArena, eliteFly], onSpawn: eliteSpawn,','hazards: [vats, labArena],')
    assert 'eliteFly' not in s and 'eliteSpawn' not in s and 'ELITE_TINT' not in s
    return s
d=sys.argv[1]
for n in sys.argv[2:]: patch(d,int(n))
