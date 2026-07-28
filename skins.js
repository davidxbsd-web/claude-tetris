'use strict';

// ---- Sistema de skins visuales ----
// Cada skin resuelve su propia paleta (colorIndex 1-8, en el mismo orden que
// las piezas: I, O, T, S, Z, J, L, Tuerca) y define drawCell(ctx, x, y,
// colorIndex, size, alpha, overrideColor) con la MISMA firma que
// game.js::drawBlock. `overrideColor`, cuando se pasa (piezas con power-up),
// SIEMPRE debe ganar sobre la paleta interna de la skin.

const SKIN_KEY = 'tetris-skin';
const SKIN_BODY_CLASSES = ['skin-retro', 'skin-neon', 'skin-pastel', 'skin-pixel'];

const PASTEL_COLORS = [
  null,
  '#a8dfe6', // I
  '#f5e2a0', // O
  '#d8b3e0', // T
  '#b7ddb0', // S
  '#eeb3b0', // Z
  '#aecbf0', // J
  '#f2cba3', // L
  '#f0b8d0', // Tuerca
];

const NEON_COLORS = [
  null,
  '#00fff2', // I
  '#faff00', // O
  '#ff00f7', // T
  '#39ff14', // S
  '#ff2d2d', // Z
  '#2d8bff', // J
  '#ff9d00', // L
  '#ff0080', // Tuerca
];

const PIXEL_COLORS = [
  null,
  '#3fd9d9', // I
  '#e0c847', // O
  '#a558b0', // T
  '#5fae5f', // S
  '#c25555', // Z
  '#4d78c2', // J
  '#c98a3f', // L
  '#c23f7a', // Tuerca
];

function drawRetroCell(context, x, y, colorIndex, size, alpha, overrideColor) {
  const palette = (typeof COLORS !== 'undefined' && COLORS) || PIXEL_COLORS;
  const color = overrideColor || palette[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawNeonCell(context, x, y, colorIndex, size, alpha, overrideColor) {
  const color = overrideColor || NEON_COLORS[colorIndex];
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = 'rgba(8, 8, 16, 0.9)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.shadowBlur = 18;
  context.shadowColor = color;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
  context.fillStyle = color;
  context.globalAlpha = (alpha ?? 1) * 0.55;
  context.fillRect(x * size + 4, y * size + 4, size - 8, size - 8);
  context.shadowBlur = 0;
  context.restore();
}

function drawPastelCell(context, x, y, colorIndex, size, alpha, overrideColor) {
  const color = overrideColor || PASTEL_COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  const px = x * size + 1.5;
  const py = y * size + 1.5;
  const w = size - 3;
  const h = size - 3;
  const r = Math.min(6, w / 3, h / 3);
  if (typeof context.roundRect === 'function') {
    context.beginPath();
    context.roundRect(px, py, w, h, r);
    context.fill();
  } else {
    context.fillRect(px, py, w, h);
  }
  context.fillStyle = 'rgba(255,255,255,0.35)';
  context.fillRect(px, py, w, 4);
  context.globalAlpha = 1;
}

function drawPixelCell(context, x, y, colorIndex, size, alpha, overrideColor) {
  const color = overrideColor || PIXEL_COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // textura: puntos pequeños en rejilla dentro de la celda
  context.fillStyle = 'rgba(0,0,0,0.22)';
  const dot = Math.max(1, Math.floor(size / 10));
  const step = Math.max(4, Math.floor(size / 4));
  for (let dy = 3; dy < size - 2; dy += step) {
    for (let dx = 3; dx < size - 2; dx += step) {
      context.fillRect(x * size + dx, y * size + dy, dot, dot);
    }
  }
  context.fillStyle = 'rgba(255,255,255,0.15)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 2);
  context.globalAlpha = 1;
}

const SKINS = {
  retro: {
    label: 'Retro',
    colors: null, // reusa COLORS de game.js
    drawCell: drawRetroCell,
    gridColor: null,
    bodyClass: 'skin-retro',
  },
  neon: {
    label: 'Neón',
    colors: NEON_COLORS,
    drawCell: drawNeonCell,
    gridColor: '#0a0a12',
    bodyClass: 'skin-neon',
  },
  pastel: {
    label: 'Pastel',
    colors: PASTEL_COLORS,
    drawCell: drawPastelCell,
    gridColor: null,
    bodyClass: 'skin-pastel',
  },
  pixel: {
    label: 'Pixel art',
    colors: PIXEL_COLORS,
    drawCell: drawPixelCell,
    gridColor: null,
    bodyClass: 'skin-pixel',
  },
};

let activeSkinName = 'retro';

function currentSkin() {
  return SKINS[activeSkinName] || SKINS.retro;
}

function applySkinBodyClass(name) {
  const root = document.documentElement;
  root.classList.remove(...SKIN_BODY_CLASSES);
  const skin = SKINS[name] || SKINS.retro;
  root.classList.add(skin.bodyClass);
}

function applySkin(name, persist) {
  activeSkinName = SKINS[name] ? name : 'retro';
  applySkinBodyClass(activeSkinName);
  if (persist) localStorage.setItem(SKIN_KEY, activeSkinName);
  // Redibuja solo si el juego ya arrancó (current/next existen).
  if (typeof current !== 'undefined' && current && typeof draw === 'function') draw();
  if (typeof next !== 'undefined' && next && typeof drawNext === 'function') drawNext();
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_KEY);
  activeSkinName = SKINS[saved] ? saved : 'retro';
  applySkinBodyClass(activeSkinName);
  const select = document.getElementById('skin-select');
  if (select) {
    select.value = activeSkinName;
    select.addEventListener('change', () => {
      applySkin(select.value, true);
    });
  }
}
