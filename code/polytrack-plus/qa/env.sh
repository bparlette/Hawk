R=/workspace/work/freeze_test/root/usr/lib/aarch64-linux-gnu
export LD_LIBRARY_PATH="$R:$R/pulseaudio:$R/blas:$R/lapack:/workspace/work/sstest/debs/root/usr/lib/aarch64-linux-gnu:/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu"
export LIBGL_ALWAYS_SOFTWARE=1 PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 GIO_USE_PROXY_RESOLVER=dummy GSETTINGS_BACKEND=memory PLAYWRIGHT_BROWSERS_PATH=/workspace/work/freeze_test/pw-browsers
export GST_PLUGIN_PATH=$R/gstreamer-1.0 __EGL_VENDOR_LIBRARY_DIRS=/workspace/work/freeze_test/root/usr/share/glvnd/egl_vendor.d LIBGL_DRIVERS_PATH=$R/dri GBM_BACKENDS_PATH=$R/gbm GIO_EXTRA_MODULES=$R/gio/modules
curl -s -o /dev/null -m 2 http://127.0.0.1:8811/index.html || { nohup python3 -m http.server 8811 -d /workspace/work/polytrack-plus/game >/dev/null 2>&1 & sleep 1.5; }
