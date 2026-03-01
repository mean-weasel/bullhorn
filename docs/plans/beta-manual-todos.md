# Beta Launch — Manual To-Dos

Items that require human action outside the codebase (service provider settings, deployment config, external tools, etc.).

---

### From Iteration 1 (2026-03-01)

- [ ] Set `CRON_SECRET` in Vercel production environment variables — cron endpoints now reject requests without it (dimension: ops, severity: HIGH)
- [ ] Set up email service (SendGrid/Resend) before enabling email notification features — SPF/DKIM records, unsubscribe links, bounce handling (dimension: feature, severity: HIGH)
- [ ] Verify `NEXT_PUBLIC_SENTRY_DSN` is configured in Vercel production env vars — error monitoring disabled without it (dimension: ops, severity: MEDIUM)
- [ ] Enable Core Web Vitals monitoring via Vercel Analytics — FCP/LCP/CLS tracking (dimension: performance, severity: MEDIUM)
- [ ] Review database indexes for high-traffic tables: posts(user_id, status, scheduled_at), campaigns(user_id, project_id), blog_drafts(user_id, status) (dimension: performance, severity: MEDIUM)
