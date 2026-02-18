# iOS App Store Submission — Design Document

**Date**: 2026-02-17
**Status**: Approved
**Approach**: Remote URL (WKWebView loads bullhorn.to)

## Goals

- Provide a better mobile experience for existing users (push notifications, share extension, native feel)
- Reach new users via App Store search and discovery
- Pass Apple's Guideline 4.2 (minimum functionality) review

## Architecture

WKWebView loads `https://bullhorn.to` in remote URL mode. The native shell provides:

- **Push notifications** (client-side already built, needs backend sending + APNs key)
- **Share extension** (already built — text + URL extraction from other apps)
- **Google OAuth** (already built — via @capgo/capacitor-social-login)
- **Deep linking** (already built — `bullhorn://share` URL scheme)
- **Session persistence** (NEW — Keychain storage for auth tokens)
- **Offline page** (NEW — branded native view when no connectivity)
- **Haptic feedback** (NEW — on key interactions)
- **Biometric auth** (NEW — optional Face ID/Touch ID app lock)
- **App icons** (NEW — proper icon set from existing branding)
- **Privacy manifest** (NEW — required since iOS 17)

### Session Persistence Fix

**Problem**: WKWebView cookies don't survive app kill in remote URL mode.

**Solution**: Native Keychain storage + web↔native bridge.
1. On web login success, web app sends auth token to native via `postMessage`
2. Native stores token in iOS Keychain (survives app kill, encrypted by OS)
3. On app launch, native reads token from Keychain and injects into WebView via cookie or JS
4. On web logout, web app signals native to clear Keychain entry

### Biometric Auth

**Implementation**: Optional app lock via Face ID/Touch ID.
1. User enables in Settings page (toggle)
2. Preference stored in native UserDefaults
3. On app foreground (if enabled), show biometric prompt before revealing content
4. Fallback to passcode if biometrics unavailable
5. Uses `LAContext` (Local Authentication framework) in AppDelegate

### Offline Page

**Implementation**: Native offline view in AppDelegate.
1. `WKWebView` delegate detects navigation failure (no network)
2. Show a branded UIView with Bullhorn logo + "No internet connection" message + retry button
3. On retry, attempt to reload the WebView
4. When connectivity returns, automatically reload

## What's Already Built

| Component | File | Status |
|-----------|------|--------|
| Capacitor config | `capacitor.config.ts` | Complete |
| iOS native project | `ios/App/` | Complete |
| Platform detection | `src/lib/capacitor.ts` | Complete |
| Google OAuth | `src/lib/googleSignIn.ts` | Complete |
| Share extension | `ios/App/BullhornShare/` | Complete |
| Push notifications (client) | `src/lib/pushNotifications.ts` | Complete |
| Push token storage | `src/app/api/push-tokens/route.ts` | Complete |
| Deep linking | `src/lib/shareHandler.ts` | Complete |
| App Delegate | `ios/App/App/AppDelegate.swift` | Complete |
| NativeInit component | `src/app/(dashboard)/components/NativeInit.tsx` | Complete |

## Phased Plan

### Phase 1 — Technical Fixes (code work)

1. **Session persistence**: Keychain storage + postMessage bridge between web and native
2. **Offline page**: Native UIView with branding shown on connectivity loss
3. **Haptic feedback**: Add `@capacitor/haptics` triggers on post create, campaign save, form submit
4. **Biometric auth**: Face ID/Touch ID optional app lock (LAContext in AppDelegate, toggle in Settings)
5. **App icons**: Generate full icon set using `@capacitor/assets` from megaphone branding
6. **Privacy manifest**: Create `PrivacyInfo.xcprivacy` declaring API usage reasons
7. **Entitlements**: Add `.entitlements` file with push notification + associated domains capabilities
8. **Update plugins**: Ensure all @capacitor/* plugins are on latest v8.x

### Phase 2 — Apple Developer Portal Setup

1. Register App ID `to.bullhorn.app` in Certificates, Identifiers & Profiles
2. Enable capabilities: Push Notifications, Associated Domains
3. Create APNs key (for push notification sending)
4. Configure automatic signing in Xcode (select team, bundle ID)
5. Build and run on physical device to verify signing works
6. Host Apple App Site Association file at `bullhorn.to/.well-known/apple-app-site-association`

### Phase 3 — App Store Connect & TestFlight

1. Create app listing in App Store Connect (name, bundle ID, SKU)
2. Prepare required screenshots (6.7" iPhone, 5.5" iPhone at minimum)
3. Write app description, keywords, set category (Productivity or Business)
4. Add privacy policy URL
5. Set age rating
6. Archive in Xcode (Product → Archive)
7. Upload to App Store Connect via Xcode Organizer
8. Create TestFlight internal testing group
9. Distribute build to internal testers
10. Test all flows on physical device: login, create post, push notifications, share extension, offline, biometrics

### Phase 4 — App Store Submission

1. Complete all required metadata in App Store Connect
2. Select the tested build
3. Submit for App Store Review
4. Monitor review status (typically 24-48 hours)
5. If rejected for Guideline 4.2: add more native features (widgets, Siri shortcuts) and resubmit
6. If rejected for other reasons: address feedback and resubmit
7. App goes live

### Phase 5 — CI/CD for iOS Builds

1. Set up GitHub Actions workflow for iOS builds (`ios-build.yml`)
2. Configure code signing in CI (certificates + profiles via match or manual)
3. Store signing secrets in GitHub repository secrets
4. Automated build on push to main
5. Automated TestFlight upload via `xcodebuild` + `altool` or Fastlane
6. Optional: Fastlane for managing certificates, builds, and uploads

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Guideline 4.2 rejection | Push notifications + share extension + offline page + haptics + biometrics = 5 native features |
| Session persistence still flaky | Keychain storage is the standard iOS solution; fallback to re-auth if Keychain read fails |
| OAuth blocked in WebView | Already using @capgo/capacitor-social-login which opens system browser |
| App Store review delay | Submit as early as possible; use TestFlight for internal testing while waiting |
| CI/CD signing complexity | Start with manual Xcode signing; automate in Phase 5 after initial submission |

## Success Criteria

- App passes App Store review on first or second submission
- Users can log in, create posts, receive push notifications, and share from other apps
- Session persists across app kills (no unexpected logouts)
- Biometric lock works when enabled
- Offline page shows instead of white screen
- CI/CD pipeline automatically uploads new builds to TestFlight
