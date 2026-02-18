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
