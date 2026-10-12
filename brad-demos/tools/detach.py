#!/usr/bin/env python3
"""detach.py <logfile> <cmd...>: run a command fully detached (double fork + setsid) with the Playwright env,
so a 2-minute shell limit doesn't kill long browser tests."""
import os, sys
log, cmd = sys.argv[1], sys.argv[2:]
env = dict(os.environ)
R = "/workspace/work/freeze_test/root/usr/lib/aarch64-linux-gnu"
env["LD_LIBRARY_PATH"] = ":".join([R, R + "/pulseaudio", R + "/blas", R + "/lapack",
    "/workspace/work/sstest/debs/root/usr/lib/aarch64-linux-gnu", "/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu"])
env.update(LIBGL_ALWAYS_SOFTWARE="1", PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS="1", GIO_USE_PROXY_RESOLVER="dummy",
           GSETTINGS_BACKEND="memory", PLAYWRIGHT_BROWSERS_PATH="/workspace/work/freeze_test/pw-browsers",
           GST_PLUGIN_PATH=R + "/gstreamer-1.0", __EGL_VENDOR_LIBRARY_DIRS="/workspace/work/freeze_test/root/usr/share/glvnd/egl_vendor.d",
           LIBGL_DRIVERS_PATH=R + "/dri", GBM_BACKENDS_PATH=R + "/gbm", GIO_EXTRA_MODULES=R + "/gio/modules")
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
if os.fork(): sys.exit(0)
os.setsid()
if os.fork(): os._exit(0)
fd = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
nul = os.open("/dev/null", os.O_RDONLY)
os.dup2(nul, 0); os.dup2(fd, 1); os.dup2(fd, 2)
for f in range(3, 256):
    try: os.close(f)
    except OSError: pass
os.execvpe(cmd[0], cmd, env)
