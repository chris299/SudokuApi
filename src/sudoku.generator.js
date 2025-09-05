const { cloneGrid, countSolutions, isSafe } = require('./sudoku.solver');

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function emptyGrid() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function fillGrid(grid) {
  const work = cloneGrid(grid);
  function dfs() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (work[r][c] === 0) {
          for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
            if (isSafe(work, r, c, n)) {
              work[r][c] = n;
              if (dfs()) return true;
              work[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true; // filled
  }
  const ok = dfs();
  return ok ? work : null;
}

function removeCellsForDifficulty(full, difficulty) {
  const targets = {
    easy: [36, 40],
    medium: [32, 35],
    hard: [28, 31],
    expert: [24, 27]
  };
  const [minGivens, maxGivens] = targets[difficulty] || targets.medium;
  const targetGivens = Math.floor(
    minGivens + Math.random() * (maxGivens - minGivens + 1)
  );

  const puzzle = cloneGrid(full);
  const positions = shuffle(
    Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9])
  );

  let removed = 0;
  for (const [r, c] of positions) {
    const current = puzzle[r][c];
    if (current === 0) continue;
    // tentatively remove
    puzzle[r][c] = 0;
    // ensure uniqueness remains
    const solutions = countSolutions(puzzle, 2);
    if (solutions !== 1) {
      puzzle[r][c] = current; // revert
      continue;
    }
    removed++;
    const givens = 81 - removed;
    if (givens <= targetGivens) break;
  }
  return puzzle;
}

function generateSudoku(difficulty = 'medium') {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  // seed is informational; Math.random is not seeded here
  const full = fillGrid(emptyGrid());
  if (!full) throw new Error('Failed to generate full grid');
  const puzzle = removeCellsForDifficulty(full, difficulty);
  return { puzzle, solution: full, seed };
}

module.exports = { generateSudoku, fillGrid };
