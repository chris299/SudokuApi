import { test, expect, request as pwRequest } from '@playwright/test'
import { spawn } from 'child_process'
import path from 'path'
import process from 'process'

let serverProc: any
const PORT = 3100
const BASE_URL = `http://127.0.0.1:${PORT}`

test.beforeAll(async ({ request }) => {
  serverProc = spawn('node', [path.join('src', 'server.js')], {
    env: { ...process.env, PORT: `${PORT}`, NODE_ENV: 'test' },
    stdio: 'inherit'
  })
  // Wait for /healthz to respond
  const start = Date.now()
  while (Date.now() - start < 5000) {
    try {
      const res = await request.get(`${BASE_URL}/healthz`)
      if (res.ok()) break
    } catch {}
    await new Promise((r) => setTimeout(r, 200))
  }
})

test.afterAll(async () => {
  if (serverProc) {
    serverProc.kill()
  }
})

test('generate -> solve -> evaluate flow', async ({ request }) => {
  const gen = await request.post(`${BASE_URL}/api/v1/sudoku/generate`, {
    data: { difficulty: 'medium', solutionIncluded: false }
  })
  expect(gen.ok()).toBeTruthy()
  const genJson = await gen.json()
  expect(genJson.puzzle).toBeTruthy()

  const solve = await request.post(`${BASE_URL}/api/v1/sudoku/solve`, {
    data: { puzzle: genJson.puzzle }
  })
  expect(solve.ok()).toBeTruthy()
  const solveJson = await solve.json()
  expect(solveJson.solution).toBeTruthy()

  const evalRes = await request.post(`${BASE_URL}/api/v1/sudoku/evaluate`, {
    data: { puzzle: genJson.puzzle }
  })
  expect(evalRes.ok()).toBeTruthy()
  const evalJson = await evalRes.json()
  expect(evalJson.rating).toBeTruthy()
})

test('explain returns steps and solution', async ({ request }) => {
  const gen = await request.post(`${BASE_URL}/api/v1/sudoku/generate`, { data: { difficulty: 'easy' } })
  expect(gen.ok()).toBeTruthy()
  const { puzzle } = await gen.json()

  const exp = await request.post(`${BASE_URL}/api/v1/sudoku/explain`, { data: { puzzle } })
  expect(exp.ok()).toBeTruthy()
  const body = await exp.json()
  expect(Array.isArray(body.steps)).toBeTruthy()
  expect(body.steps.length).toBeGreaterThan(0)
  expect(body.solution).toBeTruthy()
})

test('solve rejects invalid body (wrong key)', async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/sudoku/solve`, {
    data: { grid: [[1]] } as any
  })
  expect(res.status()).toBe(400)
})

test('solve rejects invalid grid shape', async ({ request }) => {
  const bad = Array.from({ length: 8 }, () => Array(9).fill(0))
  const res = await request.post(`${BASE_URL}/api/v1/sudoku/solve`, {
    data: { puzzle: bad }
  })
  expect(res.status()).toBe(400)
})

test('generate invalid difficulty yields 400', async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/v1/sudoku/generate`, {
    data: { difficulty: 'superhard' }
  })
  expect(res.status()).toBe(400)
})

test('unsolvable grid returns 422', async ({ request }) => {
  // Create a clear contradiction: two 5s in the same row
  const puzzle = Array.from({ length: 9 }, () => Array(9).fill(0))
  puzzle[0][0] = 5
  puzzle[0][1] = 5
  const res = await request.post(`${BASE_URL}/api/v1/sudoku/solve`, {
    data: { puzzle }
  })
  expect(res.status()).toBe(422)
  const json = await res.json()
  expect(json.code).toBe('UNSOLVABLE')
})
