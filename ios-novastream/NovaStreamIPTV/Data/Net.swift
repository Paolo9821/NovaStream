import Foundation
import os

nonisolated enum SyncError: LocalizedError, Sendable, Equatable {
    case unreachable, timeout, secure, notFound, server(Int), refused, invalid(String), empty

    var errorDescription: String? {
        switch self {
        case .unreachable: t("The server cannot be reached. Check the address and your connection.")
        case .timeout: t("The server took too long to answer.")
        case .secure: t("Secure connection failed. Try the address with http:// instead of https://.")
        case .notFound: t("Address not found (404). Check the link from your provider.")
        case .server(let code): String(format: t("The provider's server returned an error (%d)."), code)
        case .refused: t("Credentials rejected by the server.")
        case .invalid(let message): message
        case .empty: t("The playlist is empty or not in m3u format.")
        }
    }
}

/// Shared HTTP access for provider servers.
nonisolated enum Net {
    private static let current = OSAllocatedUnfairLock(initialState: makeSession())

    static var session: URLSession { current.withLock { $0 } }

    private static func makeSession() -> URLSession {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 300
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: config)
    }

    /// Fresh connections after the DNS choice changes, so nothing resolved
    /// with the old one is reused.
    static func resetSession() {
        let old = current.withLock { session in
            let previous = session
            session = makeSession()
            return previous
        }
        old.finishTasksAndInvalidate()
    }

    /// Identities presented to IPTV panels, as on Android. Many panels (often
    /// behind Cloudflare) drop requests from unknown agents, which surfaces as a
    /// 5xx such as 520 or a closed connection. A media player identity is what
    /// they expect; a browser and a common IPTV player are the fallbacks.
    static let userAgents = [
        "VLC/3.0.21 LibVLC/3.0.21",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        "IPTVSmartersPlayer",
    ]
    static var playerAgent: String { userAgents[0] }

    private static let maxAttempts = 3

    static func get(_ urlString: String) async throws -> Data {
        guard let url = URL(string: urlString.trimmed) else { throw SyncError.invalid(t("The address is not valid.")) }
        var last: SyncError = .unreachable
        var checkedDNS = false
        for attempt in 0..<maxAttempts {
            do {
                return try await fetch(url, agent: userAgents[attempt % userAgents.count])
            } catch let error as SyncError {
                last = error
                // The operator's DNS may hide the server: switch to encrypted DNS and try again.
                if !checkedDNS, error == .unreachable || error == .timeout, !EncryptedDNS.isActive {
                    checkedDNS = true
                    if await EncryptedDNS.networkHides(DnsCheck.hostName(from: url.absoluteString)),
                       EncryptedDNS.enableAutomatically() {
                        if let data = try? await fetch(url, agent: userAgents[attempt % userAgents.count]) { return data }
                    }
                }
                guard retryable(error), attempt < maxAttempts - 1 else { throw error }
                try? await Task.sleep(for: .milliseconds(1_200 * (attempt + 1)))
            }
        }
        throw last
    }

    /// Dropped connections, timeouts, 5xx (Cloudflare's 520-530 included) and
    /// agent-based refusals usually pass with a fresh connection or another identity.
    private static func retryable(_ error: SyncError) -> Bool {
        switch error {
        case .unreachable, .timeout, .refused: true
        case .server(let code): code >= 500 || code == 429 || code == 406
        default: false
        }
    }

    private static func fetch(_ url: URL, agent: String) async throws -> Data {
        var request = URLRequest(url: url)
        request.setValue(agent, forHTTPHeaderField: "User-Agent")
        request.setValue("*/*", forHTTPHeaderField: "Accept")
        do {
            let (data, response) = try await session.data(for: request)
            if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
                if http.statusCode == 404 { throw SyncError.notFound }
                if http.statusCode == 401 || http.statusCode == 403 { throw SyncError.refused }
                throw SyncError.server(http.statusCode)
            }
            return data
        } catch let error as URLError {
            switch error.code {
            case .timedOut: throw SyncError.timeout
            case .secureConnectionFailed, .serverCertificateUntrusted, .serverCertificateHasBadDate, .serverCertificateNotYetValid, .serverCertificateHasUnknownRoot:
                throw SyncError.secure
            default: throw SyncError.unreachable
            }
        }
    }

    static func text(_ data: Data) -> String {
        String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) ?? ""
    }

    static func json(_ urlString: String) async throws -> Any {
        let data = try await get(urlString)
        do {
            return try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
        } catch {
            throw SyncError.invalid(t("The server's answer is not valid."))
        }
    }
}

/// Live channels: AVPlayer plays HLS, so Xtream `.ts` live addresses are asked
/// for in their `.m3u8` form, which every Xtream panel also serves.
nonisolated enum StreamURLs {
    static func forPlayback(_ url: String, kind: MediaKind) -> String {
        guard kind == .live else { return url }
        let pattern = #"^(.+/live/[^/]+/[^/]+/[^/?#]+)\.ts([?#].*)?$"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let match = regex.firstMatch(in: url, range: NSRange(url.startIndex..., in: url)),
              let base = Range(match.range(at: 1), in: url) else {
            // Bare Xtream-style address without extension: ask for HLS.
            if url.range(of: #"/live/[^/]+/[^/]+/\d+$"#, options: .regularExpression) != nil {
                return url + ".m3u8"
            }
            return url
        }
        var result = String(url[base]) + ".m3u8"
        if let tail = Range(match.range(at: 2), in: url) { result += url[tail] }
        return result
    }
}
