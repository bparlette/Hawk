set -x
pip install -q --upgrade yt-dlp numpy > "$OUT/pip.log" 2>&1
yt-dlp --version > "$OUT/ytdlp_version.txt"
python3 analyze.py quUSjngSmN0 qEnptXwZSfo 1zRb_WNEeaw > "$OUT/summary.txt" 2> "$OUT/err.txt"
echo done
