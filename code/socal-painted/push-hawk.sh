#!/usr/bin/env bash
# Additive push of socal-summer-games-plus into bparlette/Hawk main:/brad-demos/ + local demos/site copy.
# Touches ONLY brad-demos/g/socal-summer-games-plus/, brad-demos/thumbs/socal-summer-games-plus.webp and that entry in games.json.
# Run under: flock /workspace/work/demos/.edit.lock ./push-hawk.sh
set -u
P=/workspace/work/socal-painted; ID=socal-summer-games-plus
if [ ! -d $P/hawk/.git ]; then
  timeout 110 git clone -q --filter=blob:none --no-checkout --depth 1 https://github.com/bparlette/Hawk.git $P/hawk || { echo CLONE_FAIL; exit 1; }
  (cd $P/hawk && git sparse-checkout init --no-cone)
fi
cd $P/hawk || exit 1
git sparse-checkout set "/brad-demos/games.json" "/brad-demos/demo-embed.js" "/brad-demos/g/$ID/" "/brad-demos/thumbs/$ID.webp"
for try in 1 2 3 4 5 6; do
  timeout 100 git fetch -q --depth 1 origin main || { echo "fetch failed ($try)"; sleep 15; continue; }
  git checkout -q -B main FETCH_HEAD; git reset -q --hard FETCH_HEAD
  python3 $P/merge.py brad-demos || exit 1
  git add brad-demos/games.json brad-demos/g/$ID brad-demos/thumbs/$ID.webp
  git -c user.name=Hark -c user.email=hark@hark.local commit -qm "Brad's Demos: add ★ California Games Remastered — Hark Edition ($ID)" || { echo NOTHING_TO_COMMIT; break; }
  timeout 100 git push -q origin HEAD:refs/heads/main && { echo "HAWK_PUSHED $(git rev-parse HEAD)"; break; }
  echo "push failed ($try)"; sleep 15
  [ $try = 6 ] && { echo PUSH_FAIL; exit 1; }
done
# local demos site + src manifest (no build/deploy/sync)
python3 $P/merge.py /workspace/work/demos/site && python3 $P/merge.py /workspace/work/demos/src --src && echo LOCAL_OK
