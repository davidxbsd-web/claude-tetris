'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
  '#ec407a', // Tuerca - rosa/magenta
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Tuerca (nut) - anillo con hueco central
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const powerupIndicator = document.getElementById('powerup-indicator');
const powerupNameEl = document.getElementById('powerup-name');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const resumeBtn = document.getElementById('resume-btn');
const restartBtn = document.getElementById('restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const startLevelSelect = document.getElementById('start-level');
const menuMain = document.getElementById('menu-main');
const menuControls = document.getElementById('menu-controls');
const themeToggleBtn = document.getElementById('theme-toggle');

const THEME_KEY = 'tetris-theme';
const START_LEVEL_KEY = 'tetris-start-level';
const MAX_START_LEVEL = 10;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let startLevel = 1;
let menuMode = null; // 'pause' | 'gameover' | null
let menuView = 'main'; // 'main' | 'controls'
let pauseStartedAt = 0;

const POWERUP_TYPES = ['bomb', 'laser', 'slow'];
const POWERUP_LABELS = { bomb: 'BOMBA', laser: 'LÁSER', slow: 'CÁMARA LENTA' };
const POWERUP_COLORS = { bomb: '#ff3d3d', laser: '#00e5ff', slow: '#b388ff' };
const POWERUP_LINE_INTERVAL = 5;
const BOMB_RADIUS = 1;
const SLOW_DURATION = 8000;
const SLOW_FACTOR = 2.2;
let nextPowerupAt, powerupQueued, slowUntil, powerupBag;

function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function nextPowerupType() {
  if (!powerupBag || powerupBag.length === 0) {
    powerupBag = shuffle(POWERUP_TYPES);
  }
  return powerupBag.pop();
}

function levelInterval(lv) {
  return Math.max(100, 1000 - (lv - 1) * 90);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

const NUT_TYPE = 8;
const NUT_CHANCE = 1 / 15;

function randomPiece() {
  let power = null;
  if (powerupQueued) {
    power = nextPowerupType();
    powerupQueued = false;
  }
  const type = Math.random() < NUT_CHANCE
    ? NUT_TYPE
    : Math.floor(Math.random() * (NUT_TYPE - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, power, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    registerLinesCleared(cleared);
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + startLevel;
    dropInterval = levelInterval(level);
    updateHUD();
  }
}

function registerLinesCleared(count) {
  lines += count;
  while (lines >= nextPowerupAt) {
    powerupQueued = true;
    nextPowerupAt += POWERUP_LINE_INTERVAL;
  }
}

function applyPowerup(power) {
  if (power === 'bomb') applyBomb();
  else if (power === 'laser') applyLaser();
  else if (power === 'slow') applySlow();
}

function applyBomb() {
  const cellsToClear = new Set();
  for (let r = 0; r < current.shape.length; r++) {
    for (let c = 0; c < current.shape[r].length; c++) {
      if (!current.shape[r][c]) continue;
      const bx = current.x + c, by = current.y + r;
      for (let dy = -BOMB_RADIUS; dy <= BOMB_RADIUS; dy++) {
        for (let dx = -BOMB_RADIUS; dx <= BOMB_RADIUS; dx++) {
          const nx = bx + dx, ny = by + dy;
          if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) cellsToClear.add(ny * COLS + nx);
        }
      }
    }
  }
  let destroyed = 0;
  for (const key of cellsToClear) {
    const ny = Math.floor(key / COLS), nx = key % COLS;
    if (board[ny][nx]) {
      board[ny][nx] = 0;
      destroyed++;
    }
  }
  if (destroyed) {
    score += destroyed * 10 * level;
    updateHUD();
  }
}

function applyLaser() {
  const rowsToClear = new Set();
  for (let r = 0; r < current.shape.length; r++) {
    for (let c = 0; c < current.shape[r].length; c++) {
      if (current.shape[r][c]) {
        rowsToClear.add(current.y + r);
        break;
      }
    }
  }
  const sortedRows = [...rowsToClear]
    .filter(r => r >= 0 && r < ROWS)
    .sort((a, b) => a - b);
  for (const r of sortedRows) {
    board.splice(r, 1);
    board.unshift(new Array(COLS).fill(0));
  }
  if (sortedRows.length) {
    registerLinesCleared(sortedRows.length);
    score += (LINE_SCORES[sortedRows.length] || sortedRows.length * 100) * level;
    level = Math.floor(lines / 10) + startLevel;
    dropInterval = levelInterval(level);
    updateHUD();
  }
}

function applySlow() {
  slowUntil = performance.now() + SLOW_DURATION;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  if (current.power) applyPowerup(current.power);
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  updatePowerupIndicator();
  drawNext();
}

function updatePowerupIndicator() {
  if (current.power) {
    powerupNameEl.textContent = POWERUP_LABELS[current.power];
    powerupIndicator.hidden = false;
  } else {
    powerupIndicator.hidden = true;
  }
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha, overrideColor) {
  if (!colorIndex) return;
  const color = overrideColor || COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawPowerupBorder(context, x, y, size) {
  const alpha = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 180));
  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = '#ffd700';
  context.lineWidth = 2;
  context.strokeRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);
  context.restore();
}

function drawGrid() {
  const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();
  ctx.strokeStyle = gridColor || '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  const powerColor = current.power ? POWERUP_COLORS[current.power] : null;
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2, powerColor);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c]) {
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK, null, powerColor);
        if (current.power) drawPowerupBorder(ctx, current.x + c, current.y + r, BLOCK);
      }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  const powerColor = next.power ? POWERUP_COLORS[next.power] : null;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB, null, powerColor);
        if (next.power) drawPowerupBorder(nextCtx, offX + c, offY + r, NB);
      }
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  openMenu('gameover');
}

function togglePause() {
  if (gameOver) return;
  if (paused) {
    resumeGame();
  } else {
    paused = true;
    pauseStartedAt = performance.now();
    cancelAnimationFrame(animId);
    openMenu('pause');
  }
}

function menuButtons() {
  const buttons = menuView === 'main'
    ? [resumeBtn, restartBtn, controlsBtn, startLevelSelect]
    : [controlsBackBtn];
  return buttons.filter(el => el && !el.hidden);
}

function focusMenuIndex(index) {
  const buttons = menuButtons();
  if (!buttons.length) return;
  const clamped = Math.max(0, Math.min(index, buttons.length - 1));
  buttons[clamped].focus();
}

function openMenu(mode) {
  menuMode = mode;
  menuView = 'main';
  menuMain.hidden = false;
  menuControls.hidden = true;
  resumeBtn.hidden = mode === 'gameover';
  if (mode === 'gameover') {
    overlayTitle.textContent = 'GAME OVER';
    overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  } else {
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
  }
  overlay.classList.remove('hidden');
  focusMenuIndex(0);
}

function closeMenu() {
  menuMode = null;
  overlay.classList.add('hidden');
}

function resumeGame() {
  if (menuMode !== 'pause') return;
  closeMenu();
  paused = false;
  const now = performance.now();
  if (slowUntil > pauseStartedAt) {
    slowUntil += now - pauseStartedAt;
  }
  lastTime = now;
  loop(lastTime);
}

function showControls() {
  menuView = 'controls';
  menuMain.hidden = true;
  menuControls.hidden = false;
  focusMenuIndex(0);
}

function showMainMenu() {
  menuView = 'main';
  menuMain.hidden = false;
  menuControls.hidden = true;
  focusMenuIndex(0);
}

function handleMenuKey(e) {
  switch (e.code) {
    case 'ArrowUp':
      e.preventDefault();
      moveMenuFocus(-1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      moveMenuFocus(1);
      break;
    case 'ArrowLeft':
    case 'ArrowRight':
      if (document.activeElement === startLevelSelect) {
        // let the native select handle it
      } else {
        e.preventDefault();
      }
      break;
    case 'Enter':
    case 'Space':
      e.preventDefault();
      if (document.activeElement && document.activeElement.tagName !== 'SELECT') {
        document.activeElement.click();
      }
      break;
    case 'Escape':
    case 'KeyP':
      e.preventDefault();
      if (menuView === 'controls') {
        showMainMenu();
      } else if (menuMode === 'pause') {
        resumeGame();
      }
      break;
  }
}

function moveMenuFocus(delta) {
  const buttons = menuButtons();
  if (!buttons.length) return;
  const currentIndex = Math.max(0, buttons.indexOf(document.activeElement));
  const next = (currentIndex + delta + buttons.length) % buttons.length;
  buttons[next].focus();
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  const effectiveInterval = ts < slowUntil ? dropInterval * SLOW_FACTOR : dropInterval;
  if (dropAccum >= effectiveInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = levelInterval(level);
  dropAccum = 0;
  lastTime = performance.now();
  nextPowerupAt = POWERUP_LINE_INTERVAL;
  powerupQueued = false;
  powerupBag = null;
  slowUntil = 0;
  next = randomPiece();
  spawn();
  updateHUD();
  closeMenu();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (paused || gameOver) {
    handleMenuKey(e);
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

resumeBtn.addEventListener('click', resumeGame);
restartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', showControls);
controlsBackBtn.addEventListener('click', showMainMenu);

function initStartLevel() {
  for (let lv = 1; lv <= MAX_START_LEVEL; lv++) {
    const opt = document.createElement('option');
    opt.value = lv;
    opt.textContent = lv;
    startLevelSelect.appendChild(opt);
  }
  const saved = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
  startLevel = Number.isInteger(saved) ? Math.min(Math.max(saved, 1), MAX_START_LEVEL) : 1;
  startLevelSelect.value = startLevel;
}

startLevelSelect.addEventListener('change', () => {
  const value = parseInt(startLevelSelect.value, 10);
  startLevel = Number.isInteger(value) ? Math.min(Math.max(value, 1), MAX_START_LEVEL) : 1;
  localStorage.setItem(START_LEVEL_KEY, String(startLevel));
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggleBtn.textContent = theme === 'light' ? 'Light' : 'Dark';
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

themeToggleBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

initTheme();
initStartLevel();
init();
