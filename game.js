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

function drawBlockRetro(ctx, px, py, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawBlockNeon(ctx, px, py, size, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = size / 3;
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 2.5, py + 2.5, size - 5, size - 5);
  ctx.strokeRect(px + 2.5, py + 2.5, size - 5, size - 5);
}

function drawBlockPastel(ctx, px, py, size, color) {
  const r = size / 4;
  const x = px + 1.5, y = py + 1.5, w = size - 3, h = size - 3;
  ctx.fillStyle = color;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  if (ctx.roundRect) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.clip();
    ctx.fillRect(x, y, w, h / 2);
    ctx.restore();
  } else {
    ctx.fillRect(x, y, w, h / 2);
  }
}

function drawBlockPixel(ctx, px, py, size, color) {
  const x = px + 1, y = py + 1, w = size - 2, h = size - 2;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(x + 1, y + h - 1);
  ctx.lineTo(x + 1, y + 1);
  ctx.lineTo(x + w - 1, y + 1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.moveTo(x + w - 1, y + 1);
  ctx.lineTo(x + w - 1, y + h - 1);
  ctx.lineTo(x + 1, y + h - 1);
  ctx.stroke();
  const dot = Math.max(2, size / 6);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + dot, y + h - dot * 2, dot, dot);
  ctx.fillRect(x + w - dot * 2, y + dot, dot, dot);
}

const SKINS = {
  retro: {
    label: 'Retro',
    colors: COLORS,
    drawBlock: drawBlockRetro,
  },
  neon: {
    label: 'Neon',
    colors: [null, '#00e5ff', '#ffea00', '#d500f9', '#00e676', '#ff1744', '#2979ff', '#ff9100', '#f50057'],
    drawBlock: drawBlockNeon,
    gridColor: 'rgba(0,229,255,0.15)',
  },
  pastel: {
    label: 'Pastel',
    colors: [null, '#a8dadc', '#ffe8a3', '#d8b4e2', '#b8e0c2', '#f4a6a6', '#a9c9f5', '#f6c99f', '#f3a9c4'],
    drawBlock: drawBlockPastel,
    powerupBorder: '#e6b800',
    powerupColors: { bomb: '#e08a8a', laser: '#8ecbe0', slow: '#c3a8e0' },
  },
  pixel: {
    label: 'Pixel art',
    colors: [null, '#2ba8b8', '#d9a520', '#8e4bab', '#4b9e5a', '#c04545', '#3a6fc4', '#c47a2b', '#c43a70'],
    drawBlock: drawBlockPixel,
  },
};
const DEFAULT_SKIN = 'retro';
let currentSkin;
function skin() { return SKINS[currentSkin] || SKINS[DEFAULT_SKIN]; }

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
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

const THEME_KEY = 'tetris-theme';
const SKIN_KEY = 'tetris-skin';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

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
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
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
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
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
  const s = skin();
  const color = overrideColor || s.colors[colorIndex];
  context.save();
  context.globalAlpha = alpha ?? 1;
  s.drawBlock(context, x * size, y * size, size, color);
  context.restore();
}

function powerupColorFor(power) {
  if (!power) return null;
  const s = skin();
  return (s.powerupColors && s.powerupColors[power]) || POWERUP_COLORS[power];
}

function drawPowerupBorder(context, x, y, size) {
  const alpha = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 180));
  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = skin().powerupBorder || '#ffd700';
  context.lineWidth = 2;
  context.strokeRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);
  context.restore();
}

let gridColorCache = '#22222e';

function refreshGridColorCache() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();
  gridColorCache = v || '#22222e';
}

function drawGrid() {
  ctx.strokeStyle = skin().gridColor || gridColorCache;
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
  const powerColor = powerupColorFor(current.power);
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
  const powerColor = powerupColorFor(next.power);
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
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
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
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  nextPowerupAt = POWERUP_LINE_INTERVAL;
  powerupQueued = false;
  powerupBag = null;
  slowUntil = 0;
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
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

restartBtn.addEventListener('click', init);

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggleBtn.textContent = theme === 'light' ? 'Light' : 'Dark';
  refreshGridColorCache();
  if (current) {
    drawNext();
    draw();
  }
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

themeToggleBtn.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
});

function applySkin(name) {
  currentSkin = SKINS[name] ? name : DEFAULT_SKIN;
  document.documentElement.dataset.skin = currentSkin;
  skinSelect.value = currentSkin;
  refreshGridColorCache();
  if (current) {
    drawNext();
    draw();
  }
}

function initSkin() {
  applySkin(localStorage.getItem(SKIN_KEY) || DEFAULT_SKIN);
}

skinSelect.addEventListener('change', () => {
  localStorage.setItem(SKIN_KEY, skinSelect.value);
  applySkin(skinSelect.value);
  skinSelect.blur();
});

initTheme();
initSkin();
init();
