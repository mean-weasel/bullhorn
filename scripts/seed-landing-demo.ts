#!/usr/bin/env tsx
/**
 * Seed script for landing page screenshot demo data
 *
 * Creates dummy data for all 7 landing page features
 *
 * Usage: npx tsx scripts/seed-landing-demo.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const USER_EMAIL = 'neonwatty@gmail.com'

async function main() {
  console.log('🌱 Seeding landing page demo data...\n')

  // 1. Look up user by email
  console.log(`Looking up user: ${USER_EMAIL}`)
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', USER_EMAIL)
    .single()

  if (userError || !user) {
    console.error('Failed to find user:', userError)
    console.error('Make sure you are logged in at least once in production')
    process.exit(1)
  }

  const USER_ID = user.id
  console.log(`✅ Found user: ${USER_ID}`)

  // 2. Create projects (let DB generate UUIDs)
  console.log('\n📁 Creating projects...')
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .insert([
      {
        user_id: USER_ID,
        name: 'CollabTool',
        description: 'Real-time collaboration product',
        brand_colors: { primary: '#3B82F6' },
      },
      {
        user_id: USER_ID,
        name: 'SideProject',
        description: 'Weekend indie hack',
        brand_colors: { primary: '#8B5CF6' },
      },
      {
        user_id: USER_ID,
        name: 'Client: Acme Corp',
        description: 'Agency client work',
        brand_colors: { primary: '#10B981' },
      },
    ])
    .select()
  if (projError) console.error('Project error:', projError)
  else console.log(`✅ ${projects?.length} projects created`)

  const projectIds = projects?.map((p) => p.id) || []

  // 3. Create campaigns
  console.log('\n📂 Creating campaigns...')
  const { data: campaigns, error: campError } = await supabase
    .from('campaigns')
    .insert([
      {
        user_id: USER_ID,
        project_id: projectIds[0],
        name: 'Product Launch Q1',
        description: 'CollabTool v2.0 launch',
        status: 'active',
      },
      {
        user_id: USER_ID,
        project_id: projectIds[0],
        name: 'Feature Announcements',
        description: 'Rolling feature updates',
        status: 'active',
      },
    ])
    .select()
  if (campError) console.error('Campaign error:', campError)
  else console.log(`✅ ${campaigns?.length} campaigns created`)

  const campaignIds = campaigns?.map((c) => c.id) || []

  // 4. Create blog drafts
  console.log('\n📝 Creating blog drafts...')
  const { data: blogs, error: blogError } = await supabase
    .from('blog_drafts')
    .insert([
      {
        user_id: USER_ID,
        campaign_id: campaignIds[0],
        title: 'Introducing Real-Time Collaboration',
        content: `# Introducing Real-Time Collaboration\n\nToday we're excited to announce the launch of real-time collaboration in CollabTool v2.0.\n\n## The Problem\n\nModern teams need to work together seamlessly...\n\n(850 words total)`,
        status: 'draft',
        word_count: 850,
      },
      {
        user_id: USER_ID,
        title: 'Building in Public: Month 1',
        content: `# Building in Public: Month 1\n\nIt's been 30 days since I started working on SideProject...\n\n(1200 words total)`,
        status: 'draft',
        word_count: 1200,
      },
    ])
    .select()
  if (blogError) console.error('Blog error:', blogError)
  else console.log(`✅ ${blogs?.length} blogs created`)

  // 5. Create posts
  console.log('\n📮 Creating posts...')
  const { data: posts, error: postError } = await supabase
    .from('posts')
    .insert([
      // Draft posts
      {
        user_id: USER_ID,
        campaign_id: campaignIds[0],
        platform: 'twitter',
        content: { text: 'Just shipped v2.0 with real-time collaboration 🚀' },
        status: 'draft',
      },
      {
        user_id: USER_ID,
        platform: 'linkedin',
        content: {
          text: 'Excited to share some behind-the-scenes insights on building real-time features...',
          visibility: 'public',
        },
        status: 'draft',
      },
      {
        user_id: USER_ID,
        platform: 'reddit',
        content: {
          subreddit: 'webdev',
          title: 'New tool for real-time collaboration - would love feedback',
          body: 'Hey r/webdev! I built a new collaboration tool...',
        },
        status: 'draft',
      },
      // Tweet thread (forked from blog)
      {
        user_id: USER_ID,
        campaign_id: campaignIds[0],
        platform: 'twitter',
        content: {
          text: '1/5 🚀 Announcing real-time collaboration in CollabTool v2.0\n\nNo more refresh hell. No merge conflicts.',
        },
        status: 'draft',
      },
      {
        user_id: USER_ID,
        campaign_id: campaignIds[0],
        platform: 'twitter',
        content: {
          text: '2/5 The key challenge: letting multiple people edit without conflicts.\n\nWe use CRDTs under the hood.',
        },
        status: 'draft',
      },
      {
        user_id: USER_ID,
        campaign_id: campaignIds[0],
        platform: 'twitter',
        content: {
          text: '3/5 ✨ See cursors and selections from teammates in real-time',
        },
        status: 'draft',
      },
      // Scheduled posts
      {
        user_id: USER_ID,
        campaign_id: campaignIds[0],
        platform: 'twitter',
        content: { text: '🎉 CollabTool v2.0 launches TOMORROW!' },
        status: 'scheduled',
        scheduled_at: new Date('2026-02-15T10:00:00Z').toISOString(),
      },
      {
        user_id: USER_ID,
        campaign_id: campaignIds[0],
        platform: 'linkedin',
        content: {
          text: "After 6 months of building, I'm thrilled to announce CollabTool v2.0 launches tomorrow.",
          visibility: 'public',
        },
        status: 'scheduled',
        scheduled_at: new Date('2026-02-15T14:00:00Z').toISOString(),
      },
    ])
    .select()
  if (postError) console.error('Post error:', postError)
  else console.log(`✅ ${posts?.length} posts created`)

  // 6. Create launch posts
  console.log('\n🚀 Creating launch posts...')
  const { data: launches, error: launchError } = await supabase
    .from('launch_posts')
    .insert([
      {
        user_id: USER_ID,
        campaign_id: campaignIds[0],
        platform: 'product_hunt',
        title: 'CollabTool v2.0',
        url: 'https://collabtool.com',
        description:
          'Real-time collaboration without the refresh hell. Built for modern teams who ship fast.',
        platform_fields: {
          tagline: 'Real-time collaboration without the refresh hell',
          maker_comment:
            'Hey Product Hunt! 👋 I built CollabTool after dealing with constant merge conflicts...',
        },
        status: 'draft',
        scheduled_at: new Date('2026-02-15T18:00:00Z').toISOString(),
      },
      {
        user_id: USER_ID,
        campaign_id: campaignIds[0],
        platform: 'hacker_news_show',
        title: 'Show HN: CollabTool – Real-time collaboration using CRDTs',
        url: 'https://collabtool.com',
        description:
          'Built with CRDTs and a custom sync engine. Multiple people can edit simultaneously.',
        status: 'draft',
        scheduled_at: new Date('2026-02-15T14:00:00Z').toISOString(),
      },
    ])
    .select()
  if (launchError) console.error('Launch error:', launchError)
  else console.log(`✅ ${launches?.length} launch posts created`)

  console.log('\n✅ Seeding complete!\n')
  console.log(`All dummy data added to account: ${USER_EMAIL}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seeding failed:', error)
    process.exit(1)
  })
