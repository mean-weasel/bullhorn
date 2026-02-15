#!/usr/bin/env node
/**
 * MCP Server Smoke Test
 *
 * Tests the MCP server against the Bullhorn API by sending JSON-RPC
 * messages over stdio and verifying responses.
 *
 * Covers: protocol, posts CRUD, campaigns CRUD + linking, projects CRUD,
 * blog drafts CRUD, launch posts CRUD, media upload+delete, confirmation
 * guards, and search.
 *
 * All test data uses a [SMOKE] prefix and is cleaned up after each run.
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

// --- Helpers ---

let _nextId = 0
function nextId() {
  return ++_nextId
}

function send(msg) {
  proc.stdin.write(JSON.stringify(msg) + '\n')
}

function waitFor(id, timeout = 15000) {
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

/** Send a tools/call and return the raw response */
async function callTool(id, name, args = {}) {
  send({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: args },
  })
  return waitFor(id)
}

/** callTool + assert success + parse JSON text content */
async function expectSuccess(id, name, args = {}) {
  const resp = await callTool(id, name, args)
  if (resp.error) throw new Error(`RPC error: ${resp.error.message}`)
  const content = resp.result?.content?.[0]
  if (!content?.text) throw new Error('Empty response')
  if (resp.result?.isError) throw new Error(`Tool error: ${content.text}`)
  return JSON.parse(content.text)
}

/** callTool + assert isError=true, return error text */
async function expectError(id, name, args = {}) {
  const resp = await callTool(id, name, args)
  if (resp.error) throw new Error(`RPC error (expected tool error): ${resp.error.message}`)
  const content = resp.result?.content?.[0]
  if (!resp.result?.isError) throw new Error('Expected isError=true but got success')
  return content?.text ?? ''
}

// --- Test tracking ---

let passed = 0
let failed = 0
let skipped = 0
let testNum = 0

function label(name) {
  testNum++
  const num = String(testNum).padStart(2, ' ')
  const dots = '.'.repeat(Math.max(1, 28 - name.length))
  return { num, prefix: `${num}. ${name} ${dots}` }
}

function pass(name, detail = '') {
  const { prefix } = label(name)
  const suffix = detail ? ` (${detail})` : ''
  console.log(`  ${prefix} PASS${suffix}`)
  passed++
}

function fail(name, reason = '') {
  const { prefix } = label(name)
  const suffix = reason ? ` (${reason})` : ''
  console.log(`  ${prefix} FAIL${suffix}`)
  failed++
}

function skip(name, reason = '') {
  const { prefix } = label(name)
  const suffix = reason ? ` (${reason})` : ''
  console.log(`  ${prefix} SKIP${suffix}`)
  skipped++
}

// --- Cleanup registry ---

const cleanup = {
  postIds: [],
  campaignIds: [],
  projectIds: [],
  draftIds: [],
  launchIds: [],
  mediaFilenames: [],
}

async function runCleanup() {
  for (const id of cleanup.postIds) {
    try {
      await callTool(nextId(), 'delete_post', { id, confirmed: true })
    } catch { /* best effort */ }
  }
  for (const id of cleanup.campaignIds) {
    try {
      await callTool(nextId(), 'delete_campaign', { id })
    } catch { /* best effort */ }
  }
  for (const id of cleanup.projectIds) {
    try {
      await callTool(nextId(), 'delete_project', { id, confirmed: true })
    } catch { /* best effort */ }
  }
  for (const id of cleanup.draftIds) {
    try {
      await callTool(nextId(), 'delete_blog_draft', { id, confirmed: true })
    } catch { /* best effort */ }
  }
  for (const id of cleanup.launchIds) {
    try {
      await callTool(nextId(), 'delete_launch_post', { id, confirmed: true })
    } catch { /* best effort */ }
  }
  for (const filename of cleanup.mediaFilenames) {
    try {
      await callTool(nextId(), 'delete_media', { filename })
    } catch { /* best effort */ }
  }
}

// --- Test groups ---

async function testProtocol() {
  console.log('\n  Protocol')

  // 1. Initialize
  const initId = nextId()
  send({
    jsonrpc: '2.0',
    id: initId,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'smoke-test', version: '1.0' },
    },
  })

  try {
    const init = await waitFor(initId)
    const info = init.result?.serverInfo
    if (info?.name === 'bullhorn') {
      pass('Initialize', `${info.name} v${info.version}`)
    } else {
      fail('Initialize', `unexpected: ${JSON.stringify(info)}`)
    }
  } catch (e) {
    fail('Initialize', e.message)
  }

  // Send initialized notification
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })

  // 2. List tools
  try {
    const toolsId = nextId()
    send({ jsonrpc: '2.0', id: toolsId, method: 'tools/list', params: {} })
    const tools = await waitFor(toolsId)
    const count = tools.result?.tools?.length
    if (count > 40) {
      pass('List Tools', `${count} tools`)
    } else {
      fail('List Tools', `only ${count} tools, expected >40`)
    }
  } catch (e) {
    fail('List Tools', e.message)
  }
}

async function testPosts() {
  console.log('\n  Posts')

  let postId = null

  // 3. list_posts
  try {
    const data = await expectSuccess(nextId(), 'list_posts')
    pass('list_posts', `${data.posts?.length ?? 0} posts`)
  } catch (e) {
    fail('list_posts', e.message)
  }

  // 4. create_post
  try {
    const data = await expectSuccess(nextId(), 'create_post', {
      platform: 'twitter',
      content: { text: '[SMOKE] test post' },
    })
    postId = data.post?.id
    if (!postId) throw new Error('No post id returned')
    cleanup.postIds.push(postId)
    pass('create_post', `id: ${postId.slice(0, 8)}`)
  } catch (e) {
    fail('create_post', e.message)
  }

  // 5. get_post
  if (postId) {
    try {
      const data = await expectSuccess(nextId(), 'get_post', { id: postId })
      if (data.post?.content?.text === '[SMOKE] test post') {
        pass('get_post')
      } else {
        fail('get_post', 'content mismatch')
      }
    } catch (e) {
      fail('get_post', e.message)
    }
  } else {
    skip('get_post', 'no post created')
  }

  // 6. update_post
  if (postId) {
    try {
      await expectSuccess(nextId(), 'update_post', {
        id: postId,
        content: { text: '[SMOKE] updated post' },
      })
      pass('update_post')
    } catch (e) {
      fail('update_post', e.message)
    }
  } else {
    skip('update_post', 'no post created')
  }

  // 7. search_posts
  if (postId) {
    try {
      const data = await expectSuccess(nextId(), 'search_posts', { query: '[SMOKE]' })
      const found = data.posts?.some((p) => p.id === postId)
      if (found) {
        pass('search_posts')
      } else {
        fail('search_posts', 'created post not found in results')
      }
    } catch (e) {
      fail('search_posts', e.message)
    }
  } else {
    skip('search_posts', 'no post created')
  }

  // 8. delete_post
  if (postId) {
    try {
      await expectSuccess(nextId(), 'delete_post', { id: postId, confirmed: true })
      cleanup.postIds = cleanup.postIds.filter((id) => id !== postId)
      pass('delete_post')
    } catch (e) {
      fail('delete_post', e.message)
    }
  } else {
    skip('delete_post', 'no post created')
  }
}

async function testCampaigns() {
  console.log('\n  Campaigns')

  let campaignId = null

  // 9. create_campaign
  try {
    const data = await expectSuccess(nextId(), 'create_campaign', {
      name: '[SMOKE] test campaign',
      status: 'active',
    })
    campaignId = data.campaign?.id
    if (!campaignId) throw new Error('No campaign id returned')
    cleanup.campaignIds.push(campaignId)
    pass('create_campaign', `id: ${campaignId.slice(0, 8)}`)
  } catch (e) {
    fail('create_campaign', e.message)
  }

  // 10. list_campaigns
  if (campaignId) {
    try {
      const data = await expectSuccess(nextId(), 'list_campaigns')
      const found = data.campaigns?.some((c) => c.id === campaignId)
      if (found) {
        pass('list_campaigns', 'found created campaign')
      } else {
        fail('list_campaigns', 'created campaign not in list')
      }
    } catch (e) {
      fail('list_campaigns', e.message)
    }
  } else {
    skip('list_campaigns', 'no campaign created')
  }

  // 11. update_campaign
  if (campaignId) {
    try {
      await expectSuccess(nextId(), 'update_campaign', {
        id: campaignId,
        name: '[SMOKE] updated campaign',
      })
      pass('update_campaign')
    } catch (e) {
      fail('update_campaign', e.message)
    }
  } else {
    skip('update_campaign', 'no campaign created')
  }

  // 12. add_post_to_campaign (create temp post, link, unlink, delete)
  if (campaignId) {
    let tempPostId = null
    try {
      const postData = await expectSuccess(nextId(), 'create_post', {
        platform: 'twitter',
        content: { text: '[SMOKE] campaign link test' },
      })
      tempPostId = postData.post?.id
      if (!tempPostId) throw new Error('No temp post id')
      cleanup.postIds.push(tempPostId)

      await expectSuccess(nextId(), 'add_post_to_campaign', {
        campaignId,
        postId: tempPostId,
      })

      // Verify post is linked by getting the campaign (posts are at top level, not nested)
      const campData = await expectSuccess(nextId(), 'get_campaign', { id: campaignId })
      const linked = campData.posts?.some((p) => p.id === tempPostId)
      if (linked) {
        pass('add_post_to_campaign')
      } else {
        fail('add_post_to_campaign', 'post not found in campaign')
      }

      // Clean up: remove from campaign then delete temp post
      await callTool(nextId(), 'remove_post_from_campaign', {
        campaignId,
        postId: tempPostId,
      })
      await callTool(nextId(), 'delete_post', { id: tempPostId, confirmed: true })
      cleanup.postIds = cleanup.postIds.filter((id) => id !== tempPostId)
    } catch (e) {
      fail('add_post_to_campaign', e.message)
    }
  } else {
    skip('add_post_to_campaign', 'no campaign created')
  }

  // 13. delete_campaign
  if (campaignId) {
    try {
      await expectSuccess(nextId(), 'delete_campaign', { id: campaignId })
      cleanup.campaignIds = cleanup.campaignIds.filter((id) => id !== campaignId)
      pass('delete_campaign')
    } catch (e) {
      fail('delete_campaign', e.message)
    }
  } else {
    skip('delete_campaign', 'no campaign created')
  }
}

async function testProjects() {
  console.log('\n  Projects')

  let projectId = null

  // 14. create_project
  try {
    const data = await expectSuccess(nextId(), 'create_project', {
      name: '[SMOKE] test project',
      description: 'smoke test project',
    })
    projectId = data.project?.id
    if (!projectId) throw new Error('No project id returned')
    cleanup.projectIds.push(projectId)
    pass('create_project', `id: ${projectId.slice(0, 8)}`)
  } catch (e) {
    fail('create_project', e.message)
  }

  // 15. get_project
  if (projectId) {
    try {
      const data = await expectSuccess(nextId(), 'get_project', { id: projectId })
      if (data.project?.name === '[SMOKE] test project') {
        pass('get_project')
      } else {
        fail('get_project', 'name mismatch')
      }
    } catch (e) {
      fail('get_project', e.message)
    }
  } else {
    skip('get_project', 'no project created')
  }

  // 16. update_project
  if (projectId) {
    try {
      await expectSuccess(nextId(), 'update_project', {
        id: projectId,
        description: 'updated smoke test',
      })
      pass('update_project')
    } catch (e) {
      fail('update_project', e.message)
    }
  } else {
    skip('update_project', 'no project created')
  }

  // 17. get_project_analytics
  if (projectId) {
    try {
      const data = await expectSuccess(nextId(), 'get_project_analytics', { id: projectId })
      // Analytics should return counts (even if 0 for a fresh project)
      if (data.analytics !== undefined || data.campaignCount !== undefined) {
        pass('get_project_analytics')
      } else {
        // Accept any successful response shape
        pass('get_project_analytics', 'returned data')
      }
    } catch (e) {
      fail('get_project_analytics', e.message)
    }
  } else {
    skip('get_project_analytics', 'no project created')
  }

  // 18. delete_project
  if (projectId) {
    try {
      await expectSuccess(nextId(), 'delete_project', { id: projectId, confirmed: true })
      cleanup.projectIds = cleanup.projectIds.filter((id) => id !== projectId)
      pass('delete_project')
    } catch (e) {
      fail('delete_project', e.message)
    }
  } else {
    skip('delete_project', 'no project created')
  }
}

async function testBlogDrafts() {
  console.log('\n  Blog Drafts')

  let draftId = null

  // 19. create_blog_draft
  try {
    const data = await expectSuccess(nextId(), 'create_blog_draft', {
      title: '[SMOKE] Test Draft',
      content: '# Hello\n\nSmoke test content.',
    })
    draftId = data.draft?.id
    if (!draftId) throw new Error('No draft id returned')
    cleanup.draftIds.push(draftId)
    pass('create_blog_draft', `id: ${draftId.slice(0, 8)}`)
  } catch (e) {
    fail('create_blog_draft', e.message)
  }

  // 20. get_blog_draft
  if (draftId) {
    try {
      const data = await expectSuccess(nextId(), 'get_blog_draft', { id: draftId })
      if (data.draft?.title === '[SMOKE] Test Draft') {
        pass('get_blog_draft')
      } else {
        fail('get_blog_draft', 'title mismatch')
      }
    } catch (e) {
      fail('get_blog_draft', e.message)
    }
  } else {
    skip('get_blog_draft', 'no draft created')
  }

  // 21. update_blog_draft
  if (draftId) {
    try {
      await expectSuccess(nextId(), 'update_blog_draft', {
        id: draftId,
        title: '[SMOKE] Updated Draft',
      })
      pass('update_blog_draft')
    } catch (e) {
      fail('update_blog_draft', e.message)
    }
  } else {
    skip('update_blog_draft', 'no draft created')
  }

  // 22. search_blog_drafts
  if (draftId) {
    try {
      const data = await expectSuccess(nextId(), 'search_blog_drafts', { query: '[SMOKE]' })
      const found = data.drafts?.some((d) => d.id === draftId)
      if (found) {
        pass('search_blog_drafts')
      } else {
        fail('search_blog_drafts', 'created draft not found')
      }
    } catch (e) {
      fail('search_blog_drafts', e.message)
    }
  } else {
    skip('search_blog_drafts', 'no draft created')
  }

  // 23. delete_blog_draft
  if (draftId) {
    try {
      await expectSuccess(nextId(), 'delete_blog_draft', { id: draftId, confirmed: true })
      cleanup.draftIds = cleanup.draftIds.filter((id) => id !== draftId)
      pass('delete_blog_draft')
    } catch (e) {
      fail('delete_blog_draft', e.message)
    }
  } else {
    skip('delete_blog_draft', 'no draft created')
  }
}

async function testLaunchPosts() {
  console.log('\n  Launch Posts')

  let launchId = null

  // 24. create_launch_post
  try {
    const data = await expectSuccess(nextId(), 'create_launch_post', {
      platform: 'product_hunt',
      title: '[SMOKE] Launch Post',
      url: 'https://example.com',
      status: 'draft',
    })
    launchId = data.launchPost?.id
    if (!launchId) throw new Error('No launch post id returned')
    cleanup.launchIds.push(launchId)
    pass('create_launch_post', `id: ${launchId.slice(0, 8)}`)
  } catch (e) {
    fail('create_launch_post', e.message)
  }

  // 25. get_launch_post
  if (launchId) {
    try {
      const data = await expectSuccess(nextId(), 'get_launch_post', { id: launchId })
      if (data.launchPost?.title === '[SMOKE] Launch Post') {
        pass('get_launch_post')
      } else {
        fail('get_launch_post', 'title mismatch')
      }
    } catch (e) {
      fail('get_launch_post', e.message)
    }
  } else {
    skip('get_launch_post', 'no launch post created')
  }

  // 26. update_launch_post
  if (launchId) {
    try {
      await expectSuccess(nextId(), 'update_launch_post', {
        id: launchId,
        title: '[SMOKE] Updated Launch',
      })
      pass('update_launch_post')
    } catch (e) {
      fail('update_launch_post', e.message)
    }
  } else {
    skip('update_launch_post', 'no launch post created')
  }

  // 27. delete_launch_post
  if (launchId) {
    try {
      await expectSuccess(nextId(), 'delete_launch_post', { id: launchId, confirmed: true })
      cleanup.launchIds = cleanup.launchIds.filter((id) => id !== launchId)
      pass('delete_launch_post')
    } catch (e) {
      fail('delete_launch_post', e.message)
    }
  } else {
    skip('delete_launch_post', 'no launch post created')
  }
}

async function testMedia() {
  console.log('\n  Media')

  const testImagePath = join(__dirname, '..', 'e2e', 'fixtures', 'test-image.png')
  let uploadedFilename = null

  // 29. upload_media
  try {
    const data = await expectSuccess(nextId(), 'upload_media', { filePath: testImagePath })
    uploadedFilename = data.filename
    if (!uploadedFilename) throw new Error('No filename returned')
    cleanup.mediaFilenames.push(uploadedFilename)
    if (!data.url || !data.url.includes(uploadedFilename)) {
      throw new Error(`Unexpected URL: ${data.url}`)
    }
    pass('upload_media', `file: ${uploadedFilename.slice(0, 8)}`)
  } catch (e) {
    fail('upload_media', e.message)
  }

  // 30. list_media
  if (uploadedFilename) {
    try {
      const data = await expectSuccess(nextId(), 'list_media')
      const found = data.files?.some((f) => f.filename === uploadedFilename)
      if (found) {
        pass('list_media', `${data.count} file(s)`)
      } else {
        fail('list_media', 'uploaded file not found in list')
      }
    } catch (e) {
      fail('list_media', e.message)
    }
  } else {
    skip('list_media', 'no file uploaded')
  }

  // 31. delete_media
  if (uploadedFilename) {
    try {
      const data = await expectSuccess(nextId(), 'delete_media', {
        filename: uploadedFilename,
      })
      if (data.success) {
        cleanup.mediaFilenames = cleanup.mediaFilenames.filter((f) => f !== uploadedFilename)
        pass('delete_media')
      } else {
        fail('delete_media', 'success was not true')
      }
    } catch (e) {
      fail('delete_media', e.message)
    }
  } else {
    skip('delete_media', 'no file uploaded')
  }
}

async function testConfirmationGuards() {
  console.log('\n  Confirmation Guards')

  // 28. delete_post without confirmed should fail
  try {
    // Create a temp post to attempt deletion on
    const postData = await expectSuccess(nextId(), 'create_post', {
      platform: 'twitter',
      content: { text: '[SMOKE] guard test' },
    })
    const tempId = postData.post?.id
    if (!tempId) throw new Error('No temp post id')
    cleanup.postIds.push(tempId)

    const errText = await expectError(nextId(), 'delete_post', { id: tempId })
    if (errText.toLowerCase().includes('confirm')) {
      pass('delete_post guard', 'requires confirmation')
    } else {
      // Still passed if it returned an error — the guard worked
      pass('delete_post guard', 'rejected without confirmed')
    }

    // Clean up the temp post
    await callTool(nextId(), 'delete_post', { id: tempId, confirmed: true })
    cleanup.postIds = cleanup.postIds.filter((id) => id !== tempId)
  } catch (e) {
    fail('delete_post guard', e.message)
  }
}

// --- Main ---

async function run() {
  console.log('=== Bullhorn MCP Smoke Test ===')

  try {
    await testProtocol()
    await testPosts()
    await testCampaigns()
    await testProjects()
    await testBlogDrafts()
    await testLaunchPosts()
    await testMedia()
    await testConfirmationGuards()
  } finally {
    // Safety net: clean up any resources that weren't deleted during tests
    await runCleanup()
  }

  const total = passed + failed + skipped
  console.log(`\n  Results: ${passed} passed, ${failed} failed, ${skipped} skipped (${total} total)`)
  console.log('===============================\n')

  proc.kill()
  process.exit(failed > 0 ? 1 : 0)
}

run()
