import sys, importlib.util
sys.argv = ["build2.py", "devcap", "ref_dev", "dev_out"]
spec = importlib.util.spec_from_file_location("b2", "/workspace/work/trailer_v2/build2.py"); b2 = importlib.util.module_from_spec(spec); spec.loader.exec_module(b2)
b2.CAB = b2.Cabinet("ref_dev")
c = b2.Cap("devcap/level6")
idx = [i for i, m in enumerate(c.meta) if "file" in m]
j = next(i for i in idx if c.meta[i].get("inp", {}).get("a") and c.meta[i]["inp"]["dx"])
k = next(i for i in idx if c.meta[i].get("inp", {}).get("b") and c.meta[i]["inp"]["dy"])
from PIL import Image
a = c.frame(j); b = c.frame(k)
s = Image.new("RGB", (1440, 1280)); s.paste(a, (0, 0)); s.paste(b, (720, 0)); s.save("/tmp/comp.jpg", quality=85)
print(j, c.meta[j]["inp"], k, c.meta[k]["inp"])
