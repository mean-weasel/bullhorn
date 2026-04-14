import { test, expect } from '@playwright/test'

// Canary: asserts every user-facing table and RPC is reachable via the
// PostgREST schema cache. Catches schema-cache drift where a migration has
// landed but PostgREST has not reloaded its cached schema.
test.describe('Schema Health Canary', () => {
  test('all tables and RPCs are reachable via PostgREST schema cache', async ({ page }) => {
    const res = await page.request.get('/api/health/schema')
    const body = await res.json()
    expect(res.status(), JSON.stringify(body)).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.tables).toBeGreaterThan(0)
    expect(body.rpcs).toBeGreaterThan(0)
  })
})
