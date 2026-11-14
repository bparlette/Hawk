import { Player } from './Player.js';
import { Enemy } from './Enemy.js';
import { Ball } from './Ball.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        this.isRunning = false;
        this.lastTime = 0;

        // Level Configuration - 5 Floors
        // Canvas height is 600. 
        // Floors at: 550, 440, 330, 220, 110
        this.floors = [550, 440, 330, 220, 110];

        // Ladders (1-2 per floor)
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

        this.score = 0;
        this.lives = 3;

        // Input Handling
        const handleInput = (e) => {
            if (this.isRunning) {
                e.preventDefault(); // Prevent default touch actions (scrolling/zooming)
                this.player.handleInput('click');
            }
        };

        window.addEventListener('mousedown', handleInput);
        window.addEventListener('touchstart', handleInput, { passive: false });
    }

    start() {
        this.isRunning = true;
        this.lastTime = performance.now();
        this.gameLoop(this.lastTime);

        // Spawn enemies
        this.spawnEnemy();
        setInterval(() => this.spawnEnemy(), 2500);
    }

    spawnEnemy() {
        if (!this.isRunning) return;
        const floorIdx = Math.floor(Math.random() * this.floors.length);
        const x = -30; // Spawn on left
        this.enemies.push(new Enemy(this, x, this.floors[floorIdx], floorIdx));
    }

    update(deltaTime) {
        this.player.update(deltaTime);
        this.ball.update(deltaTime);

        this.enemies.forEach((enemy, index) => {
            enemy.update(deltaTime);
            if (enemy.markedForDeletion) {
                this.enemies.splice(index, 1);
            }
        });

        if (this.lives <= 0) {
            this.isRunning = false;
            alert("GAME OVER! Score: " + this.score);
            location.reload();
        }
    }

    draw() {
        // Clear screen
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw Floors
        this.ctx.fillStyle = '#4488aa';
        this.floors.forEach(y => {
            this.ctx.fillRect(0, y, this.width, 10);
        });

        // Draw Ladders
        this.ctx.fillStyle = '#aa4444';
        this.ladders.forEach(ladder => {
            const floorY = this.floors[ladder.floorIdx];
            this.ctx.fillRect(ladder.x, floorY - 110, 40, 120);

            // Rungs
            this.ctx.fillStyle = '#ffaaaa';
            for (let i = 0; i < 8; i++) {
                this.ctx.fillRect(ladder.x + 5, floorY - 110 + (i * 14), 30, 4);
            }
            this.ctx.fillStyle = '#aa4444';
        });

        this.player.draw(this.ctx);
        this.ball.draw(this.ctx);
        this.enemies.forEach(enemy => enemy.draw(this.ctx));
    }

    gameLoop(timestamp) {
        if (!this.isRunning) return;

        const deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw();

        requestAnimationFrame(t => this.gameLoop(t));
    }
}
