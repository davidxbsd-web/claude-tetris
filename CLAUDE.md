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
