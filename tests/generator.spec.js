const { generateSudoku, fillGrid } = require('../src/sudoku.generator');
const { solveSudoku, countSolutions } = require('../src/sudoku.solver');

test('fillGrid generates a valid full solution', () => {
  const full = fillGrid(Array.from({ length: 9 }, () => Array(9).fill(0)));
  expect(full).toHaveLength(9);
  for (const row of full) expect(row).toHaveLength(9);
});

test('generateSudoku produces a uniquely solvable puzzle', () => {
  const { puzzle } = generateSudoku('medium');
  const { solution } = solveSudoku(puzzle);
  expect(solution).toBeTruthy();
  const ways = countSolutions(puzzle, 2);
  expect(ways).toBe(1);
});
