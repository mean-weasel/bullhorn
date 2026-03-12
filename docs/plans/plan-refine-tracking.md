# Plan Refine Tracking

**Prompt:** "Double-check this plan and its associated files for accuracy. Make sure it's not missing any fundamental ideas, etc."
**Plan File:** /Users/jeremywatt/Desktop/bullhorn/plans/TESTFLIGHT-CI-2026-03-10.md

---

## Iteration Log

### Iteration 1 (2026-03-11)

**Findings:** 8 (3 HIGH, 4 MEDIUM, 1 LOW)

#### Changes Applied

- [HIGH] Fixed `Gemfile.lock` claim — plan said "Gemfile + Gemfile.lock — New" but no lockfile exists in repo. Corrected section title to "Gemfile — New" and added a note that `Gemfile.lock` must be generated and committed for `bundler-cache: true` to work. Added corresponding to-do item.
- [HIGH] Added missing concurrency strategy documentation — workflow has `concurrency: { group: ios-testflight, cancel-in-progress: true }` which was not mentioned anywhere in the plan. Added to the workflow summary paragraph.
- [HIGH] Added missing Xcode version pinning — workflow selects Xcode 16.2 via `xcode-select`, not documented. Added to step 1 of the workflow description and noted `macos-15` runner + 30-minute timeout.
- [MEDIUM] Clarified `.p8` key decode step — plan said "decodes the base64-encoded key" but didn't mention the directory creation or file naming convention (`AuthKey_{KEY_ID}.p8`). Updated step 3.
- [MEDIUM] Documented `ASC_KEY_FILEPATH` env var override in Fastfile — local dev fallback path was undocumented. Added note to Fastfile section.
- [MEDIUM] Added `macos-15` runner and `timeout-minutes: 30` to workflow summary paragraph.
- [MEDIUM] Documented `CAPACITOR_SERVER_URL` override in trigger strategy rationale — relevant for understanding the remote URL architecture.
- [LOW] Fixed section 5 title from "Gemfile + Gemfile.lock" to just "Gemfile" to match actual file state.

### Iteration 2 (2026-03-11)

**Findings:** 8 (3 HIGH, 4 MEDIUM, 1 LOW)

#### Changes Applied

- [HIGH] Updated stale to-do item — `Gemfile.lock` already exists on disk (untracked), changed to-do from "Generate and commit" to "Commit" and updated the note in section 5 to reflect actual state
- [HIGH] Added missing `app_identifier: "to.bullhorn.app"` detail to Fastfile description — required parameter for `latest_testflight_build_number` that was omitted
- [HIGH] Documented `skip_waiting_for_build_processing: true` in Fastfile section — deliberate CI optimization that avoids 15-30 min blocking wait
- [MEDIUM] Added Node.js version (20) and `npm ci` (vs `npm install`) with npm caching to workflow step 1 description
- [MEDIUM] Noted actual resolved fastlane version (2.232.2) alongside the `~> 2.225` constraint in Gemfile section
- [MEDIUM] Documented `xcargs: "-allowProvisioningUpdates"` in Fastfile section — required for automatic signing in headless CI
- [MEDIUM] Added note about `build_app` passing `-allowProvisioningUpdates` to xcodebuild for automatic provisioning profile downloads
- [LOW] Updated Appfile section title and description to mention `app_identifier("to.bullhorn.app")` alongside the env var rename

### Iteration 3 (2026-03-11)

**Findings:** 6 (3 HIGH, 3 MEDIUM, 0 LOW)

#### Changes Applied

- [HIGH] Documented `app_store_connect_api_key` construction — the Fastfile builds an API key object from env vars and passes it to both `latest_testflight_build_number` and `upload_to_testflight`; this fundamental authentication step was missing from the plan
- [HIGH] Documented `export_options` in Fastfile section — `build_app` specifies `method: "app-store"`, `teamID`, and `signingStyle: "automatic"` which control IPA export and signing; these were omitted
- [HIGH] Added edge case note to trigger strategy — Capacitor plugin version changes in `package.json` can affect native output via `npx cap sync ios`, but `package.json` isn't in the path filter; documented the tradeoff and workaround
- [MEDIUM] Added `working-directory: ios/App` detail to Ruby setup step — relevant because the Gemfile lives in `ios/App`, not the repo root
- [MEDIUM] Clarified "Four secrets" phrasing to "Four iOS-specific secrets" and noted other repo secrets exist for other workflows
- [MEDIUM] Added workflow name (`iOS TestFlight`) and job name (`Build & Upload to TestFlight`) to workflow description

### Iteration 4 (2026-03-11)

**Findings:** 4 (1 HIGH, 2 MEDIUM, 1 LOW)

#### Changes Applied

- [HIGH] Fixed to-do list — `ios/App/Gemfile` is also untracked (not just `Gemfile.lock`); updated to explicitly call out both files with `git add` and changed "Commit all changed files" to "Commit all changed and newly-tracked files"
- [MEDIUM] Retitled section 3 from "Build number auto-increment" to "Fastlane beta lane" — after 3 iterations of content expansion, the old title no longer reflected the section's scope (API key, export options, upload config, local dev override)
- [MEDIUM] Added "Ancillary Cleanup" section documenting the 11 deleted old plan/status documents on this branch — unrelated to TestFlight but part of the PR diff
- [LOW] Added `project: "App.xcodeproj"` and `scheme: "App"` params to the `build_app` and `increment_build_number` descriptions in the Fastfile section

### Iteration 5 (2026-03-11)

**Findings:** 1 (0 HIGH, 1 MEDIUM, 0 LOW)

#### Changes Applied

- [MEDIUM] Flagged stale `ExportOptions.plist` in repo root — used by the old workflow's `xcodebuild -exportArchive` step but now dead (Fastlane handles export options inline). Added to Ancillary Cleanup section and to-do list for deletion
