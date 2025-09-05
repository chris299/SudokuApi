# SudokuAPI

Node.js Sudoku API service to generate, solve, validate, evaluate, and explain Sudoku puzzles. Built with Fastify, validated with JSON Schema (AJV), and documented via OpenAPI.

## Features

- Generate puzzles with difficulty: `easy`, `medium`, `hard`, `expert`
- Solve puzzles and return metrics
- Evaluate difficulty using heuristic and human techniques
- Validate grid shape
- Explain step-by-step human-style solution techniques
- Rate limiting, input validation, structured logging
- OpenAPI spec served and Swagger UI

## Endpoints

- `POST /api/v1/sudoku/generate`
- `POST /api/v1/sudoku/solve`
- `POST /api/v1/sudoku/evaluate`
- `POST /api/v1/sudoku/validate`
- `POST /api/v1/sudoku/explain`
- `GET /openapi.yaml`
- `GET /docs` (Swagger UI)
- `GET /healthz`

See `openapi/openapi.yaml` for complete schemas.

## Run locally

```bash
npm install
npm start
# Server listens on http://localhost:3000 by default
```

Environment variables:
- `PORT` (default `3000`)
- `HOST` (default `0.0.0.0`)

Logs are written to `logs/access.log`.

## Tests

Unit tests (Jest):
```bash
npm test
```

API tests (Playwright):
```bash
npm run test:e2e
```

## CI (GitHub Actions)

The workflow runs on push and can be manually triggered. It installs dependencies, installs Playwright, runs unit tests and API tests. See `.github/workflows/playwright.yml`.

## Architecture

- Fastify server with rate limiting and sensible defaults
- Sudoku engine: generator, solver (human techniques + backtracking), difficulty evaluator
- Swagger/OpenAPI for documentation
- PlantUML diagrams in `docs/`:
  - `architecture.puml` – high-level architecture
  - `techniques.puml` – activity diagrams for human techniques
  - `classes.puml` – module/class diagram

## Security & Hardening

- JSON Schema validation with AJV: type coercion, removal of additional properties
- Rate limiting (100 req/min/IP) with headers
- Request body size limit (10KB)
- Structured logging of requests and responses/errors for audit

## Reference Material

Domain-specific heuristics were guided by https://www.heise.de/hintergrund/Wie-man-mit-einem-Python-Programm-die-Schwierigkeit-von-Sudokus-bewertet-10291201.html?seite=all and their Repo https://github.com/Periculum/Sudoku-evaluating-program .

