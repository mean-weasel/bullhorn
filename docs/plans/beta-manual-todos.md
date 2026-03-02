# Beta Launch — Manual To-Dos

Items that require human action outside the codebase (service provider settings, deployment config, external tools, etc.).

---

### From Iteration 1 (2026-03-01)

- [ ] Set `CRON_SECRET` in Vercel production environment variables — cron endpoints now reject requests without it (dimension: ops, severity: HIGH)
- [ ] Set up email service (SendGrid/Resend) before enabling email notification features — SPF/DKIM records, unsubscribe links, bounce handling (dimension: feature, severity: HIGH)
- [ ] Verify `NEXT_PUBLIC_SENTRY_DSN` is configured in Vercel production env vars — error monitoring disabled without it (dimension: ops, severity: MEDIUM)
- [ ] Enable Core Web Vitals monitoring via Vercel Analytics — FCP/LCP/CLS tracking (dimension: performance, severity: MEDIUM)
- [x] Review database indexes for high-traffic tables — addressed in migration `20260302002247_add_performance_indexes.sql` (dimension: performance, severity: MEDIUM)

### From Iteration 2 (2026-03-01)

- [ ] Apply database migration `20260302002247_add_performance_indexes.sql` to production via `supabase db push` (dimension: ops, severity: MEDIUM)
- [ ] Verify all required Vercel env vars are set in production: `CRON_SECRET`, `NEXT_PUBLIC_SENTRY_DSN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — see `docs/environment-variables.md` for full list (dimension: ops, severity: HIGH)
- [ ] Configure Sentry project alerts for production error spikes (dimension: ops, severity: MEDIUM)
- [ ] Set up Upstash Redis for rate limiting — recommended for production, app works without it but rate limiting will be disabled (dimension: ops, severity: MEDIUM)

### From Iteration 3 (2026-03-02)

- [ ] Create a cookie policy page at `/cookies` or `/cookie-policy` — privacy policy references cookies but no dedicated page exists for regulatory compliance (dimension: feature, severity: HIGH)
