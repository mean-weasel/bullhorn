import path from 'path'
import { fileURLToPath } from 'url'
import { readFixture, resolveRefs } from './lib/parse'
import type { RefRegistry } from './lib/types'
import * as api from './lib/api'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const blue = (s: string) => `\x1b[34m${s}\x1b[0m`
const green = (s: string) => `\x1b[32m${s}\x1b[0m`
const red = (s: string) => `\x1b[31m${s}\x1b[0m`
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`

function parseArgs(): { fixturePath: string; port: number; resetOnly: boolean } {
  const args = process.argv.slice(2)
  let fixturePath = path.resolve(__dirname, 'fixtures/default.yaml')
  let port = 3000
  let resetOnly = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10)
      if (isNaN(port)) {
        console.error(red(`Invalid port: "${args[i + 1]}"`))
        process.exit(1)
      }
      i++
    } else if (args[i] === '--reset-only') {
      resetOnly = true
    } else if (!args[i].startsWith('--')) {
      fixturePath = path.resolve(args[i])
    }
  }

  return { fixturePath, port, resetOnly }
}

const FAILED = '__FAILED__'

async function main() {
  const { fixturePath, port, resetOnly } = parseArgs()
  const apiBase = `http://localhost:${port}/api`
  const start = Date.now()
  const errors: string[] = []
  const registry: RefRegistry = new Map()
  const counts = { projects: 0, campaigns: 0, posts: 0, blogDrafts: 0, launchPosts: 0, media: 0 }

  // Step 1: Reset database
  console.log(blue('\n▸ Resetting database...'))
  try {
    await api.resetDatabase(apiBase)
    console.log(green('  ✓ Database reset'))
  } catch (e) {
    const msg = String((e as Error).message || e)
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
      console.error(
        red(`  ✗ Cannot connect to ${apiBase}. Is the dev server running? (make qa-dev)`)
      )
    } else {
      console.error(red(`  ✗ Reset failed: ${msg}`))
    }
    process.exit(1)
  }

  if (resetOnly) {
    console.log(green('\n✓ Reset complete') + dim(` (${Date.now() - start}ms)\n`))
    return
  }

  // Step 2: Parse fixture
  console.log(blue(`▸ Reading fixture: ${path.basename(fixturePath)}`))
  const fixture = readFixture(fixturePath)
  const hasData =
    fixture.projects?.length ||
    fixture.campaigns?.length ||
    fixture.posts?.length ||
    fixture.blogDrafts?.length ||
    fixture.launchPosts?.length

  if (!hasData) {
    console.log(dim('  (empty fixture — no data to seed)'))
    console.log(green('\n✓ Done') + dim(` (${Date.now() - start}ms)\n`))
    return
  }

  // Validate _name uniqueness across all entities
  const allNames = [
    ...(fixture.projects ?? []),
    ...(fixture.campaigns ?? []),
    ...(fixture.posts ?? []),
    ...(fixture.blogDrafts ?? []),
    ...(fixture.launchPosts ?? []),
  ].map((e) => e._name)
  const dupes = allNames.filter((n, i) => allNames.indexOf(n) !== i)
  if (dupes.length) {
    console.error(red(`  ✗ Duplicate _name values: ${[...new Set(dupes)].join(', ')}`))
    process.exit(1)
  }

  // Step 3: Seed projects
  if (fixture.projects?.length) {
    console.log(blue(`▸ Creating ${fixture.projects.length} projects...`))
    for (const raw of fixture.projects) {
      try {
        const data = resolveRefs(raw, registry)
        const id = await api.createProject(apiBase, data)
        registry.set(raw._name, id)
        counts.projects++
        console.log(dim(`  → ${raw.name} (${id.slice(0, 8)})`))
      } catch (e) {
        errors.push(`Project "${raw.name}": ${(e as Error).message}`)
        console.error(red(`  ✗ ${raw.name}: ${(e as Error).message}`))
        registry.set(raw._name, FAILED)
      }
    }
  }

  // Step 4: Seed campaigns (need project IDs)
  if (fixture.campaigns?.length) {
    console.log(blue(`▸ Creating ${fixture.campaigns.length} campaigns...`))
    for (const raw of fixture.campaigns) {
      try {
        const data = resolveRefs(raw, registry)
        const id = await api.createCampaign(apiBase, data)
        registry.set(raw._name, id)
        counts.campaigns++
        console.log(dim(`  → ${raw.name} (${id.slice(0, 8)})`))
      } catch (e) {
        errors.push(`Campaign "${raw.name}": ${(e as Error).message}`)
        console.error(red(`  ✗ ${raw.name}: ${(e as Error).message}`))
        registry.set(raw._name, FAILED)
      }
    }
  }

  // Step 5: Seed posts, blog drafts, launch posts
  if (fixture.posts?.length) {
    console.log(blue(`▸ Creating ${fixture.posts.length} posts...`))
    for (const raw of fixture.posts) {
      try {
        const { media, ...rest } = resolveRefs(raw, registry) as Record<string, unknown> & {
          media?: Array<{ path: string }>
        }
        const id = await api.createPost(apiBase, rest)
        registry.set(raw._name, id)
        counts.posts++
        console.log(dim(`  → ${raw.platform} ${raw.status || 'draft'} (${id.slice(0, 8)})`))

        if (media?.length) {
          for (const m of media) {
            try {
              await api.uploadAndAttachMedia(apiBase, id, m.path)
              counts.media++
              console.log(dim(`    📎 ${path.basename(m.path)}`))
            } catch (e) {
              errors.push(`Media "${m.path}" for post "${raw._name}": ${(e as Error).message}`)
              console.error(red(`    ✗ media ${m.path}: ${(e as Error).message}`))
            }
          }
        }
      } catch (e) {
        errors.push(`Post "${raw._name}": ${(e as Error).message}`)
        console.error(red(`  ✗ ${raw._name}: ${(e as Error).message}`))
      }
    }
  }

  if (fixture.blogDrafts?.length) {
    console.log(blue(`▸ Creating ${fixture.blogDrafts.length} blog drafts...`))
    for (const raw of fixture.blogDrafts) {
      try {
        const data = resolveRefs(raw, registry)
        const id = await api.createBlogDraft(apiBase, data)
        registry.set(raw._name, id)
        counts.blogDrafts++
        console.log(dim(`  → ${raw.title || 'Untitled'} (${id.slice(0, 8)})`))
      } catch (e) {
        errors.push(`Blog draft "${raw.title}": ${(e as Error).message}`)
        console.error(red(`  ✗ ${raw.title}: ${(e as Error).message}`))
      }
    }
  }

  if (fixture.launchPosts?.length) {
    console.log(blue(`▸ Creating ${fixture.launchPosts.length} launch posts...`))
    for (const raw of fixture.launchPosts) {
      try {
        const data = resolveRefs(raw, registry)
        const id = await api.createLaunchPost(apiBase, data)
        registry.set(raw._name, id)
        counts.launchPosts++
        console.log(dim(`  → ${raw.platform}: ${raw.title} (${id.slice(0, 8)})`))
      } catch (e) {
        errors.push(`Launch post "${raw.title}": ${(e as Error).message}`)
        console.error(red(`  ✗ ${raw.title}: ${(e as Error).message}`))
      }
    }
  }

  // Summary
  const elapsed = Date.now() - start
  const parts = [
    counts.projects && `${counts.projects} projects`,
    counts.campaigns && `${counts.campaigns} campaigns`,
    counts.posts && `${counts.posts} posts`,
    counts.blogDrafts && `${counts.blogDrafts} blog drafts`,
    counts.launchPosts && `${counts.launchPosts} launch posts`,
    counts.media && `${counts.media} media files`,
  ].filter(Boolean)

  console.log('')
  if (errors.length) {
    console.log(red(`✗ Seeded with ${errors.length} error(s):`) + ` ${parts.join(', ')}`)
    for (const e of errors) console.log(red(`  - ${e}`))
    console.log(dim(`  (${elapsed}ms)\n`))
    process.exit(1)
  } else {
    console.log(green(`✓ Seeded: ${parts.join(', ')}`) + dim(` (${elapsed}ms)\n`))
  }
}

main().catch((e) => {
  console.error(red(`\n✗ Fatal: ${e.message}\n`))
  process.exit(1)
})
