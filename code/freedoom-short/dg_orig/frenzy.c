// Freedoom Frenzy: a tiny gameplay mod for doomgeneric (GPL-2.0).
//  1. Horde density: every monster placed by the map spawns (density-1) extra copies nearby.
//  2. Kill-cam: 3+ explosive kills (rocket / BFG / barrel) within 8 tics -> ~1 s of 0.3x slow motion.
//  3. Combo counter: "x12 COMBO" drawn by the game, resets after 3 s without a kill.
//  Plus a small deterministic "director" script used only to capture trailer footage.

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#include "doomdef.h"
#include "doomstat.h"
#include "d_player.h"
#include "p_local.h"
#include "r_local.h"
#include "i_video.h"
#include "v_video.h"
#include "w_wad.h"
#include "z_zone.h"
#include "hu_stuff.h"
#include "s_sound.h"
#include "sounds.h"
#include "m_random.h"
#include "doomgeneric.h"
#include "frenzy.h"

int frenzy_density = 3;
int frenzy_buddha = 0;
double frenzy_timescale = 1.0;
int frenzy_slowmo = 0;
int frenzy_capture = 0;
int frenzy_capture_quit = 0;

extern patch_t *hu_font[HU_FONTSIZE];

static int combo, combo_timer, combo_pop, best_combo, total_kills;
static int killcam_cooldown, killcam_label;
static int splash_tics[16];
static int splash_n;
static mobj_t *last_inflictor;
static int flash_tics;

#define SLOWMO_TICS 11      /* 11 game tics at 0.3x ~= 1.05 s of real time */
#define SLOWMO_SCALE 0.3

// ---------------------------------------------------------------- density
void Frenzy_SpawnExtras(mobj_t *orig, mapthing_t *mthing)
{
    static const int dirs[8][2] = {{1,0},{-1,0},{0,1},{0,-1},{1,1},{-1,-1},{1,-1},{-1,1}};
    int made = 0, k;
    fixed_t d;
    if (frenzy_density <= 1 || netgame || !(orig->flags & MF_COUNTKILL))
        return;
    d = orig->info->radius * 2 + 6 * FRACUNIT;
    for (k = 0; k < 8 && made < frenzy_density - 1; k++)
    {
        fixed_t x = orig->x + dirs[k][0] * d;
        fixed_t y = orig->y + dirs[k][1] * d;
        fixed_t z = (orig->info->flags & MF_SPAWNCEILING) ? ONCEILINGZ : ONFLOORZ;
        mobj_t *m = P_SpawnMobj(x, y, z, orig->type);
        if (!P_CheckPosition(m, x, y) || !P_CheckSight(orig, m)
            || abs(m->floorz - orig->floorz) > 24 * FRACUNIT)
        {
            P_RemoveMobj(m);
            continue;
        }
        m->spawnpoint = *mthing;
        m->angle = orig->angle;
        if (orig->flags & MF_AMBUSH) m->flags |= MF_AMBUSH;
        if (m->tics > 0) m->tics = 1 + (P_Random() % m->tics);
        totalkills++;
        made++;
    }
}

// ---------------------------------------------------------------- kills
void Frenzy_LevelStart(void)
{
    combo = combo_timer = combo_pop = 0;
    killcam_cooldown = killcam_label = 0;
    splash_n = 0;
    frenzy_slowmo = 0;
    frenzy_timescale = 1.0;
    total_kills = 0;
}

void Frenzy_OnDamage(mobj_t *inflictor) { last_inflictor = inflictor; }

void Frenzy_OnKill(mobj_t *source, mobj_t *target)
{
    mobj_t *inf = last_inflictor;
    last_inflictor = NULL;
    if (!(target->flags & MF_COUNTKILL) || !source || !source->player)
        return;
    total_kills++;
    combo++;
    if (combo > best_combo) best_combo = combo;
    combo_timer = 3 * TICRATE;
    combo_pop = 6;

    if (inf && (inf->type == MT_ROCKET || inf->type == MT_BFG || inf->type == MT_BARREL
                || (inf == source && source->player->readyweapon == wp_bfg)))
    {
        int i, n = 0;
        splash_tics[splash_n++ & 15] = leveltime;
        for (i = 0; i < 16 && i < splash_n; i++)
            if (leveltime - splash_tics[i] <= 8) n++;
        if (n >= 3 && killcam_cooldown == 0 && frenzy_slowmo == 0)
        {
            frenzy_slowmo = SLOWMO_TICS;
            killcam_label = SLOWMO_TICS + 8;
            killcam_cooldown = SLOWMO_TICS + 70;
            flash_tics = 3;
        }
    }
}

void Frenzy_Ticker(void)
{
    if (combo_timer > 0 && --combo_timer == 0) combo = 0;
    if (combo_pop > 0) combo_pop--;
    if (killcam_label > 0) killcam_label--;
    if (killcam_cooldown > 0) killcam_cooldown--;
    if (flash_tics > 0) flash_tics--;
    if (frenzy_slowmo > 0) frenzy_slowmo--;
    frenzy_timescale = frenzy_slowmo > 0 ? SLOWMO_SCALE : 1.0;
}

// ---------------------------------------------------------------- drawing
static byte gold[256], white[256], blackmap[256];
static int maps_ready;

static void BuildMaps(void)
{
    int i;
    for (i = 0; i < 256; i++) { gold[i] = white[i] = i; blackmap[i] = 0; }
    // red ramp 176..191 -> yellow/orange; also brown/gray font ramps
    for (i = 176; i < 192; i++) gold[i] = 160 + (i - 176) / 2;      /* yellow 160..167 */
    for (i = 80; i < 112; i++)  gold[i] = 160 + (i - 80) / 4;       /* gray -> yellow */
    for (i = 176; i < 192; i++) white[i] = 80 + (i - 176);          /* red -> light gray */
    maps_ready = 1;
}

static void PutBlock(int x, int y, int s, byte c)
{
    int i, j;
    for (j = 0; j < s; j++)
    {
        int yy = y + j;
        if (yy < 0 || yy >= SCREENHEIGHT) continue;
        for (i = 0; i < s; i++)
        {
            int xx = x + i;
            if (xx < 0 || xx >= SCREENWIDTH) continue;
            I_VideoBuffer[yy * SCREENWIDTH + xx] = c;
        }
    }
}

static void DrawPatchS(int x, int y, patch_t *p, int s, byte *map)
{
    int col, w = SHORT(p->width);
    for (col = 0; col < w; col++)
    {
        column_t *c = (column_t *)((byte *)p + LONG(p->columnofs[col]));
        while (c->topdelta != 0xff)
        {
            byte *src = (byte *)c + 3;
            int i;
            for (i = 0; i < c->length; i++)
                PutBlock(x + col * s, y + (c->topdelta + i) * s, s, map[src[i]]);
            c = (column_t *)((byte *)c + c->length + 4);
        }
    }
}

static int TextWidth(const char *t, int s)
{
    int w = 0;
    for (; *t; t++)
    {
        int c = toupper((unsigned char)*t) - HU_FONTSTART;
        if (c < 0 || c >= HU_FONTSIZE) w += 4 * s;
        else w += SHORT(hu_font[c]->width) * s;
    }
    return w;
}

static void DrawText(int x, int y, const char *t, int s, byte *map)
{
    int pass;
    for (pass = 0; pass < 2; pass++)
    {
        int cx = x;
        const char *q;
        for (q = t; *q; q++)
        {
            int c = toupper((unsigned char)*q) - HU_FONTSTART;
            if (c < 0 || c >= HU_FONTSIZE) { cx += 4 * s; continue; }
            if (pass == 0)
            {   // chunky drop shadow / outline
                DrawPatchS(cx + s, y + s, hu_font[c], s, blackmap);
                DrawPatchS(cx - s / 2, y + s, hu_font[c], s, blackmap);
            }
            else
                DrawPatchS(cx, y, hu_font[c], s, map);
            cx += SHORT(hu_font[c]->width) * s;
        }
    }
}

static void DrawTextC(int y, const char *t, int s, byte *map)
{
    DrawText((SCREENWIDTH - TextWidth(t, s)) / 2, y, t, s, map);
}

static void DrawBigNum(int x, int y, int v, int s, int pct)
{
    char buf[16];
    int i, cx = x;
    sprintf(buf, "%d", v);
    for (i = 0; buf[i]; i++)
    {
        char name[9];
        patch_t *p;
        sprintf(name, "STTNUM%c", buf[i]);
        p = W_CacheLumpName(name, PU_CACHE);
        DrawPatchS(cx + s, y + s, p, s, blackmap);
        DrawPatchS(cx, y, p, s, white);
        cx += SHORT(p->width) * s;
    }
    if (pct)
    {
        patch_t *p = W_CacheLumpName("STTPRCNT", PU_CACHE);
        DrawPatchS(cx + s, y + s, p, s, blackmap);
        DrawPatchS(cx, y, p, s, white);
    }
}

void Frenzy_Drawer(void)
{
    player_t *pl = &players[displayplayer];
    int S = SCREENWIDTH >= 480 ? SCREENWIDTH / 108 : 2;   /* 5 at 540 wide, 2 at 320 */
    char buf[64];
    if (!maps_ready) BuildMaps();
    if (gamestate != GS_LEVEL || automapactive) return;

    if (combo >= 2)
    {
        int s = S + (combo_pop > 3 ? 2 : (combo_pop > 0 ? 1 : 0));
        int y = SCREENHEIGHT * 36 / 100 - (s - S) * 4;
        if (SCREENHEIGHT <= SCREENWIDTH) y = SCREENHEIGHT / 6;
        sprintf(buf, "x%d COMBO", combo);
        DrawTextC(y, buf, s, gold);
    }
    if (total_kills > 0 && viewheight == SCREENHEIGHT)
    {
        int s = S > 2 ? S - 2 : 1;
        int y = SCREENHEIGHT * 36 / 100 + 13 * S;
        if (SCREENHEIGHT <= SCREENWIDTH) y = SCREENHEIGHT / 6 + 12 * S;
        sprintf(buf, "KILLS %d", total_kills);
        DrawTextC(y, buf, s, white);
    }
    if (killcam_label > 0 && (killcam_label & 2 || frenzy_slowmo > 0))
    {
        int y = SCREENHEIGHT * 60 / 100;
        int i;
        if (SCREENHEIGHT <= SCREENWIDTH) y = SCREENHEIGHT / 2;
        DrawTextC(y, "KILL CAM", S, gold);
        // red frame while time is slowed
        if (frenzy_slowmo > 0)
            for (i = 0; i < SCREENWIDTH; i += 4)
            {
                PutBlock(i, 0, 4, 176); PutBlock(i, viewheight - 4, 4, 176);
            }
    }
    // full-screen mini HUD (only when the status bar is hidden)
    if (viewheight == SCREENHEIGHT)
    {
        int s = SCREENWIDTH >= 480 ? 3 : 1;
        int ammo = -1;
        DrawBigNum(8 * s / 2 + 4, SCREENHEIGHT - 20 * s, pl->health, s, 1);
        if (weaponinfo[pl->readyweapon].ammo != am_noammo)
            ammo = pl->ammo[weaponinfo[pl->readyweapon].ammo];
        if (ammo >= 0)
        {
            int w = 0, v = ammo;
            do { w += 14 * s; v /= 10; } while (v);
            DrawBigNum(SCREENWIDTH - w - 8 * s, SCREENHEIGHT - 20 * s, ammo, s, 0);
        }
    }
}

// ---------------------------------------------------------------- director script
typedef struct { int a, b; char cmd[16]; double v[7]; } scmd_t;
static scmd_t *script;
static int nscript;

void Frenzy_ScriptLoad(const char *path)
{
    FILE *f = fopen(path, "r");
    char line[256];
    int cap = 0;
    if (!f) { printf("frenzy: no script %s\n", path); return; }
    while (fgets(line, sizeof line, f))
    {
        scmd_t c;
        int n;
        memset(&c, 0, sizeof c);
        if (line[0] == '#' || line[0] == '\n') continue;
        n = sscanf(line, "%d %d %15s %lf %lf %lf %lf %lf %lf %lf", &c.a, &c.b, c.cmd,
                   &c.v[0], &c.v[1], &c.v[2], &c.v[3], &c.v[4], &c.v[5], &c.v[6]);
        if (n < 3) continue;
        if (nscript == cap) { cap = cap ? cap * 2 : 64; script = realloc(script, cap * sizeof *script); }
        script[nscript++] = c;
    }
    fclose(f);
    printf("frenzy: %d script lines\n", nscript);
}

static angle_t Deg(double d) { return (angle_t)(long long)(fmod(d + 3600.0, 360.0) / 360.0 * 4294967296.0); }

static void Info(player_t *p)
{
    thinker_t *th;
    printf("INFO t=%d pos %d %d z %d ang %.1f hp %d kills %d/%d\n", leveltime,
           p->mo->x >> FRACBITS, p->mo->y >> FRACBITS, p->mo->z >> FRACBITS,
           p->mo->angle / 4294967296.0 * 360.0, p->health, total_kills, totalkills);
    for (th = thinkercap.next; th != &thinkercap; th = th->next)
    {
        mobj_t *m;
        if (th->function.acp1 != (actionf_p1)P_MobjThinker) continue;
        m = (mobj_t *)th;
        if (!(m->flags & MF_COUNTKILL) || m->health <= 0) continue;
        printf("MON %d %d %d %d %d\n", m->type, m->x >> FRACBITS, m->y >> FRACBITS,
               P_AproxDistance(m->x - p->mo->x, m->y - p->mo->y) >> FRACBITS, P_CheckSight(p->mo, m));
    }
}

void Frenzy_ScriptTick(void)
{
    player_t *p = &players[consoleplayer];
    int i, t = leveltime;
    if (!script || !p->mo) return;
    for (i = 0; i < nscript; i++)
    {
        scmd_t *c = &script[i];
        if (!strcmp(c->cmd, "in"))
        {
            if (t >= c->a && t < c->b)
            {
                p->cmd.forwardmove = (signed char)c->v[0];
                p->cmd.sidemove = (signed char)c->v[1];
                p->cmd.angleturn = (short)c->v[2];
                p->cmd.buttons = ((int)c->v[3] & 1 ? BT_ATTACK : 0) | ((int)c->v[3] & 2 ? BT_USE : 0);
            }
            continue;
        }
        if (!strcmp(c->cmd, "turnto") && t >= c->a && t < c->b)
        {   // smooth turn toward absolute angle, finishing at tic b
            angle_t target = Deg(c->v[0]);
            int left = c->b - t;
            int diff = (int)(target - p->mo->angle);
            p->cmd.angleturn = (short)((diff / left) >> 16);
            continue;
        }
        if (c->a != t) continue;
        if (!strcmp(c->cmd, "pos"))
        {
            P_TeleportMove(p->mo, (fixed_t)(c->v[0] * FRACUNIT), (fixed_t)(c->v[1] * FRACUNIT));
            p->mo->z = p->mo->floorz;
            p->mo->momx = p->mo->momy = 0;
            p->mo->angle = Deg(c->v[2]);
            p->viewz = p->mo->z + VIEWHEIGHT;
        }
        else if (!strcmp(c->cmd, "ang")) p->mo->angle = Deg(c->v[0]);
        else if (!strcmp(c->cmd, "give"))
        {
            int w;
            if (!p->backpack) { for (w = 0; w < NUMAMMO; w++) p->maxammo[w] *= 2; p->backpack = true; }
            for (w = 0; w < NUMWEAPONS; w++) p->weaponowned[w] = true;
            for (w = 0; w < NUMAMMO; w++) p->ammo[w] = p->maxammo[w];
        }
        else if (!strcmp(c->cmd, "weapon"))
        {
            p->pendingweapon = (weapontype_t)(int)c->v[0];
            if (c->v[1] > 0)
            {   // instant switch (cut-friendly)
                p->readyweapon = p->pendingweapon;
                p->pendingweapon = wp_nochange;
                P_SetupPsprites(p);
            }
        }
        else if (!strcmp(c->cmd, "ammo")) p->ammo[(int)c->v[0]] = (int)c->v[1];
        else if (!strcmp(c->cmd, "health")) { p->health = p->mo->health = (int)c->v[0]; }
        else if (!strcmp(c->cmd, "armor")) { p->armorpoints = (int)c->v[0]; p->armortype = 1; }
        else if (!strcmp(c->cmd, "buddha")) frenzy_buddha = (int)c->v[0];
        else if (!strcmp(c->cmd, "cap")) frenzy_capture = (int)c->v[0];
        else if (!strcmp(c->cmd, "alert")) P_NoiseAlert(p->mo, p->mo);
        else if (!strcmp(c->cmd, "info")) Info(p);
        else if (!strcmp(c->cmd, "spawn"))
        {   // spawn TYPE X Y ANG COUNT SPACING : a row/grid of monsters facing ANG
            int n = (int)c->v[4], k, cols = n < 5 ? n : 5;
            for (k = 0; k < n; k++)
            {
                double ox = (k % cols - (cols - 1) / 2.0) * c->v[5];
                double oy = (k / cols) * c->v[5];
                mobj_t *m = P_SpawnMobj((fixed_t)((c->v[1] + ox) * FRACUNIT),
                                        (fixed_t)((c->v[2] + oy) * FRACUNIT), ONFLOORZ, (mobjtype_t)(int)c->v[0]);
                m->angle = Deg(c->v[3]);
                totalkills++;
            }
        }
        else if (!strcmp(c->cmd, "quit")) frenzy_capture_quit = 1;
    }
}

// ---------------------------------------------------------------- sound log (for the trailer mix)
static FILE *sndlog;
static int sndlog_tried;
void Frenzy_SoundLog(int sfx_id, int vol, int sep, int maxvol)
{
#ifdef __wasm__
    extern void js_sound(const char *name, int vol, int sep, int maxvol);
    js_sound(S_sfx[sfx_id].name, vol, sep, maxvol);
#else
    if (!sndlog_tried)
    {
        const char *p = getenv("FD_SNDLOG");
        sndlog_tried = 1;
        if (p) sndlog = fopen(p, "w");
    }
    if (sndlog && frenzy_capture)
    {
        fprintf(sndlog, "%u %s %d %d %d %.2f\n", DG_GetTicksMs(), S_sfx[sfx_id].name, vol, sep, maxvol, frenzy_timescale);
        fflush(sndlog);
    }
#endif
}
