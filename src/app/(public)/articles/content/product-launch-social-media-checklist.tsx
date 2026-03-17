/* eslint-disable max-lines */
/* eslint-disable max-lines-per-function */
import Link from 'next/link'
import type { ArticleWithContent } from './index'

export const article: ArticleWithContent = {
  slug: 'product-launch-social-media-checklist',
  title: 'Product Launch Social Media Checklist for 2026',
  description:
    'A step-by-step social media checklist for launching your product on Product Hunt, Hacker News, Reddit, Twitter, and LinkedIn.',
  publishedAt: '2026-03-17',
  keywords: [
    'product launch social media',
    'product hunt launch checklist',
    'startup launch social media',
  ],
  content: () => (
    <>
      <p>
        You built something worth sharing. Now you need people to know about it. A product launch
        without a social media plan is like shipping a feature without telling anyone — it might be
        great, but nobody will find it.
      </p>
      <p>
        This checklist covers every platform that matters for technical product launches. Use it
        whether you are launching on Product Hunt, posting to Hacker News, or just announcing a new
        feature to your community.
      </p>

      <h2>Two Weeks Before Launch</h2>
      <ul>
        <li>
          <strong>Draft your core announcement</strong> — Write one clear paragraph explaining what
          you built and why it matters. This becomes the foundation for every platform-specific
          post.
        </li>
        <li>
          <strong>Prepare platform-specific versions</strong> — A tweet thread is not a LinkedIn
          post is not a Reddit submission. Adapt your message for each platform&apos;s style and
          audience.
        </li>
        <li>
          <strong>Create visuals</strong> — Screenshots, a short demo GIF, or a 30-second video.
          Visual content gets 2-3x more engagement across every platform.
        </li>
        <li>
          <strong>Schedule teasers</strong> — Post hints about what you are building. Build
          anticipation without revealing everything.
        </li>
        <li>
          <strong>Identify your launch platforms</strong> — Product Hunt? Hacker News? Reddit?
          BetaList? Pick 2-3 and prepare submissions for each.
        </li>
      </ul>

      <h2>Launch Day: Product Hunt</h2>
      <ul>
        <li>
          <strong>Submit at 12:01 AM PT</strong> — Product Hunt resets daily at midnight Pacific
          time. Early submission gives you the full day to accumulate upvotes.
        </li>
        <li>
          <strong>Write a compelling tagline</strong> — Under 60 characters. Focus on the outcome,
          not the technology.
        </li>
        <li>
          <strong>Prepare your maker comment</strong> — A genuine, detailed first comment explaining
          your motivation, what makes this different, and what you plan to build next.
        </li>
        <li>
          <strong>Reply to every comment</strong> — Product Hunt rewards engagement. Respond quickly
          and thoughtfully.
        </li>
      </ul>

      <h2>Launch Day: Hacker News</h2>
      <ul>
        <li>
          <strong>Use Show HN format</strong> — Title: &quot;Show HN: [Product Name] -
          [Description]&quot;. Keep it factual and understated.
        </li>
        <li>
          <strong>Post between 7-9 AM ET</strong> — This is when the US technical audience is most
          active on HN.
        </li>
        <li>
          <strong>Write a technical first comment</strong> — HN readers want to know how you built
          it, what technical decisions you made, and what problems you solved.
        </li>
        <li>
          <strong>Do not ask for upvotes</strong> — This violates HN guidelines and can get your
          post flagged.
        </li>
      </ul>

      <h2>Launch Day: Twitter</h2>
      <ul>
        <li>
          <strong>Post a thread, not a single tweet</strong> — Start with the hook (what you built),
          then the problem, solution, demo, and call to action.
        </li>
        <li>
          <strong>Include a demo GIF or video</strong> — Visual tweets get significantly more
          engagement in the timeline.
        </li>
        <li>
          <strong>Tag relevant people</strong> — If you built on someone&apos;s API or were inspired
          by someone, mention them. They may retweet.
        </li>
        <li>
          <strong>Schedule follow-up tweets</strong> — Post updates throughout the day: milestone
          numbers, user feedback, behind-the-scenes stories.
        </li>
      </ul>

      <h2>Launch Day: LinkedIn</h2>
      <ul>
        <li>
          <strong>Write a personal story</strong> — LinkedIn favors personal narratives over
          promotional content. Tell the story of why you built this.
        </li>
        <li>
          <strong>Post between 8-10 AM</strong> in your audience&apos;s timezone.
        </li>
        <li>
          <strong>Engage in comments for the first hour</strong> — LinkedIn&apos;s algorithm weighs
          early engagement heavily.
        </li>
      </ul>

      <h2>Launch Day: Reddit</h2>
      <ul>
        <li>
          <strong>Find the right subreddit</strong> — r/SideProject, r/startups, r/webdev, or niche
          subreddits related to your product category.
        </li>
        <li>
          <strong>Follow subreddit rules exactly</strong> — Many subreddits have strict
          self-promotion rules. Read them before posting.
        </li>
        <li>
          <strong>Be genuine and helpful</strong> — Reddit users can spot marketing from a mile
          away. Focus on the problem you solve, not features.
        </li>
      </ul>

      <h2>After Launch Day</h2>
      <ul>
        <li>
          <strong>Share milestones</strong> — First 100 users, unexpected use cases, what you
          learned. Building in public keeps momentum going.
        </li>
        <li>
          <strong>Repurpose content</strong> — Turn your Product Hunt maker comment into a blog
          post. Turn your Twitter thread into a LinkedIn article.
        </li>
        <li>
          <strong>Schedule consistent follow-ups</strong> — One launch post is not enough. Plan
          weekly content that keeps your product visible.
        </li>
      </ul>

      <h2>Keep It Organized</h2>
      <p>
        Coordinating a launch across 5 platforms is a lot of content to manage. This is exactly what{' '}
        <Link href="/signup" className="text-[hsl(var(--gold))] font-bold hover:underline">
          Bullhorn
        </Link>{' '}
        is built for — organize your launch posts into campaigns, use dedicated launch templates for
        Product Hunt and Hacker News, and schedule everything from one place. Capture ideas from
        your AI tools while you work, then publish when the time is right.
      </p>
      <p>
        <Link href="/signup" className="text-[hsl(var(--gold))] font-bold hover:underline">
          Try Bullhorn free
        </Link>{' '}
        — 50 posts, 5 campaigns, launch templates included.
      </p>
    </>
  ),
}
