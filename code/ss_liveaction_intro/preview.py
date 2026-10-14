import sys, importlib.util
from PIL import Image
mode=sys.argv[1]; sys.argv=['r',mode,'/tmp/pv_'+mode]
spec=importlib.util.spec_from_file_location('r','render.py'); r=importlib.util.module_from_spec(spec); spec.loader.exec_module(r)
ts=[0.6,1.2,1.55,2.2,2.6,3.2,4.5,5.3,5.75,6.5,7.5,8.2,8.9,10,12,13.5]
ims=[r.render(int(t*30)) for t in ts]
w,h=ims[0].size; cols=8
c=Image.new('RGB',(w*cols,h*2))
for i,im in enumerate(ims): c.paste(im,((i%cols)*w,(i//cols)*h))
c.save('pv_'+mode+'.png'); print(c.size)
