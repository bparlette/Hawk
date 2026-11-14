export class Player {
    constructor(game) {
        this.game = game;
        this.width = 30;
        this.height = 50;
        this.floorIdx = 2; // Middle floor (0-4, so 2 is middle)
        this.x = this.game.width - 80; // Far right
        this.y = this.game.floors[this.floorIdx] - this.height;

        this.facing = -1; // Always face left

        this.isSwinging = false;
        this.swingTimer = 0;
        this.swingDuration = 0.24; // tightened from 0.3 — snappier contact
    }

    update(dt) {
        // Swing Timer
        if (this.isSwinging) {
            this.swingTimer -= dt;
            if (this.swingTimer <= 0) {
                this.isSwinging = false;
            }
        }
    }

    handleInput(type) {
        if (type === 'click') {
            if (this.game.ball.state === 'HELD') {
                this.game.ball.toss(this.x + (this.facing * 20), this.y);
            } else if (this.game.ball.state === 'AIR') {
                this.swing();
            }
        }
    }

    swing() {
        this.isSwinging = true;
        this.swingTimer = this.swingDuration;
        this.game.sound.swing();
        // Check collision with ball — if the swing connects, the game juices it
        const before = this.game.ball.state;
        this.game.ball.checkHit(this);
        if (this.game.ball.state === 'HIT' && before !== 'HIT') {
            this.game.onBatHit();
        }
    }

    draw(ctx) {
        // Soft contact shadow on the floor
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2, this.y + this.height + 6, 20, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // NeoGeo Style Player Sprite (same drawing as the original)
        ctx.save();
        ctx.translate(this.x, this.y);

        // Facing flip (always left, so scale -1)
        ctx.translate(this.width, 0);
        ctx.scale(-1, 1);

        const uniformColor = '#0000cc'; // Blue uniform
        const skinColor = '#ffccaa';

        // Body
        ctx.fillStyle = uniformColor;
        ctx.fillRect(5, 15, 20, 25);

        // Head
        ctx.fillStyle = skinColor;
        ctx.fillRect(8, 0, 14, 15);

        // Cap
        ctx.fillStyle = '#0000aa';
        ctx.fillRect(8, 0, 14, 5);
        ctx.fillRect(18, 0, 8, 5); // Bill

        // Legs
        ctx.fillStyle = '#fff';
        ctx.fillRect(5, 40, 8, 10);
        ctx.fillRect(17, 40, 8, 10);

        // Arms & Bat
        if (this.isSwinging) {
            // Swing animation — accelerating sweep (slow cock-back, fast cut)
            ctx.save();
            ctx.translate(15, 20);
            const swingProgress = 1 - (this.swingTimer / this.swingDuration);
            const eased = Math.pow(swingProgress, 1.6);
            const angle = -Math.PI / 2 + (eased * Math.PI); // Start back, swing forward
            ctx.rotate(angle);

            // Arms
            ctx.fillStyle = uniformColor;
            ctx.fillRect(0, -5, 15, 10);

            // Bat
            ctx.fillStyle = '#d2b48c'; // Wood color
            ctx.fillRect(15, -8, 35, 6);
            ctx.restore();
        } else {
            // Holding bat (Idle)
            ctx.fillStyle = uniformColor;
            ctx.fillRect(10, 18, 10, 10); // Hands

            ctx.save();
            ctx.translate(15, 20);
            ctx.rotate(-Math.PI / 3); // Held back
            ctx.fillStyle = '#d2b48c';
            ctx.fillRect(0, -3, 35, 6);
            ctx.restore();
        }

        ctx.restore();

        // Swoosh arc trailing the bat (screen space, fades with the swing)
        if (this.isSwinging) {
            const p = 1 - (this.swingTimer / this.swingDuration);
            ctx.save();
            ctx.strokeStyle = `rgba(255,255,255,${0.38 * (1 - p)})`;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(this.x + 12, this.y + 16, 36, Math.PI * (0.95 - 0.75 * p), Math.PI * (1.75 - 0.75 * p));
            ctx.stroke();
            ctx.restore();
        }
    }
}
