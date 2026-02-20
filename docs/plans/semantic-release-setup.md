# Adding Semantic Release to a Next.js + Vercel Project

> **What this does:** Automatically creates version tags and GitHub Releases every time you merge to `main`, based on your commit messages. No manual version bumping ever again.
>
> **GitHub repo:** https://github.com/semantic-release/semantic-release (23k+ stars, actively maintained)

## How It Works (Summary)

1. You write commit messages with a type prefix (`feat:`, `fix:`, `chore:`, etc.) — this is manual, not auto-generated
2. You open a PR and merge to `main` — nothing version-related happens on the PR itself
3. After merge, CI runs all checks (lint, typecheck, tests, E2E)
4. If all checks pass, the Release job reads commits since the last version tag
5. It determines the bump type from the prefixes: `feat:` → minor, `fix:` → patch, `feat!:` → major
6. It creates a git tag (e.g., `v1.3.0`), updates `CHANGELOG.md` and `package.json`, and publishes a GitHub Release
7. If all commits since the last tag are `chore:`, `docs:`, `test:`, etc. — no release is created

**Version numbers never change on PRs or branches. Only on `main`, only after CI passes.**

## Prerequisites

- GitHub repo with GitHub Actions CI
- Conventional commit messages (`feat:`, `fix:`, `chore:`, etc.)
- Node.js project with `package.json`

---

## Step 1: Install Dependencies

```bash
npm install --save-dev semantic-release @semantic-release/commit-analyzer @semantic-release/release-notes-generator @semantic-release/github @semantic-release/changelog @semantic-release/git
```

**What each package does:**

| Package | Purpose |
|---------|---------|
| `semantic-release` | Core engine — reads commits, decides version |
| `@semantic-release/commit-analyzer` | Parses commit messages to determine bump type |
| `@semantic-release/release-notes-generator` | Generates changelog text from commits |
| `@semantic-release/github` | Creates GitHub Releases with the changelog |
| `@semantic-release/changelog` | Writes a `CHANGELOG.md` file in the repo |
| `@semantic-release/git` | Commits the updated `CHANGELOG.md` and `package.json` back to the repo |

## Step 2: Create `.releaserc.json`

Create this file in the **project root** (next to `package.json`):

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    [
      "@semantic-release/npm",
      {
        "npmPublish": false
      }
    ],
    [
      "@semantic-release/git",
      {
        "assets": ["CHANGELOG.md", "package.json"],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ],
    "@semantic-release/github"
  ]
}
```

**What this config does:**

1. **commit-analyzer** — Reads commits since last tag. `fix:` → patch, `feat:` → minor, `BREAKING CHANGE` → major. Anything else (`chore:`, `docs:`, `test:`, `refactor:`) → no release.
2. **release-notes-generator** — Builds markdown changelog from those commits.
3. **changelog** — Writes/updates `CHANGELOG.md` in the repo.
4. **npm** — Bumps `package.json` version (with `npmPublish: false` since we're not publishing to npm).
5. **git** — Commits the updated `CHANGELOG.md` and `package.json` back to `main`. The `[skip ci]` in the commit message prevents an infinite loop of CI triggering releases.
6. **github** — Creates a GitHub Release with the changelog attached to a git tag (`v1.2.3`).

**Plugin order matters** — they execute top to bottom. Analyze → generate notes → write changelog → bump package.json → commit files → create GitHub release.

## Step 3: Add Release Job to CI Workflow

Add this job to `.github/workflows/ci.yml`:

```yaml
  release:
    name: Release
    # Only run on push to main (not on PRs)
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    # Wait for ALL checks to pass first
    needs: [typecheck, unit-tests, e2e-tests, lint, knip]
    runs-on: ubuntu-latest
    permissions:
      contents: write      # Create releases and tags
      issues: write        # Comment on issues referenced in commits
      pull-requests: write # Comment on PRs referenced in commits
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0   # Full history needed to read all commits since last tag
          persist-credentials: false

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run semantic-release
        run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Key details:**

- `if: github.event_name == 'push'` — Only runs when merging to main, not on PR checks
- `needs: [...]` — Won't release unless ALL CI jobs pass
- `fetch-depth: 0` — Clones full git history so semantic-release can read all commits since the last tag
- `GITHUB_TOKEN` — Built-in GitHub Actions token, no secrets to configure
- `persist-credentials: false` — Lets semantic-release use its own auth for pushing the changelog commit

## Step 4: Update Knip Config (if using Knip)

If your project uses Knip for dead code detection, add all new packages to `ignoreDependencies` in `knip.json`. This includes both the semantic-release plugins (this step) and the commitlint packages (Step 7) — listed together here since they go in the same array:

```json
{
  "ignoreDependencies": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/github",
    "@semantic-release/git",
    "@commitlint/cli",
    "@commitlint/config-conventional",
    "husky"
  ]
}
```

These packages are used by CI and git hooks, not imported in code, so Knip would otherwise flag them as unused.

## Step 5: Set the Initial Version

If your `package.json` version is `0.1.0` (the create-next-app default), semantic-release will start from there. To start at `1.0.0` instead, create a git tag before your first release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Semantic-release reads the latest tag to determine "what version are we on now?" and bumps from there. If no tag exists, it uses `package.json` version as the starting point.

## Step 6: Verify It Works

1. Merge a PR with a `feat:` or `fix:` commit to `main`
2. Watch the CI run — the new "Release" job should appear after all checks pass
3. Check your repo's **Releases** page on GitHub — a new release should appear with a changelog
4. Check `package.json` on `main` — the version should be bumped
5. Check `CHANGELOG.md` — it should contain the release notes

---

## How It Behaves Day-to-Day

### Commits that trigger a release:
```
fix: resolve auth redirect loop          → patch bump (1.0.0 → 1.0.1)
feat: add campaign detail page            → minor bump (1.0.0 → 1.1.0)
feat!: redesign the API                   → major bump (1.0.0 → 2.0.0)
perf: optimize search queries             → patch bump (1.0.0 → 1.0.1)
```

### Commits that do NOT trigger a release:
```
chore: update dependencies
docs: fix README typo
test: add unit tests for auth
refactor: extract helper function
ci: update GitHub Actions workflow
style: fix formatting
```

### Multiple commits in one PR:
The highest-priority change wins. If a PR has both a `fix:` and a `feat:`, it's a minor bump (not patch). If any commit has `BREAKING CHANGE` in its body, it's a major bump.

### No qualifying commits since last release:
Nothing happens. No tag, no release, no version bump. The job runs but exits cleanly.

---

## Customization

### Change which commit types trigger releases

Edit `.releaserc.json` to customize the commit-analyzer:

```json
[
  "@semantic-release/commit-analyzer",
  {
    "preset": "angular",
    "releaseRules": [
      { "type": "refactor", "release": "patch" },
      { "type": "perf", "release": "patch" },
      { "type": "chore", "scope": "deps", "release": "patch" }
    ]
  }
]
```

### Skip the CHANGELOG.md file

Remove `@semantic-release/changelog` and `@semantic-release/git` from the plugins list. You'll still get GitHub Releases, just no file committed to the repo.

### Dry run (test without publishing)

```bash
npx semantic-release --dry-run
```

Shows what version would be created without actually doing anything.

---

## Step 7: Enforce Conventional Commits with commitlint

Semantic-release trusts that your commit messages follow the convention. If someone writes `updated the auth page` instead of `fix: resolve auth redirect`, the tool can't determine a version bump and silently skips the release. To prevent this, add commitlint — a git hook that **rejects commits** with invalid messages before they enter the repo.

### Install commitlint + husky

```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional husky
```

| Package | Purpose |
|---------|---------|
| `@commitlint/cli` | The linter that validates commit messages |
| `@commitlint/config-conventional` | Preset rules matching the conventional commits spec |
| `husky` | Git hook manager — runs commitlint automatically on every commit |

### Create `commitlint.config.cjs`

Create this file in the **project root**. Use `.cjs` extension (not `.js`) if your `package.json` has `"type": "module"`, since commitlint uses `module.exports` (CommonJS):

```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature (minor version bump)
        'fix',      // Bug fix (patch version bump)
        'perf',     // Performance improvement (patch version bump)
        'security', // Security fix (patch version bump)
        'docs',     // Documentation only (no release)
        'test',     // Adding/updating tests (no release)
        'chore',    // Maintenance, deps, config (no release)
        'refactor', // Code restructure, no behavior change (no release)
        'ci',       // CI/CD changes (no release)
        'style',    // Formatting, whitespace (no release)
      ],
    ],
  },
}
```

This defines the exact set of allowed prefixes. Any commit that doesn't start with one of these types followed by a colon will be rejected.

### Set up the git hook

```bash
npx husky init
echo "npx --no -- commitlint --edit \$1" > .husky/commit-msg
```

This creates a `.husky/commit-msg` hook that runs commitlint against every commit message before the commit is created.

### What it looks like in practice

**Bad commit — rejected:**
```
$ git commit -m "updated the auth page"
⧗   input: updated the auth page
✖   subject may not be empty [subject-empty]
✖   type may not be empty [type-empty]
✖   Found 2 problems, 0 warnings
```

**Bad type — rejected:**
```
$ git commit -m "update: changed the auth page"
⧗   input: update: changed the auth page
✖   type must be one of [feat, fix, perf, security, docs, test, chore, refactor, ci, style] [type-enum]
✖   Found 1 problem, 0 warnings
```

**Good commit — passes:**
```
$ git commit -m "fix: resolve auth redirect on login page"
[main abc1234] fix: resolve auth redirect on login page
```

### Interaction with existing pre-commit hook

If you already have a pre-commit hook (lint, typecheck, tests), that's fine — commitlint uses the `commit-msg` hook, which is a **different** git hook. They run at different stages:

1. `pre-commit` hook runs first (lint, typecheck, tests)
2. Git prompts for the commit message
3. `commit-msg` hook runs (commitlint validates the message)
4. Commit is created (or rejected)

Both hooks coexist without conflict.

---

## Step 8: Update CLAUDE.md

Since Claude Code writes most of your commit messages, update the Git Conventions section in `CLAUDE.md` to make the rules explicit and explain their impact on versioning:

Replace the existing Git Conventions section with:

```markdown
## Git Conventions

Commit format: `<type>: <description>`

**Every commit MUST start with an allowed type prefix.** These prefixes drive automatic
versioning via semantic-release. Using the wrong type will create an incorrect version bump.
Commits are validated by a commitlint git hook — invalid messages will be rejected.

| Type | Version Bump | When to Use |
|------|-------------|-------------|
| `feat` | Minor (1.0→1.1) | New feature or user-facing capability |
| `fix` | Patch (1.0.0→1.0.1) | Bug fix |
| `perf` | Patch | Performance improvement |
| `security` | Patch | Security fix |
| `docs` | No release | Documentation only |
| `test` | No release | Adding/updating tests |
| `chore` | No release | Maintenance, deps, config |
| `refactor` | No release | Code restructure, no behavior change |
| `ci` | No release | CI/CD pipeline changes |
| `style` | No release | Formatting, whitespace |

For breaking changes, add `!` after the type: `feat!: redesign auth flow`
This triggers a major version bump (1.0→2.0).

Guidelines:
- First line: 50 chars max, imperative mood ("add feature" not "added feature")
- Use `feat` only for genuinely new capabilities — not for extending existing ones (use `fix` or `refactor`)
- Use `chore` for dependency updates, config changes, and anything that doesn't affect the shipped product
- When in doubt between `feat` and `fix`, prefer `fix` — it's safer (patch bump vs minor bump)
```

This ensures Claude Code understands that the prefix isn't just a style choice — it directly controls what version number gets published.

---

## Relationship to iOS / Capacitor Versioning

Semantic-release manages the **web app version** only. iOS versioning stays separate because:

- The iOS shell app only needs a new version when native code changes (rare for remote URL mode)
- Apple requires a unique integer build number (`CURRENT_PROJECT_VERSION`) per TestFlight upload
- The iOS `MARKETING_VERSION` follows its own cadence

If you ever want to sync them, tools like [`capacitor-set-version`](https://www.npmjs.com/package/capacitor-set-version) can copy `package.json` version → iOS `Info.plist`, but this is optional and only needed when shipping a new iOS build.
