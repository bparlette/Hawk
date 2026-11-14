export class Enemy {
    constructor(game, x, y, floorIdx) {
        this.game = game;
        this.x = x;
        this.y = y - 50; // On top of floor
        this.width = 30;
        this.height = 50;
        this.floorIdx = floorIdx;

        this.speed = 60;
        this.state = 'WALK'; // WALK, CLIMB, DIZZY, FALL
        this.dizzyTimer = 0;
        this.markedForDeletion = false;

        this.color = '#ff0000';
        this.frameTimer = 0;
        this.frame = 0;
    }

    update(dt) {
        if (this.state === 'WALK' || this.state === 'CLIMB') {
            const playerFloor = this.game.player.floorIdx;

            // Horizontal Movement
            if (this.state === 'WALK') {
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
                this.game.lives--;
                document.getElementById('lives').innerText = `LIVES: ${this.game.lives}`;
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

            // Check if hit bottom
            if (this.y > this.game.height) {
                this.markedForDeletion = true;
                this.game.score += 100;
                document.getElementById('score').innerText = `SCORE: ${this.game.score}`;
            }
        }
    }

    checkLadder() {
        const center = this.x + this.width / 2;
        return this.game.ladders.find(l =>
            l.floorIdx === this.floorIdx && // Ladder starts on this floor
            Math.abs(center - (l.x + 20)) < 5 // Close to center of ladder
        );
    }

    checkBallCollision() {
        const ball = this.game.ball;
        if (ball.state === 'HIT') {
            // Simple AABB
            if (ball.x > this.x && ball.x < this.x + this.width &&
                ball.y > this.y && ball.y < this.y + this.height) {
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
        this.color = '#ff00ff'; // Flash color
    }

    draw(ctx) {
        // NeoGeo Style Baseball Player Sprite (Simplified)
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.state === 'DIZZY') {
            ctx.translate(Math.sin(Date.now() / 50) * 5, 0); // Wobble
        }

        // Colors
        const uniformColor = '#cc0000'; // Red uniform for enemies
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
    }
}
