export class Ball {
    constructor(game) {
        this.game = game;
        this.radius = 6;
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.state = 'HELD'; // HELD, AIR, HIT
        this.gravity = 800;
        this.trail = []; // recent positions for the motion trail (feel kit)
    }

    update(dt) {
        if (this.state === 'HELD') {
            // Follow player
            this.x = this.game.player.x + (this.game.player.facing === 1 ? 25 : 5);
            this.y = this.game.player.y + 25;
            this.trail.length = 0;
        } else {
            // Physics
            this.vy += this.gravity * dt;
            this.x += this.vx * dt;
            this.y += this.vy * dt;

            // Trail history (newest first, capped)
            this.trail.unshift({ x: this.x, y: this.y });
            if (this.trail.length > 14) this.trail.pop();

            // Bounce off walls
            if (this.x < 0 || this.x > this.game.width) {
                this.vx *= -0.8;
                this.x = this.x < 0 ? 0 : this.game.width;
            }

            // Reset if falls off screen
            if (this.y > this.game.height) {
                this.reset();
            }
        }
    }

    toss(x, y) {
        this.state = 'AIR';
        this.x = x;
        this.y = y;
        this.vx = 0; // Straight up and down
        this.vy = -550; // Higher toss
        this.trail.length = 0;
        this.game.sound.toss();
    }

    checkHit(player) {
        // Check distance to player bat swing area
        // Expanded hit range since it's "always hittable"
        const dx = this.x - (player.x + player.width / 2);
        const dy = this.y - (player.y + player.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Allow hitting as long as it's somewhat close horizontally and on screen
        const horizontalDist = Math.abs(this.x - (player.x + 15));

        if (horizontalDist < 50 && this.y < this.game.height) {
            this.state = 'HIT';

            // Calculate trajectory based on height relative to player
            const relativeY = this.y - player.y;
            let angleY = 0;

            if (relativeY < 0) {
                // High hit -> Up
                angleY = -450;
            } else if (relativeY > 50) {
                // Low hit -> Down
                angleY = 450;
            } else {
                // Mid -> Straightish
                angleY = -50;
            }

            this.vx = -900; // Always hit left fast
            this.vy = angleY;
        }
    }

    reset() {
        this.state = 'HELD';
        this.vx = 0;
        this.vy = 0;
        this.trail.length = 0;
    }

    draw(ctx) {
        // Motion trail — fading ghosts behind the ball; longer/streakier at HIT speed
        if (this.state !== 'HELD' && this.trail.length > 1) {
            for (let i = this.trail.length - 1; i >= 2; i -= 2) {
                const p = this.trail[i];
                const f = 1 - i / this.trail.length;
                ctx.beginPath();
                ctx.arc(p.x, p.y, this.radius * (0.35 + 0.55 * f), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${0.20 * f})`;
                ctx.fill();
                ctx.closePath();
            }
            if (this.state === 'HIT') {
                // speed lines trailing to the right (ball screams left)
                ctx.strokeStyle = 'rgba(255,255,255,0.45)';
                ctx.lineWidth = 2;
                for (let j = 0; j < 3; j++) {
                    const yy = this.y - 4 + j * 4;
                    ctx.beginPath();
                    ctx.moveTo(this.x + 10 + j * 7, yy);
                    ctx.lineTo(this.x + 34 + j * 11, yy);
                    ctx.stroke();
                }
            }
        }

        // Ball body with a soft shadow + red seams, like a real baseball
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.closePath();
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.strokeStyle = 'rgba(210,40,40,0.85)';
        ctx.lineWidth = 1.2;
        const rot = this.x * 0.04;
        for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(this.x + s * this.radius * 0.95, this.y + Math.sin(rot) * 1.5, this.radius * 0.75, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }
}
