import UIKit
import Capacitor
import WebKit

class BullhornViewController: CAPBridgeViewController {

    private var offlineVC: OfflineViewController?

    override open func capacitorDidLoad() {
        // Register for navigation error notifications to show offline page
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleNavigationError(_:)),
            name: NSNotification.Name("CAPWebViewDidFailNavigation"),
            object: nil
        )
    }

    @objc private func handleNavigationError(_ notification: Notification) {
        if let error = notification.userInfo?["error"] as? Error {
            handleWebViewError(error)
        }
    }

    private func handleWebViewError(_ error: Error) {
        let nsError = error as NSError
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
