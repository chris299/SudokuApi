import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: /.*api\.spec\.(ts|js)/,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
  },
})
