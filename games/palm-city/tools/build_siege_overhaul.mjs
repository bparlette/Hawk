// build_siege_overhaul.mjs — Queue 4 Task 2: MOTEL SIEGE asset overhaul, round 2.
// Priority 1: People (side_player, side_cop, side_swat) -> 6x5 = 30-pose sheets (314x184 cells)
// with expressive #210f2e ink anatomy, true 8-frame walk, 4-frame climb, 3-frame push/pry,
// wind/punch/slam, rappel, jump, hurt/busted/down + frame-strip contact sheets.
// Priority 2: Room dressing & all 19 props over the picked Round-1 AFTER cutaway base.
// Usage: node tools/build_siege_overhaul.mjs
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CELL_W, CELL_H, COLS, ROWS, POSES, drawCharacterCell } from './siege_chars.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_SIEGE = path.join(ROOT, 'assets', 'siege');
const OUT = path.join(ROOT, 'shots', 'siege-overhaul');
const BEFORE = path.join(OUT, 'before');
const AFTER = path.join(OUT, 'after');
const TMP = '/tmp/siege_overhaul_png';
for (const d of [OUT, BEFORE, AFTER, TMP]) fs.mkdirSync(d, { recursive: true });

const cwebp = fs.existsSync('/opt/homebrew/bin/cwebp') ? '/opt/homebrew/bin/cwebp' : 'cwebp';
const siegeJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'siege.json'), 'utf8'));

// 1. Copy all 23 existing Round-1 AFTER / shipped siege assets untouched into before/
const ALL_FILES = fs.readdirSync(SRC_SIEGE).filter(f => f.endsWith('.webp')).sort();
for (const f of ALL_FILES) fs.copyFileSync(path.join(SRC_SIEGE, f), path.join(BEFORE, f));

const loadB64 = (f) => 'data:image/webp;base64,' + fs.readFileSync(path.join(BEFORE, f)).toString('base64');
const baseColorUrl = loadB64('motel_color.webp');
const baseNightUrl = loadB64('motel_night.webp');

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--no-sandbox'] });
const baker = await browser.newPage({ viewport: { width: 1884, height: 1105 } });

await baker.addScriptTag({
  type: 'module',
  content: `
    window.__drawCell = ${drawCharacterCell.toString()};
  `,
});

// Helper to bake a canvas in browser and save as transparent WebP
function saveWebp(dataUrl, outName, q = 90) {
  const png = path.join(TMP, outName.replace('.webp', '.png'));
  fs.writeFileSync(png, Buffer.from(dataUrl.split(',')[1], 'base64'));
  execFileSync(cwebp, ['-q', String(q), '-alpha_q', '100', png, '-o', path.join(AFTER, outName)], { stdio: 'ignore' });
}

// 2. Bake the 3 overhauled character sheets (6x5 = 30 poses, 1884x920) + frame strips
const charCode = `
  ${fs.readFileSync(path.join(ROOT, 'tools', 'siege_chars.mjs'), 'utf8')
    .replace(/export /g, '')}
  window.bakeChar = (role) => {
    const cv = document.createElement('canvas');
    cv.width = COLS * CELL_W; cv.height = ROWS * CELL_H;
    const g = cv.getContext('2d');
    POSES.forEach((pose, idx) => {
      const col = idx % COLS, row = Math.floor(idx / COLS);
      g.save();
      g.beginPath(); g.rect(col * CELL_W, row * CELL_H, CELL_W, CELL_H); g.clip();
      drawCharacterCell(g, col * CELL_W + CELL_W / 2, row * CELL_H + 174, role, pose);
      g.restore();
    });
    return cv.toDataURL('image/png');
  };
  window.bakeStrip = (role) => {
    const groups = [
      ['WALK (8)', ['walk0','walk1','walk2','walk3','walk4','walk5','walk6','walk7']],
      ['IDLE / CLIMB (6)', ['idle','idle1','climbA','climbB','climb2','climb3']],
      ['PUSH / PRY (6)', ['push0','push1','push2','pry0','pry1','pry2']],
      ['ACTION / RAPPEL / KO (10)', ['wind','punch','slam','rappel0','rappel1','jump','jump1','hurt','busted','down']],
    ];
    const cw = 96, ch = 104, pad = 16, cv = document.createElement('canvas');
    cv.width = 1020; cv.height = groups.length * (ch + 38) + 54;
    const g = cv.getContext('2d');
    g.fillStyle = '#190d28'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#ffd45c'; g.font = '900 20px "Avenir Next", system-ui, sans-serif';
    g.fillText('MOTEL SIEGE — ' + role.toUpperCase() + ' ANIMATION STRIPS (30 POSES · 6×5)', pad, 30);
    let y = 50;
    for (const [title, list] of groups) {
      g.fillStyle = '#6ee2ff'; g.font = '800 13px "Avenir Next", system-ui, sans-serif';
      g.fillText(title, pad, y + 14);
      y += 20;
      list.forEach((p, i) => {
        const x = pad + i * (cw + 4);
        g.fillStyle = 'rgba(255,244,214,0.08)'; g.fillRect(x, y, cw, ch);
        g.strokeStyle = 'rgba(255,212,92,0.35)'; g.lineWidth = 1; g.strokeRect(x, y, cw, ch);
        const tmp = document.createElement('canvas'); tmp.width = CELL_W; tmp.height = CELL_H;
        drawCharacterCell(tmp.getContext('2d'), CELL_W / 2, 174, role, p);
        g.drawImage(tmp, 70, 38, 174, 146, x + 4, y + 4, cw - 8, ch - 22);
        g.fillStyle = '#fff1d8'; g.font = '700 10px "Avenir Next", system-ui, sans-serif';
        g.textAlign = 'center'; g.fillText(p, x + cw / 2, y + ch - 5); g.textAlign = 'left';
      });
      y += ch + 14;
    }
    return cv.toDataURL('image/png');
  };
`;
await baker.addScriptTag({ content: charCode });

for (const [role, file] of [['player', 'side_player.webp'], ['cop', 'side_cop.webp'], ['swat', 'side_swat.webp']]) {
  const sheetUrl = await baker.evaluate((r) => window.bakeChar(r), role);
  saveWebp(sheetUrl, file, 90);
  const stripUrl = await baker.evaluate((r) => window.bakeStrip(r), role);
  fs.writeFileSync(path.join(OUT, `strip_${role}.png`), Buffer.from(stripUrl.split(',')[1], 'base64'));
}

// 3. Overhaul motel_color.webp, motel_night.webp, and all 19 props over the picked Round-1 AFTER base
const propCode = `
window.bakeBuildingAndProps = async (baseColUrl, baseNightUrl) => {
  const INK = '#210f2e';
  const load = (u) => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; });
  const make = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const out = {};

  // ---- Overhauled motel_color (1664x1105): start from Round-1 AFTER, add room dressing & motel character
  {
    const base = await load(baseColUrl);
    const [c, g] = make(1664, 1105);
    g.drawImage(base, 0, 0);

    // Subtle striped wallpaper accents inside F1/F2 rooms
    g.save();
    g.globalCompositeOperation = 'soft-light';
    g.globalAlpha = 0.05;
    for (let x = 310; x < 1240; x += 18) {
      g.fillStyle = '#fff4de';
      g.fillRect(x, 350, 6, 215);
      g.fillRect(x, 600, 6, 210);
    }
    g.restore();

    // Helper: framed wall art
    const frameArt = (x, y, w, h, bg, accent) => {
      g.fillStyle = '#5a3222'; g.strokeStyle = INK; g.lineWidth = 2.6;
      g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h);
      g.fillStyle = bg; g.fillRect(x + 4, y + 4, w - 8, h - 8);
      g.fillStyle = accent; g.beginPath(); g.arc(x + w * 0.5, y + h * 0.45, Math.min(w, h) * 0.22, 0, 7); g.fill();
    };
    // Helper: bedside nightstand + shaded lamp
    const lampStand = (x, y) => {
      g.fillStyle = '#7a4a2e'; g.strokeStyle = INK; g.lineWidth = 2.4;
      g.fillRect(x - 14, y - 34, 28, 34); g.strokeRect(x - 14, y - 34, 28, 34);
      g.fillStyle = '#c89a64'; g.fillRect(x - 3, y - 50, 6, 16);
      g.fillStyle = '#ffdf9e';
      g.beginPath(); g.moveTo(x - 12, y - 48); g.lineTo(x + 12, y - 48); g.lineTo(x + 8, y - 64); g.lineTo(x - 8, y - 64); g.closePath();
      g.fill(); g.stroke();
    };
    // Helper: window drapes
    const drapes = (x, y, w, h, col) => {
      g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 2.4;
      g.fillRect(x - 12, y, 16, h); g.strokeRect(x - 12, y, 16, h);
      g.fillRect(x + w - 4, y, 16, h); g.strokeRect(x + w - 4, y, 16, h);
    };

    // F0 Lobby dressing: key rack, brass bell on check-in, palm art, VACANCY window sign, ice machine
    frameArt(476, 860, 44, 34, '#36a8b8', '#ffd45c');
    // Key rack behind check-in desk
    g.fillStyle = '#4e2c1e'; g.strokeStyle = INK; g.lineWidth = 2.4;
    g.fillRect(528, 864, 54, 40); g.strokeRect(528, 864, 54, 40);
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
      g.fillStyle = '#ffd45c'; g.beginPath(); g.arc(537 + k * 12, 876 + r * 16, 2.5, 0, 7); g.fill();
    }
    // Hallway Ice Machine (far right F0 hall, clear of vending trap)
    g.fillStyle = '#d4e2ea'; g.strokeStyle = INK; g.lineWidth = 2.8;
    g.fillRect(1146, 976, 52, 86); g.strokeRect(1146, 976, 52, 86);
    g.fillStyle = '#3c88b8'; g.fillRect(1152, 984, 40, 14);
    g.fillStyle = '#243040'; g.fillRect(1158, 1012, 28, 22);

    // F1 Room dressing: framed art, drapes, bedside lamps
    drapes(362, 654, 152, 96, '#d8586a');
    drapes(760, 654, 152, 96, '#4a9eb0');
    drapes(1022, 654, 152, 96, '#e2a64c');
    frameArt(530, 668, 38, 28, '#f0a672', '#288a78');
    frameArt(936, 668, 38, 28, '#8ec6e6', '#ff6e5a');
    lampStand(334, 816);
    lampStand(1214, 816);

    // F2 Top Suites: drapes, wall art, lamps, balcony railing planter
    drapes(424, 406, 152, 96, '#2ea49e');
    drapes(786, 406, 152, 96, '#4c7cb8');
    drapes(1062, 406, 152, 96, '#e07a50');
    frameArt(602, 418, 42, 30, '#ffd45c', '#e05060');
    lampStand(988, 570);
    // Roof AC ducting & vent pipe detail
    g.fillStyle = '#7e8496'; g.strokeStyle = INK; g.lineWidth = 2.8;
    g.fillRect(490, 294, 110, 20); g.strokeRect(490, 294, 110, 20);
    g.fillStyle = '#5a6070'; g.fillRect(510, 298, 24, 12);
    // Exterior balcony planter pot
    g.fillStyle = '#b85638'; g.strokeStyle = INK; g.lineWidth = 2.4;
    g.fillRect(1284, 548, 34, 22); g.strokeRect(1284, 548, 34, 22);
    g.fillStyle = '#4aa24a'; g.beginPath(); g.arc(1301, 542, 16, 0, 7); g.fill(); g.stroke();

    out['motel_color.webp'] = c.toDataURL('image/png');
  }

  // ---- Overhauled motel_night (1664x1105): start from Round-1 AFTER + warm bedside lamp pools & ice machine glow
  {
    const base = await load(baseNightUrl);
    const [c, g] = make(1664, 1105);
    g.drawImage(base, 0, 0);
    const pool = (x, y, r, col, a) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col + a + ')'); gr.addColorStop(1, col + '0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    };
    pool(334, 760, 78, 'rgba(255,212,120,', 0.65);
    pool(1214, 760, 78, 'rgba(255,212,120,', 0.65);
    pool(988, 514, 78, 'rgba(255,212,120,', 0.65);
    pool(802, 991, 64, 'rgba(110,226,255,', 0.0);
    pool(1172, 991, 64, 'rgba(110,226,255,', 0.55); // ice machine glow
    out['motel_night.webp'] = c.toDataURL('image/png');
  }

  // Helper for painted props
  const prop = (name, w, h, fn) => {
    const [c, g] = make(w, h);
    fn(g, w, h);
    out[name] = c.toDataURL('image/png');
  };
  const rectInk = (g, x, y, w, h, fill, lw = 2.8) => {
    g.fillStyle = fill; g.fillRect(x, y, w, h);
    g.strokeStyle = INK; g.lineWidth = lw; g.strokeRect(x, y, w, h);
  };

  // Barricades (4)
  prop('barricade_desk_intact.webp', 96, 64, (g) => {
    rectInk(g, 4, 8, 88, 12, '#b67444', 3); // top
    rectInk(g, 10, 20, 14, 40, '#8a522c', 2.6);
    rectInk(g, 72, 20, 14, 40, '#8a522c', 2.6);
    rectInk(g, 24, 20, 48, 22, '#9e6236', 2.6);
    g.fillStyle = '#ffd45c'; g.fillRect(38, 12, 8, 6); // brass bell
    g.fillStyle = '#70d4e0'; g.fillRect(58, 25, 10, 5); // drawer pull
  });
  prop('barricade_desk_damaged.webp', 96, 64, (g) => {
    g.save(); g.translate(48, 40); g.rotate(-0.08); g.translate(-48, -40);
    rectInk(g, 6, 12, 82, 11, '#9e6036', 3);
    rectInk(g, 12, 23, 13, 37, '#764424', 2.6);
    rectInk(g, 70, 23, 13, 37, '#764424', 2.6);
    g.strokeStyle = INK; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(36, 12); g.lineTo(44, 24); g.lineTo(38, 34); g.stroke();
    g.restore();
  });
  prop('barricade_dresser.webp', 64, 80, (g) => {
    rectInk(g, 6, 6, 52, 68, '#a46438', 3);
    for (let i = 0; i < 3; i++) {
      rectInk(g, 12, 14 + i * 19, 40, 15, '#c27e4c', 2.2);
      g.fillStyle = '#ffd45c'; g.beginPath(); g.arc(24, 21 + i * 19, 2.2, 0, 7); g.arc(40, 21 + i * 19, 2.2, 0, 7); g.fill();
    }
  });
  prop('barricade_mattress.webp', 88, 48, (g) => {
    g.fillStyle = '#f6ebd6'; g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.roundRect(4, 8, 80, 34, 8); g.fill(); g.stroke();
    g.fillStyle = '#e05872'; g.fillRect(8, 22, 72, 6); // coral stripe
    g.fillStyle = '#d4c2a8';
    for (let x = 18; x <= 70; x += 16) { g.beginPath(); g.arc(x, 16, 2, 0, 7); g.arc(x, 34, 2, 0, 7); g.fill(); }
  });

  // Traps (10)
  prop('trap_vend_intact.webp', 64, 80, (g) => {
    rectInk(g, 6, 4, 52, 72, '#d83b48', 3);
    rectInk(g, 12, 12, 30, 34, '#6ee2ff', 2.4); // glowing soda window
    g.fillStyle = '#ff6e5a'; g.fillRect(16, 16, 8, 10);
    g.fillStyle = '#ffd45c'; g.fillRect(28, 16, 8, 10);
    g.fillStyle = '#7dffa8'; g.fillRect(16, 30, 8, 10);
    rectInk(g, 12, 54, 40, 14, '#241a34', 2.2); // chute
  });
  prop('trap_vend_dropped.webp', 96, 64, (g) => {
    g.save(); g.translate(48, 42); g.rotate(1.42); g.translate(-32, -40);
    rectInk(g, 6, 4, 52, 72, '#b82f3c', 3);
    rectInk(g, 12, 12, 30, 34, '#3a6278', 2.4);
    g.restore();
    // spilled cans
    g.fillStyle = '#ffd45c'; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.arc(14, 54, 4, 0, 7); g.arc(82, 52, 4, 0, 7); g.fill(); g.stroke();
  });
  prop('trap_tv_intact.webp', 48, 48, (g) => {
    g.strokeStyle = INK; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(24, 14); g.lineTo(14, 4); g.moveTo(24, 14); g.lineTo(34, 4); g.stroke();
    rectInk(g, 6, 14, 36, 28, '#5a3a28', 2.8);
    rectInk(g, 10, 18, 22, 18, '#6ee2ff', 2);
    g.fillStyle = '#ffd45c'; g.beginPath(); g.arc(37, 23, 2.2, 0, 7); g.arc(37, 30, 2.2, 0, 7); g.fill();
  });
  prop('trap_tv_broken.webp', 56, 48, (g) => {
    g.save(); g.translate(28, 34); g.rotate(0.2); g.translate(-24, -28);
    rectInk(g, 6, 14, 36, 28, '#462c1e', 2.8);
    rectInk(g, 10, 18, 22, 18, '#1e202c', 2);
    g.strokeStyle = '#cfeefa'; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(12, 20); g.lineTo(28, 32); g.moveTo(26, 20); g.lineTo(14, 32); g.stroke();
    g.restore();
  });
  prop('trap_cart_intact.webp', 72, 64, (g) => {
    rectInk(g, 10, 18, 52, 34, '#8894a8', 2.8);
    rectInk(g, 16, 10, 22, 10, '#fff4de', 2); // folded towels
    rectInk(g, 40, 12, 14, 8, '#6ee2ff', 2);
    g.fillStyle = '#241a34'; g.strokeStyle = INK; g.lineWidth = 2.4;
    g.beginPath(); g.arc(18, 56, 5, 0, 7); g.arc(54, 56, 5, 0, 7); g.fill(); g.stroke();
  });
  prop('trap_cart_tipped.webp', 84, 56, (g) => {
    g.save(); g.translate(42, 34); g.rotate(-1.15); g.translate(-36, -32);
    rectInk(g, 10, 18, 52, 34, '#707c90', 2.8);
    g.restore();
    rectInk(g, 6, 40, 18, 8, '#fff4de', 2);
    rectInk(g, 62, 42, 14, 7, '#6ee2ff', 2);
  });
  prop('trap_fusebox_intact.webp', 40, 48, (g) => {
    rectInk(g, 6, 6, 28, 36, '#6e7888', 2.8);
    g.fillStyle = '#ffd45c'; g.beginPath(); g.moveTo(22, 12); g.lineTo(14, 24); g.lineTo(20, 24); g.lineTo(17, 36); g.lineTo(26, 22); g.lineTo(20, 22); g.closePath(); g.fill();
    g.fillStyle = '#7dffa8'; g.beginPath(); g.arc(28, 12, 2.5, 0, 7); g.fill();
  });
  prop('trap_fusebox_shorted.webp', 48, 56, (g) => {
    rectInk(g, 8, 8, 30, 38, '#3a3444', 2.8);
    g.fillStyle = '#ff6e5a'; g.beginPath(); g.arc(24, 26, 8, 0, 7); g.fill();
    g.strokeStyle = '#ffd45c'; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(6, 12); g.lineTo(16, 20); g.moveTo(42, 16); g.lineTo(32, 24); g.stroke();
  });
  prop('trap_ac_intact.webp', 56, 48, (g) => {
    rectInk(g, 6, 8, 44, 32, '#c8d2dc', 2.8);
    rectInk(g, 11, 13, 22, 22, '#5a6676', 2);
    g.strokeStyle = INK; g.lineWidth = 2;
    for (let y = 16; y <= 32; y += 5) { g.beginPath(); g.moveTo(36, y); g.lineTo(46, y); g.stroke(); }
  });
  prop('trap_ac_dropped.webp', 64, 56, (g) => {
    g.save(); g.translate(32, 34); g.rotate(0.28); g.translate(-28, -24);
    rectInk(g, 6, 8, 44, 32, '#929ca8', 2.8);
    rectInk(g, 11, 13, 22, 22, '#3a424e', 2);
    g.restore();
  });

  // Roof / Ladder / Neon Signage (4)
  prop('prop_ext_ladder.webp', 48, 144, (g) => {
    rectInk(g, 10, 4, 6, 136, '#b0bac8', 2.4);
    rectInk(g, 32, 4, 6, 136, '#b0bac8', 2.4);
    for (let y = 14; y <= 130; y += 16) rectInk(g, 12, y, 24, 4, '#d8e2ee', 2);
  });
  prop('prop_roof_hatch_closed.webp', 88, 32, (g) => {
    rectInk(g, 8, 14, 72, 14, '#5e566a', 2.8);
    rectInk(g, 4, 8, 80, 8, '#8a7a96', 2.8);
    g.fillStyle = '#ffd45c'; g.fillRect(68, 10, 8, 4);
  });
  prop('prop_roof_hatch_open.webp', 96, 88, (g) => {
    rectInk(g, 8, 66, 76, 16, '#5e566a', 2.8);
    g.save(); g.translate(12, 68); g.rotate(-1.15);
    rectInk(g, 0, -8, 68, 10, '#9a8aa8', 2.8);
    g.restore();
  });
  prop('prop_neon_motel_sign.webp', 192, 112, (g) => {
    rectInk(g, 84, 72, 24, 38, '#3e2d4c', 3); // steel post
    g.fillStyle = '#261436'; g.strokeStyle = INK; g.lineWidth = 3.5;
    g.beginPath(); g.roundRect(10, 10, 172, 66, 12); g.fill(); g.stroke();
    g.strokeStyle = '#6ee2ff'; g.lineWidth = 3;
    g.beginPath(); g.roundRect(16, 16, 160, 54, 9); g.stroke();
    g.fillStyle = '#ff5c9a'; g.font = '900 32px "Avenir Next", Futura, system-ui, sans-serif';
    g.textAlign = 'center'; g.fillText('MOTEL', 96, 48);
    g.fillStyle = '#ffd45c'; g.font = '800 12px "Avenir Next", Futura, system-ui, sans-serif';
    g.fillText('VACANCY', 96, 64);
  });

  return out;
};
`;
await baker.addScriptTag({ content: propCode });
const renderedProps = await baker.evaluate(({ c, n }) => window.bakeBuildingAndProps(c, n), { c: baseColorUrl, n: baseNightUrl });
for (const [name, url] of Object.entries(renderedProps)) {
  saveWebp(url, name, name.startsWith('motel_') ? 90 : 92);
}
await baker.close();

// 4. Render phone-size (420x860 @2x) side-by-side bake-off sheets using live SiegeRenderer + page.route()
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); r.end(); }
    else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }
  });
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const overhauledJson = JSON.parse(JSON.stringify(siegeJson));
for (const k of ['player', 'cop', 'swat']) {
  overhauledJson.peds[k].cols = COLS;
  overhauledJson.peds[k].poses = POSES;
}

async function captureSiegePhone(tod, useAfter, outPng) {
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  if (useAfter) {
    await page.route('**/assets/siege.json*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(overhauledJson) }));
    await page.route('**/assets/siege/*.webp*', route => {
      const name = path.basename(route.request().url().split('?')[0]);
      const p = path.join(AFTER, name);
      if (fs.existsSync(p)) return route.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(p) });
      return route.continue();
    });
  }
  await page.goto(`http://localhost:${port}/index.html?t=${tod}&dpr=2`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim);
  await page.waitForTimeout(3500);
  await page.evaluate(async () => {
    const { enterSiege } = await import('/src/siege.js');
    const s = window.__palm.sim;
    enterSiege(s);
    const sg = s.siege;
    sg.enterT = 1;
    sg.hero.x = -1.2; sg.hero.z = 0; sg.hero.surf = 'F0'; sg.hero.moving = true; sg.hero.walk = 0.45;
    sg.cops.push({ kind: 'cop', x: 0.9, z: 0, surf: 'F0', face: -1, walk: 0.25, st: 'walk', hp: 3 });
    sg.cops.push({ kind: 'swat', x: -1.8, z: sg.geo.S.floors[1], surf: 'F1', face: 1, walk: 0.15, st: 'walk', hp: 4 });
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: outPng });
  await page.close();
}

for (const [label, tod] of [['golden', 0.25], ['dusk', 0.85]]) {
  const bPng = path.join(TMP, `siege_before_${label}.png`);
  const aPng = path.join(TMP, `siege_after_${label}.png`);
  await captureSiegePhone(tod, false, bPng);
  await captureSiegePhone(tod, true, aPng);

  const comp = await browser.newPage({ viewport: { width: 920, height: 940 }, deviceScaleFactor: 1 });
  const bUrl = 'data:image/png;base64,' + fs.readFileSync(bPng).toString('base64');
  const aUrl = 'data:image/png;base64,' + fs.readFileSync(aPng).toString('base64');
  await comp.setContent(`
    <html><body style="margin:0;background:#160b24;font-family:'Avenir Next',system-ui,sans-serif;color:#fff4de;display:flex;flex-direction:column;align-items:center;padding:14px;">
      <div style="font-weight:900;font-size:18px;letter-spacing:1px;margin-bottom:10px;color:#ffd45c;">
        MOTEL SIEGE ROUND-2 OVERHAUL BAKE-OFF — ${label.toUpperCase()} (420×860 PHONE)
      </div>
      <div style="display:flex;gap:20px;align-items:flex-start;">
        <div style="text-align:center;">
          <div style="font-weight:800;font-size:13px;margin-bottom:6px;color:#ff9a8a;">BEFORE — Round-1 Picked AFTER + Stick Peds</div>
          <img src="${bUrl}" style="width:420px;height:860px;border:2px solid #523a68;border-radius:12px;display:block;"/>
        </div>
        <div style="text-align:center;">
          <div style="font-weight:800;font-size:13px;margin-bottom:6px;color:#7dffa8;">AFTER — 30-Pose People + Room & Prop Overhaul</div>
          <img src="${aUrl}" style="width:420px;height:860px;border:2px solid #ffd45c;border-radius:12px;display:block;"/>
        </div>
      </div>
    </body></html>
  `);
  await comp.waitForTimeout(300);
  await comp.screenshot({ path: path.join(OUT, `bakeoff-${label}-phone.png`), fullPage: true });
  await comp.close();
}

await browser.close();
server.close();
console.log('SIEGE ROUND-2 OVERHAUL BUILT:', OUT);
