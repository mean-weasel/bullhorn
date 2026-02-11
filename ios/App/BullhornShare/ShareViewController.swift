import UIKit
import Social
import UniformTypeIdentifiers

class ShareViewController: SLComposeServiceViewController {

    override func isContentValid() -> Bool {
        return true
    }

    override func didSelectPost() {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
            extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }

        var sharedText = contentText ?? ""
        var sharedUrl = ""

        let group = DispatchGroup()

        for item in items {
            guard let attachments = item.attachments else { continue }
            for attachment in attachments {
                if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    group.enter()
                    attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { data, _ in
                        if let url = data as? URL {
                            sharedUrl = url.absoluteString
                        }
                        group.leave()
                    }
                } else if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    group.enter()
                    attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { data, _ in
                        if let text = data as? String, sharedText.isEmpty {
                            sharedText = text
                        }
                        group.leave()
                    }
                }
            }
        }

        group.notify(queue: .main) { [weak self] in
            self?.openMainApp(text: sharedText, url: sharedUrl)
        }
    }

    private func openMainApp(text: String, url: String) {
        var components = URLComponents()
        components.scheme = "bullhorn"
        components.host = "share"
        var queryItems: [URLQueryItem] = []
        if !text.isEmpty {
            queryItems.append(URLQueryItem(name: "text", value: text))
        }
        if !url.isEmpty {
            queryItems.append(URLQueryItem(name: "url", value: url))
        }
        components.queryItems = queryItems.isEmpty ? nil : queryItems

        if let deepLinkUrl = components.url {
            // Open main app via URL scheme
            var responder: UIResponder? = self
            while let r = responder {
                if let application = r as? UIApplication {
                    application.open(deepLinkUrl, options: [:], completionHandler: nil)
                    break
                }
                responder = r.next
            }

            // Fallback: use openURL selector for share extension context
            let selector = sel_registerName("openURL:")
            responder = self
            while let r = responder {
                if r.responds(to: selector) {
                    r.perform(selector, with: deepLinkUrl)
                    break
                }
                responder = r.next
            }
        }

        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    override func configurationItems() -> [Any]! {
        return []
    }
}
