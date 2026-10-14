. /workspace/work/freeze_test/env.sh
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu
export GIO_USE_PROXY_RESOLVER=dummy GSETTINGS_BACKEND=memory
# the local server for site/ on :8761 is started separately (T/serve.sh), detached with setsid
