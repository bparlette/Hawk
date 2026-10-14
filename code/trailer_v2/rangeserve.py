# rangeserve.py PORT DIR : static server with HTTP Range support (video seeking, like surge/iOS need)
import http.server, os, sys, re
class H(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        rng = self.headers.get("Range"); path = self.translate_path(self.path)
        if not rng or not os.path.isfile(path): return super().send_head()
        m = re.match(r"bytes=(\d*)-(\d*)", rng); size = os.path.getsize(path)
        a = int(m.group(1)) if m.group(1) else size - int(m.group(2)); b = int(m.group(2)) if m.group(1) and m.group(2) else size - 1
        b = min(b, size - 1); f = open(path, "rb"); f.seek(a)
        self.send_response(206); self.send_header("Content-Type", self.guess_type(path)); self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", "bytes %d-%d/%d" % (a, b, size)); self.send_header("Content-Length", str(b - a + 1)); self.end_headers()
        self.remain = b - a + 1; return f
    def copyfile(self, src, dst):
        n = getattr(self, "remain", None)
        if n is None: return super().copyfile(src, dst)
        while n > 0:
            buf = src.read(min(65536, n))
            if not buf: break
            try: dst.write(buf)
            except (BrokenPipeError, ConnectionResetError): break
            n -= len(buf)
os.chdir(sys.argv[2]); http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
