#!/bin/bash
cd /workspace/work/ss_trailer
python3 -u build.py stills 14 15 && python3 -u build.py levels 14 15 && python3 -u build.py full && python3 -u build.py manifest && echo FINISH_OK
