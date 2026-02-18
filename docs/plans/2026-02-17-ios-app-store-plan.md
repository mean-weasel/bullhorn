# iOS App Store Submission — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship Bullhorn to the iOS App Store as a Capacitor remote-URL app with native features (push, share, offline, biometrics, haptics) that pass Guideline 4.2 review.

**Architecture:** WKWebView loads `https://bullhorn.to`. Native shell provides session persistence via Keychain, offline detection, biometric lock, haptic feedback, push notifications, and share extension. Web↔native bridge via `postMessage` + Capacitor plugins.

**Tech Stack:** Capacitor 8, Swift (AppDelegate + Keychain + LAContext), Next.js 14, Supabase, Xcode 16, GitHub Actions

---

## Phase 1: Technical Fixes

### Task 1: Session Persistence — Capacitor Plugin for Keychain Bridge

The web app needs to store/retrieve Supabase auth tokens in the iOS Keychain so sessions survive app kills.

**Files:**
- Create: `ios/App/App/KeychainPlugin.swift`
- Create: `src/lib/sessionBridge.ts`
- Modify: `ios/App/App/AppDelegate.swift:10-14`
- Modify: `src/app/(dashboard)/components/NativeInit.tsx`
- Test: `src/lib/sessionBridge.test.ts`

**Step 1: Write the native Keychain Capacitor plugin**

Create `ios/App/App/KeychainPlugin.swift`:

```swift
import Capacitor
import Security

@objc(KeychainPlugin)
public class KeychainPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KeychainPlugin"
    public let jsName = "Keychain"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
    ]

    private let service = "to.bullhorn.app"

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"),
              let value = call.getString("value") else {
            call.reject("Missing key or value")
            return
        }

        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)

        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock

        let status = SecItemAdd(addQuery as CFDictionary, nil)
        if status == errSecSuccess {
            call.resolve()
        } else {
            call.reject("Keychain set failed: \(status)")
        }
    }

    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("Missing key")
            return
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var ref: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &ref)

        if status == errSecSuccess, let data = ref as? Data, let value = String(data: data, encoding: .utf8) {
            call.resolve(["value": value])
        } else if status == errSecItemNotFound {
            call.resolve(["value": NSNull()])
        } else {
            call.reject("Keychain get failed: \(status)")
        }
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("Missing key")
            return
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]

        SecItemDelete(query as CFDictionary)
        call.resolve()
    }
}
```

**Step 2: Register plugin in AppDelegate**

Modify `ios/App/App/AppDelegate.swift`. In `didFinishLaunchingWithOptions`, after `UNUserNotificationCenter.current().delegate = self`, add:

```swift
// Register custom Capacitor plugins
let bridge = (window?.rootViewController as? CAPBridgeViewController)?.bridge
bridge?.registerPluginInstance(KeychainPlugin())
```

Note: Plugin registration happens automatically via `CAPBridgedPlugin` in Capacitor 8. If auto-registration works, skip this step and verify the plugin loads by calling it from JS.

**Step 3: Write the web-side session bridge**

Create `src/lib/sessionBridge.ts`:

```typescript
import { isNativePlatform } from './capacitor'

const SESSION_KEY = 'supabase_session'

interface KeychainPlugin {
  set(options: { key: string; value: string }): Promise<void>
  get(options: { key: string }): Promise<{ value: string | null }>
  remove(options: { key: string }): Promise<void>
}

async function getKeychainPlugin(): Promise<KeychainPlugin | null> {
  if (!isNativePlatform()) return null
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.Plugins.Keychain as unknown as KeychainPlugin
  } catch {
    return null
  }
}

export async function saveSessionToKeychain(accessToken: string, refreshToken: string): Promise<void> {
  const plugin = await getKeychainPlugin()
  if (!plugin) return
  const payload = JSON.stringify({ accessToken, refreshToken })
  await plugin.set({ key: SESSION_KEY, value: payload })
}

export async function getSessionFromKeychain(): Promise<{
  accessToken: string
  refreshToken: string
} | null> {
  const plugin = await getKeychainPlugin()
  if (!plugin) return null
  const result = await plugin.get({ key: SESSION_KEY })
  if (!result.value) return null
  try {
    return JSON.parse(result.value)
  } catch {
    return null
  }
}

export async function clearSessionFromKeychain(): Promise<void> {
  const plugin = await getKeychainPlugin()
  if (!plugin) return
  await plugin.remove({ key: SESSION_KEY })
}
```

**Step 4: Write unit test for session bridge**

Create `src/lib/sessionBridge.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock capacitor module
vi.mock('./capacitor', () => ({
  isNativePlatform: vi.fn(() => false),
}))

import { saveSessionToKeychain, getSessionFromKeychain, clearSessionFromKeychain } from './sessionBridge'
import { isNativePlatform } from './capacitor'

describe('sessionBridge', () => {
  beforeEach(() => {
    vi.mocked(isNativePlatform).mockReturnValue(false)
  })

  it('returns null from getSessionFromKeychain on web', async () => {
    const result = await getSessionFromKeychain()
    expect(result).toBeNull()
  })

  it('saveSessionToKeychain is a no-op on web', async () => {
    await expect(saveSessionToKeychain('token', 'refresh')).resolves.toBeUndefined()
  })

  it('clearSessionFromKeychain is a no-op on web', async () => {
    await expect(clearSessionFromKeychain()).resolves.toBeUndefined()
  })
})
```

**Step 5: Run tests to verify**

Run: `npx vitest run src/lib/sessionBridge.test.ts`
Expected: 3 tests PASS

**Step 6: Integrate session bridge into NativeInit**

Modify `src/app/(dashboard)/components/NativeInit.tsx`. Add session restoration on init and session save on auth state change:

```typescript
// In the init() function, before push registration:
try {
  const { getSessionFromKeychain, saveSessionToKeychain } = await import('@/lib/sessionBridge')
  const session = await getSessionFromKeychain()
  if (session) {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.setSession({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    })
  }
  // Listen for future auth changes to save tokens
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  supabase.auth.onAuthStateChange(async (_event, newSession) => {
    if (newSession) {
      await saveSessionToKeychain(newSession.access_token, newSession.refresh_token)
    } else {
      const { clearSessionFromKeychain } = await import('@/lib/sessionBridge')
      await clearSessionFromKeychain()
    }
  })
} catch (err) {
  console.error('[NativeInit] Session bridge failed:', err)
}
```

**Step 7: Commit**

```bash
git add ios/App/App/KeychainPlugin.swift src/lib/sessionBridge.ts src/lib/sessionBridge.test.ts src/app/\(dashboard\)/components/NativeInit.tsx
git commit -m "feat(ios): add Keychain session persistence for WKWebView"
```

---

### Task 2: Offline Page — Native Error View

Show a branded offline page instead of a white screen when there's no internet.

**Files:**
- Create: `ios/App/App/OfflineViewController.swift`
- Modify: `ios/App/App/AppDelegate.swift`

**Step 1: Create the offline view controller**

Create `ios/App/App/OfflineViewController.swift`:

```swift
import UIKit

class OfflineViewController: UIViewController {

    var onRetry: (() -> Void)?

    private let logoImageView: UIImageView = {
        let iv = UIImageView()
        iv.image = UIImage(named: "AppIcon-512@2x")
        iv.contentMode = .scaleAspectFit
        iv.translatesAutoresizingMaskIntoConstraints = false
        return iv
    }()

    private let titleLabel: UILabel = {
        let label = UILabel()
        label.text = "No Internet Connection"
        label.font = UIFont.systemFont(ofSize: 22, weight: .bold)
        label.textColor = .white
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private let subtitleLabel: UILabel = {
        let label = UILabel()
        label.text = "Please check your connection and try again."
        label.font = UIFont.systemFont(ofSize: 16, weight: .regular)
        label.textColor = UIColor.white.withAlphaComponent(0.7)
        label.textAlignment = .center
        label.numberOfLines = 0
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private lazy var retryButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("Retry", for: .normal)
        button.titleLabel?.font = UIFont.systemFont(ofSize: 17, weight: .bold)
        button.setTitleColor(.black, for: .normal)
        button.backgroundColor = UIColor(red: 206/255, green: 154/255, blue: 8/255, alpha: 1) // gold
        button.layer.cornerRadius = 8
        button.layer.borderWidth = 3
        button.layer.borderColor = UIColor.black.cgColor
        button.translatesAutoresizingMaskIntoConstraints = false
        button.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)
        return button
    }()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 26/255, green: 26/255, blue: 26/255, alpha: 1) // #1a1a1a

        view.addSubview(logoImageView)
        view.addSubview(titleLabel)
        view.addSubview(subtitleLabel)
        view.addSubview(retryButton)

        NSLayoutConstraint.activate([
            logoImageView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            logoImageView.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -80),
            logoImageView.widthAnchor.constraint(equalToConstant: 80),
            logoImageView.heightAnchor.constraint(equalToConstant: 80),

            titleLabel.topAnchor.constraint(equalTo: logoImageView.bottomAnchor, constant: 24),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
            titleLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32),

            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            subtitleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
            subtitleLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32),

            retryButton.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 32),
            retryButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            retryButton.widthAnchor.constraint(equalToConstant: 160),
            retryButton.heightAnchor.constraint(equalToConstant: 48),
        ])
    }

    @objc private func retryTapped() {
        onRetry?()
    }
}
```

**Step 2: Add WKWebView navigation failure handling to AppDelegate**

This requires subclassing `CAPBridgeViewController` to intercept WebView load errors. Create `ios/App/App/BullhornViewController.swift`:

```swift
import UIKit
import Capacitor
import WebKit

class BullhornViewController: CAPBridgeViewController {

    private var offlineVC: OfflineViewController?

    override func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        super.webView(webView, didFail: navigation, withError: error)
        handleWebViewError(error)
    }

    override func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        super.webView(webView, didFailProvisionalNavigation: navigation, withError: error)
        handleWebViewError(error)
    }

    private func handleWebViewError(_ error: Error) {
        let nsError = error as NSError
        // NSURLErrorNotConnectedToInternet or NSURLErrorTimedOut
        if nsError.domain == NSURLErrorDomain &&
           (nsError.code == NSURLErrorNotConnectedToInternet ||
            nsError.code == NSURLErrorCannotFindHost ||
            nsError.code == NSURLErrorTimedOut ||
            nsError.code == NSURLErrorNetworkConnectionLost) {
            showOfflinePage()
        }
    }

    private func showOfflinePage() {
        guard offlineVC == nil else { return }
        let vc = OfflineViewController()
        vc.onRetry = { [weak self] in
            self?.dismissOfflinePage()
            self?.bridge?.webView?.reload()
        }
        offlineVC = vc
        vc.view.frame = view.bounds
        view.addSubview(vc.view)
        addChild(vc)
        vc.didMove(toParent: self)
    }

    private func dismissOfflinePage() {
        offlineVC?.willMove(toParent: nil)
        offlineVC?.view.removeFromSuperview()
        offlineVC?.removeFromParent()
        offlineVC = nil
    }
}
```

**Step 3: Update Main.storyboard to use BullhornViewController**

In Xcode: Open `ios/App/App/Base.lproj/Main.storyboard`, select the view controller, and change its class from `CAPBridgeViewController` to `BullhornViewController` in the Identity Inspector.

Alternatively, edit the storyboard XML to replace `customClass="CAPBridgeViewController"` with `customClass="BullhornViewController"`.

**Step 4: Commit**

```bash
git add ios/App/App/OfflineViewController.swift ios/App/App/BullhornViewController.swift
git commit -m "feat(ios): add branded offline page for no-connectivity state"
```

---

### Task 3: Haptic Feedback

Add haptic feedback on key user interactions.

**Files:**
- Create: `src/lib/haptics.ts`
- Modify: `src/app/(dashboard)/new/page.tsx` (or post form component)
- Modify: `src/app/(dashboard)/campaigns/page.tsx` (campaign creation)
- Test: `src/lib/haptics.test.ts`

**Step 1: Write the haptics utility**

Create `src/lib/haptics.ts`:

```typescript
import { isNativePlatform } from './capacitor'

export async function hapticSuccess(): Promise<void> {
  if (!isNativePlatform()) return
  const { Haptics, NotificationType } = await import('@capacitor/haptics')
  await Haptics.notification({ type: NotificationType.Success })
}

export async function hapticWarning(): Promise<void> {
  if (!isNativePlatform()) return
  const { Haptics, NotificationType } = await import('@capacitor/haptics')
  await Haptics.notification({ type: NotificationType.Warning })
}

export async function hapticLight(): Promise<void> {
  if (!isNativePlatform()) return
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
  await Haptics.impact({ style: ImpactStyle.Light })
}
```

**Step 2: Write unit test**

Create `src/lib/haptics.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./capacitor', () => ({
  isNativePlatform: vi.fn(() => false),
}))

import { hapticSuccess, hapticWarning, hapticLight } from './haptics'

describe('haptics', () => {
  it('hapticSuccess is a no-op on web', async () => {
    await expect(hapticSuccess()).resolves.toBeUndefined()
  })

  it('hapticWarning is a no-op on web', async () => {
    await expect(hapticWarning()).resolves.toBeUndefined()
  })

  it('hapticLight is a no-op on web', async () => {
    await expect(hapticLight()).resolves.toBeUndefined()
  })
})
```

**Step 3: Run tests**

Run: `npx vitest run src/lib/haptics.test.ts`
Expected: 3 tests PASS

**Step 4: Add haptic triggers to key user actions**

In Zustand stores or page components, call `hapticSuccess()` after successful create/save actions. For example, in post creation success, campaign save success, blog draft save.

Find the success callback in the relevant store `addPost` action in `src/lib/storage.ts` and add:

```typescript
import { hapticSuccess } from './haptics'

// After successful API response in addPost:
hapticSuccess()
```

Repeat for `addCampaign` in `src/lib/campaigns.ts`, `addDraft` in `src/lib/blogDrafts.ts`.

**Step 5: Commit**

```bash
git add src/lib/haptics.ts src/lib/haptics.test.ts src/lib/storage.ts src/lib/campaigns.ts src/lib/blogDrafts.ts
git commit -m "feat(ios): add haptic feedback on create/save actions"
```

---

### Task 4: Biometric Auth (Face ID / Touch ID)

Optional app lock via biometrics.

**Files:**
- Create: `ios/App/App/BiometricPlugin.swift`
- Create: `src/lib/biometricAuth.ts`
- Create: `src/components/ui/BiometricLock.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`
- Modify: `src/app/(dashboard)/components/NativeInit.tsx`
- Modify: `ios/App/App/Info.plist` (add NSFaceIDUsageDescription)
- Test: `src/lib/biometricAuth.test.ts`

**Step 1: Create the native biometric plugin**

Create `ios/App/App/BiometricPlugin.swift`:

```swift
import Capacitor
import LocalAuthentication

@objc(BiometricPlugin)
public class BiometricPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BiometricPlugin"
    public let jsName = "BiometricAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isEnabled", returnType: CAPPluginReturnPromise),
    ]

    private let enabledKey = "biometric_lock_enabled"

    @objc func isAvailable(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        let biometryType: String
        switch context.biometryType {
        case .faceID: biometryType = "faceID"
        case .touchID: biometryType = "touchID"
        default: biometryType = "none"
        }
        call.resolve(["available": available, "biometryType": biometryType])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Unlock Bullhorn"
        let context = LAContext()
        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, error in
            DispatchQueue.main.async {
                if success {
                    call.resolve(["success": true])
                } else {
                    call.resolve(["success": false, "error": error?.localizedDescription ?? "Authentication failed"])
                }
            }
        }
    }

    @objc func setEnabled(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled") else {
            call.reject("Missing enabled parameter")
            return
        }
        UserDefaults.standard.set(enabled, forKey: enabledKey)
        call.resolve()
    }

    @objc func isEnabled(_ call: CAPPluginCall) {
        let enabled = UserDefaults.standard.bool(forKey: enabledKey)
        call.resolve(["enabled": enabled])
    }
}
```

**Step 2: Add NSFaceIDUsageDescription to Info.plist**

Add to `ios/App/App/Info.plist` inside the top-level `<dict>`:

```xml
<key>NSFaceIDUsageDescription</key>
<string>Bullhorn uses Face ID to protect your account</string>
```

**Step 3: Write the web-side biometric auth module**

Create `src/lib/biometricAuth.ts`:

```typescript
import { isNativePlatform } from './capacitor'

interface BiometricPlugin {
  isAvailable(): Promise<{ available: boolean; biometryType: string }>
  authenticate(options: { reason: string }): Promise<{ success: boolean; error?: string }>
  setEnabled(options: { enabled: boolean }): Promise<void>
  isEnabled(): Promise<{ enabled: boolean }>
}

async function getPlugin(): Promise<BiometricPlugin | null> {
  if (!isNativePlatform()) return null
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.Plugins.BiometricAuth as unknown as BiometricPlugin
  } catch {
    return null
  }
}

export async function isBiometricAvailable(): Promise<{
  available: boolean
  biometryType: 'faceID' | 'touchID' | 'none'
}> {
  const plugin = await getPlugin()
  if (!plugin) return { available: false, biometryType: 'none' }
  const result = await plugin.isAvailable()
  return result as { available: boolean; biometryType: 'faceID' | 'touchID' | 'none' }
}

export async function authenticateBiometric(reason = 'Unlock Bullhorn'): Promise<boolean> {
  const plugin = await getPlugin()
  if (!plugin) return true // Allow access on web
  const result = await plugin.authenticate({ reason })
  return result.success
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  const plugin = await getPlugin()
  if (!plugin) return
  await plugin.setEnabled({ enabled })
}

export async function isBiometricEnabled(): Promise<boolean> {
  const plugin = await getPlugin()
  if (!plugin) return false
  const result = await plugin.isEnabled()
  return result.enabled
}
```

**Step 4: Write unit test**

Create `src/lib/biometricAuth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./capacitor', () => ({
  isNativePlatform: vi.fn(() => false),
}))

import {
  isBiometricAvailable,
  authenticateBiometric,
  setBiometricEnabled,
  isBiometricEnabled,
} from './biometricAuth'

describe('biometricAuth', () => {
  it('isBiometricAvailable returns unavailable on web', async () => {
    const result = await isBiometricAvailable()
    expect(result).toEqual({ available: false, biometryType: 'none' })
  })

  it('authenticateBiometric returns true on web (passthrough)', async () => {
    const result = await authenticateBiometric()
    expect(result).toBe(true)
  })

  it('setBiometricEnabled is a no-op on web', async () => {
    await expect(setBiometricEnabled(true)).resolves.toBeUndefined()
  })

  it('isBiometricEnabled returns false on web', async () => {
    const result = await isBiometricEnabled()
    expect(result).toBe(false)
  })
})
```

**Step 5: Run tests**

Run: `npx vitest run src/lib/biometricAuth.test.ts`
Expected: 4 tests PASS

**Step 6: Add biometric lock check to NativeInit**

Modify `src/app/(dashboard)/components/NativeInit.tsx`. After session restoration, check if biometric lock is enabled:

```typescript
// After session bridge setup:
try {
  const { isBiometricEnabled, authenticateBiometric } = await import('@/lib/biometricAuth')
  const enabled = await isBiometricEnabled()
  if (enabled) {
    const success = await authenticateBiometric()
    if (!success) {
      // User failed biometric — could redirect to login or show lock screen
      console.warn('[NativeInit] Biometric auth failed')
    }
  }
} catch (err) {
  console.error('[NativeInit] Biometric check failed:', err)
}
```

**Step 7: Add biometric toggle to Settings page**

Add a `BiometricSection` component to the Settings page. This shows only on native platform and lets users toggle Face ID/Touch ID lock.

Create `src/app/(dashboard)/settings/BiometricSection.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Fingerprint } from 'lucide-react'
import { isNativePlatform } from '@/lib/capacitor'

export function BiometricSection() {
  const [available, setAvailable] = useState(false)
  const [biometryType, setBiometryType] = useState<string>('none')
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isNativePlatform()) {
      setLoading(false)
      return
    }
    async function check() {
      const { isBiometricAvailable, isBiometricEnabled } = await import('@/lib/biometricAuth')
      const avail = await isBiometricAvailable()
      setAvailable(avail.available)
      setBiometryType(avail.biometryType)
      const on = await isBiometricEnabled()
      setEnabled(on)
      setLoading(false)
    }
    check()
  }, [])

  if (!isNativePlatform() || loading || !available) return null

  const label = biometryType === 'faceID' ? 'Face ID' : 'Touch ID'

  const handleToggle = async () => {
    const { setBiometricEnabled, authenticateBiometric } = await import('@/lib/biometricAuth')
    if (!enabled) {
      const success = await authenticateBiometric(`Enable ${label} for Bullhorn`)
      if (!success) return
    }
    const newValue = !enabled
    await setBiometricEnabled(newValue)
    setEnabled(newValue)
  }

  return (
    <div className="p-6 rounded-md border-[3px] border-border bg-card shadow-[4px_4px_0_hsl(var(--border))] mb-6">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground mb-4">
        <Fingerprint className="w-4 h-4 inline-block mr-1 -mt-0.5" /> Security
      </h2>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-sm">{label} Lock</p>
          <p className="text-sm text-muted-foreground">Require {label} to open Bullhorn</p>
        </div>
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors border-2 border-border ${
            enabled ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform border border-border ${
              enabled ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  )
}
```

Then import and render `<BiometricSection />` in `src/app/(dashboard)/settings/page.tsx` after the Theme section.

**Step 8: Commit**

```bash
git add ios/App/App/BiometricPlugin.swift src/lib/biometricAuth.ts src/lib/biometricAuth.test.ts \
  src/components/ui/BiometricLock.tsx src/app/\(dashboard\)/settings/BiometricSection.tsx \
  src/app/\(dashboard\)/settings/page.tsx src/app/\(dashboard\)/components/NativeInit.tsx \
  ios/App/App/Info.plist
git commit -m "feat(ios): add optional Face ID / Touch ID app lock"
```

---

### Task 5: App Icons

Generate a complete icon set from existing branding.

**Files:**
- Create: `assets/icon-only.png` (1024x1024 source)
- Create: `assets/splash.png` (2732x2732 source)
- Modify: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

**Step 1: Prepare source assets**

The project already has `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`. Check if it's suitable as a source (needs to be at least 1024x1024).

Copy or create a 1024x1024 `icon-only.png` in an `assets/` folder at project root. Also create a 2732x2732 `splash.png` with the Bullhorn branding on dark background (#1a1a1a).

**Step 2: Install and run capacitor-assets**

```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --ios
```

This generates all required icon sizes and splash screen variants in `ios/App/App/Assets.xcassets/`.

**Step 3: Verify in Xcode**

Open Xcode (`npx cap open ios`), check Assets.xcassets to verify all icon slots are filled.

**Step 4: Commit**

```bash
git add assets/ ios/App/App/Assets.xcassets/
git commit -m "feat(ios): generate complete app icon and splash screen set"
```

---

### Task 6: Privacy Manifest

Required since iOS 17 — declares API usage reasons.

**Files:**
- Create: `ios/App/App/PrivacyInfo.xcprivacy`

**Step 1: Create the privacy manifest**

Create `ios/App/App/PrivacyInfo.xcprivacy`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array/>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>CA92.1</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
```

The `CA92.1` reason covers UserDefaults access for app functionality (biometric preference storage).

**Step 2: Add to Xcode project**

In Xcode, drag `PrivacyInfo.xcprivacy` into the App target if it doesn't appear automatically.

**Step 3: Commit**

```bash
git add ios/App/App/PrivacyInfo.xcprivacy
git commit -m "feat(ios): add privacy manifest (PrivacyInfo.xcprivacy)"
```

---

### Task 7: Entitlements File

Enable push notification and associated domains capabilities.

**Files:**
- Create: `ios/App/App/App.entitlements`

**Step 1: Create entitlements file**

Create `ios/App/App/App.entitlements`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>aps-environment</key>
    <string>development</string>
    <key>com.apple.developer.associated-domains</key>
    <array>
        <string>applinks:bullhorn.to</string>
    </array>
</dict>
</plist>
```

Note: Change `aps-environment` to `production` before App Store submission. Xcode manages this automatically when you switch build configurations.

**Step 2: Configure in Xcode**

In Xcode → App target → Signing & Capabilities → + Capability:
- Add "Push Notifications"
- Add "Associated Domains" → add `applinks:bullhorn.to`

Xcode will create/update the entitlements file and set it in build settings.

**Step 3: Commit**

```bash
git add ios/App/App/App.entitlements
git commit -m "feat(ios): add entitlements for push notifications and universal links"
```

---

### Task 8: Apple App Site Association File

Enable universal links from iOS to Bullhorn web app.

**Files:**
- Create: `public/.well-known/apple-app-site-association`
- Modify: `next.config.js` (ensure .well-known is served correctly)

**Step 1: Create the AASA file**

Create `public/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.to.bullhorn.app",
        "paths": ["/posts/*", "/campaigns/*", "/projects/*", "/new", "/dashboard"]
      }
    ]
  }
}
```

Replace `TEAM_ID` with your actual Apple Team ID (found in Apple Developer portal under Membership).

Note: This file MUST be served as `application/json` with no `.json` extension. Next.js serves files from `public/` as-is, so this works by default.

**Step 2: Verify it's accessible**

After deploying, verify: `curl -I https://bullhorn.to/.well-known/apple-app-site-association`
Expected: `200 OK` with `Content-Type: application/json`

**Step 3: Commit**

```bash
git add public/.well-known/apple-app-site-association
git commit -m "feat(ios): add Apple App Site Association for universal links"
```

---

## Phase 2: Apple Developer Portal Setup

These are manual steps performed in a browser. Not automatable by Claude.

### Task 9: Register App ID and Configure Capabilities

**Steps (in Apple Developer portal):**

1. Go to https://developer.apple.com/account → Certificates, Identifiers & Profiles
2. Click "Identifiers" → "+" → "App IDs" → "App"
3. Enter description: "Bullhorn"
4. Bundle ID: `to.bullhorn.app` (Explicit)
5. Enable capabilities:
   - Push Notifications
   - Associated Domains
6. Click "Register"

### Task 10: Create APNs Key

**Steps:**

1. In Apple Developer portal → Keys → "+"
2. Name: "Bullhorn APNs"
3. Enable "Apple Push Notifications service (APNs)"
4. Click "Register"
5. **Download the .p8 key file** (you can only download this ONCE)
6. Note the Key ID and your Team ID
7. Store the .p8 file securely (you'll need it for backend push sending)

### Task 11: Configure Xcode Signing

**Steps:**

1. Open Xcode: `npx cap open ios`
2. Select the "App" target
3. Go to Signing & Capabilities
4. Check "Automatically manage signing"
5. Select your Team from the dropdown
6. Verify Bundle Identifier is `to.bullhorn.app`
7. Xcode should show "Provisioning Profile: Xcode Managed Profile" with no errors
8. Build and run on a physical device (Product → Run, select your iPhone)
9. Verify the app launches and loads bullhorn.to

---

## Phase 3: App Store Connect & TestFlight

### Task 12: Create App Store Connect Listing

**Steps (in App Store Connect):**

1. Go to https://appstoreconnect.apple.com → My Apps → "+"  → "New App"
2. Fill in:
   - Platform: iOS
   - Name: "Bullhorn"
   - Primary Language: English (U.S.)
   - Bundle ID: Select `to.bullhorn.app`
   - SKU: `bullhorn-ios-001`
3. Save

### Task 13: Prepare App Store Metadata

**Required metadata:**

- **Screenshots**: At minimum 6.7" (iPhone 15 Pro Max) and 5.5" (iPhone 8 Plus). Take screenshots from the Simulator.
- **Description**: Write 170-4000 character description of Bullhorn
- **Keywords**: Comma-separated, max 100 chars total (e.g., "social media,scheduler,twitter,linkedin,reddit,post,campaign")
- **Category**: Productivity (primary), Social Networking (secondary)
- **Privacy Policy URL**: Must be a publicly accessible URL (e.g., `https://bullhorn.to/privacy`)
- **Age Rating**: Complete the questionnaire (no objectionable content → 4+)
- **App Icon**: 1024x1024, no alpha channel, no rounded corners (Apple applies rounding)

### Task 14: Archive, Upload, and TestFlight

**Steps:**

1. In Xcode, set version number: App target → General → Version: `1.0.0`, Build: `1`
2. Select "Any iOS Device (arm64)" as build destination
3. Product → Archive
4. In Organizer: Distribute App → App Store Connect → Upload
5. Wait for processing (5-30 minutes)
6. In App Store Connect → TestFlight: build appears
7. Create internal testing group, add testers by email
8. Testers install via TestFlight app and test all flows

**Test checklist:**
- [ ] Login via Google OAuth works
- [ ] Session persists after app kill and relaunch
- [ ] Creating a post works with haptic feedback
- [ ] Push notification permission prompt appears
- [ ] Share extension works from Safari/other apps
- [ ] Offline page appears when airplane mode is on
- [ ] Retry button on offline page works
- [ ] Biometric lock toggle in Settings works
- [ ] Face ID/Touch ID prompt appears on next foreground (if enabled)

---

## Phase 4: App Store Submission

### Task 15: Submit for Review

**Steps:**

1. In App Store Connect → App Store tab
2. Fill in all required fields (screenshots, description, etc.)
3. Under "Build", select the tested TestFlight build
4. Review all sections for completeness
5. Click "Submit for Review"
6. Monitor status (typically 24-48 hours)

**If rejected for Guideline 4.2:**
- Document the 5 native features in the review notes: push notifications, share extension, offline handling, haptic feedback, biometric authentication
- Add demo account credentials for the reviewer
- Consider adding more features: home screen widgets, Siri shortcuts
- Resubmit with detailed App Review notes explaining native functionality

---

## Phase 5: CI/CD for iOS Builds

### Task 16: GitHub Actions iOS Build Workflow

**Files:**
- Create: `.github/workflows/ios-build.yml`

**Step 1: Create the workflow file**

Create `.github/workflows/ios-build.yml`:

```yaml
name: iOS Build

on:
  push:
    branches: [main]
    paths:
      - 'ios/**'
      - 'capacitor.config.ts'
      - 'package.json'
  workflow_dispatch:

jobs:
  build:
    name: Build & Upload to TestFlight
    runs-on: macos-14
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Sync Capacitor
        run: npx cap sync ios

      - name: Setup Xcode
        uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: '16.0'

      - name: Install CocoaPods
        run: cd ios/App && pod install

      - name: Import signing certificate
        env:
          P12_BASE64: ${{ secrets.IOS_P12_BASE64 }}
          P12_PASSWORD: ${{ secrets.IOS_P12_PASSWORD }}
          KEYCHAIN_PASSWORD: ${{ secrets.IOS_KEYCHAIN_PASSWORD }}
        run: |
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db
          security create-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
          security set-keychain-settings -lut 21600 $KEYCHAIN_PATH
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
          echo "$P12_BASE64" | base64 --decode > $RUNNER_TEMP/certificate.p12
          security import $RUNNER_TEMP/certificate.p12 -P "$P12_PASSWORD" -A -t cert -f pkcs12 -k $KEYCHAIN_PATH
          security list-keychain -d user -s $KEYCHAIN_PATH

      - name: Import provisioning profile
        env:
          PROFILE_BASE64: ${{ secrets.IOS_PROVISION_PROFILE_BASE64 }}
        run: |
          mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
          echo "$PROFILE_BASE64" | base64 --decode > ~/Library/MobileDevice/Provisioning\ Profiles/bullhorn.mobileprovision

      - name: Build archive
        run: |
          cd ios/App
          xcodebuild archive \
            -workspace App.xcworkspace \
            -scheme App \
            -archivePath $RUNNER_TEMP/Bullhorn.xcarchive \
            -configuration Release \
            CODE_SIGN_STYLE=Manual \
            PROVISIONING_PROFILE_SPECIFIER="Bullhorn Distribution" \
            CODE_SIGN_IDENTITY="Apple Distribution"

      - name: Export IPA
        run: |
          cd ios/App
          xcodebuild -exportArchive \
            -archivePath $RUNNER_TEMP/Bullhorn.xcarchive \
            -exportPath $RUNNER_TEMP/export \
            -exportOptionsPlist ../../ExportOptions.plist

      - name: Upload to TestFlight
        env:
          APP_STORE_CONNECT_API_KEY_ID: ${{ secrets.ASC_KEY_ID }}
          APP_STORE_CONNECT_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}
          APP_STORE_CONNECT_API_KEY: ${{ secrets.ASC_API_KEY }}
        run: |
          xcrun altool --upload-app \
            --type ios \
            --file $RUNNER_TEMP/export/App.ipa \
            --apiKey "$APP_STORE_CONNECT_API_KEY_ID" \
            --apiIssuer "$APP_STORE_CONNECT_ISSUER_ID"
```

**Step 2: Create ExportOptions.plist**

Create `ExportOptions.plist` at project root:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>TEAM_ID</string>
    <key>signingStyle</key>
    <string>manual</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>to.bullhorn.app</key>
        <string>Bullhorn Distribution</string>
    </dict>
</dict>
</plist>
```

Replace `TEAM_ID` with your actual Apple Team ID.

**Step 3: Store secrets in GitHub**

In GitHub → Settings → Secrets and variables → Actions, add:
- `IOS_P12_BASE64`: Base64-encoded distribution certificate (.p12)
- `IOS_P12_PASSWORD`: Password for the .p12 file
- `IOS_KEYCHAIN_PASSWORD`: Any random password for the temporary keychain
- `IOS_PROVISION_PROFILE_BASE64`: Base64-encoded provisioning profile
- `ASC_KEY_ID`: App Store Connect API Key ID
- `ASC_ISSUER_ID`: App Store Connect API Issuer ID
- `ASC_API_KEY`: App Store Connect API Key (.p8 contents)

**Step 4: Commit**

```bash
git add .github/workflows/ios-build.yml ExportOptions.plist
git commit -m "feat(ios): add GitHub Actions CI/CD for iOS builds and TestFlight"
```

---

## Dependency Map

```
Task 1 (Session persistence) ← no dependencies
Task 2 (Offline page)        ← no dependencies
Task 3 (Haptics)             ← no dependencies
Task 4 (Biometric auth)      ← no dependencies
Task 5 (App icons)           ← no dependencies
Task 6 (Privacy manifest)    ← no dependencies
Task 7 (Entitlements)        ← no dependencies
Task 8 (AASA file)           ← no dependencies

Task 9  (Register App ID)    ← Apple Developer account
Task 10 (APNs key)           ← Task 9
Task 11 (Xcode signing)      ← Task 9 + Tasks 1-8

Task 12 (App Store Connect)  ← Task 9
Task 13 (Metadata)           ← Task 12
Task 14 (Archive/TestFlight) ← Tasks 1-8 + Task 11 + Task 12

Task 15 (Submit)             ← Task 13 + Task 14

Task 16 (CI/CD)              ← Task 14 (needs signing artifacts)
```

Tasks 1-8 are fully independent and can be parallelized.
