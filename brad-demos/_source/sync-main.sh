#!/usr/bin/env bash
# Mirrors demos into bparlette/Hawk main: brad-demos/ = built site (GitHub Pages), brad-demos/_source/ = everything else
cd "$(dirname "$0")"
git add -A; git -c user.name=Hark -c user.email=hark@hark.local commit -qm "demos $(date -Is)" || true
git fetch -q --depth 1 origin main || exit 1
export GIT_INDEX_FILE=$(mktemp -u)
git read-tree FETCH_HEAD
git rm -rq --cached brad-demos 2>/dev/null
git read-tree --prefix=brad-demos/ HEAD:site
git read-tree --prefix=brad-demos/_source/ HEAD
git rm -rq --cached brad-demos/_source/site
E=$(git hash-object -w /dev/null); git update-index --add --cacheinfo 100644,$E,.nojekyll
T=$(git write-tree); C=$(git -c user.name=Hark -c user.email=hark@hark.local commit-tree $T -p FETCH_HEAD -m "Update Brad's Demos (Pages: /brad-demos/)")
rm -f $GIT_INDEX_FILE
git push -q origin $C:refs/heads/main && echo MAIN_SYNCED $C
