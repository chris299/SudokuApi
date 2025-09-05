const { evaluateDifficulty } = require('../src/sudoku.difficulty');

const easyLike = [
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

test('evaluateDifficulty returns a level and score', () => {
  const { rating, metrics } = evaluateDifficulty(easyLike);
  expect(['easy', 'medium', 'hard', 'expert']).toContain(rating.level);
  expect(typeof rating.score).toBe('number');
  expect(metrics).toHaveProperty('steps');
});
