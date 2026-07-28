'use strict';

// ---------------------------------------------------------------------------
// Persistencia de récords locales.
//
// Formato de localStorage:
//   'tetris-highscores'   -> JSON array (máx 5), ordenado desc por score:
//                            [{ name, score, lines, level, combo, date }, ...]
//                            `combo` guarda el MEJOR combo alcanzado en esa
//                            partida (bestCombo), no el combo final.
//                            `date` es un timestamp (Date.now()).
//   'tetris-player-name'  -> string, último nombre usado al guardar un récord.
//   'tetris-best-combo'   -> string numérico, mejor combo histórico ALCANZADO
//                            EN CUALQUIER PARTIDA (independiente de si esa
//                            partida entró en el top-5 de puntuación).
//   'tetris-max-lines-once' -> string numérico, mayor nº de líneas limpiadas
//                            de una sola vez (una sola jugada/lock) en
//                            cualquier partida jugada.
//
// Se usan dos claves separadas para las "mejores marcas históricas" (combo y
// líneas de una vez) en lugar de derivarlas del top-5 de puntuación, porque
// una partida con un combo enorme o un clear de muchas líneas no
// necesariamente entra en el top-5 de score.
// ---------------------------------------------------------------------------

const HIGHSCORES_KEY = 'tetris-highscores';
const PLAYER_NAME_KEY = 'tetris-player-name';
const BEST_COMBO_KEY = 'tetris-best-combo';
const MAX_LINES_KEY = 'tetris-max-lines-once';
const MAX_RECORDS = 5;

function loadRecords() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(e => e && typeof e.score === 'number')
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECORDS);
  } catch (err) {
    return [];
  }
}

function saveRecord(entry) {
  try {
    const records = loadRecords();
    records.push(entry);
    records.sort((a, b) => b.score - a.score);
    const top = records.slice(0, MAX_RECORDS);
    localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(top));
    return top;
  } catch (err) {
    return loadRecords();
  }
}

function resetRecords() {
  try {
    localStorage.removeItem(HIGHSCORES_KEY);
    localStorage.removeItem(BEST_COMBO_KEY);
    localStorage.removeItem(MAX_LINES_KEY);
  } catch (err) {
    // localStorage deshabilitado o inaccesible: no hay nada que limpiar.
  }
}

function getBestComboEver() {
  try {
    const v = parseInt(localStorage.getItem(BEST_COMBO_KEY), 10);
    return Number.isFinite(v) ? v : 0;
  } catch (err) {
    return 0;
  }
}

function getMaxLinesEver() {
  try {
    const v = parseInt(localStorage.getItem(MAX_LINES_KEY), 10);
    return Number.isFinite(v) ? v : 0;
  } catch (err) {
    return 0;
  }
}

function updateGlobalStats(bestComboThisGame, maxLinesAtOnceThisGame) {
  try {
    if (bestComboThisGame > getBestComboEver()) {
      localStorage.setItem(BEST_COMBO_KEY, String(bestComboThisGame));
    }
    if (maxLinesAtOnceThisGame > getMaxLinesEver()) {
      localStorage.setItem(MAX_LINES_KEY, String(maxLinesAtOnceThisGame));
    }
  } catch (err) {
    // localStorage deshabilitado: se pierde el progreso de esta sesión.
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function renderRecords(container, highlightIndex) {
  if (!container) return;
  const records = loadRecords();
  container.innerHTML = '';

  if (records.length === 0) {
    const li = document.createElement('li');
    li.className = 'record-empty';
    li.textContent = 'Sin récords todavía';
    container.appendChild(li);
    return;
  }

  records.forEach((rec, i) => {
    const li = document.createElement('li');
    li.className = 'record-row' + (highlightIndex === i ? ' record-new' : '');
    li.innerHTML = `
      <span class="record-rank">${i + 1}</span>
      <span class="record-name">${escapeHtml(rec.name || '---')}</span>
      <span class="record-score">${(rec.score || 0).toLocaleString()}</span>
      <span class="record-meta">Nv.${rec.level ?? '-'} · ${rec.lines ?? 0}L · combo x${rec.combo ?? 0}</span>
    `;
    container.appendChild(li);
  });
}

function initStartScreen() {
  const startScreen = document.getElementById('start-screen');
  const playBtn = document.getElementById('play-btn');
  const resetBtn = document.getElementById('reset-records-btn');
  const recordsList = document.getElementById('records-list');
  const bestComboEl = document.getElementById('best-combo-ever');
  const maxLinesEl = document.getElementById('max-lines-ever');

  function refresh() {
    renderRecords(recordsList, null);
    if (bestComboEl) bestComboEl.textContent = getBestComboEver();
    if (maxLinesEl) maxLinesEl.textContent = getMaxLinesEver();
  }

  refresh();

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      startScreen.classList.add('hidden');
      init();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('¿Seguro que quieres borrar todos los récords y marcas históricas?')) {
        resetRecords();
        refresh();
      }
    });
  }

  if (startScreen) startScreen.classList.remove('hidden');
}

// Handlers actuales del formulario de guardado de récord, guardados aquí
// para poder quitarlos antes de añadir los nuevos en cada game over
// (evita listeners duplicados entre partidas sucesivas).
let currentSaveHandler = null;
let currentEnterHandler = null;

function onGameOver(finalScore, finalLines, finalLevel, finalBestCombo, finalMaxLinesAtOnce) {
  updateGlobalStats(finalBestCombo, finalMaxLinesAtOnce);

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${finalScore.toLocaleString()}`;

  const saveBox = document.getElementById('save-record-box');
  const saveBtn = document.getElementById('save-record-btn');
  const nameInput = document.getElementById('player-name-input');

  if (saveBtn && currentSaveHandler) {
    saveBtn.removeEventListener('click', currentSaveHandler);
    currentSaveHandler = null;
  }
  if (nameInput && currentEnterHandler) {
    nameInput.removeEventListener('keydown', currentEnterHandler);
    currentEnterHandler = null;
  }

  const records = loadRecords();
  const qualifies = saveBox && (records.length < MAX_RECORDS || finalScore > records[records.length - 1].score);

  if (qualifies) {
    saveBox.classList.remove('hidden');
    const savedName = (() => {
      try { return localStorage.getItem(PLAYER_NAME_KEY) || ''; } catch (err) { return ''; }
    })();
    nameInput.value = savedName;
    nameInput.focus();

    const handleSave = () => {
      const name = (nameInput.value || 'JUGADOR').trim().slice(0, 12) || 'JUGADOR';
      try { localStorage.setItem(PLAYER_NAME_KEY, name); } catch (err) { /* no-op */ }
      const entry = {
        name,
        score: finalScore,
        lines: finalLines,
        level: finalLevel,
        combo: finalBestCombo,
        date: Date.now(),
      };
      saveRecord(entry);
      saveBox.classList.add('hidden');
      saveBtn.removeEventListener('click', handleSave);
      nameInput.removeEventListener('keydown', onEnter);
      currentSaveHandler = null;
      currentEnterHandler = null;
    };
    const onEnter = e => {
      if (e.key === 'Enter') handleSave();
    };

    currentSaveHandler = handleSave;
    currentEnterHandler = onEnter;
    saveBtn.addEventListener('click', currentSaveHandler);
    nameInput.addEventListener('keydown', currentEnterHandler);
  } else if (saveBox) {
    saveBox.classList.add('hidden');
  }

  overlay.classList.remove('hidden');
}
