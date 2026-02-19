# PR: Add `--internal` flag to `asc testflight beta-groups create`

## Problem

The `asc` CLI cannot create internal TestFlight groups. The `create` command only accepts `--app` and `--name`. The `update` command has `--internal` but Apple's API rejects it: `isInternalGroup` cannot be set via PATCH — it must be set at creation time.

## Repo

- **URL**: https://github.com/rudrankriyam/App-Store-Connect-CLI
- **Language**: Go
- **File to modify**: `internal/cli/testflight/beta_groups.go`

## Changes

### 1. `BetaGroupsCreateCommand()` — add `--internal` flag

```go
// Add to flag set (alongside existing --app, --name)
internal := fs.Bool("internal", false, "Create as internal group")
```

### 2. `CreateBetaGroup()` client method — accept `isInternalGroup`

```go
// Current signature:
func (c *Client) CreateBetaGroup(ctx context.Context, appID, name string) (*BetaGroupResponse, error)

// New signature:
func (c *Client) CreateBetaGroup(ctx context.Context, appID, name string, isInternal bool) (*BetaGroupResponse, error)
```

Add `isInternalGroup` to the POST request body attributes:

```go
"attributes": {
    "name": name,
    "isInternalGroup": isInternal
}
```

### 3. Update call site

Pass the new `*internal` bool from the flag through to `CreateBetaGroup()`.

## Verification

```bash
# Create internal group
asc testflight beta-groups create --app "$APP_ID" --name "Team" --internal --pretty

# Verify isInternalGroup is true in response
# Expected: "isInternalGroup": true

# Create external group (default, unchanged behavior)
asc testflight beta-groups create --app "$APP_ID" --name "Public Beta" --pretty

# Verify isInternalGroup is false (or absent)
```

---

## Additional Change: Cancel/Delete Beta Review Submissions

### Problem

The `asc` CLI has no way to cancel a beta app review submission. The `testflight review submissions` subcommand only supports `list`, `get`, and `build` — no `delete` or `cancel`.

Apple's API supports `DELETE /v1/betaAppReviewSubmissions/{id}` to withdraw a submission that's `WAITING_FOR_REVIEW`.

### File to modify

`internal/cli/testflight/review.go` (or wherever review submission subcommands are defined)

### Changes

Add a `delete` subcommand to `testflight review submissions`:

```bash
asc testflight review submissions delete --id "SUBMISSION_ID" --confirm
```

This sends `DELETE /v1/betaAppReviewSubmissions/{id}` to the App Store Connect API.

### Verification

```bash
# Submit a build for review
asc testflight review submit --build "$BUILD_ID" --confirm

# List to get the submission ID
asc testflight review submissions list --build "$BUILD_ID"

# Cancel it
asc testflight review submissions delete --id "$SUBMISSION_ID" --confirm

# Verify it's gone
asc testflight review submissions list --build "$BUILD_ID"
```

---

## Additional Change: Remove `--internal` from `update`

### Problem

The `--internal` flag on `beta-groups update` is dead code. Apple's API rejects it:
> `The attribute 'isInternalGroup' can not be included in a 'UPDATE' request`

### Change

Remove the `--internal` flag from `BetaGroupsUpdateCommand()` to avoid misleading users.

---

## Notes

- The data model (`BetaGroupAttributes`) already has `IsInternalGroup bool` — no struct changes needed for the create change
- File an issue first before the PR to discuss with maintainer
- Three changes total: (1) add `--internal` to `create`, (2) add `delete` to review submissions, (3) remove dead `--internal` from `update`
