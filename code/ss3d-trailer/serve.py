import os, sys, http.server, socketserver, functools
if os.fork(): sys.exit(0)
os.setsid()
if os.fork(): sys.exit(0)
fd = os.open('/dev/null', os.O_RDWR)
for i in (0, 1, 2): os.dup2(fd, i)
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory='/workspace/work/ss3d-trailer/site')
H.log_message = lambda *a: None
socketserver.TCPServer.allow_reuse_address = True
socketserver.ThreadingTCPServer(('127.0.0.1', 8844), H).serve_forever()
