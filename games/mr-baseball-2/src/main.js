import { Game } from './Game.js';

window.addEventListener('load', () => {
    const canvas = document.getElementById('gameCanvas');
    const container = document.getElementById('game-container');
    const game = new Game(canvas);
    game.draw(); // paint the stadium once behind the start panel (original showed a black void)

    // Letterbox fit: scale the fixed 800×600 cabinet to the largest size
    // that fits the window (this is what the original lacked on phones —
    // its cabinet was hard-coded to 800×600 CSS pixels and overflowed).
    const fit = () => {
        const s = Math.min(window.innerWidth / 800, window.innerHeight / 600);
        container.style.transform = `translate(-50%, -50%) scale(${s})`;
    };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);

    // Handle start screen click
    const startScreen = document.getElementById('start-screen');
    const gameoverScreen = document.getElementById('gameover-screen');
    const restartBtn = document.getElementById('restart-btn');

    const startGame = () => {
        if (!game.isRunning) {
            game.start();
            startScreen.style.display = 'none';
            gameoverScreen.style.display = 'none';
        }
    };

    startScreen.addEventListener('click', startGame);
    restartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startGame();
    });

    // QA hook for headless verification (same pattern as our other games)
    window.__game = {
        game,
        get phase() { return game.isRunning ? 'playing' : (gameoverScreen.style.display !== 'none' ? 'over' : 'start'); },
        get score() { return game.score; },
        get lives() { return game.lives; },
        get enemyCount() { return game.enemies.length; },
        get ballState() { return game.ball.state; },
        ballPos: () => ({ x: Math.round(game.ball.x), y: Math.round(game.ball.y) }),
        playerPos: () => ({ x: game.player.x, y: game.player.y, floorIdx: game.player.floorIdx }),
        enemies: () => game.enemies.map(e => ({ x: Math.round(e.x), y: Math.round(e.y), state: e.state, floorIdx: e.floorIdx })),
        start: () => startGame(),
        tap: () => game.player.handleInput('click'),
        spawnOn: (floorIdx, x) => { const e = game.spawnEnemy(floorIdx, x); return !!e; },
        setLives: (n) => { game.lives = n; game.updateHUD(); }
    };
});
