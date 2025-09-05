function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

function validateGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== 9) return false;
  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== 9) return false;
    for (const v of row) {
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 9) return false;
    }
  }
  return true;
}

function normalizeGrid(grid) {
  // Deep clone and ensure integers
  return grid.map((row) => row.map((v) => (v | 0)));
}

function findEmpty(grid) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) return [r, c];
    }
  }
  return null;
}

function isSafe(grid, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (grid[row][i] === num) return false;
    if (grid[i][col] === num) return false;
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      if (grid[r][c] === num) return false;
    }
  }
  return true;
}

function hasConflicts(grid) {
  // Check rows and columns
  for (let i = 0; i < 9; i++) {
    const rowSet = new Set();
    const colSet = new Set();
    for (let j = 0; j < 9; j++) {
      const rVal = grid[i][j];
      const cVal = grid[j][i];
      if (rVal !== 0) {
        if (rowSet.has(rVal)) return true;
        rowSet.add(rVal);
      }
      if (cVal !== 0) {
        if (colSet.has(cVal)) return true;
        colSet.add(cVal);
      }
    }
  }
  // Check boxes
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      const boxSet = new Set();
      for (let r = br; r < br + 3; r++) {
        for (let c = bc; c < bc + 3; c++) {
          const v = grid[r][c];
          if (v !== 0) {
            if (boxSet.has(v)) return true;
            boxSet.add(v);
          }
        }
      }
    }
  }
  return false;
}

function getCandidates(grid, row, col) {
  const candidates = [];
  for (let n = 1; n <= 9; n++) if (isSafe(grid, row, col, n)) candidates.push(n);
  return candidates;
}

function unitCells(type, index) {
  // returns array of [r,c] for a unit
  const cells = [];
  if (type === 'row') for (let c = 0; c < 9; c++) cells.push([index, c]);
  if (type === 'col') for (let r = 0; r < 9; r++) cells.push([r, index]);
  if (type === 'box') {
    const br = Math.floor(index / 3) * 3;
    const bc = (index % 3) * 3;
    for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) cells.push([r, c]);
  }
  return cells;
}

function findNakedSingles(grid, metrics) {
  let changed = false;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        const cand = getCandidates(grid, r, c);
        if (cand.length === 1) {
          grid[r][c] = cand[0];
          metrics.steps++;
          metrics.techniquesUsed.push('Naked Single');
          changed = true;
        }
      }
    }
  }
  return changed;
}

function findHiddenSingles(grid, metrics) {
  let changed = false;
  const types = ['row', 'col', 'box'];
  for (const type of types) {
    for (let idx = 0; idx < 9; idx++) {
      const cells = unitCells(type, idx);
      const posByNum = new Map();
      for (let n = 1; n <= 9; n++) posByNum.set(n, []);
      for (const [r, c] of cells) {
        if (grid[r][c] !== 0) continue;
        const cand = getCandidates(grid, r, c);
        for (const n of cand) posByNum.get(n).push([r, c]);
      }
      for (let n = 1; n <= 9; n++) {
        const positions = posByNum.get(n);
        if (positions.length === 1) {
          const [r, c] = positions[0];
          if (grid[r][c] === 0) {
            grid[r][c] = n;
            metrics.steps++;
            metrics.techniquesUsed.push(`Hidden Single (${type})`);
            changed = true;
          }
        }
      }
    }
  }
  return changed;
}

function eliminateWithNakedPairs(grid, metrics) {
  // Deprecated in favor of candidate-grid based implementation
  return false;
}

function solveBacktracking(grid) {
  const work = cloneGrid(grid);
  const metrics = { steps: 0, backtracks: 0, techniquesUsed: [] };

  function dfs() {
    const pos = findEmpty(work);
    if (!pos) return true; // solved
    const [r, c] = pos;
    const candidates = getCandidates(work, r, c);
    // heuristic: try fewer candidates first
    for (const n of candidates) {
      work[r][c] = n;
      metrics.steps++;
      if (dfs()) return true;
      work[r][c] = 0; // backtrack
      metrics.backtracks++;
    }
    return false;
  }

  const solved = dfs();
  return { solved, solution: solved ? work : null, metrics };
}

function countSolutions(grid, max = 2) {
  const work = cloneGrid(grid);
  let count = 0;
  function dfs() {
    if (count >= max) return; // early exit
    const pos = findEmpty(work);
    if (!pos) {
      count++;
      return;
    }
    const [r, c] = pos;
    const candidates = getCandidates(work, r, c);
    for (const n of candidates) {
      work[r][c] = n;
      dfs();
      if (count >= max) return;
      work[r][c] = 0;
    }
  }
  dfs();
  return count;
}

function solveSudoku(grid, opts = {}) {
  const work = cloneGrid(grid);
  const metrics = { steps: 0, backtracks: 0, techniquesUsed: [] };
  const recorder = createRecorder(!!opts.explain);

  // Human-like loop with candidate grid and additional techniques
  humanSolvePhase(work, metrics, recorder);

  // Check if solved
  if (!findEmpty(work)) {
    const result = { solution: work, metrics };
    if (recorder.enabled) result.steps = recorder.steps;
    return result;
  }

  // Fallback to backtracking to complete
  const { solution, metrics: m2 } = solveBacktracking(work);
  metrics.steps += m2.steps;
  metrics.backtracks += m2.backtracks;
  metrics.techniquesUsed.push('Backtracking');
  const result = { solution, metrics };
  if (recorder.enabled) result.steps = recorder.steps;
  return result;
}

function buildCandidates(grid) {
  const cand = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) cand[r][c] = getCandidates(grid, r, c);
    }
  }
  return cand;
}

function updateCandidatesForPlacement(grid, cand, r, c, recorder) {
  const n = grid[r][c];
  cand[r][c] = [];
  for (let i = 0; i < 9; i++) {
    // row and col
    if (grid[r][i] === 0) {
      const before = cand[r][i];
      const after = before.filter((x) => x !== n);
      if (after.length !== before.length && recorder && recorder.enabled) {
        recorder.record('Placement Propagation', [], [{ r, c: i, n }]);
      }
      cand[r][i] = after;
    }
    if (grid[i][c] === 0) {
      const before = cand[i][c];
      const after = before.filter((x) => x !== n);
      if (after.length !== before.length && recorder && recorder.enabled) {
        recorder.record('Placement Propagation', [], [{ r: i, c, n }]);
      }
      cand[i][c] = after;
    }
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let rr = br; rr < br + 3; rr++) {
    for (let cc = bc; cc < bc + 3; cc++) {
      if (grid[rr][cc] === 0) {
        const before = cand[rr][cc];
        const after = before.filter((x) => x !== n);
        if (after.length !== before.length && recorder && recorder.enabled) {
          recorder.record('Placement Propagation', [], [{ r: rr, c: cc, n }]);
        }
        cand[rr][cc] = after;
      }
    }
  }
}

function techniqueNakedSingles(grid, cand, metrics, recorder) {
  let changed = false;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0 && cand[r][c].length === 1) {
        grid[r][c] = cand[r][c][0];
        metrics.steps++;
        metrics.techniquesUsed.push('Naked Single');
        if (recorder && recorder.enabled) recorder.record('Naked Single', [{ r, c, n: grid[r][c] }], []);
        updateCandidatesForPlacement(grid, cand, r, c, recorder);
        changed = true;
      }
    }
  }
  return changed;
}

function techniqueHiddenSingles(grid, cand, metrics, recorder) {
  let changed = false;
  const units = [
    ...Array.from({ length: 9 }, (_, i) => ({ type: 'row', idx: i, cells: unitCells('row', i) })),
    ...Array.from({ length: 9 }, (_, i) => ({ type: 'col', idx: i, cells: unitCells('col', i) })),
    ...Array.from({ length: 9 }, (_, i) => ({ type: 'box', idx: i, cells: unitCells('box', i) })),
  ];
  for (const u of units) {
    for (let n = 1; n <= 9; n++) {
      const positions = [];
      for (const [r, c] of u.cells) {
        if (grid[r][c] === 0 && cand[r][c].includes(n)) positions.push([r, c]);
      }
      if (positions.length === 1) {
        const [r, c] = positions[0];
        grid[r][c] = n;
        metrics.steps++;
        metrics.techniquesUsed.push(`Hidden Single (${u.type})`);
        if (recorder && recorder.enabled) recorder.record(`Hidden Single (${u.type})`, [{ r, c, n }], []);
        updateCandidatesForPlacement(grid, cand, r, c, recorder);
        changed = true;
      }
    }
  }
  return changed;
}

function techniqueLockedCandidates(grid, cand, metrics, recorder) {
  let changed = false;
  // Pointing in box -> eliminate in row/col
  for (let b = 0; b < 9; b++) {
    const cells = unitCells('box', b);
    for (let n = 1; n <= 9; n++) {
      const pos = cells.filter(([r, c]) => grid[r][c] === 0 && cand[r][c].includes(n));
      if (pos.length <= 1) continue;
      const allRow = pos.every(([r]) => r === pos[0][0]);
      const allCol = pos.every(([, c]) => c === pos[0][1]);
      if (allRow) {
        const row = pos[0][0];
        for (let c = 0; c < 9; c++) {
          if (!cells.some(([rr, cc]) => rr === row && cc === c) && grid[row][c] === 0 && cand[row][c].includes(n)) {
            cand[row][c] = cand[row][c].filter((x) => x !== n);
            metrics.techniquesUsed.push('Locked Candidates (Pointing)');
            if (recorder && recorder.enabled) recorder.record('Locked Candidates (Pointing)', [], [{ r: row, c, n }]);
            changed = true;
          }
        }
      }
      if (allCol) {
        const col = pos[0][1];
        for (let r = 0; r < 9; r++) {
          if (!cells.some(([rr, cc]) => cc === col && rr === r) && grid[r][col] === 0 && cand[r][col].includes(n)) {
            cand[r][col] = cand[r][col].filter((x) => x !== n);
            metrics.techniquesUsed.push('Locked Candidates (Pointing)');
            if (recorder && recorder.enabled) recorder.record('Locked Candidates (Pointing)', [], [{ r, c: col, n }]);
            changed = true;
          }
        }
      }
    }
  }
  // Claiming in row/col -> eliminate in box
  for (let r = 0; r < 9; r++) {
    for (let n = 1; n <= 9; n++) {
      const cols = [];
      for (let c = 0; c < 9; c++) if (grid[r][c] === 0 && cand[r][c].includes(n)) cols.push(c);
      if (cols.length > 1) {
        const boxIndex = Math.floor(r / 3) * 3 + Math.floor(cols[0] / 3);
        const sameBox = cols.every((c) => Math.floor(c / 3) === Math.floor(cols[0] / 3));
        if (sameBox) {
          const cells = unitCells('box', boxIndex);
          for (const [rr, cc] of cells) {
            if (rr !== r && grid[rr][cc] === 0 && cand[rr][cc].includes(n)) {
              cand[rr][cc] = cand[rr][cc].filter((x) => x !== n);
              metrics.techniquesUsed.push('Locked Candidates (Claiming)');
              if (recorder && recorder.enabled) recorder.record('Locked Candidates (Claiming)', [], [{ r: rr, c: cc, n }]);
              changed = true;
            }
          }
        }
      }
    }
  }
  for (let c = 0; c < 9; c++) {
    for (let n = 1; n <= 9; n++) {
      const rows = [];
      for (let r = 0; r < 9; r++) if (grid[r][c] === 0 && cand[r][c].includes(n)) rows.push(r);
      if (rows.length > 1) {
        const boxIndex = Math.floor(rows[0] / 3) * 3 + Math.floor(c / 3);
        const sameBox = rows.every((r) => Math.floor(r / 3) === Math.floor(rows[0] / 3));
        if (sameBox) {
          const cells = unitCells('box', boxIndex);
          for (const [rr, cc] of cells) {
            if (cc !== c && grid[rr][cc] === 0 && cand[rr][cc].includes(n)) {
              cand[rr][cc] = cand[rr][cc].filter((x) => x !== n);
              metrics.techniquesUsed.push('Locked Candidates (Claiming)');
              if (recorder && recorder.enabled) recorder.record('Locked Candidates (Claiming)', [], [{ r: rr, c: cc, n }]);
              changed = true;
            }
          }
        }
      }
    }
  }
  return changed;
}

function techniqueNakedTuples(grid, cand, metrics, size = 2, recorder) {
  let changed = false;
  const types = ['row', 'col', 'box'];
  for (const type of types) {
    for (let idx = 0; idx < 9; idx++) {
      const cells = unitCells(type, idx);
      const emptyCells = cells.filter(([r, c]) => grid[r][c] === 0);
      // collect candidate strings for cells with len <= size
      const groups = new Map();
      for (const [r, c] of emptyCells) {
        const candList = cand[r][c];
        if (candList.length >= 2 && candList.length <= size) {
          const key = candList.slice().sort().join(',');
          const arr = groups.get(key) || [];
          arr.push([r, c]);
          groups.set(key, arr);
        }
      }
      for (const [key, positions] of groups) {
        const nums = key.split(',').map((x) => parseInt(x, 10));
        if (positions.length === nums.length && nums.length === size) {
          // eliminate these nums from other cells in unit
          for (const [r, c] of emptyCells) {
            if (!positions.some(([rr, cc]) => rr === r && cc === c)) {
              const before = cand[r][c].length;
              cand[r][c] = cand[r][c].filter((n) => !nums.includes(n));
              if (cand[r][c].length !== before) {
                metrics.techniquesUsed.push(size === 2 ? `Naked Pair (${type})` : `Naked Triple (${type})`);
                if (recorder && recorder.enabled) {
                  const removed = nums.map((n) => ({ r, c, n }));
                  recorder.record(size === 2 ? `Naked Pair (${type})` : `Naked Triple (${type})`, [], removed);
                }
                changed = true;
              }
            }
          }
        }
      }
    }
  }
  return changed;
}

function techniqueHiddenPairs(grid, cand, metrics, recorder) {
  let changed = false;
  const types = ['row', 'col', 'box'];
  for (const type of types) {
    for (let idx = 0; idx < 9; idx++) {
      const cells = unitCells(type, idx);
      // map number -> positions
      const posByNum = new Map();
      for (let n = 1; n <= 9; n++) posByNum.set(n, []);
      for (const [r, c] of cells) {
        if (grid[r][c] !== 0) continue;
        for (const n of cand[r][c]) posByNum.get(n).push([r, c]);
      }
      const pairs = [];
      for (let n = 1; n <= 9; n++) {
        const pos = posByNum.get(n);
        if (pos.length === 2) pairs.push({ n, pos });
      }
      for (let i = 0; i < pairs.length; i++) {
        for (let j = i + 1; j < pairs.length; j++) {
          const a = pairs[i];
          const b = pairs[j];
          if (a.pos[0][0] === b.pos[0][0] && a.pos[0][1] === b.pos[0][1] && a.pos[1][0] === b.pos[1][0] && a.pos[1][1] === b.pos[1][1]) {
            // hidden pair found: restrict candidates of those two cells to these two numbers
            for (const [r, c] of a.pos) {
              const beforeList = cand[r][c].slice();
              cand[r][c] = [a.n, b.n];
              if (cand[r][c].length !== beforeList.length) {
                metrics.techniquesUsed.push(`Hidden Pair (${type})`);
                if (recorder && recorder.enabled) {
                  const removed = beforeList.filter((x) => ![a.n, b.n].includes(x)).map((n) => ({ r, c, n }));
                  if (removed.length) recorder.record(`Hidden Pair (${type})`, [], removed);
                }
                changed = true;
              }
            }
          }
        }
      }
    }
  }
  return changed;
}

function techniqueHiddenTriples(grid, cand, metrics, recorder) {
  let changed = false;
  const types = ['row', 'col', 'box'];
  for (const type of types) {
    for (let idx = 0; idx < 9; idx++) {
      const cells = unitCells(type, idx).filter(([r, c]) => grid[r][c] === 0);
      // map number -> positions
      const posByNum = new Map();
      for (let n = 1; n <= 9; n++) posByNum.set(n, []);
      for (const [r, c] of cells) {
        for (const n of cand[r][c]) posByNum.get(n).push([r, c]);
      }
      const nums = Array.from({ length: 9 }, (_, i) => i + 1);
      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          for (let k = j + 1; k < nums.length; k++) {
            const A = { n: nums[i], pos: posByNum.get(nums[i]) };
            const B = { n: nums[j], pos: posByNum.get(nums[j]) };
            const C = { n: nums[k], pos: posByNum.get(nums[k]) };
            if (A.pos.length >= 1 && A.pos.length <= 3 && B.pos.length >= 1 && B.pos.length <= 3 && C.pos.length >= 1 && C.pos.length <= 3) {
              const union = [...new Set([...A.pos.map(p => p.toString()), ...B.pos.map(p => p.toString()), ...C.pos.map(p => p.toString())])].map(s => s.split(',').map(Number));
              if (union.length === 3) {
                for (const [r, c] of union) {
                  const before = cand[r][c].slice();
                  cand[r][c] = cand[r][c].filter((x) => [A.n, B.n, C.n].includes(x));
                  if (cand[r][c].length !== before.length) {
                    metrics.techniquesUsed.push(`Hidden Triple (${type})`);
                    if (recorder && recorder.enabled) {
                      const removed = before.filter((x) => ![A.n, B.n, C.n].includes(x)).map((n) => ({ r, c, n }));
                      if (removed.length) recorder.record(`Hidden Triple (${type})`, [], removed);
                    }
                    changed = true;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return changed;
}

function techniqueXWing(grid, cand, metrics, recorder) {
  let changed = false;
  // Row-based X-Wing
  for (let n = 1; n <= 9; n++) {
    const rowCols = [];
    for (let r = 0; r < 9; r++) {
      const cols = [];
      for (let c = 0; c < 9; c++) if (grid[r][c] === 0 && cand[r][c].includes(n)) cols.push(c);
      if (cols.length === 2) rowCols.push({ r, cols: cols.join(',') });
    }
    const groups = rowCols.reduce((m, rc) => { (m[rc.cols] ||= []).push(rc.r); return m; }, {});
    for (const key of Object.keys(groups)) {
      const rows = groups[key];
      if (rows.length === 2) {
        const [c1, c2] = key.split(',').map(Number);
        for (let r = 0; r < 9; r++) {
          if (!rows.includes(r)) {
            for (const c of [c1, c2]) {
              if (grid[r][c] === 0 && cand[r][c].includes(n)) {
                cand[r][c] = cand[r][c].filter((x) => x !== n);
                metrics.techniquesUsed.push('X-Wing (row)');
                if (recorder && recorder.enabled) recorder.record('X-Wing (row)', [], [{ r, c, n }]);
                changed = true;
              }
            }
          }
        }
      }
    }
  }
  // Column-based X-Wing
  for (let n = 1; n <= 9; n++) {
    const colRows = [];
    for (let c = 0; c < 9; c++) {
      const rows = [];
      for (let r = 0; r < 9; r++) if (grid[r][c] === 0 && cand[r][c].includes(n)) rows.push(r);
      if (rows.length === 2) colRows.push({ c, rows: rows.join(',') });
    }
    const groups = colRows.reduce((m, cr) => { (m[cr.rows] ||= []).push(cr.c); return m; }, {});
    for (const key of Object.keys(groups)) {
      const cols = groups[key];
      if (cols.length === 2) {
        const [r1, r2] = key.split(',').map(Number);
        for (let c = 0; c < 9; c++) {
          if (!cols.includes(c)) {
            for (const r of [r1, r2]) {
              if (grid[r][c] === 0 && cand[r][c].includes(n)) {
                cand[r][c] = cand[r][c].filter((x) => x !== n);
                metrics.techniquesUsed.push('X-Wing (col)');
                if (recorder && recorder.enabled) recorder.record('X-Wing (col)', [], [{ r, c, n }]);
                changed = true;
              }
            }
          }
        }
      }
    }
  }
  return changed;
}

function createRecorder(enabled) {
  const steps = [];
  return {
    enabled,
    steps,
    record(technique, placements = [], eliminations = []) {
      if (!enabled) return;
      steps.push({ technique, placements, eliminations });
    }
  };
}

function realizeSinglesFromCandidates(grid, cand, metrics, recorder) {
  // After elimination, place any singles that emerged
  let placed = false;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0 && cand[r][c].length === 1) {
        grid[r][c] = cand[r][c][0];
        metrics.steps++;
        metrics.techniquesUsed.push('Naked Single');
        if (recorder && recorder.enabled) recorder.record('Naked Single', [{ r, c, n: grid[r][c] }], []);
        updateCandidatesForPlacement(grid, cand, r, c, recorder);
        placed = true;
      }
    }
  }
  return placed;
}

function humanSolvePhase(grid, metrics, recorder) {
  const cand = buildCandidates(grid);
  let progress = true;
  while (progress) {
    progress = false;
    if (techniqueNakedSingles(grid, cand, metrics, recorder)) { progress = true; continue; }
    if (techniqueHiddenSingles(grid, cand, metrics, recorder)) { progress = true; continue; }
    if (techniqueLockedCandidates(grid, cand, metrics, recorder)) {
      if (realizeSinglesFromCandidates(grid, cand, metrics, recorder)) { progress = true; continue; }
      progress = true; // eliminations occurred
      continue;
    }
    if (techniqueNakedTuples(grid, cand, metrics, 2, recorder)) {
      if (realizeSinglesFromCandidates(grid, cand, metrics, recorder)) { progress = true; continue; }
      progress = true; continue;
    }
    if (techniqueHiddenPairs(grid, cand, metrics, recorder)) {
      if (realizeSinglesFromCandidates(grid, cand, metrics, recorder)) { progress = true; continue; }
      progress = true; continue;
    }
    if (techniqueNakedTuples(grid, cand, metrics, 3, recorder)) {
      if (realizeSinglesFromCandidates(grid, cand, metrics, recorder)) { progress = true; continue; }
      progress = true; continue;
    }
    if (techniqueHiddenTriples(grid, cand, metrics, recorder)) {
      if (realizeSinglesFromCandidates(grid, cand, metrics, recorder)) { progress = true; continue; }
      progress = true; continue;
    }
    if (techniqueXWing(grid, cand, metrics, recorder)) {
      if (realizeSinglesFromCandidates(grid, cand, metrics, recorder)) { progress = true; continue; }
      progress = true; continue;
    }
  }
}

module.exports = {
  solveSudoku,
  validateGrid,
  normalizeGrid,
  cloneGrid,
  isSafe,
  countSolutions,
  getCandidates,
  hasConflicts
};
