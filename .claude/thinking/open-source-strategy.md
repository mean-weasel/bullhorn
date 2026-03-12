# Should Bullhorn Go Open-Source?

> Decision: Yes — open-source the code AND launch the hosted SaaS simultaneously.

## The Problem

Bullhorn is a mature, production-grade social media scheduler (54K LoC, 265 tests, 66 API routes) with no users, no distribution, and no revenue. The builder is between things and needs to either monetize it or leverage it for credibility/audience.

## The Strategy: Combined Open-Source + SaaS Launch

Open-sourcing alone gets stars but no revenue. A SaaS launch alone has no distribution. Combining both maximizes the outcome.

### Positioning

**"The social media scheduler built for developers who ship — with first-class MCP support for AI-native workflows."**

Narrative: "I built this because I wanted to schedule launch posts from Claude Code. Buffer doesn't have an MCP server. So I built one."

### Target Audience

- Developers and indie hackers who use AI-assisted development (Claude Code, Cursor)
- Builders who ship products and need to coordinate launches
- Self-hosters who want control over their social media tooling

## Differentiators vs. Buffer/Hootsuite/Typefully

1. **MCP-native**: Schedule posts from Claude Code, Cursor, or any AI tool
2. **Self-hostable**: AGPL open-source, run your own instance
3. **Developer workflow**: Launch post templates (Product Hunt, HN), blog-to-social, campaigns
4. **Built by a developer, for developers**: No enterprise bloat

## Pre-Launch Checklist

### Must-Have Before Launch
- [ ] Wire up Stripe (free/pro billing) — plan enforcement code already exists
- [ ] Compelling README with screenshot/GIF, "why this exists" (MCP angle), one-click deploy
- [ ] Self-hosting guide (Docker Compose, env vars, Supabase setup)
- [ ] Clean up any remaining hardcoded values or dev-only references

### Launch Day Content
- [ ] Show HN post (focus on MCP angle, link repo + hosted version)
- [ ] Reddit posts: r/selfhosted, r/nextjs, r/opensource, r/SideProject
- [ ] Twitter/X thread: "I built an AI-native social media scheduler" with demo GIF
- [ ] Product Hunt listing (can be same day or separate wave)

### Nice-to-Have
- [ ] Demo video or GIF showing MCP workflow (Claude Code → scheduled post)
- [ ] One-click Vercel + Supabase deploy button
- [ ] Landing page update emphasizing open-source + MCP

## Monetization Protection (AGPL)

- AGPL license means anyone hosting it must open-source their modifications
- Companies avoid AGPL → they'll pay for hosted version
- Self-hosting is complex (Supabase + Redis + cron + push notifications) → convenience tax
- Future: hold back enterprise features (teams, SSO, audit logs) as proprietary add-ons (open core model)

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Nobody cares / gets buried | Multi-channel launch (HN + Reddit + Twitter + PH). The MCP angle is timely. |
| Gets stars but no paying users | Stripe must be wired up BEFORE launch. Free tier with clear upgrade path. |
| Someone forks and competes | AGPL prevents hosted competition. Focus on being the canonical version. |
| Too much support burden | Good docs reduce support load. AGPL community can self-serve. |
| Open-sourcing reveals bad code | Code is clean, 265 tests, security-hardened. Already prepped (commit #203). |

## Success Metrics

| Timeframe | Target |
|-----------|--------|
| Month 1 | 200-500 GitHub stars, HN front page, handful of free signups |
| Month 3 | First paying users, small community, established in AI-tools space |
| Month 6 | Either has product legs OR is a strong portfolio piece + audience for next project |

## The Key Insight

The distribution problem is real. Open-sourcing IS the distribution strategy. But open-sourcing without a monetization path means you get attention you can't capture. The combined launch solves both.

## Sequencing Recommendation

1. **Week 1-2**: Wire up Stripe billing (plan enforcement is already built)
2. **Week 2-3**: README, self-hosting guide, Docker setup
3. **Week 3-4**: Prepare launch content (HN post, Reddit posts, Twitter thread, PH listing)
4. **Week 4**: Launch everything on the same day

## Open Questions

- [ ] What's the right free tier limit? Current: 50 posts, 5 campaigns, 3 projects
- [ ] Price point for Pro? ($9/mo? $15/mo? Compare to Typefully at $12/mo)
- [ ] Should the MCP server be a separate repo for discoverability?
- [ ] Is there a way to get listed on MCP directories / Claude tool registries?
