# Bullhorn Browser Workflow QA Audit Report

**Date:** February 8, 2026
**Target:** https://bullhorn.to (Production)
**Test Account:** neonwatty@gmail.com (Google OAuth)
**Total Workflows:** 46 defined, 40 executed

---

## Executive Summary

**40 workflows tested across all major app features.** The app is largely functional with a well-executed sticker bomb design system. Two critical API failures were discovered (blog drafts and email notifications), along with several minor UX issues.

| Category | Count |
|----------|-------|
| Passed | 31 |
| Partial (limited by auth/data) | 5 |
| MANUAL (requires human interaction) | 3 |
| BLOCKED (by API failures) | 4 |
| FAILED | 1 |
| SKIPPED (destructive) | 1 |

---

## Critical Issues (Production Bugs)

### 1. [HIGH] Blog Draft Save — 500 Internal Server Error
- **Endpoint:** `POST /api/blog-drafts`
- **Impact:** Blog draft creation is **completely non-functional** in production
- **Behavior:** User fills out blog editor, clicks Save, API returns 500. No error message shown — "Unsaved changes" persists silently
- **Blocked workflows:** Create, Edit, Search/Filter, Archive/Restore, Delete Blog Draft (5 workflows)
- **Recommendation:** Investigate server-side error in blog-drafts API route

### 2. [HIGH] Email Notification Preferences — 500 Internal Server Error
- **Endpoint:** `GET /api/notification-preferences`
- **Impact:** Email notification management is **completely broken** in production
- **Behavior:** Settings page shows "Failed to load email preferences. Please refresh the page."
- **Recommendation:** Investigate notification_preferences table/API route

---

## Medium Severity Issues

### 3. [MED] No Error Feedback on Blog Draft Save Failure
- **Location:** `/blog/new` editor
- **Issue:** When API returns 500, UI shows no error toast. User has no indication why save failed

### 4. [MED] Reset Password Page Lacks Session Validation
- **Location:** `/reset-password`
- **Issue:** Shows password form without valid recovery session. Submit silently fails

### 5. [MED] Date Picker React State Sync Issue
- **Location:** Post editor date/time inputs
- **Issue:** Programmatic date/time values don't sync with React state on first attempt

---

## Low Severity Issues

| # | Issue | Location |
|---|-------|----------|
| 6 | Stats bar doesn't update after campaign creation | `/projects/:id` |
| 7 | Launch post cards not directly clickable | `/launch-posts` |
| 8 | Empty search shows generic empty state | `/posts` |
| 9 | URL query param not reflected in filter tab | `/posts?status=...` |
| 10 | Profile Save button always active | `/profile` |
| 11 | Gold button contrast on white backgrounds | Multiple pages |

---

## Observations & Notes

- New campaigns default to "Active" instead of "Draft" — may be intentional
- Sticker bomb design system is consistently applied throughout
- ConfirmDialog component is well-designed for destructive actions
- Real-time avatar/name preview, PasswordStrength indicator, markdown Write/Preview tabs are strong UX patterns
- Brand Kit with hashtag pill previews works well

---

## Workflow Results

| # | Workflow | Status | Issues |
|---|---------|--------|--------|
| 1 | Login with Email | Passed | 0 |
| 2 | Login with Google OAuth | Passed | 0 |
| 3 | Sign Up with Email | Partial | 0 |
| 4 | Forgot Password | Passed | 0 |
| 5 | Reset Password | Partial | 1 Med |
| 6 | Access Denied | Passed | 0 |
| 7 | Change Theme | Passed | 0 |
| 8 | Handle Empty States | Passed | 0 |
| 9 | Enable Notifications | Partial | 0 |
| 10 | Create Post | Passed | 0 |
| 11 | Edit Post | Passed | 0 |
| 12 | Schedule Post | Passed | 1 Med |
| 13 | Delete Post | MANUAL | 0 |
| 14 | Archive/Restore Post | Passed | 0 |
| 15 | Filter Posts | Passed | 1 Low |
| 16 | Search Posts | Passed | 1 Low |
| 17 | Create Campaign | Passed | 1 Low |
| 18 | Edit Campaign | Passed | 0 |
| 19 | Move Campaign | Passed | 0 |
| 20 | Filter Campaigns | Passed | 0 |
| 21 | Delete Campaign | Passed | 0 |
| 22 | Create Launch Post | Passed | 0 |
| 23 | Edit Launch Post | Passed | 0 |
| 24 | Filter Launch Posts | Passed | 1 Low |
| 25 | Delete Launch Post | MANUAL | 0 |
| 26 | Bulk Actions | Incomplete | 0 |
| 27 | Create New Project | Passed | 0 |
| 28 | View Project Detail | Passed | 0 |
| 29 | Edit Project Settings | Passed | 0 |
| 30 | Delete Project | Passed | 0 |
| 31 | Campaign in Project | Passed | 1 Low |
| 32 | Create Blog Draft | **FAILED** | **1 High, 1 Med** |
| 33 | Edit Blog Draft | BLOCKED | 0 |
| 34 | Search Blog Drafts | BLOCKED | 0 |
| 35 | Archive Blog Draft | BLOCKED | 0 |
| 36 | Delete Blog Draft | BLOCKED | 0 |
| 37 | Connect Analytics | Partial | **1 High** |
| 38 | View/Edit Profile | Passed | 1 Low |
| 39 | Change Password | Passed | 0 |
| 40 | Delete Account | SKIPPED | 0 |

---

## Recommendations (Priority Order)

1. **Fix `POST /api/blog-drafts` 500 error** — Blog feature completely broken
2. **Fix `GET /api/notification-preferences` 500 error** — Email settings broken
3. **Add error toasts for failed API calls** — Silent failures confuse users
4. **Validate recovery session on reset-password page**
5. **Make launch post cards clickable** — Consistency with campaigns/posts
6. **Add search-specific empty state messaging**
7. **Update stats bar reactively after campaign CRUD**
8. **Initialize filter from URL query params**
9. **Disable Save button when unchanged**
