const fastify = require('fastify')
const rateLimit = require('@fastify/rate-limit')
const sensible = require('@fastify/sensible')
const cors = require('@fastify/cors')
const swagger = require('@fastify/swagger')
const swaggerUI = require('@fastify/swagger-ui')
const fs = require('fs')
const path = require('path')

const { generateSudoku } = require('./sudoku.generator')
const { solveSudoku, validateGrid, normalizeGrid, hasConflicts } = require('./sudoku.solver')
const { evaluateDifficulty } = require('./sudoku.difficulty')

function isServerless() {
  return !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME)
}

function buildLogger() {
  if (isServerless()) return true
  const logsDir = path.join(__dirname, '..', 'logs')
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
  return {
    transport: {
      target: 'pino/file',
      options: { destination: path.join(logsDir, 'access.log'), mkdir: true }
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`
  }
}

function logAccess(app, route, reqBody, resBody, statusCode = 200) {
  app.log.info({ route, statusCode, request: reqBody, response: resBody })
}

function resolveOpenApiPath() {
  const candidates = [
    // Local dev (run from repo): src/.. -> openapi/openapi.yaml
    path.join(__dirname, '..', 'openapi', 'openapi.yaml'),
    // Netlify functions (served from .netlify/functions-serve/api/netlify/functions)
    path.join(__dirname, '..', '..', 'openapi', 'openapi.yaml'),
    // Fallback to CWD
    path.join(process.cwd(), 'openapi', 'openapi.yaml')
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p
    } catch {}
  }
  // Last resort: default to repo-relative path
  return path.join(__dirname, '..', 'openapi', 'openapi.yaml')
}

function resolveProjectFile(...segments) {
  const candidates = [
    path.join(__dirname, '..', ...segments),
    path.join(__dirname, '..', '..', ...segments),
    path.join(process.cwd(), ...segments)
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p
    } catch {}
  }
  return path.join(__dirname, '..', ...segments)
}

function registerRoutes(app) {
  // Serve OpenAPI spec and Swagger UI
  app.register(swagger, {
    mode: 'static',
    specification: { path: resolveOpenApiPath() }
  })
  app.register(swaggerUI, { routePrefix: '/docs', uiConfig: { docExpansion: 'list', deepLinking: true } })

  // Raw OpenAPI file
  app.get('/openapi.yaml', async (req, reply) => {
    const specPath = path.join(__dirname, '..', 'openapi', 'openapi.yaml')
    const content = fs.readFileSync(specPath, 'utf8')
    logAccess(app, '/openapi.yaml', null, 'YAML', 200)
    reply.type('application/yaml').send(content)
  })

  // Serve favicon.ico from project root if present
  app.get('/favicon.ico', async (req, reply) => {
    try {
      const iconPath = resolveProjectFile('favicon.ico')
      if (fs.existsSync(iconPath)) {
        logAccess(app, '/favicon.ico', null, 'ICO', 200)
        reply.type('image/x-icon')
        return fs.createReadStream(iconPath)
      }
      return reply.code(404).send()
    } catch (e) {
      app.log.error({ e }, 'favicon error')
      return reply.code(500).send()
    }
  })

  // Health endpoint for readiness checks
  app.get('/healthz', async (req, reply) => {
    const res = { ok: true }
    logAccess(app, '/healthz', null, res, 200)
    return res
  })

  const gridSchema = {
    type: 'array',
    minItems: 9,
    maxItems: 9,
    items: {
      type: 'array',
      minItems: 9,
      maxItems: 9,
      items: { type: 'integer', minimum: 0, maximum: 9 }
    }
  }

  const difficultyEnum = { type: 'string', enum: ['easy', 'medium', 'hard', 'expert'] }

  app.route({
    method: 'POST',
    url: '/api/v1/sudoku/generate',
    schema: {
      body: {
        type: 'object',
        properties: {
          difficulty: difficultyEnum,
          solutionIncluded: { type: 'boolean', default: false }
        },
        required: ['difficulty'],
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            puzzle: gridSchema,
            solution: gridSchema
          },
          required: ['puzzle']
        }
      }
    },
    handler: async (req, reply) => {
      const { difficulty, solutionIncluded } = req.body
      if (!['easy', 'medium', 'hard', 'expert'].includes(difficulty)) {
        const res = { error: 'InvalidDifficulty', code: 'INVALID_DIFFICULTY', details: 'Must be easy|medium|hard|expert' }
        logAccess(app, '/api/v1/sudoku/generate', req.body, res, 400)
        return reply.code(400).send(res)
      }
      try {
        const { puzzle, solution } = generateSudoku(difficulty)
        const res = solutionIncluded ? { puzzle, solution } : { puzzle }
        logAccess(app, '/api/v1/sudoku/generate', req.body, { ...res, solution: undefined }, 200)
        return res
      } catch (err) {
        app.log.error({ err }, 'Generation error')
        const res = { error: 'GenerationFailed', code: 'GENERATION_FAILED', details: err.message }
        logAccess(app, '/api/v1/sudoku/generate', req.body, res, 500)
        return reply.code(500).send(res)
      }
    }
  })

  app.route({
    method: 'POST',
    url: '/api/v1/sudoku/solve',
    schema: {
      body: { type: 'object', properties: { puzzle: gridSchema }, required: ['puzzle'], additionalProperties: false },
      response: {
        200: {
          type: 'object',
          properties: {
            solution: gridSchema,
            metrics: {
              type: 'object',
              properties: {
                steps: { type: 'integer', minimum: 0 },
                backtracks: { type: 'integer', minimum: 0 },
                techniquesUsed: { type: 'array', items: { type: 'string' } }
              },
              required: ['steps', 'backtracks']
            }
          },
          required: ['solution']
        }
      }
    },
    handler: async (req, reply) => {
      const { puzzle } = req.body
      if (!validateGrid(puzzle)) {
        const res = { error: 'InvalidGrid', code: 'INVALID_GRID', details: 'Grid must be 9x9 with integers 0-9' }
        logAccess(app, '/api/v1/sudoku/solve', req.body, res, 400)
        return reply.code(400).send(res)
      }
      if (hasConflicts(puzzle)) {
        const res = { error: 'Unsolvable', code: 'UNSOLVABLE', details: 'Puzzle has conflicts (duplicates in row/col/box)' }
        logAccess(app, '/api/v1/sudoku/solve', req.body, res, 422)
        return reply.code(422).send(res)
      }
      try {
        const { solution, metrics } = solveSudoku(normalizeGrid(puzzle))
        if (!solution) {
          const res = { error: 'Unsolvable', code: 'UNSOLVABLE', details: 'Puzzle has no solution' }
          logAccess(app, '/api/v1/sudoku/solve', req.body, res, 422)
          return reply.code(422).send(res)
        }
        const res = { solution, metrics }
        logAccess(app, '/api/v1/sudoku/solve', req.body, res, 200)
        return res
      } catch (err) {
        app.log.error({ err }, 'Solve error')
        const res = { error: 'SolveFailed', code: 'SOLVE_FAILED', details: err.message }
        logAccess(app, '/api/v1/sudoku/solve', req.body, res, 500)
        return reply.code(500).send(res)
      }
    }
  })

  // Test-only route to assert rate limit headers on exceed
  if (process.env.NODE_ENV === 'test') {
    app.get('/api/v1/test/ratelimit', {
      config: {
        rateLimit: { max: 1, timeWindow: '1 minute', hook: 'onRequest' }
      }
    }, async (req, reply) => {
      return { ok: true }
    })
  }

  app.route({
    method: 'POST',
    url: '/api/v1/sudoku/explain',
    schema: {
      body: { type: 'object', properties: { puzzle: gridSchema }, required: ['puzzle'], additionalProperties: false },
      response: {
        200: {
          type: 'object',
          properties: {
            solution: gridSchema,
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  technique: { type: 'string' },
                  placements: { type: 'array', items: { type: 'object', properties: { r: { type: 'integer' }, c: { type: 'integer' }, n: { type: 'integer' } }, required: ['r','c','n'] } },
                  eliminations: { type: 'array', items: { type: 'object', properties: { r: { type: 'integer' }, c: { type: 'integer' }, n: { type: 'integer' } }, required: ['r','c','n'] } }
                },
                required: ['technique']
              }
            },
            metrics: {
              type: 'object',
              properties: {
                steps: { type: 'integer', minimum: 0 },
                backtracks: { type: 'integer', minimum: 0 },
                techniquesUsed: { type: 'array', items: { type: 'string' } }
              },
              required: ['steps', 'backtracks']
            }
          },
          required: ['solution', 'steps']
        }
      }
    },
    handler: async (req, reply) => {
      const { puzzle } = req.body
      if (!validateGrid(puzzle)) {
        const res = { error: 'InvalidGrid', code: 'INVALID_GRID', details: 'Grid must be 9x9 with integers 0-9' }
        logAccess(app, '/api/v1/sudoku/explain', req.body, res, 400)
        return reply.code(400).send(res)
      }
      if (hasConflicts(puzzle)) {
        const res = { error: 'Unsolvable', code: 'UNSOLVABLE', details: 'Puzzle has conflicts (duplicates in row/col/box)' }
        logAccess(app, '/api/v1/sudoku/explain', req.body, res, 422)
        return reply.code(422).send(res)
      }
      try {
        const { solution, metrics, steps } = solveSudoku(normalizeGrid(puzzle), { explain: true })
        const res = { solution, steps, metrics }
        logAccess(app, '/api/v1/sudoku/explain', req.body, { stepsCount: steps?.length || 0 }, 200)
        return res
      } catch (err) {
        app.log.error({ err }, 'Explain error')
        const res = { error: 'ExplainFailed', code: 'EXPLAIN_FAILED', details: err.message }
        logAccess(app, '/api/v1/sudoku/explain', req.body, res, 500)
        return reply.code(500).send(res)
      }
    }
  })

  app.route({
    method: 'POST',
    url: '/api/v1/sudoku/evaluate',
    schema: {
      body: { type: 'object', properties: { puzzle: gridSchema }, required: ['puzzle'], additionalProperties: false },
      response: {
        200: {
          type: 'object',
          properties: {
            rating: { type: 'object', properties: { level: difficultyEnum, score: { type: 'number' } }, required: ['level', 'score'] },
            metrics: {
              type: 'object',
              properties: {
                steps: { type: 'integer', minimum: 0 },
                backtracks: { type: 'integer', minimum: 0 },
                techniquesUsed: { type: 'array', items: { type: 'string' } }
              },
              required: ['steps', 'backtracks']
            }
          },
          required: ['rating']
        }
      }
    },
    handler: async (req, reply) => {
      const { puzzle } = req.body
      if (!validateGrid(puzzle)) {
        const res = { error: 'InvalidGrid', code: 'INVALID_GRID', details: 'Grid must be 9x9 with integers 0-9' }
        logAccess(app, '/api/v1/sudoku/evaluate', req.body, res, 400)
        return reply.code(400).send(res)
      }
      try {
        const norm = normalizeGrid(puzzle)
        const { rating, metrics } = evaluateDifficulty(norm)
        const res = { rating, metrics }
        logAccess(app, '/api/v1/sudoku/evaluate', req.body, res, 200)
        return res
      } catch (err) {
        app.log.error({ err }, 'Evaluate error')
        const res = { error: 'EvaluateFailed', code: 'EVALUATE_FAILED', details: err.message }
        logAccess(app, '/api/v1/sudoku/evaluate', req.body, res, 500)
        return reply.code(500).send(res)
      }
    }
  })

  // Global error handler to ensure consistent error responses
  app.setErrorHandler((error, req, reply) => {
    app.log.error({ err: error }, 'Unhandled error')
    const status = error.statusCode || 500
    const payload = {
      error: error.name || 'Error',
      code: error.code || 'INTERNAL_ERROR',
      details: error.message || 'Internal Server Error'
    }
    logAccess(app, req.url, req.body, payload, status)
    reply.code(status).send(payload)
  })
}

async function createApp() {
  const app = fastify({
    logger: buildLogger(),
    bodyLimit: 1024 * 10,
    ajv: { customOptions: { removeAdditional: 'all', useDefaults: true, coerceTypes: true, allErrors: true, strict: false } }
  })

  app.register(sensible)
  app.register(cors, { origin: true, methods: ['GET', 'POST', 'OPTIONS'] })
  app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    ban: 0,
    hook: 'preHandler',
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'ratelimit-limit': true,
      'ratelimit-remaining': true,
      'ratelimit-reset': true,
      'retry-after': true
    },
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'ratelimit-limit': true,
      'ratelimit-remaining': true,
      'ratelimit-reset': true
    }
  })

  registerRoutes(app)
  return app
}

module.exports = { createApp }
