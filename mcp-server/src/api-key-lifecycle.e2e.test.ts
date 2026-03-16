/* eslint-disable max-lines */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import { spawn, ChildProcess } from 'child_process'
import { createHash, randomBytes } from 'crypto'
import path from 'path'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MCP_SERVER_DIR = path.resolve(__dirname, '..')
const APP_ROOT = path.resolve(__dirname, '../..')
const API_URL = 'http://localhost:3001'
const SUPABASE_PROJECT_REF = '<your-supabase-project-ref>'

/** Generate a test API key with matching SHA-256 hash. */
function generateTestKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const rawKey = `bh_test_${randomBytes(24).toString('hex')}`
  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 12)
  return { rawKey, keyHash, keyPrefix }
}

/** Generate a random UUID. */
function randomUuid(): string {
  return randomBytes(16)
    .toString('hex')
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
}

/**
 * Execute raw SQL via the Supabase Management API.
 * Bypasses PostgREST (and its stale schema cache) entirely.
 */
async function execSql(accessToken: string, sql: string): Promise<unknown[]> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SQL execution failed (${res.status}): ${text}`)
  }
  return res.json()
}

/**
 * Fetch the Supabase project URL and API keys from the Management API.
 * Ensures the Next.js server connects to the SAME database where we insert test data.
 */
async function fetchProjectCredentials(
  accessToken: string
): Promise<{ url: string; anonKey: string; serviceRoleKey: string }> {
  const url = `https://${SUPABASE_PROJECT_REF}.supabase.co`

  const keysRes = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/api-keys`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!keysRes.ok) {
    throw new Error(`Failed to fetch API keys: ${keysRes.status}`)
  }
  const keys = (await keysRes.json()) as Array<{ name: string; api_key: string }>

  const anonKey = keys.find((k) => k.name === 'anon')?.api_key
  const serviceRoleKey = keys.find((k) => k.name === 'service_role')?.api_key

  if (!anonKey || !serviceRoleKey) {
    throw new Error('Could not find anon or service_role keys from Management API')
  }

  return { url, anonKey, serviceRoleKey }
}

/** Insert an API key via raw SQL through the Management API. */
async function insertTestKey(
  accessToken: string,
  key: { keyHash: string; keyPrefix: string },
  opts: { userId: string; scopes: string[]; expiresAt?: string; name?: string }
) {
  const id = randomUuid()
  const now = new Date().toISOString()
  const name = (opts.name || 'lifecycle-test-key').replace(/'/g, "''")
  const scopesLiteral = `ARRAY[${opts.scopes.map((s) => `'${s}'`).join(',')}]::text[]`
  const expiresAt = opts.expiresAt ? `'${opts.expiresAt}'::timestamptz` : 'NULL'

  await execSql(
    accessToken,
    `INSERT INTO public.api_keys (id, user_id, name, key_hash, key_prefix, scopes, expires_at, created_at, updated_at)
     VALUES ('${id}', '${opts.userId}', '${name}', '${key.keyHash}', '${key.keyPrefix}', ${scopesLiteral}, ${expiresAt}, '${now}'::timestamptz, '${now}'::timestamptz)`
  )
}

/** Revoke a key by hash via raw SQL. */
async function revokeTestKey(accessToken: string, keyHash: string) {
  await execSql(
    accessToken,
    `UPDATE public.api_keys SET revoked_at = now() WHERE key_hash = '${keyHash}'`
  )
}

/** Delete a test key by hash via raw SQL. */
async function deleteTestKey(accessToken: string, keyHash: string) {
  await execSql(accessToken, `DELETE FROM public.api_keys WHERE key_hash = '${keyHash}'`)
}

/** Delete all test keys for a user via raw SQL. */
async function deleteTestKeysForUser(accessToken: string, userId: string) {
  await execSql(accessToken, `DELETE FROM public.api_keys WHERE user_id = '${userId}'`)
}

/** Spawn an MCP server process connected to a fresh Client. */
async function createMcpClient(
  apiKey: string
): Promise<{ client: Client; transport: StdioClientTransport }> {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    cwd: MCP_SERVER_DIR,
    env: {
      ...process.env,
      BULLHORN_API_KEY: apiKey,
      BULLHORN_API_URL: API_URL,
    },
    stderr: 'pipe',
  })

  const client = new Client(
    { name: 'lifecycle-test-client', version: '1.0.0' },
    { capabilities: {} }
  )
  await client.connect(transport)
  return { client, transport }
}

/** Call an MCP tool and return the raw result. */
async function callTool(client: Client, name: string, args: Record<string, unknown> = {}) {
  return client.request(
    { method: 'tools/call', params: { name, arguments: args } },
    CallToolResultSchema
  )
}

/** Extract text from the first text content block. */
function getResponseText(response: {
  content: Array<{ type: string; text?: string }>
  isError?: boolean
}): string {
  const block = response.content.find((c) => c.type === 'text')
  return block?.text || ''
}

/** Poll a URL until it returns 200 or timeout is reached. */
async function waitForServer(url: string, timeoutMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`)
}

// ---------------------------------------------------------------------------
// All available scopes (mirrored from src/lib/auth.ts)
// ---------------------------------------------------------------------------
const ALL_SCOPES = [
  'posts:read',
  'posts:write',
  'campaigns:read',
  'campaigns:write',
  'projects:read',
  'projects:write',
  'blog:read',
  'blog:write',
  'launches:read',
  'launches:write',
  'media:write',
  'analytics:read',
]

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

// eslint-disable-next-line max-lines-per-function
describe('API Key Lifecycle E2E', () => {
  let accessToken: string
  let testUserId: string
  let apiProcess: ChildProcess

  // Track keys for cleanup
  const createdKeyHashes: string[] = []
  const createdPostIds: string[] = []

  // eslint-disable-next-line max-lines-per-function
  beforeAll(async () => {
    // 1. Validate required env vars
    const sbAccessToken = process.env.SUPABASE_ACCESS_TOKEN
    if (!sbAccessToken) {
      throw new Error(
        'Missing SUPABASE_ACCESS_TOKEN. ' +
          'Set SUPABASE_ACCESS_TOKEN in your environment, then run: npm run test:e2e'
      )
    }
    accessToken = sbAccessToken

    // 2. Create (or reuse) a test user entirely via Management API SQL
    //    GoTrue auth admin API writes are NOT visible from the Management API
    //    SQL endpoint (different connection paths), so we create the user directly.
    const testEmail = 'lifecycle-test@bullhorn.test'
    const existingRows = (await execSql(
      accessToken,
      `SELECT id FROM auth.users WHERE email = '${testEmail}' LIMIT 1`
    )) as Array<{ id: string }>

    if (existingRows.length > 0) {
      testUserId = existingRows[0].id
    } else {
      const newUserId = randomUuid()
      const now = new Date().toISOString()
      await execSql(
        accessToken,
        `INSERT INTO auth.users (
           id, aud, role, email, encrypted_password, email_confirmed_at,
           raw_app_meta_data, raw_user_meta_data, is_super_admin,
           created_at, updated_at, is_sso_user, is_anonymous
         ) VALUES (
           '${newUserId}', 'authenticated', 'authenticated',
           '${testEmail}', '', '${now}'::timestamptz,
           '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
           '${now}'::timestamptz, '${now}'::timestamptz, false, false
         )`
      )
      testUserId = newUserId
    }

    // 4. Ensure user_profiles row exists with 'pro' plan (avoids limit enforcement)
    await execSql(
      accessToken,
      `INSERT INTO public.user_profiles (id, plan, updated_at)
       VALUES ('${testUserId}', 'pro', now())
       ON CONFLICT (id) DO UPDATE SET plan = 'pro', updated_at = now()`
    )

    // 5. Fetch remote Supabase credentials so the Next.js server
    //    connects to the SAME database where we insert test data.
    const creds = await fetchProjectCredentials(accessToken)

    // 6. Build MCP server
    await new Promise<void>((resolve, reject) => {
      const build = spawn('npm', ['run', 'build'], {
        cwd: MCP_SERVER_DIR,
        stdio: 'pipe',
      })
      build.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`MCP server build failed with code ${code}`))
      })
    })

    // 7. Start Next.js on port 3001 WITHOUT E2E_TEST_MODE
    //    Override Supabase env vars to point at the remote project.
    apiProcess = spawn('npm', ['run', 'api:start'], {
      cwd: APP_ROOT,
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: '3001',
        NEXT_PUBLIC_SUPABASE_URL: creds.url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: creds.anonKey,
        SUPABASE_SERVICE_ROLE_KEY: creds.serviceRoleKey,
      },
    })

    // 8. Wait for server to be ready
    await waitForServer(`${API_URL}/api/health`, 60000)
  }, 120000)

  afterAll(async () => {
    // Clean up test posts via Management API SQL
    for (const postId of createdPostIds) {
      await execSql(accessToken, `DELETE FROM public.posts WHERE id = '${postId}'`).catch(() => {})
    }

    // Clean up test API keys via Management API SQL
    for (const keyHash of createdKeyHashes) {
      await deleteTestKey(accessToken, keyHash).catch(() => {})
    }

    // Delete test user and related data via Management API SQL
    if (testUserId) {
      await execSql(accessToken, `DELETE FROM public.posts WHERE user_id = '${testUserId}'`).catch(
        () => {}
      )
      await execSql(
        accessToken,
        `DELETE FROM public.campaigns WHERE user_id = '${testUserId}'`
      ).catch(() => {})
      await deleteTestKeysForUser(accessToken, testUserId).catch(() => {})
      await execSql(
        accessToken,
        `DELETE FROM public.user_profiles WHERE id = '${testUserId}'`
      ).catch(() => {})
      await execSql(accessToken, `DELETE FROM auth.users WHERE id = '${testUserId}'`).catch(
        () => {}
      )
    }

    // Kill Next.js process
    if (apiProcess) {
      apiProcess.kill('SIGTERM')
    }
  })

  // -------------------------------------------------------------------------
  // Full-scope key
  // -------------------------------------------------------------------------

  describe('Full-scope key', () => {
    it('MCP operations succeed with a valid all-scope key', async () => {
      const key = generateTestKey()
      createdKeyHashes.push(key.keyHash)

      await insertTestKey(accessToken, key, {
        userId: testUserId,
        scopes: ALL_SCOPES,
      })

      const { client, transport } = await createMcpClient(key.rawKey)

      try {
        // list_posts should succeed
        const listResult = await callTool(client, 'list_posts', { limit: 5 })
        expect(listResult.isError).not.toBe(true)

        // create_post should succeed
        const createResult = await callTool(client, 'create_post', {
          platform: 'twitter',
          content: { text: 'Lifecycle E2E test tweet' },
        })
        expect(createResult.isError).not.toBe(true)

        const parsed = JSON.parse(getResponseText(createResult))
        expect(parsed.success).toBe(true)
        const postId = parsed.post.id
        createdPostIds.push(postId)

        // delete the post to clean up
        const deleteResult = await callTool(client, 'delete_post', {
          id: postId,
          confirmed: true,
        })
        expect(deleteResult.isError).not.toBe(true)
      } finally {
        await transport.close()
      }
    })

    it('MCP operations fail after key revocation', async () => {
      const key = generateTestKey()
      createdKeyHashes.push(key.keyHash)

      await insertTestKey(accessToken, key, {
        userId: testUserId,
        scopes: ALL_SCOPES,
      })

      // Revoke the key
      await revokeTestKey(accessToken, key.keyHash)

      const { client, transport } = await createMcpClient(key.rawKey)

      try {
        const result = await callTool(client, 'list_posts', { limit: 5 })
        expect(result.isError).toBe(true)
        expect(getResponseText(result).toLowerCase()).toContain('unauthorized')
      } finally {
        await transport.close()
      }
    })
  })

  // -------------------------------------------------------------------------
  // Scope enforcement
  // -------------------------------------------------------------------------

  describe('Scope enforcement', () => {
    it('Read-only key allows reads but blocks writes', async () => {
      const key = generateTestKey()
      createdKeyHashes.push(key.keyHash)

      await insertTestKey(accessToken, key, {
        userId: testUserId,
        scopes: ['posts:read'],
      })

      const { client, transport } = await createMcpClient(key.rawKey)

      try {
        // list_posts (read) should succeed
        const listResult = await callTool(client, 'list_posts', { limit: 5 })
        expect(listResult.isError).not.toBe(true)

        // create_post (write) should fail with Forbidden
        const createResult = await callTool(client, 'create_post', {
          platform: 'twitter',
          content: { text: 'Should be forbidden' },
        })
        expect(createResult.isError).toBe(true)
        expect(getResponseText(createResult).toLowerCase()).toContain('forbidden')
      } finally {
        await transport.close()
      }
    })

    it('Posts-only key blocks campaign operations', async () => {
      const key = generateTestKey()
      createdKeyHashes.push(key.keyHash)

      await insertTestKey(accessToken, key, {
        userId: testUserId,
        scopes: ['posts:read', 'posts:write'],
      })

      const { client, transport } = await createMcpClient(key.rawKey)

      try {
        // create_post should succeed
        const createResult = await callTool(client, 'create_post', {
          platform: 'twitter',
          content: { text: 'Posts-only scope test' },
        })
        expect(createResult.isError).not.toBe(true)

        const parsed = JSON.parse(getResponseText(createResult))
        createdPostIds.push(parsed.post.id)

        // list_campaigns should fail with Forbidden
        const campaignResult = await callTool(client, 'list_campaigns')
        expect(campaignResult.isError).toBe(true)
        expect(getResponseText(campaignResult).toLowerCase()).toContain('forbidden')

        // Clean up created post
        await callTool(client, 'delete_post', {
          id: parsed.post.id,
          confirmed: true,
        })
      } finally {
        await transport.close()
      }
    })
  })

  // -------------------------------------------------------------------------
  // Key expiration
  // -------------------------------------------------------------------------

  describe('Key expiration', () => {
    it('Expired key is rejected', async () => {
      const key = generateTestKey()
      createdKeyHashes.push(key.keyHash)

      // Set expires_at to 1 hour ago
      const expiredAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()

      await insertTestKey(accessToken, key, {
        userId: testUserId,
        scopes: ALL_SCOPES,
        expiresAt: expiredAt,
      })

      const { client, transport } = await createMcpClient(key.rawKey)

      try {
        const result = await callTool(client, 'list_posts', { limit: 5 })
        expect(result.isError).toBe(true)
        expect(getResponseText(result).toLowerCase()).toContain('unauthorized')
      } finally {
        await transport.close()
      }
    })
  })
})
