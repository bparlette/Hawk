exec(open('/workspace/work/vo2/push.py').read().split("g=get(")[0])
import html,re
P='brad-demos/index.html'
g=get(P); s=base64.b64decode(g['content']).decode()
new=open('gbp_v2.txt').read().strip()
m=re.search(r'(<pre id="gbpText"[^>]*>)(.*?)(</pre>)',s,re.S); assert m
s=s[:m.start(2)]+html.escape(new,quote=False)+s[m.end(2):]
s=s.replace('Describe your game in 1–3 sentences at the top, then paste the whole thing into any AI (Gemini, ChatGPT, Claude).','Describe your game at the top, paste it into any AI (Gemini, ChatGPT, Claude), then send the follow-up prompts one at a time.')
put(P,s.encode(),"Brad's Demos: Game Builder Prompt v2 (game-first, fewer hard rules)",g['sha'])
# also download .txt if a separate file exists
for f in ['brad-demos/game-builder-prompt.txt']:
    x=get(f)
    if x: put(f,(new+'\n').encode(),"Brad's Demos: Game Builder Prompt v2 txt",x['sha'])
