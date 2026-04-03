// Game Constants
const GRID_SIZE = 20;
const CANVAS_SIZE = 400; 
const TILE_COUNT = CANVAS_SIZE / GRID_SIZE;
const BASE_SPEED = 8; 
const MAX_SPEED = 20;

// Asset Loading
const snakeHeadImg = new Image();
snakeHeadImg.src = 'snake-head.png'; // Replace with your icon path

// Audio Context setup
let audioCtx;

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'eat') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'die') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.4);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    } else if (type === 'levelUp') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.setValueAtTime(450, audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    }
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// DOM Elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const screens = {
    start: document.getElementById('start-screen'),
    game: document.getElementById('game-screen'),
    gameOver: document.getElementById('game-over-screen')
};
const ui = {
    score: document.getElementById('score'),
    level: document.getElementById('level'),
    highScore: document.getElementById('high-score'),
    finalScore: document.getElementById('final-score'),
    finalLevel: document.getElementById('final-level'),
    pauseOverlay: document.getElementById('pause-overlay')
};
const btns = {
    start: document.getElementById('start-btn'),
    restart: document.getElementById('restart-btn')
};

// Game State
let state = {
    snake: [],
    food: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    nextVelocity: { x: 0, y: 0 },
    score: 0,
    level: 1,
    highScore: localStorage.getItem('neonSnakeHighScore') || 0,
    isPaused: false,
    isGameOver: false,
    lastRenderTime: 0,
    animFrameId: null,
    currentSpeed: BASE_SPEED
};

ui.highScore.textContent = state.highScore;

// Input Handling
window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }

    if (state.isGameOver || screens.start.classList.contains('active')) return;

    switch (e.key) {
        case 'ArrowUp':
            if (state.velocity.y === 0) state.nextVelocity = { x: 0, y: -1 };
            break;
        case 'ArrowDown':
            if (state.velocity.y === 0) state.nextVelocity = { x: 0, y: 1 };
            break;
        case 'ArrowLeft':
            if (state.velocity.x === 0) state.nextVelocity = { x: -1, y: 0 };
            break;
        case 'ArrowRight':
            if (state.velocity.x === 0) state.nextVelocity = { x: 1, y: 0 };
            break;
        case ' ':
            togglePause();
            break;
    }
});

btns.start.addEventListener('click', () => {
    initAudio();
    startGame();
});

btns.restart.addEventListener('click', () => {
    initAudio();
    startGame();
});

function switchScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function startGame() {
    state.snake = [
        { x: 10, y: 10 },
        { x: 10, y: 11 },
        { x: 10, y: 12 }
    ];
    state.velocity = { x: 0, y: -1 };
    state.nextVelocity = { x: 0, y: -1 };
    state.score = 0;
    state.level = 1;
    state.currentSpeed = BASE_SPEED;
    state.isGameOver = false;
    state.isPaused = false;
    ui.pauseOverlay.classList.add('hidden');
    
    updateHUD();
    spawnFood();
    switchScreen('game');
    
    if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
    state.lastRenderTime = performance.now();
    state.animFrameId = requestAnimationFrame(gameLoop);
}

function togglePause() {
    if (state.isGameOver) return;
    state.isPaused = !state.isPaused;
    
    if (state.isPaused) {
        ui.pauseOverlay.classList.remove('hidden');
    } else {
        ui.pauseOverlay.classList.add('hidden');
        state.lastRenderTime = performance.now();
        state.animFrameId = requestAnimationFrame(gameLoop);
    }
}

function gameOver() {
    state.isGameOver = true;
    cancelAnimationFrame(state.animFrameId);
    playSound('die');
    
    if (state.score > state.highScore) {
        state.highScore = state.score;
        localStorage.setItem('neonSnakeHighScore', state.highScore);
        ui.highScore.textContent = state.highScore;
    }
    
    ui.finalScore.textContent = state.score;
    ui.finalLevel.textContent = state.level;
    
    setTimeout(() => {
        switchScreen('gameOver');
    }, 500);
}

function spawnFood() {
    let newFood;
    while (true) {
        newFood = {
            x: Math.floor(Math.random() * TILE_COUNT),
            y: Math.floor(Math.random() * TILE_COUNT)
        };
        const onSnake = state.snake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
        if (!onSnake) break;
    }
    state.food = newFood;
}

function updateHUD() {
    ui.score.textContent = state.score;
    ui.level.textContent = state.level;
}

function gameLoop(currentTime) {
    if (state.isPaused || state.isGameOver) return;

    state.animFrameId = requestAnimationFrame(gameLoop);

    const secondsSinceLastRender = (currentTime - state.lastRenderTime) / 1000;
    const tickRate = 1 / state.currentSpeed;

    if (secondsSinceLastRender < tickRate) return;

    state.lastRenderTime = currentTime;
    update();
    draw();
}

function update() {
    state.velocity = state.nextVelocity;
    
    const head = { ...state.snake[0] };
    head.x += state.velocity.x;
    head.y += state.velocity.y;
    
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
        gameOver();
        return;
    }
    
    if (state.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        gameOver();
        return;
    }
    
    state.snake.unshift(head);
    
    if (head.x === state.food.x && head.y === state.food.y) {
        playSound('eat');
        state.score += 1;
        
        if (state.score % 5 === 0) {
            state.level += 1;
            state.currentSpeed = Math.min(MAX_SPEED, BASE_SPEED + (state.level - 1) * 1.5);
            playSound('levelUp');
            canvas.style.opacity = '0.5';
            setTimeout(() => canvas.style.opacity = '1', 100);
        }
        
        updateHUD();
        spawnFood();
    } else {
        state.snake.pop();
    }
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    // Draw Food
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff0055';
    ctx.fillStyle = '#ff0055';
    const pad = 2;
    ctx.beginPath();
    ctx.roundRect ? 
        ctx.roundRect(state.food.x * GRID_SIZE + pad, state.food.y * GRID_SIZE + pad, GRID_SIZE - pad * 2, GRID_SIZE - pad * 2, 4) : 
        ctx.rect(state.food.x * GRID_SIZE + pad, state.food.y * GRID_SIZE + pad, GRID_SIZE - pad * 2, GRID_SIZE - pad * 2);
    ctx.fill();
    
    // Draw Snake
    state.snake.forEach((segment, index) => {
        if (index === 0) {
            // --- DRAW HEAD ICON ---
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00ffcc';
            
            // Draw image if loaded, otherwise fallback to a colored circle
            if (snakeHeadImg.complete && snakeHeadImg.naturalWidth !== 0) {
                ctx.drawImage(
                    snakeHeadImg, 
                    segment.x * GRID_SIZE, 
                    segment.y * GRID_SIZE, 
                    GRID_SIZE, 
                    GRID_SIZE
                );
            } else {
                ctx.fillStyle = '#00ffcc';
                ctx.beginPath();
                ctx.arc(
                    segment.x * GRID_SIZE + GRID_SIZE / 2, 
                    segment.y * GRID_SIZE + GRID_SIZE / 2, 
                    GRID_SIZE / 2 - 1, 0, Math.PI * 2
                );
                ctx.fill();
            }
        } else {
            // --- DRAW BODY ---
            const opacity = Math.max(0.3, 1 - (index / state.snake.length));
            ctx.shadowBlur = 10 * opacity;
            ctx.shadowColor = '#00ffcc';
            ctx.fillStyle = `rgba(0, 255, 204, ${opacity})`;
            
            ctx.beginPath();
            if(ctx.roundRect) {
                ctx.roundRect(segment.x * GRID_SIZE + 1, segment.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2, 4);
            } else {
                ctx.rect(segment.x * GRID_SIZE + 1, segment.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
            }
            ctx.fill();
        }
    });
    
    ctx.shadowBlur = 0;
}
