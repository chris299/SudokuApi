const { solveSudoku, validateGrid, normalizeGrid } = require('../src/sudoku.solver');

const puzzle = [
  [5,3,0,0,7,0,0,0,0],
  [6,0,0,1,9,5,0,0,0],
  [0,9,8,0,0,0,0,6,0],
  [8,0,0,0,6,0,0,0,3],
  [4,0,0,8,0,3,0,0,1],
  [7,0,0,0,2,0,0,0,6],
  [0,6,0,0,0,0,2,8,0],
  [0,0,0,4,1,9,0,0,5],
  [0,0,0,0,8,0,0,7,9]
];

const solution = [
  [5,3,4,6,7,8,9,1,2],
  [6,7,2,1,9,5,3,4,8],
  [1,9,8,3,4,2,5,6,7],
  [8,5,9,7,6,1,4,2,3],
  [4,2,6,8,5,3,7,9,1],
  [7,1,3,9,2,4,8,5,6],
  [9,6,1,5,3,7,2,8,4],
  [2,8,7,4,1,9,6,3,5],
  [3,4,5,2,8,6,1,7,9]
];

test('validateGrid checks shape and values', () => {
  expect(validateGrid(puzzle)).toBe(true);
  expect(validateGrid([[1]])).toBe(false);
});

test('solveSudoku solves a known puzzle', () => {
  const { solution: solved, metrics } = solveSudoku(normalizeGrid(puzzle));
  expect(solved).toEqual(solution);
  expect(metrics.steps).toBeGreaterThan(0);
});

test('solveSudoku returns null for unsolvable', () => {
  const bad = normalizeGrid(puzzle);
  bad[0][0] = 1;
  bad[0][1] = 1; // conflict in row
  const { solution: solved } = solveSudoku(bad);
  expect(solved).toBeNull();
});
