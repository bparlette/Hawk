export class Enemy {
    constructor(game, x, y, floorIdx, speedScale = 1) {
        this.game = game;
        this.x = x;
        this.y = y - 50; // On top of floor
        this.width = 30;
        this.height = 50;
        this.floorIdx = floorIdx;

        this.speed = 60 * speedScale; // base 60, scaled by the game's difficulty ramp
        this.state = 'WALK'; // WALK, CLIMB, DIZZY, FALL
        this.dizzyTimer = 0;
        this.markedForDeletion = false;

        this.color = '#ff0000';
        this.frameTimer = 0;
        this.frame = 0;
        this.squashT = 0; // squash & stretch timer (feel kit: hit squash 1.31 × 0.69, spring back)
        this.prevCenter = this.x + this.width / 2;
    }

    update(dt) {
        if (this.squashT > 0) this.squashT = Math.max(0, this.squashT - dt);

        if (this.state === 'WALK' || this.state === 'CLIMB') {
            const playerFloor = this.game.player.floorIdx;

            // Horizontal Movement
            if (this.state === 'WALK') {
                this.prevCenter = this.x + this.width / 2;
                this.x += this.speed * dt; // Always move right towards player

                // Animation frame
                this.frameTimer += dt;
                if (this.frameTimer > 0.2) {
                    this.frame = (this.frame + 1) % 2;
                    this.frameTimer = 0;
                }

                // Check for ladders if we need to change floors
                if (this.floorIdx !== playerFloor) {
                    const ladder = this.checkLadder();
                    if (ladder) {
                        this.state = 'CLIMB';
                        this.x = ladder.x + 5; // Snap to ladder
                    }
                }
            }

            // Vertical Movement (Climbing)
            if (this.state === 'CLIMB') {
                const targetY = this.game.floors[playerFloor];
                const currentY = this.game.floors[this.floorIdx];

                if (currentY > targetY) {
                    this.y -= this.speed * dt; // Go Up
                } else {
                    this.y += this.speed * dt; // Go Down
                }

                // Check if reached next floor
                this.game.floors.forEach((floorY, idx) => {
                    if (idx !== this.floorIdx && Math.abs((this.y + this.height) - floorY) < 5) {
                        this.floorIdx = idx;
                        this.state = 'WALK';
                        this.y = floorY - this.height; // Snap to floor
                    }
                });
            }

            // Check collision with ball
            this.checkBallCollision();

            // Check collision with player (Game Over / Damage)
            if (this.x > this.game.player.x) {
                this.markedForDeletion = true;
                this.game.onEnemyReachedPlayer();
            }

        } else if (this.state === 'DIZZY') {
            this.dizzyTimer -= dt;
            if (this.dizzyTimer <= 0) {
                this.state = 'FALL';
            }

        } else if (this.state === 'FALL') {
            this.y += 250 * dt; // Fall faster

            // Check collision with other enemies (Domino effect)
            this.game.enemies.forEach(other => {
                if (other !== this && other.state === 'WALK') {
                    if (this.checkCollision(other)) {
                        other.hit();
                    }
                }
            });

            // Check if hit bottom — score is awarded centrally by the game
            if (this.y > this.game.height) {
                this.markedForDeletion = true;
                this.game.addScore(100, this.x + this.width / 2, this.game.height - 24);
            }
        }
    }

    checkLadder() {
        // FIX (original bug): the old test needed the enemy center within 5px of
        // the ladder center on a single frame — at low frame rates or higher
        // speeds the enemy stepped clean over the window and never climbed.
        // Now: did the center CROSS the ladder center this frame?
        const center = this.x + this.width / 2;
        return this.game.ladders.find(l => {
            if (l.floorIdx !== this.floorIdx) return false;
            const lc = l.x + 20;
            return (this.prevCenter - lc) * (center - lc) <= 0 && center !== this.prevCenter;
        });
    }

    checkBallCollision() {
        const ball = this.game.ball;
        if (ball.state === 'HIT') {
            // AABB, now with the ball's radius included (original tested the
            // center point only, so edge grazes that visually touch missed)
            if (ball.x + ball.radius > this.x && ball.x - ball.radius < this.x + this.width &&
                ball.y + ball.radius > this.y && ball.y - ball.radius < this.y + this.height) {
                this.hit();
                ball.vx *= -0.5; // Bounce ball off
                ball.state = 'AIR'; // Ball loses kill momentum
            }
        }
    }

    checkCollision(other) {
        return (this.x < other.x + other.width &&
            this.x + this.width > other.x &&
            this.y < other.y + other.height &&
            this.y + this.height > other.y);
    }

    hit() {
        if (this.state === 'DIZZY' || this.state === 'FALL') return;
        this.state = 'DIZZY';
        this.dizzyTimer = 1.0; // 1 second dizzy before fall
        this.color = '#ff00ff'; // Flash color (now actually used in draw)
        this.squashT = 0.5; // squash & stretch spring
        this.game.onEnemyHit(this);
    }

    draw(ctx) {
        // Soft contact shadow (not while falling through the air)
        if (this.state !== 'FALL') {
            ctx.fillStyle = 'rgba(0,0,0,0.30)';
            ctx.beginPath();
            ctx.ellipse(this.x + this.width / 2, this.y + this.height + 6, 18, 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // NeoGeo Style Baseball Player Sprite (Simplified) — same drawing, plus juice
        ctx.save();
        ctx.translate(this.x, this.y);

        // Squash & stretch around the feet (visual only — hitbox never changes)
        if (this.squashT > 0) {
            const p = 1 - this.squashT / 0.5; // 0 → 1 over the spring
            const ring = Math.exp(-3 * p) * Math.cos(p * 10);
            const sx = 1 + 0.31 * ring;  // starts at 1.31 (measured hit squash)
            const sy = 1 - 0.31 * ring;  // starts at 0.69, overshoots, rings down
            ctx.translate(this.width / 2, this.height);
            ctx.scale(sx, sy);
            ctx.translate(-this.width / 2, -this.height);
        }

        if (this.state === 'DIZZY') {
            ctx.translate(Math.sin(Date.now() / 50) * 5, 0); // Wobble
        }

        // Colors — flash magenta for the first beat of DIZZY (the original set
        // this.color on hit but never drew with it; now it reads)
        const uniformColor = (this.state === 'DIZZY' && this.dizzyTimer > 0.82) ? '#ff00ff' : '#cc0000'; // Red uniform for enemies
        const skinColor = '#ffccaa';

        // Body
        ctx.fillStyle = uniformColor;
        ctx.fillRect(5, 15, 20, 25);

        // Head
        ctx.fillStyle = skinColor;
        ctx.fillRect(8, 0, 14, 15);

        // Cap
        ctx.fillStyle = '#aa0000';
        ctx.fillRect(8, 0, 14, 5);
        ctx.fillRect(18, 0, 8, 5); // Bill of cap facing right

        // Legs (Animated)
        ctx.fillStyle = '#fff'; // White pants
        if (this.state === 'WALK' && this.frame === 0) {
            ctx.fillRect(5, 40, 8, 10); // Left leg
            ctx.fillRect(17, 40, 8, 10); // Right leg
        } else if (this.state === 'WALK' && this.frame === 1) {
            ctx.fillRect(5, 38, 8, 10); // Left leg up
            ctx.fillRect(17, 42, 8, 8); // Right leg down
        } else {
            ctx.fillRect(5, 40, 8, 10);
            ctx.fillRect(17, 40, 8, 10);
        }

        // Arms
        ctx.fillStyle = uniformColor;
        ctx.fillRect(10, 18, 15, 8); // Arms forward

        ctx.restore();

        // Dizzy stars circling the head
        if (this.state === 'DIZZY') {
            ctx.save();
            ctx.fillStyle = '#ffe066';
            const cx = this.x + 15, cy = this.y - 4;
            for (let i = 0; i < 3; i++) {
                const a = Date.now() / 180 + i * (Math.PI * 2 / 3);
                const sx = cx + Math.cos(a) * 13, sy = cy + Math.sin(a) * 4.5;
                ctx.beginPath();
                for (let k = 0; k < 8; k++) {
                    const ang = k * Math.PI / 4, r = k % 2 === 0 ? 4 : 1.8;
                    const px = sx + Math.cos(ang) * r, py = sy + Math.sin(ang) * r;
                    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }
    }
}
