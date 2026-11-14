import { Player } from './Player.js';
import { Enemy } from './Enemy.js';
import { Ball } from './Ball.js';
import { Sound } from './Sound.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        this.isRunning = false;
        this.loopActive = false;
        this.lastTime = 0;
        this.elapsed = 0;

        // Level Configuration - 5 Floors (unchanged from the original)
        // Canvas height is 600.
        // Floors at: 550, 440, 330, 220, 110
        this.floors = [550, 440, 330, 220, 110];

        // Ladders (1-2 per floor) — unchanged
        this.ladders = [
            { x: 200, floorIdx: 0, height: 110 },
            { x: 600, floorIdx: 0, height: 110 },
            { x: 400, floorIdx: 1, height: 110 },
            { x: 150, floorIdx: 2, height: 110 },
            { x: 650, floorIdx: 2, height: 110 },
            { x: 300, floorIdx: 3, height: 110 }
        ];

        this.player = new Player(this);
        this.ball = new Ball(this);
        this.enemies = [];
        this.sound = new Sound();

        this.score = 0;
        this.lives = 3;

        // ---- pacing (improvement): spawn interval + enemy speed ramp ----
        this.spawnTimer = 0;

        // ---- feel kit state (measured recipes, see feel-study/FEEL.md) ----
        this.hitStop = 0;        // seconds of frozen world on impact (0.09 bat, 0.12 life)
        this.trauma = 0;         // camera shake trauma 0..1, offsets go as trauma²
        this.punchT = 0;         // camera punch-in timer (+7% zoom, ~0.22 s)
        this.flashA = 0;         // white/red flash alpha
        this.flashColor = '#ffffff';
        this.pops = [];          // floating score popups

        // ---- stadium dressing (precomputed, static) ----
        this.crowd = [];
        const crowdColors = ['#e8c39e', '#c96f4a', '#7fb2d9', '#d9d9d9', '#a3d9a5', '#e88ca0', '#f2e394'];
        for (let y = 18; y <= 88; y += 9) {
            for (let x = 6; x < 800; x += 7) {
                this.crowd.push({
                    x: x + (Math.random() * 4 - 2),
                    y: y + (Math.random() * 3 - 1.5),
                    r: 1.5 + Math.random() * 1.2,
                    c: crowdColors[Math.floor(Math.random() * crowdColors.length)],
                    a: 0.35 + Math.random() * 0.45
                });
            }
        }
        this.trackSpecks = [];
        for (let i = 0; i < 130; i++) {
            this.trackSpecks.push({ x: Math.random() * 800, y: 562 + Math.random() * 36, r: Math.random() * 1.8 + 0.5 });
        }
        const fg = this.ctx.createLinearGradient(0, 0, 0, 12);
        fg.addColorStop(0, '#6f9dbd'); fg.addColorStop(1, '#40698c');
        this.floorGrad = fg;

        // Input Handling — ONE pointerdown listener (mouse + touch unified).
        // FIX (original bug): the original listened to mousedown AND touchstart;
        // on touch devices a single tap could fire both and toss+swing at once.
        const handleInput = (e) => {
            if (this.isRunning) {
                if (e.target && e.target.closest && e.target.closest('button')) return;
                e.preventDefault();
                this.player.handleInput('click');
            }
        };
        window.addEventListener('pointerdown', handleInput);
    }

    // Difficulty ramp 0→1 over ~100 s of play
    ramp() { return Math.min(1, this.elapsed / 100); }
    spawnInterval() { return 2.5 - (2.5 - 1.15) * this.ramp(); }  // 2.5 s → 1.15 s
    enemySpeedScale() { return 1 + 0.55 * this.ramp(); }           // 60 → ~93 px/s

    reset() {
        this.score = 0;
        this.lives = 3;
        this.enemies = [];
        this.pops = [];
        this.elapsed = 0;
        this.spawnTimer = 0.4;
        this.hitStop = 0;
        this.trauma = 0;
        this.punchT = 0;
        this.flashA = 0;
        this.ball.reset();
        this.player.isSwinging = false;
        this.updateHUD();
    }

    start() {
        this.sound.init();
        this.reset();
        this.isRunning = true;
        this.lastTime = performance.now();
        this.sound.startJingle();
        if (!this.loopActive) {
            this.loopActive = true;
            requestAnimationFrame(t => this.gameLoop(t));
        }
    }

    spawnEnemy(floorIdx, x) {
        if (!this.isRunning) return null;
        const fi = (floorIdx === undefined) ? Math.floor(Math.random() * this.floors.length) : floorIdx;
        const ex = (x === undefined) ? -30 : x; // Spawn on left
        const e = new Enemy(this, ex, this.floors[fi], fi, this.enemySpeedScale());
        this.enemies.push(e);
        return e;
    }

    // ---- central event handlers (score / damage / juice) ----
    addScore(n, x, y) {
        this.score += n;
        this.pops.push({ x, y, text: '+' + n, t: 0, life: 0.9 });
        this.sound.score();
        this.updateHUD();
    }

    onEnemyHit(enemy) {
        this.sound.pop();
        this.hitStop = Math.max(this.hitStop, 0.045);
        this.trauma = Math.min(1, this.trauma + 0.22);
    }

    onBatHit() {
        this.sound.crack();
        this.hitStop = Math.max(this.hitStop, 0.09);   // measured hit-stop default
        this.punchT = 0.22;                             // camera punch +7%
        this.trauma = Math.min(1, this.trauma + 0.30);
        this.flashA = Math.max(this.flashA, 0.30);
        this.flashColor = '#ffffff';
    }

    onEnemyReachedPlayer() {
        this.lives--;
        this.sound.sting();
        this.hitStop = Math.max(this.hitStop, 0.12);
        this.trauma = 0.95;                             // big shake on a lost life
        this.flashA = 0.38;
        this.flashColor = '#ff2a1a';
        this.updateHUD();
        if (this.lives <= 0) this.gameOver();
    }

    gameOver() {
        this.isRunning = false;
        const el = document.getElementById('gameover-screen');
        const fs = document.getElementById('final-score');
        if (fs) fs.innerText = `SCORE: ${this.score}`;
        if (el) el.style.display = 'block';
    }

    updateHUD() {
        const s = document.getElementById('score');
        const l = document.getElementById('lives');
        if (s) s.innerText = `SCORE: ${this.score}`;
        if (l) l.innerText = `LIVES: ${this.lives}`;
    }

    update(dt) {
        this.elapsed += dt;

        // Spawning lives in the loop now.
        // FIX (original bug): start() used a setInterval whose id was never
        // stored or cleared — restarts would have stacked spawners forever.
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnEnemy();
            this.spawnTimer = this.spawnInterval() * (0.85 + Math.random() * 0.3);
        }

        this.player.update(dt);
        this.ball.update(dt);

        for (const enemy of this.enemies) enemy.update(dt);
        // FIX (original bug): splice() inside forEach skipped the enemy after
        // every deleted one for a whole frame (stutter + missed updates).
        this.enemies = this.enemies.filter(e => !e.markedForDeletion);
    }

    fxUpdate(dt) {
        // Feel timers always run on real time, even while the world is frozen
        if (this.hitStop > 0) this.hitStop -= dt;
        this.trauma = Math.max(0, this.trauma - 0.9 * dt);       // measured decay ≈0.9/s
        if (this.punchT > 0) this.punchT -= dt;
        this.flashA = Math.max(0, this.flashA - 2.6 * dt);
        for (const p of this.pops) { p.t += dt; p.y -= 46 * dt; }
        this.pops = this.pops.filter(p => p.t < p.life);
    }

    drawBackground(ctx) {
        // Night sky / stadium glow
        const sky = ctx.createLinearGradient(0, 0, 0, this.height);
        sky.addColorStop(0, '#0b1026');
        sky.addColorStop(0.45, '#173a5e');
        sky.addColorStop(1, '#1d4e4a');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, this.width, this.height);

        // Floodlight glows
        for (const lx of [90, 710]) {
            const g = ctx.createRadialGradient(lx, 34, 4, lx, 34, 150);
            g.addColorStop(0, 'rgba(255,250,220,0.55)');
            g.addColorStop(0.25, 'rgba(255,244,200,0.16)');
            g.addColorStop(1, 'rgba(255,244,200,0)');
            ctx.fillStyle = g;
            ctx.fillRect(lx - 150, 0, 300, 190);
            ctx.fillStyle = '#fffbe8';
            ctx.fillRect(lx - 16, 26, 32, 12);
        }

        // The stands — crowd dots behind the top floor
        ctx.fillStyle = '#232a4a';
        ctx.fillRect(0, 0, this.width, 98);
        for (const d of this.crowd) {
            ctx.globalAlpha = d.a;
            ctx.fillStyle = d.c;
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Outfield wall
        const wall = ctx.createLinearGradient(0, 98, 0, 560);
        wall.addColorStop(0, '#17384f');
        wall.addColorStop(1, '#0f2c42');
        ctx.fillStyle = wall;
        ctx.fillRect(0, 98, this.width, 462);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        for (let x = 40; x < 800; x += 80) ctx.fillRect(x, 98, 2, 462);
        ctx.fillStyle = '#c9a227';
        ctx.fillRect(0, 98, this.width, 3);
        // faint distance marker, a little stadium charm
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.font = 'bold 44px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('375', 402, 190);
        ctx.textAlign = 'left';

        // Warning track below the bottom floor
        ctx.fillStyle = '#7a4b28';
        ctx.fillRect(0, 562, this.width, 38);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        for (const s of this.trackSpecks) {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = '#e8f4ff';
        ctx.fillRect(0, 560, this.width, 2); // chalk line
    }

    draw() {
        const ctx = this.ctx;
        ctx.save();

        // Camera: trauma shake (offsets ∝ trauma²) + punch-in zoom on bat contact
        const now = performance.now();
        const mag = this.trauma * this.trauma * 13;
        const ox = Math.sin(now * 0.091) * mag;
        const oy = Math.cos(now * 0.113) * mag * 0.7;
        let zoom = 1;
        if (this.punchT > 0) {
            const p = 1 - this.punchT / 0.22;         // 0→1
            zoom = 1 + 0.07 * Math.sin(Math.min(1, p) * Math.PI * 0.5) * (1 - p * 0.35);
        }
        const px = this.player.x + this.player.width / 2;
        const py = this.player.y + this.player.height / 2;
        ctx.translate(px + ox, py + oy);
        ctx.scale(zoom, zoom);
        ctx.translate(-px, -py);

        this.drawBackground(ctx);

        // Draw Ladders — rails + rungs (same red family as the original)
        this.ladders.forEach(ladder => {
            const floorY = this.floors[ladder.floorIdx];
            const top = floorY - 110;
            ctx.fillStyle = '#8e3a32';
            ctx.fillRect(ladder.x - 2, top, 44, 122);
            ctx.fillStyle = '#c1554a';
            ctx.fillRect(ladder.x, top, 6, 120);
            ctx.fillRect(ladder.x + 34, top, 6, 120);
            ctx.fillStyle = '#e6a58e';
            for (let i = 0; i < 8; i++) {
                ctx.fillRect(ladder.x + 6, top + 4 + (i * 14), 28, 4);
            }
        });

        // Draw Floors — steel ledges with a chalk top line (same geometry)
        this.floors.forEach(y => {
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(0, y + 9, this.width, 10); // drop shadow
            ctx.fillStyle = this.floorGrad;
            ctx.fillRect(0, y, this.width, 12);
            ctx.fillStyle = '#eaf6ff'; // chalk line
            ctx.fillRect(0, y, this.width, 3);
            ctx.fillStyle = 'rgba(10,25,40,0.55)';
            ctx.fillRect(0, y + 10, this.width, 2);
            ctx.fillStyle = 'rgba(10,25,40,0.5)';
            for (let x = 32; x < 800; x += 64) {
                ctx.beginPath();
                ctx.arc(x, y + 6, 1.6, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        this.player.draw(ctx);
        this.ball.draw(ctx);
        this.enemies.forEach(enemy => enemy.draw(ctx));

        // Score pops
        for (const p of this.pops) {
            const a = 1 - p.t / p.life;
            ctx.save();
            ctx.globalAlpha = a;
            ctx.font = 'bold 21px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(20,30,10,0.85)';
            ctx.strokeText(p.text, p.x, p.y);
            ctx.fillStyle = '#ffe066';
            ctx.fillText(p.text, p.x, p.y);
            ctx.restore();
        }
        ctx.textAlign = 'left';

        ctx.restore();

        // Impact flash (screen space, above the world)
        if (this.flashA > 0.005) {
            ctx.fillStyle = this.flashColor;
            ctx.globalAlpha = Math.min(0.4, this.flashA);
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.globalAlpha = 1;
        }
    }

    gameLoop(timestamp) {
        if (!this.isRunning) { this.loopActive = false; return; }

        // FIX: clamp dt — the original let a backgrounded tab teleport enemies
        const dt = Math.min(0.05, (timestamp - this.lastTime) / 1000 || 0.016);
        this.lastTime = timestamp;

        this.fxUpdate(dt);
        if (this.hitStop <= 0) this.update(dt); // world freezes during hit-stop
        this.draw();

        requestAnimationFrame(t => this.gameLoop(t));
    }
}
