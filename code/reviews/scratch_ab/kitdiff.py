import re,difflib
H=open('/workspace/work/toad-city/handoff/kit/toadcity_kit.js').read().split('\n')
S=open('/workspace/work/reviews/hawk-ab/toadcity_kit.js').read().split('\n')
app=[(1,86),(88,107),(398,456)]
appl=[]
for a,b in app: appl+=H[a-1:b]
# strip comments-only lines? compare exact line membership
Sset=set(l.rstrip() for l in S)
missing=[l for l in appl if l.strip() and l.rstrip() not in Sset]
print('appendix lines',len(appl),'non-verbatim in Sonnet kit',len(missing))
for l in missing: print('  -',l[:160])
