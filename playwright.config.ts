import { defineConfig } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100'

export default defineConfig({
  testDir: './tests',
  testMatch: /.*api\.spec\.(ts|js)/,
  timeout: 60_000,
  use: {
    baseURL,
  },
})
