// SHELL SHOCK 16 - Level 1: one wave + Ramrod. Sega Genesis / Mega Drive, SGDK 2.11.
// Controls (3-button pad): D-pad move, B attack (3-hit combo), C jump (B in air = jump kick), A special spin, START pause.
#include <genesis.h>
#include "resources.h"

#define W 320
#define LEVEL_W 640
#define FLOOR_TOP 150
#define FLOOR_BOT 214

// ---------- tiny helpers ----------
static u16 rngState = 0xACE1;
static u16 rnd(void) { rngState ^= rngState << 7; rngState ^= rngState >> 9; rngState ^= rngState << 8; return rngState; }
static s16 iabs(s16 v) { return v < 0 ? -v : v; }
static s16 clampi(s16 v, s16 lo, s16 hi) { return v < lo ? lo : (v > hi ? hi : v); }

// ---------- sound (PSG only: ch0 bass, ch1 lead, ch2 sfx tone, ch3 noise) ----------
static const u16 BASS[32] = { 82,0,82,0,98,0,82,0, 110,0,110,0,98,0,73,0, 82,0,82,0,98,0,82,0, 123,0,110,0,98,0,92,0 };
static const u16 LEAD[32] = { 330,0,392,440,0,392,330,0, 294,0,330,392,0,0,330,294, 330,0,392,440,0,494,587,0, 494,440,392,0,330,0,0,0 };
static const u16 BBASS[16] = { 73,0,73,73,0,73,87,0, 73,0,73,73,0,98,92,87 };
static const u16 BLEAD[16] = { 294,0,0,349,0,0,330,311, 294,0,0,440,0,415,392,370 };
static u8 musOn = 0, musBoss = 0; static u16 musStep = 0, musT = 0; static u8 env0 = 15, env1 = 15;
static u8 sfxT = 0; static u16 sfxF = 0; static s16 sfxDF = 0; static u8 nzT = 0, nzLen = 1;
static void sfxTone(u16 f, s16 df, u8 len) { sfxF = f; sfxDF = df; sfxT = len; }
static void sfxNoise(u8 len, u8 clk) { nzT = len; nzLen = len; PSG_setNoise(PSG_NOISE_TYPE_WHITE, clk); }
static void soundTick(void) {
    if (musOn) {
        if (musT == 0) {
            u16 i = musBoss ? (musStep & 15) : (musStep & 31);
            u16 b = musBoss ? BBASS[i] : BASS[i], l = musBoss ? BLEAD[i] : LEAD[i];
            if (b) { PSG_setFrequency(0, b); env0 = 3; }
            if (l) { PSG_setFrequency(1, l); env1 = 5; }
            musStep++;
        }
        musT = (musT + 1) % (musBoss ? 7 : 8);
        PSG_setEnvelope(0, env0); PSG_setEnvelope(1, env1);
        if ((musT & 1) == 0) { if (env0 < 15) env0++; if (env1 < 15) env1++; }
    } else { PSG_setEnvelope(0, 15); PSG_setEnvelope(1, 15); }
    if (sfxT) { PSG_setFrequency(2, sfxF); PSG_setEnvelope(2, 2 + (8 - (sfxT > 8 ? 8 : sfxT))); sfxF += sfxDF; sfxT--; } else PSG_setEnvelope(2, 15);
    if (nzT) { PSG_setEnvelope(3, (u8)(15 - (nzT * 13) / nzLen)); nzT--; } else PSG_setEnvelope(3, 15);
}
#define SFX_SWING() sfxTone(900, -40, 6)
#define SFX_HIT()   sfxNoise(8, PSG_NOISE_FREQ_CLOCK4)
#define SFX_BIG()   sfxNoise(18, PSG_NOISE_FREQ_CLOCK8)
#define SFX_JUMP()  sfxTone(300, 30, 8)
#define SFX_HURT()  sfxTone(500, -25, 12)

// ---------- actors ----------
enum { A_IDLE, A_WALK, A_ATTACK, A_JUMP, A_HURT, A_DOWN };            // lenny anims
enum { E_IDLE, E_WALK, E_ATTACK, E_HURT, E_DOWN };                    // punk anims
enum { R_IDLE, R_WALK, R_CHARGE, R_KICK, R_FIRE, R_HURT, R_DOWN };    // ramrod anims
enum { T_LIGHT, T_WEAPON, T_BIG, T_BOSS };
enum { S_WALK, S_WIND, S_ATK, S_HURT, S_DOWN, S_GETUP, S_DEAD, S_TELE, S_CHARGE, S_KWIND, S_KICK, S_FIRE, S_ENTER };

typedef struct {
    Sprite* spr; u8 on, type, state; s16 x, y, z, vx, vz, t, hp, maxHp, facing, cool, cellW, cellH, flash, dmgAcc;
} Ent;

#define MAXE 4
static Ent P; static Ent E[MAXE];
static s16 pAtkT, pCombo, pComboT, pInv, pSpinT, pJumpAtk, lives, score, pDeadT;
static u16 joy, joyPrev;
static s16 camX; static u8 phase; // 0 wave, 1 go, 2 boss, 3 clear, 4 over
static s16 spawnIdx, spawnT, killCount, bannerT;
static Map* bgMap; static u16 bgBase;
static u8 spinDefOn = 0; static u8 paused = 0;
static const u8 WAVE[8] = { T_LIGHT, T_LIGHT, T_WEAPON, T_LIGHT, T_BIG, T_WEAPON, T_LIGHT, T_BIG };
#define WAVE_N 8
#define TILE_BAR (TILE_USER_INDEX)

// HUD tiles (PAL0: 13 = black, 14 = yellow, 15 = white)
static const u32 T_SOLID[8] = { 0xDDDDDDDD,0xDDDDDDDD,0xDDDDDDDD,0xDDDDDDDD,0xDDDDDDDD,0xDDDDDDDD,0xDDDDDDDD,0xDDDDDDDD };
static const u32 T_FULL[8]  = { 0xDDDDDDDD,0xFFFFFFFF,0xEEEEEEEE,0xEEEEEEEE,0xEEEEEEEE,0xEEEEEEEE,0xFFFFFFFF,0xDDDDDDDD };
static const u32 T_HALF[8]  = { 0xDDDDDDDD,0xFFFFDDDD,0xEEEEDDDD,0xEEEEDDDD,0xEEEEDDDD,0xEEEEDDDD,0xFFFFDDDD,0xDDDDDDDD };
static const u32 T_EMPTY[8] = { 0xDDDDDDDD,0xDFFFFFFD,0xDDDDDDDD,0xDDDDDDDD,0xDDDDDDDD,0xDDDDDDDD,0xDFFFFFFD,0xDDDDDDDD };

static void drawBar(u16 x, u16 y, s16 hp, s16 maxHp, u16 cells) {
    s16 per = (maxHp + cells - 1) / cells; if (per < 1) per = 1;
    for (u16 i = 0; i < cells; i++) {
        s16 v = hp - i * per; u16 t = v >= per ? 1 : (v * 2 >= per ? 2 : 3);
        VDP_setTileMapXY(WINDOW, TILE_ATTR_FULL(PAL0, TRUE, FALSE, FALSE, TILE_BAR + t), x + i, y);
    }
}
static s16 hudHp = -1, hudLives = -1, hudScore = -1, hudBoss = -2;
static void hud(void) {
    char buf[16];
    if (hudHp != P.hp) { hudHp = P.hp; drawBar(1, 1, P.hp, P.maxHp, 12); }
    if (hudLives != lives) { hudLives = lives; buf[0] = 'x'; buf[1] = '0' + (lives > 9 ? 9 : lives); buf[2] = 0; VDP_drawTextBG(WINDOW, buf, 14, 1); }
    if (hudScore != score) { hudScore = score; intToStr(score * 10, buf, 6); VDP_drawTextBG(WINDOW, buf, 8, 0); }
    s16 bh = -1; for (u8 i = 0; i < MAXE; i++) if (E[i].on && E[i].type == T_BOSS) bh = E[i].hp;
    if (bh != hudBoss) {
        if (bh < 0) VDP_fillTileMapRect(WINDOW, TILE_ATTR_FULL(PAL0, TRUE, FALSE, FALSE, TILE_BAR), 22, 0, 18, 2);
        else { if (hudBoss < 0) VDP_drawTextBG(WINDOW, "RAMROD", 26, 0); drawBar(26, 1, bh, 60, 12); }
        hudBoss = bh;
    }
}

// ---------- sprite setup ----------
static void setSpr(Ent* e) {
    if (!e->spr) return;
    s16 sx = e->x - camX - e->cellW / 2, sy = e->y - e->z - e->cellH;
    if (e->type == 255 && spinDefOn) { sx = e->x - camX - 64; sy = e->y - e->z - 56; }
    SPR_setPosition(e->spr, sx, sy);
    SPR_setHFlip(e->spr, e->facing < 0);
    SPR_setDepth(e->spr, -e->y);
    SPR_setVisibility(e->spr, (e->flash && (e->flash & 2)) ? HIDDEN : VISIBLE);
}
static void spawnEnemy(u8 type, s16 fromRight) {
    for (u8 i = 0; i < MAXE; i++) if (!E[i].on) {
        Ent* e = &E[i]; memset(e, 0, sizeof(Ent));
        e->on = 1; e->type = type; e->facing = fromRight ? -1 : 1;
        e->x = fromRight ? camX + W + 30 : camX - 30; e->y = FLOOR_TOP + 8 + (rnd() % (FLOOR_BOT - FLOOR_TOP - 12));
        const SpriteDefinition* d = type == T_LIGHT ? &spr_light : type == T_WEAPON ? &spr_weapon : type == T_BIG ? &spr_big : &spr_ramrod;
        e->cellW = type == T_BOSS ? 80 : 72; e->cellH = type == T_BOSS ? 80 : 72;
        e->maxHp = e->hp = type == T_LIGHT ? 6 : type == T_WEAPON ? 8 : type == T_BIG ? 14 : 60;
        e->cool = 40 + (rnd() & 31); e->state = type == T_BOSS ? S_ENTER : S_WALK;
        e->spr = SPR_addSprite(d, -100, -100, TILE_ATTR(PAL3, FALSE, FALSE, FALSE));
        if (type == T_BOSS) { e->x = camX + W + 50; e->y = (FLOOR_TOP + FLOOR_BOT) / 2; }
        return;
    }
}
static void killEnt(Ent* e) { if (e->spr) SPR_releaseSprite(e->spr); e->spr = NULL; e->on = 0; }

// ---------- combat ----------
static void hurtPlayer(s16 dmg, s16 dir, u8 knock) {
    if (pInv || pDeadT || pSpinT) return;
    P.hp -= dmg; SFX_HURT(); pAtkT = 0; pCombo = 0;
    if (P.hp <= 0 || knock) { P.state = S_DOWN; P.t = 0; P.vz = 5; P.vx = dir * 2; if (P.z == 0) P.z = 1; }
    else { P.state = S_HURT; P.t = 0; }
    P.facing = -dir; pInv = 50;
}
static void hitEnemy(Ent* e, s16 dmg, s16 dir, u8 knock) {
    if (e->state == S_DOWN || e->state == S_DEAD || e->state == S_GETUP || e->state == S_ENTER) return;
    e->hp -= dmg; score += dmg; e->facing = -dir; SFX_HIT();
    if (e->type == T_BOSS) {
        e->dmgAcc += dmg;
        if (e->hp <= 0 || e->dmgAcc >= 14) { e->dmgAcc = 0; e->state = S_DOWN; e->t = 0; e->vx = dir * 2; e->vz = 4; e->z = 1; SFX_BIG(); }
        else if (e->state != S_CHARGE && e->state != S_KICK) { e->state = S_HURT; e->t = 0; }
        return;
    }
    if (e->hp <= 0 || knock) { e->state = S_DOWN; e->t = 0; e->vx = dir * 3; e->vz = 5; e->z = 1; SFX_BIG(); }
    else { e->state = S_HURT; e->t = 0; e->x += dir * 3; }
}
static void playerStrike(s16 reach, s16 dmg, u8 knock, u8 all) {
    for (u8 i = 0; i < MAXE; i++) {
        Ent* e = &E[i]; if (!e->on) continue;
        s16 dx = e->x - P.x, dy = iabs(e->y - P.y);
        if (dy > 12) continue;
        if (all ? iabs(dx) < reach : (dx * P.facing > -6 && dx * P.facing < reach)) { hitEnemy(e, dmg, dx >= 0 ? 1 : -1, knock); }
    }
}

// ---------- player ----------
static void updatePlayer(void) {
    u16 pressed = joy & ~joyPrev;
    if (pInv) pInv--;
    if (P.state == S_DOWN) {
        P.t++;
        if (P.z > 0 || P.vz > 0) { P.z += P.vz; P.vz -= 1; P.x += P.vx; if (P.z <= 0) { P.z = 0; P.vz = 0; P.vx = 0; SFX_BIG(); } }
        if (P.t > 50) {
            if (P.hp <= 0) {
                lives--;
                if (lives < 0) { phase = 4; bannerT = 0; lives = 0; return; }
                P.hp = P.maxHp; pInv = 120;
                for (u8 i = 0; i < MAXE; i++) if (E[i].on) hitEnemy(&E[i], 0, E[i].x > P.x ? 1 : -1, 1);
            }
            P.state = S_WALK; P.t = 0;
        }
        P.flash = 0; return;
    }
    if (P.state == S_HURT) { if (++P.t > 16) { P.state = S_WALK; } P.flash = 0; return; }
    if (pSpinT) {
        pSpinT--; P.x += P.facing; if ((pSpinT & 7) == 0) { playerStrike(44, 2, 1, 1); SFX_SWING(); }
        if (pSpinT == 0 && spinDefOn) { SPR_setDefinition(P.spr, &spr_lenny); spinDefOn = 0; }
        P.x = clampi(P.x, camX + 12, camX + W - 12); return;
    }
    s16 dx = 0, dy = 0;
    if (joy & BUTTON_LEFT) dx = -1; if (joy & BUTTON_RIGHT) dx = 1;
    if (joy & BUTTON_UP) dy = -1; if (joy & BUTTON_DOWN) dy = 1;
    // airborne
    if (P.z > 0 || P.vz > 0) {
        P.z += P.vz; if ((P.t++ & 1) == 0) P.vz -= 1;
        P.x += P.vx;
        if ((pressed & BUTTON_B) && !pJumpAtk) { pJumpAtk = 1; SFX_SWING(); }
        if (pJumpAtk && pJumpAtk < 20) { pJumpAtk++; if (pJumpAtk > 2 && pJumpAtk < 14) playerStrike(40, 3, 1, 0); }
        if (P.z <= 0) { P.z = 0; P.vz = 0; pJumpAtk = 0; P.vx = 0; }
    } else if (pAtkT) {
        pAtkT--;
        if (pAtkT == 8) playerStrike(pCombo == 3 ? 46 : 40, pCombo == 3 ? 2 : 1, pCombo == 3, 0);
        if (pAtkT == 0) pComboT = 18;
    } else {
        if (pComboT) { pComboT--; if (!pComboT) pCombo = 0; }
        if (pressed & BUTTON_C) { P.vz = 7; P.z = 1; P.vx = dx * 2; P.t = 0; pJumpAtk = 0; SFX_JUMP(); }
        else if (pressed & BUTTON_A) {
            pSpinT = 36; SFX_SWING(); if (P.hp > 2) P.hp -= 2;
            SPR_setDefinition(P.spr, &spr_spin); spinDefOn = 1; SPR_setAnimAndFrame(P.spr, 0, 0);
        }
        else if (pressed & BUTTON_B) { pCombo = pComboT ? (pCombo % 3) + 1 : 1; pAtkT = 14; SFX_SWING(); }
        else {
            P.x += dx * 2; P.y += dy; if (dx) P.facing = dx;
            P.state = (dx || dy) ? S_WALK : S_WALK; P.t = (dx || dy) ? P.t + 1 : 0;
        }
    }
    P.y = clampi(P.y, FLOOR_TOP, FLOOR_BOT);
    s16 lo = camX + 14, hi = (phase == 1) ? LEVEL_W - 14 : camX + W - 14;
    P.x = clampi(P.x, lo, hi);
    P.flash = pInv && !pDeadT ? pInv : 0;
}
static void animPlayer(void) {
    if (spinDefOn) { SPR_setAnimAndFrame(P.spr, 0, (pSpinT >> 2) & 1); return; }
    s16 a = A_IDLE, f = 0;
    if (P.state == S_DOWN) a = A_DOWN;
    else if (P.state == S_HURT) a = A_HURT;
    else if (P.z > 0) a = pJumpAtk && pJumpAtk < 16 ? A_ATTACK : A_JUMP;
    else if (pAtkT) a = A_ATTACK;
    else if (P.t > 0) { a = A_WALK; f = (P.t >> 3) & 3; }
    SPR_setAnimAndFrame(P.spr, a, f);
}

// ---------- enemies ----------
static void updatePunk(Ent* e) {
    s16 dx = P.x - e->x, dy = P.y - e->y; e->t++;
    if (e->flash) e->flash--;
    switch (e->state) {
    case S_WALK: {
        s16 want = P.x + (e->x < P.x ? -30 : 30) + ((e - E) * 7 % 13) - 6;
        s16 mx = want - e->x, sp = e->type == T_BIG ? 1 : 1;
        if (iabs(dy) > 1) e->y += dy > 0 ? 1 : -1;
        if (iabs(mx) > 2 && (e->t & (e->type == T_BIG ? 1 : 0)) == 0) e->x += mx > 0 ? sp : -sp;
        e->facing = dx >= 0 ? 1 : -1;
        if (e->cool) e->cool--;
        if (!e->cool && iabs(dx) < 40 && iabs(dy) < 8 && !P.flash && P.state != S_DOWN) { e->state = S_WIND; e->t = 0; }
        break; }
    case S_WIND: if (e->t > (e->type == T_BIG ? 16 : 12)) { e->state = S_ATK; e->t = 0; SFX_SWING(); } break;
    case S_ATK:
        if (e->t == 3) { s16 reach = e->type == T_WEAPON ? 48 : 38; if (dx * e->facing > -4 && dx * e->facing < reach && iabs(dy) < 10 && P.z < 20) hurtPlayer(e->type == T_BIG ? 3 : 2, e->facing, e->type == T_BIG); }
        if (e->t > 14) { e->state = S_WALK; e->t = 0; e->cool = 50 + (rnd() % 60); }
        break;
    case S_HURT: if (e->t > 14) { e->state = S_WALK; e->t = 0; e->cool = 20; } break;
    case S_DOWN:
        if (e->z > 0 || e->vz > 0) { e->z += e->vz; if (e->t & 1) e->vz--; e->x += e->vx; if (e->z <= 0) { e->z = 0; e->vz = 0; e->vx = 0; } }
        if (e->t > 45) { if (e->hp <= 0) { e->state = S_DEAD; e->t = 0; } else { e->state = S_GETUP; e->t = 0; } }
        break;
    case S_GETUP: if (e->t > 10) { e->state = S_WALK; e->t = 0; e->cool = 30; } break;
    case S_DEAD: e->flash = e->t; if (e->t > 40) { killEnt(e); killCount++; score += 10; } return;
    }
    e->y = clampi(e->y, FLOOR_TOP, FLOOR_BOT);
}
static void animPunk(Ent* e) {
    s16 a = E_IDLE, f = 0;
    switch (e->state) {
    case S_WALK: if (iabs(P.x - e->x) > 34 || iabs(P.y - e->y) > 2) { a = E_WALK; f = (e->t >> 3) & 3; } break;
    case S_WIND: a = E_IDLE; break;
    case S_ATK: a = E_ATTACK; break;
    case S_HURT: a = E_HURT; break;
    case S_DOWN: case S_DEAD: a = E_DOWN; break;
    case S_GETUP: a = E_HURT; break;
    }
    SPR_setAnimAndFrame(e->spr, a, f);
}
static void updateBoss(Ent* e) {
    s16 dx = P.x - e->x, dy = P.y - e->y; e->t++;
    s16 L = camX + 20, R = camX + W - 20;
    if (e->flash && e->state != S_TELE) e->flash--;
    switch (e->state) {
    case S_ENTER: e->x -= 1; e->facing = -1; if (e->x < camX + W - 50) { e->state = S_WALK; e->t = 0; e->cool = 60; } break;
    case S_WALK: {
        s16 want = P.x + (e->x < P.x ? -44 : 44), mx = want - e->x;
        if (iabs(dy) > 1) e->y += dy > 0 ? 1 : -1;
        if (iabs(mx) > 3) e->x += mx > 0 ? 1 : -1;
        e->facing = dx >= 0 ? 1 : -1;
        if (e->cool) e->cool--;
        else if (P.state != S_DOWN) {
            u16 r = rnd() & 3; e->t = 0; e->cool = 80 + (rnd() & 31);
            if (iabs(dx) < 50) e->state = S_KWIND; else if (iabs(dy) < 8 && r < 2) { e->state = S_TELE; } else e->state = S_FIRE;
        }
        break; }
    case S_TELE: e->flash = (e->t & 4) ? 2 : 0; if (e->t > 30) { e->flash = 0; e->state = S_CHARGE; e->t = 0; sfxTone(200, 6, 20); } break;
    case S_CHARGE:
        e->x += e->facing * 4;
        if (iabs(P.x - e->x) < 22 && iabs(dy) < 10 && P.z < 16) hurtPlayer(3, e->facing, 1);
        if (e->x <= L || e->x >= R || e->t > 120) { e->x = clampi(e->x, L, R); e->state = S_WALK; e->t = 0; SFX_BIG(); }
        break;
    case S_KWIND: if (e->t > 10) { e->state = S_KICK; e->t = 0; SFX_SWING(); } break;
    case S_KICK: if (e->t == 4 && dx * e->facing > -4 && dx * e->facing < 54 && iabs(dy) < 10 && P.z < 18) hurtPlayer(3, e->facing, 1);
        if (e->t > 22) { e->state = S_WALK; e->t = 0; } break;
    case S_FIRE: // shoulder-cannon blast: long reach along the row
        if (e->t == 14) { sfxTone(1200, -60, 14); if (dx * e->facing > 0 && dx * e->facing < 150 && iabs(dy) < 8 && P.z < 24) hurtPlayer(2, e->facing, 0); }
        if (e->t > 30) { e->state = S_WALK; e->t = 0; } break;
    case S_HURT: if (e->t > 10) { e->state = S_WALK; e->t = 0; } break;
    case S_DOWN:
        if (e->z > 0 || e->vz > 0) { e->z += e->vz; if (e->t & 1) e->vz--; e->x += e->vx; if (e->z <= 0) { e->z = 0; e->vz = 0; e->vx = 0; } }
        if (e->t > 60) { if (e->hp <= 0) { e->state = S_DEAD; e->t = 0; } else { e->state = S_WALK; e->t = 0; e->cool = 20; } }
        break;
    case S_DEAD: e->flash = e->t; if (e->t > 90) { killEnt(e); score += 500; phase = 3; bannerT = 0; musOn = 0; } return;
    }
    e->x = clampi(e->x, camX - 60, camX + W + 60); e->y = clampi(e->y, FLOOR_TOP, FLOOR_BOT);
}
static void animBoss(Ent* e) {
    s16 a = R_IDLE, f = 0;
    switch (e->state) {
    case S_ENTER: case S_WALK: a = R_WALK; f = (e->t >> 4) & 1; break;
    case S_TELE: case S_CHARGE: a = R_CHARGE; break;
    case S_KWIND: a = R_IDLE; break;
    case S_KICK: a = R_KICK; break;
    case S_FIRE: a = R_FIRE; break;
    case S_HURT: a = R_HURT; break;
    case S_DOWN: case S_DEAD: a = R_DOWN; break;
    }
    SPR_setAnimAndFrame(e->spr, a, f);
}

// ---------- scenes ----------
static void waitStart(void) { // title screen
    VDP_clearPlane(BG_A, TRUE); VDP_clearPlane(BG_B, TRUE); VDP_clearPlane(WINDOW, TRUE);
    VDP_setWindowVPos(FALSE, 0);
    VDP_setHorizontalScroll(BG_B, 0);
    PAL_setColors(0, palette_black, 64, DMA);
    VDP_drawImageEx(BG_B, &title_img, TILE_ATTR_FULL(PAL0, FALSE, FALSE, FALSE, TILE_USER_INDEX), 0, 0, FALSE, DMA);
    PAL_fadeIn(0, 15, title_img.palette->data, 30, FALSE);
    VDP_setTextPalette(PAL0); VDP_setTextPlane(BG_A);
    VDP_drawText("LEVEL 1: THE BURNING LOBBY", 7, 23);
    u16 t = 0; joyPrev = 0xFFFF;
    while (1) {
        joy = JOY_readJoypad(JOY_1);
        if ((t >> 4) & 1) VDP_drawText("PRESS START", 14, 25); else VDP_clearText(14, 25, 11);
        if ((joy & ~joyPrev) & (BUTTON_START | BUTTON_A | BUTTON_B | BUTTON_C)) break;
        joyPrev = joy; t++; rnd(); soundTick(); SYS_doVBlankProcess();
    }
    sfxTone(600, 40, 14);
    PAL_fadeOutAll(20, FALSE);
}
static void startGame(void) {
    VDP_clearPlane(BG_A, TRUE); VDP_clearPlane(BG_B, TRUE);
    PAL_setColors(0, palette_black, 64, DMA);
    bgBase = TILE_USER_INDEX + 8;
    VDP_loadTileData(T_SOLID, TILE_BAR, 1, DMA); VDP_loadTileData(T_FULL, TILE_BAR + 1, 1, DMA);
    VDP_loadTileData(T_HALF, TILE_BAR + 2, 1, DMA); VDP_loadTileData(T_EMPTY, TILE_BAR + 3, 1, DMA);
    VDP_loadTileSet(&bg_tiles, bgBase, DMA);
    bgMap = MAP_create(&bg_map, BG_B, TILE_ATTR_FULL(0, FALSE, FALSE, FALSE, bgBase));
    camX = 0; MAP_scrollTo(bgMap, 0, 0);
    // HUD on the window plane (top 2 rows)
    VDP_setWindowVPos(FALSE, 2); VDP_setTextPlane(WINDOW); VDP_setTextPalette(PAL0);
    VDP_fillTileMapRect(WINDOW, TILE_ATTR_FULL(PAL0, TRUE, FALSE, FALSE, TILE_BAR), 0, 0, 40, 2);
    VDP_drawTextBG(WINDOW, "LENNY", 1, 0);
    memset(&P, 0, sizeof(P)); memset(E, 0, sizeof(E));
    P.type = 255; P.x = 60; P.y = 185; P.facing = 1; P.maxHp = P.hp = 24; P.cellW = 80; P.cellH = 64; P.state = S_WALK;
    P.spr = SPR_addSprite(&spr_lenny, 0, 0, TILE_ATTR(PAL2, FALSE, FALSE, FALSE)); spinDefOn = 0;
    lives = 2; score = 0; pAtkT = pCombo = pComboT = pInv = pSpinT = pJumpAtk = pDeadT = 0;
    phase = 0; spawnIdx = 0; spawnT = 60; killCount = 0; bannerT = 0;
    hudHp = hudLives = hudScore = -1; hudBoss = -2;
    u16 pal[64]; memcpy(pal, bg_pal.data, 32 * 2); memcpy(pal + 32, spr_lenny.palette->data, 16 * 2); memcpy(pal + 48, spr_ramrod.palette->data, 16 * 2);
    setSpr(&P); animPlayer(); SPR_update();
    PAL_fadeInAll(pal, 20, FALSE);
    musOn = 1; musBoss = 0; musStep = 0; musT = 0;
}
static void endGame(void) {
    for (u8 i = 0; i < MAXE; i++) if (E[i].on) killEnt(&E[i]);
    if (P.spr) { SPR_releaseSprite(P.spr); P.spr = NULL; }
    SPR_update(); musOn = 0;
    PAL_fadeOutAll(30, FALSE);
    MAP_release(bgMap); bgMap = NULL;
    VDP_clearPlane(BG_A, TRUE); VDP_clearPlane(WINDOW, TRUE); VDP_setTextPlane(BG_A);
}
static u8 alive(void) { u8 n = 0; for (u8 i = 0; i < MAXE; i++) if (E[i].on) n++; return n; }

static void gameLoop(void) {
    joyPrev = 0xFFFF;
    while (1) {
        joy = JOY_readJoypad(JOY_1);
        if ((joy & ~joyPrev) & BUTTON_START && phase < 3) {
            paused ^= 1; if (paused) { VDP_drawTextBG(BG_A, "PAUSED", 17, 12); musOn = 0; } else { VDP_clearTextBG(BG_A, 17, 12, 6); musOn = 1; }
        }
        if (paused) { joyPrev = joy; soundTick(); SYS_doVBlankProcess(); continue; }
        updatePlayer();
        for (u8 i = 0; i < MAXE; i++) if (E[i].on) { if (E[i].type == T_BOSS) updateBoss(&E[i]); else updatePunk(&E[i]); }
        // flow
        if (phase == 0) {
            if (spawnT) spawnT--;
            if (!spawnT && spawnIdx < WAVE_N && alive() < 3) { spawnEnemy(WAVE[spawnIdx], (spawnIdx % 3) != 2); spawnIdx++; spawnT = 70; }
            if (spawnIdx >= WAVE_N && alive() == 0) { phase = 1; bannerT = 0; }
        } else if (phase == 1) {
            bannerT++;
            s16 want = clampi(P.x - 120, 0, LEVEL_W - W); if (want > camX) camX += (want - camX > 2) ? 2 : want - camX;
            if (camX >= LEVEL_W - W) { phase = 2; VDP_clearTextBG(BG_A, 30, 10, 8); spawnEnemy(T_BOSS, 1); musBoss = 1; musStep = 0; bannerT = 0; }
        } else if (phase == 2) { bannerT++; }
        else if (phase >= 3) {
            bannerT++;
            if (bannerT == 1) VDP_drawTextBG(BG_A, phase == 3 ? "STAGE CLEAR!" : " GAME OVER ", 14, 11);
            if (bannerT == 30 && phase == 3) VDP_drawTextBG(BG_A, "THANKS FOR PLAYING", 11, 13);
            if (bannerT > 240 || (bannerT > 60 && ((joy & ~joyPrev) & BUTTON_START))) return;
        }
        if (phase == 1) { if ((bannerT >> 4) & 1) VDP_drawTextBG(BG_A, "GO! -->", 31, 10); else VDP_clearTextBG(BG_A, 31, 10, 7); }
        if (phase == 2 && bannerT < 120) { if ((bannerT >> 3) & 1) VDP_drawTextBG(BG_A, "WARNING: RAMROD!", 12, 6); else VDP_clearTextBG(BG_A, 12, 6, 16); }
        if (phase == 2 && bannerT == 120) VDP_clearTextBG(BG_A, 12, 6, 16);
        MAP_scrollTo(bgMap, camX, 0);
        setSpr(&P); animPlayer();
        for (u8 i = 0; i < MAXE; i++) if (E[i].on) { setSpr(&E[i]); if (E[i].type == T_BOSS) animBoss(&E[i]); else animPunk(&E[i]); }
        hud();
        SPR_update();
        joyPrev = joy; soundTick();
        SYS_doVBlankProcess();
    }
}

int main(bool hard) {
    VDP_setScreenWidth320();
    JOY_init();
    SPR_initEx(480);
    PSG_reset();
    while (1) {
        waitStart();
        startGame();
        gameLoop();
        endGame();
    }
    return 0;
}
