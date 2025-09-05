const { solveSudoku } = require('./sudoku.solver');

function countClues(grid) {
  let count = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) if (grid[r][c] !== 0) count++;
  }
  return count;
}

function scoreToLevel(score) {
  if (score < 120) return 'easy';
  if (score < 300) return 'medium';
  if (score < 700) return 'hard';
  return 'expert';
}

function evaluateDifficulty(grid) {
  const clues = countClues(grid);
  const { solution, metrics } = solveSudoku(grid);
  if (!solution) {
    return { rating: { level: 'expert', score: Infinity }, metrics: { steps: 0, backtracks: 0, techniquesUsed: [] } };
  }
  const steps = metrics.steps || 0;
  const backtracks = metrics.backtracks || 0;
  const t = metrics.techniquesUsed || [];
  const singles = t.filter((x) => x.includes('Single')).length;
  const pairs = t.filter((x) => x.includes('Pair')).length;
  const btUsed = t.includes('Backtracking') ? 1 : 0;
  // Weighted score: fewer clues, more steps/backtracks => higher score
  // Incorporate technique usage: more complex techniques/backtracking raise score
  const score = (81 - clues) * 1.3 + steps * 0.4 + backtracks * 2.2 + pairs * 4 + btUsed * 20 - singles * 0.2;
  const level = scoreToLevel(score);
  return { rating: { level, score: Math.round(score) }, metrics };
}

module.exports = { evaluateDifficulty };
