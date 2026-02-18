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
