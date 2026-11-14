import { Game } from './Game.js';

window.addEventListener('load', () => {
    const canvas = document.getElementById('gameCanvas');
    const game = new Game(canvas);

    // Handle start screen click
    const startScreen = document.getElementById('start-screen');

    const startGame = () => {
        if (!game.isRunning) {
            game.start();
            startScreen.style.display = 'none';
        }
    };

    startScreen.addEventListener('click', startGame);
});
