#!/usr/bin/env bash
cd "$(dirname "$0")"
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
./surge_cli/node_modules/.bin/surge ./site_final shellshock-trailer.surge.sh && echo DEPLOY_OK
