#!/usr/bin/env node
/**
 * MCP Server Smoke Test
 *
 * Tests the MCP server against the Bullhorn API by sending JSON-RPC
 * messages over stdio and verifying responses.
 *
 * Usage: BULLHORN_API_KEY=bh_xxx node smoke-test.mjs
 *    or: doppler run --project bullhorn --config prd -- node smoke-test.mjs
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

if (!process.env.BULLHORN_API_KEY) {
  console.error('Error: BULLHORN_API_KEY is required')
  console.error('Usage: doppler run --project bullhorn --config prd -- node smoke-test.mjs')
  process.exit(1)
}

const proc = spawn('node', [join(__dirname, 'dist/index.js')], {
  env: process.env,
  stdio: ['pipe', 'pipe', 'pipe'],
})

let buf = ''
const responses = new Map()

proc.stdout.on('data', (chunk) => {
  buf += chunk.toString()

  // Parse newline-delimited JSON messages
  let newlineIdx
  while ((newlineIdx = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, newlineIdx).trim()
    buf = buf.slice(newlineIdx + 1)

    if (!line) continue
    try {
      const msg = JSON.parse(line)
      if (msg.id !== undefined) {
        responses.set(msg.id, msg)
      }
    } catch {
      // skip non-JSON lines
    }
  }
})

proc.stderr.on('data', () => {
  /* suppress stderr */
})

function send(msg) {
  proc.stdin.write(JSON.stringify(msg) + '\n')
}

function waitFor(id, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (responses.has(id)) return resolve(responses.get(id))
      if (Date.now() - start > timeout)
        return reject(new Error(`Timeout waiting for response ${id}`))
      setTimeout(check, 50)
    }
    check()
  })
}

let passed = 0
let failed = 0

async function run() {
  console.log('=== Bullhorn MCP Smoke Test ===\n')

  // Test 1: Initialize
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'smoke-test', version: '1.0' },
    },
  })

  try {
    const init = await waitFor(1)
    const info = init.result?.serverInfo
    if (info?.name === 'bullhorn') {
      console.log(`  1. Initialize ......... PASS (${info.name} v${info.version})`)
      passed++
    } else {
      console.log(`  1. Initialize ......... FAIL (unexpected: ${JSON.stringify(info)})`)
      failed++
    }
  } catch (e) {
    console.log(`  1. Initialize ......... FAIL (${e.message})`)
    failed++
  }

  // Send initialized notification
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })

  // Test 2: List tools
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  try {
    const tools = await waitFor(2)
    const count = tools.result?.tools?.length
    if (count > 0) {
      console.log(`  2. List Tools ......... PASS (${count} tools)`)
      passed++
    } else {
      console.log(`  2. List Tools ......... FAIL (0 tools)`)
      failed++
    }
  } catch (e) {
    console.log(`  2. List Tools ......... FAIL (${e.message})`)
    failed++
  }

  // Test 3: list_posts (read-only)
  send({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'list_posts', arguments: {} },
  })
  try {
    const result = await waitFor(3)
    const text = result.result?.content?.[0]?.text
    if (text) {
      const data = JSON.parse(text)
      console.log(`  3. list_posts ......... PASS (${data.posts?.length ?? 0} posts)`)
      passed++
    } else if (result.error) {
      console.log(`  3. list_posts ......... FAIL (${result.error.message})`)
      failed++
    } else {
      console.log(`  3. list_posts ......... FAIL (empty response)`)
      failed++
    }
  } catch (e) {
    console.log(`  3. list_posts ......... FAIL (${e.message})`)
    failed++
  }

  // Test 4: list_campaigns (read-only)
  send({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'list_campaigns', arguments: {} },
  })
  try {
    const result = await waitFor(4)
    const text = result.result?.content?.[0]?.text
    if (text) {
      const data = JSON.parse(text)
      console.log(`  4. list_campaigns ..... PASS (${data.campaigns?.length ?? 0} campaigns)`)
      passed++
    } else {
      console.log(`  4. list_campaigns ..... FAIL`)
      failed++
    }
  } catch (e) {
    console.log(`  4. list_campaigns ..... FAIL (${e.message})`)
    failed++
  }

  // Test 5: list_projects (read-only)
  send({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: { name: 'list_projects', arguments: {} },
  })
  try {
    const result = await waitFor(5)
    const text = result.result?.content?.[0]?.text
    if (text) {
      const data = JSON.parse(text)
      console.log(`  5. list_projects ...... PASS (${data.projects?.length ?? 0} projects)`)
      passed++
    } else {
      console.log(`  5. list_projects ...... FAIL`)
      failed++
    }
  } catch (e) {
    console.log(`  5. list_projects ...... FAIL (${e.message})`)
    failed++
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed`)
  console.log('===============================\n')

  proc.kill()
  process.exit(failed > 0 ? 1 : 0)
}

run()
