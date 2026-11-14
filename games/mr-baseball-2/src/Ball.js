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
    }

    update(dt) {
        if (this.state === 'HELD') {
            // Follow player
            this.x = this.game.player.x + (this.game.player.facing === 1 ? 25 : 5);
            this.y = this.game.player.y + 25;
        } else {
            // Physics
            this.vy += this.gravity * dt;
            this.x += this.vx * dt;
            this.y += this.vy * dt;

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
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.closePath();
    }
}
