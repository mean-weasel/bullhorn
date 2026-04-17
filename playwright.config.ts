import { defineConfig, devices } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Use port 3000 for Next.js (default) or TEST_PORT if specified
const PORT = process.env.TEST_PORT || 3000

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: process.env.CI ? 120_000 : 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    timezoneId: 'UTC',
    actionTimeout: process.env.CI ? 30_000 : 10_000,
    navigationTimeout: process.env.CI ? 60_000 : 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: process.env.CI
      ? `E2E_TEST_MODE=true NEXT_PUBLIC_E2E_TEST_MODE=true npm start -- --port ${PORT}`
      : `E2E_TEST_MODE=true NEXT_PUBLIC_E2E_TEST_MODE=true npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 180_000 : 120_000,
    env: {
      E2E_TEST_MODE: 'true',
      NEXT_PUBLIC_E2E_TEST_MODE: 'true',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      SELF_HOSTED: process.env.SELF_HOSTED || '',
    },
  },
})
