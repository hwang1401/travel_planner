import Foundation
import Capacitor
import AuthenticationServices

@objc(AuthSessionPlugin)
public class AuthSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AuthSessionPlugin"
    public let jsName = "AuthSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise)
    ]

    @objc func start(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let callbackScheme = call.getString("callbackScheme"),
              let url = URL(string: urlString) else {
            call.reject("Missing url or callbackScheme")
            return
        }

        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: callbackScheme
            ) { callbackURL, error in
                if let error = error {
                    call.reject("Auth cancelled", nil, error)
                    return
                }
                guard let callbackURL = callbackURL else {
                    call.reject("No callback URL")
                    return
                }
                call.resolve(["url": callbackURL.absoluteString])
            }

            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }
    }
}

extension AuthSessionPlugin: ASWebAuthenticationPresentationContextProviding {
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return self.bridge?.webView?.window ?? ASPresentationAnchor()
    }
}
