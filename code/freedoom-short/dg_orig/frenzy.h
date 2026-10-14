// Freedoom Frenzy mod (GPL-2.0, same as the engine)
#ifndef FRENZY_H
#define FRENZY_H
#include "p_mobj.h"
#include "d_player.h"

extern int frenzy_density;      // monster multiplier (3 = triple)
extern int frenzy_buddha;       // player can't drop below 1 HP (capture director only)
extern double frenzy_timescale; // 1.0 normal, 0.3 during kill-cam
extern int frenzy_slowmo;       // tics of kill-cam left
extern int frenzy_capture_quit;

void Frenzy_SpawnExtras(mobj_t *orig, mapthing_t *mthing);
void Frenzy_OnDamage(mobj_t *inflictor);
void Frenzy_OnKill(mobj_t *source, mobj_t *target);
void Frenzy_Ticker(void);         // once per game tic (P_Ticker)
void Frenzy_LevelStart(void);
void Frenzy_Drawer(void);         // on top of the 3D view
void Frenzy_ScriptLoad(const char *path);
void Frenzy_ScriptTick(void);     // director: before players think
void Frenzy_SoundLog(int sfx_id, int vol, int sep, int maxvol);
#endif
