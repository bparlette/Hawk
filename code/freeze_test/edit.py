import sys
def edit(path, old, new):
    s = open(path).read()          # re-read right before each edit
    n = s.count(old)
    if n != 1: print("SKIP (count=%d):" % n, old[:80]); return False
    open(path, 'w').write(s.replace(old, new, 1)); print("OK:", old[:70].replace("\n"," ")); return True
