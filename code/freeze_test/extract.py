import re,sys
s=open(sys.argv[1]).read()
blocks=re.findall(r'<script(?![^>]*src)[^>]*>(.*?)</script>',s,re.S)
b=max(blocks,key=len)
open(sys.argv[2],'w').write(b)
print(len(b))
