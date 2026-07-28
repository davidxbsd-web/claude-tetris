# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A classic Tetris implementation in vanilla JavaScript (ES6+), HTML5 Canvas, and CSS. No dependencies, no build step, no package.json — just three files (`index.html`, `style.css`, `game.js`).

## Running the game

There is no build/lint/test tooling in this repo. To run:

```bash
open index.html          # macOS, opens directly in the browser
# or serve it locally (needed if you hit CORS/file:// issues):
python3 -m http.server 8000
npx serve .
```

Then verify changes by opening the page and playing — there are no automated tests.

## Architecture

Everything lives in `game.js` (~300 lines), which owns all game state and logic. `index.html` only provides DOM anchors (`#board` and `#next-canvas` canvases, HUD spans for score/lines/level, the pause/game-over `#overlay`), and `style.css` is purely presentational (dark/retro theme). There is no module system — `game.js` is loaded as a single classic script.

Key pieces in `game.js`:

- **Board model**: `board` is a `ROWS × COLS` matrix; each cell is `0` (empty) or a color index `1–7` identifying which piece locked there.
- **Pieces**: `PIECES` are square matrices (index 0 unused/null placeholder to align color indices 1–7 with piece types). Rotation (`rotateCW`) is done via transpose + row reversal, not stored per-orientation.
- **Collision** (`collide`): checks board bounds and overlap with already-locked cells.
- **Wall kicks** (`tryRotate`): after rotating, tries horizontal offsets `[0, -1, 1, -2, 2]` until a non-colliding position is found.
- **Game loop** (`loop`): driven by `requestAnimationFrame`; accumulates elapsed time (`dropAccum`) and advances the piece one row once `dropInterval` is exceeded.
- **Line clearing** (`clearLines`): scans bottom-up, splices full rows out and unshifts empty rows at the top; re-checks the same row index after a splice.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by current level; hard drop adds 2 pts/row dropped, soft drop adds 1 pt/row.
- **Leveling/speed**: level increases every 10 lines; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row, drawn at `globalAlpha = 0.2`.

Control flow: `init()` builds the board, seeds `next` via `randomPiece()`, calls `spawn()` (promotes `next` to `current`, generates a new `next`), then starts the `loop`. If a freshly spawned piece immediately collides, `endGame()` fires and the Game Over overlay is shown. Keyboard input (`keydown` listener) handles movement/rotation/soft-drop/hard-drop/pause; `P` toggles pause independent of game-over state.

Tunable constants at the top of `game.js`: `COLS`, `ROWS`, `BLOCK` (px per cell), `COLORS` (palette per piece type), `LINE_SCORES`, `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, the `<canvas id="board">` `width`/`height` in `index.html` must be updated to match (`COLS × BLOCK`, `ROWS × BLOCK`).

## Menú de pausa

`#pause-menu` (in `index.html`) is a separate overlay from `#overlay` (which is reserved for Game Over / records), reusing the generic `.overlay`/`.overlay.hidden` CSS pattern but styled independently under the `/* ---- Menú de pausa ---- */` block in `style.css`. It has two sub-views toggled with the generic `.hidden` class: the main menu (`#pause-menu-main`: Reanudar/Reiniciar/Ver controles buttons plus the `#start-level` select) and a controls sub-view (`#pause-menu-controls`). `togglePause()` opens/closes it symmetrically via `openPauseMenu()`/`closePauseMenu()`, tracked by the `menuOpen`/`controlsOpen` flags. `P` and `Escape` both toggle the menu; `Escape` closes the controls sub-view first if it's open. The chosen starting level (1–15) is persisted in `localStorage['tetris-start-level']` and applied by `getStartLevel()` the next time `init()` runs (i.e. next game, not the current one). While any `<input>`/`<select>`/`<textarea>`/`<button>` has focus, `inputLocked()` swallows all keydown handling except `Escape`, so the level `<select>` doesn't leak keystrokes into game controls.

## Records locales y combo

`records.js` (classic script, loaded in `index.html` **before** `game.js`) owns local high-score persistence and the start screen. It exposes `loadRecords`, `saveRecord`, `resetRecords`, `renderRecords`, `initStartScreen`, `onGameOver` — all globals, called from `game.js` (and vice versa: `initStartScreen`/`onGameOver` reach back into `game.js` globals like `overlay`, `overlayTitle`, `overlayScore`, `init`).

New `localStorage` keys (see the header comment in `records.js` for the exact format):
- `tetris-highscores` — JSON array (max 5) of `{ name, score, lines, level, combo, date }`, sorted desc by score. `combo` here is that game's `bestCombo`.
- `tetris-player-name` — last name used when saving a record, used to prefill the name input.
- `tetris-best-combo` / `tetris-max-lines-once` — all-time bests (combo and lines-cleared-in-one-clear), tracked independently of the top-5 score list so a huge combo/clear isn't lost just because the run's score didn't make the top 5.

Startup contract changed: `game.js` no longer calls `init()` at the bottom — it calls `initTheme(); initStartScreen();`. `init()` now only runs when the player presses JUGAR on `#start-screen` or clicks `#restart-btn`. `endGame()` no longer paints the overlay itself; it delegates to `onGameOver(score, lines, level, bestCombo, maxLinesAtOnce)`, which fills `#overlay-title`/`#overlay-score` and, if the score qualifies for the top 5, reveals a name input + save button inside `.overlay-box` before showing the overlay.

Combo: `combo` (current streak) and `bestCombo` (max this game) are tracked in `game.js`. `lockPiece()` accumulates lines cleared during that lock (regular `clearLines()` plus a laser powerup's clear, since both can fire in the same lock) into `lockClearedCount`, then calls `updateCombo()`: a lock that clears at least one line increments `combo` (and awards `50 * combo * level` bonus points from the second link onward); a lock that clears none resets `combo` to 0. `maxLinesAtOnce` tracks the largest single-clear batch (regular or laser) in the current game. The combo panel section (`#combo-indicator`, mirroring `#powerup-indicator`'s `hidden`-attribute pattern) only shows while `combo > 1`.

A shared `inputLocked()` guard (checks `document.activeElement` for `INPUT`/`SELECT`/`TEXTAREA`/`BUTTON`) sits above the `keydown` listener so typing a player name (or focusing any button) doesn't trigger game controls; `Escape` always passes through.
