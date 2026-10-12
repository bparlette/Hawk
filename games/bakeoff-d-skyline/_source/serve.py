import os, sys, http.server, socketserver, functools
port, d = int(sys.argv[1]), sys.argv[2]
if os.fork(): sys.exit(0)
os.setsid()
if os.fork(): sys.exit(0)
fd = os.open('/dev/null', os.O_RDWR)
for i in (0, 1, 2): os.dup2(fd, i)
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=d)
H.log_message = lambda *a: None
socketserver.ThreadingTCPServer.allow_reuse_address = True
socketserver.ThreadingTCPServer(('127.0.0.1', port), H).serve_forever()
