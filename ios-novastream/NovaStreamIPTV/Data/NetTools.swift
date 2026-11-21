import Foundation

// MARK: - Private hosts

/// Resolves a private host number into the server address it stands for.
///
/// The list is a public file on the NovaStream website (`/app/host.json`):
/// `{ "hosts": [ { "id": "1836", "url": "http://cdn.example.xyz" } ] }`, or a
/// plain map (`{ "hosts": { "1836": "http://…" } }`). The address is kept with
/// the account but never shown: the viewer only sees and types the number.
nonisolated enum PrivateHosts {
    private static let sources = [
        "https://novastreamapp.com/app/host.json",
        "https://novastream.rork.app/app/host.json",
    ]

    /// Keeps letters and digits only, at most 12, as on Android and the website.
    static func clean(_ number: String) -> String {
        String(number.filter { $0.isLetter || $0.isNumber }.prefix(12))
    }

    static func resolve(_ number: String) async -> String? {
        let wanted = clean(number)
        guard !wanted.isEmpty else { return nil }
        let minute = Int(Date().timeIntervalSince1970 / 60)
        for source in sources {
            guard let root = try? await Net.json("\(source)?t=\(minute)") as? [String: Any] else { continue }
            if let url = lookup(root, wanted) { return url }
        }
        return nil
    }

    private static func lookup(_ root: [String: Any], _ wanted: String) -> String? {
        func text(_ obj: [String: Any], _ key: String) -> String? {
            let value: String?
            if let s = obj[key] as? String { value = s } else if let n = obj[key] as? NSNumber { value = n.stringValue } else { value = nil }
            let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return trimmed.isEmpty ? nil : trimmed
        }
        if let list = root["hosts"] as? [[String: Any]] {
            for item in list {
                let id = text(item, "id") ?? text(item, "number") ?? text(item, "code")
                if id?.caseInsensitiveCompare(wanted) == .orderedSame {
                    return normalized(text(item, "url") ?? text(item, "host") ?? text(item, "server"))
                }
            }
        } else if let map = root["hosts"] as? [String: Any],
                  let entry = map.first(where: { $0.key.caseInsensitiveCompare(wanted) == .orderedSame }) {
            if let s = entry.value as? String { return normalized(s) }
            if let obj = entry.value as? [String: Any] { return normalized(text(obj, "url") ?? text(obj, "host")) }
        }
        return nil
    }

    private static func normalized(_ raw: String?) -> String? {
        guard var value = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        while value.hasSuffix("/") { value.removeLast() }
        guard !value.isEmpty else { return nil }
        let lower = value.lowercased()
        return lower.hasPrefix("http://") || lower.hasPrefix("https://") ? value : "http://\(value)"
    }
}

// MARK: - DNS

nonisolated enum DnsPreset: String, Codable, CaseIterable, Sendable {
    case system, cloudflare, google, quad9, custom

    var label: String {
        switch self {
        case .system: t("System default")
        case .cloudflare: "Cloudflare"
        case .google: "Google"
        case .quad9: "Quad9"
        case .custom: t("Custom")
        }
    }

    var detail: String {
        switch self {
        case .system: t("Use your network's DNS")
        case .cloudflare: "1.1.1.1"
        case .google: "8.8.8.8"
        case .quad9: "9.9.9.9"
        case .custom: t("Your own resolver")
        }
    }

    var dohURL: String? {
        switch self {
        case .cloudflare: "https://cloudflare-dns.com/dns-query"
        case .google: "https://dns.google/dns-query"
        case .quad9: "https://dns.quad9.net/dns-query"
        case .system, .custom: nil
        }
    }
}

/// Kept apart from the main settings so older saved settings keep loading.
nonisolated struct DnsSettings: Codable, Sendable, Equatable {
    var preset: DnsPreset = .system
    var customIP = ""
    var customDoH = ""

    private static let key = "dns_settings"

    static func load() -> DnsSettings {
        guard let data = UserDefaults.standard.data(forKey: key),
              let s = try? JSONDecoder().decode(DnsSettings.self, from: data) else { return DnsSettings() }
        return s
    }

    func save() { UserDefaults.standard.set(try? JSONEncoder().encode(self), forKey: Self.key) }

    /// Encrypted resolver to compare against the network: the chosen one, or Cloudflare.
    var resolver: (label: String, url: String) {
        switch preset {
        case .custom:
            let doh = customDoH.trimmingCharacters(in: .whitespaces)
            if doh.lowercased().hasPrefix("https://") { return ("Custom DoH", doh) }
            let ip = customIP.trimmingCharacters(in: .whitespaces)
            if DnsCheck.isIPv4(ip) { return ("DNS \(ip)", "https://\(ip)/dns-query") }
            return ("Cloudflare DoH", DnsPreset.cloudflare.dohURL!)
        case .system:
            return ("Cloudflare DoH", DnsPreset.cloudflare.dohURL!)
        default:
            return ("\(preset.label) DoH", preset.dohURL!)
        }
    }
}

nonisolated struct DnsResult: Sendable {
    var host: String
    var resolver: String
    var addresses: [String]
    var latencyMs: Int
    var systemAddresses: [String]
    /// The network's DNS found nothing (or a dead sinkhole) while the encrypted one did.
    var networkBlocked: Bool
}

/// DNS check for the playlist server: the network's own DNS against an
/// encrypted DNS-over-HTTPS resolver. iOS plays video through the system DNS,
/// so this is a diagnosis: it shows whether the network hides the server.
nonisolated enum DnsCheck {
    static func hostName(from input: String) -> String {
        var s = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if let r = s.range(of: "://") { s = String(s[r.upperBound...]) }
        s = String(s.prefix { $0 != "/" && $0 != "?" && $0 != "#" })
        if let at = s.lastIndex(of: "@") { s = String(s[s.index(after: at)...]) }
        if let colon = s.lastIndex(of: ":"), !s.contains("]") { s = String(s[..<colon]) }
        return s.lowercased()
    }

    static func isIPv4(_ s: String) -> Bool {
        let parts = s.split(separator: ".", omittingEmptySubsequences: false)
        return parts.count == 4 && parts.allSatisfy { UInt8($0) != nil }
    }

    static func isSinkhole(_ ip: String) -> Bool {
        ip.hasPrefix("0.") || ip.hasPrefix("127.") || ip == "::" || ip == "::1"
    }

    static func run(host input: String, settings: DnsSettings) async -> DnsResult {
        let host = hostName(from: input)
        let resolver = settings.resolver
        async let system = Task.detached(priority: .userInitiated) { systemLookup(host) }.value
        let start = Date()
        let doh = (try? await dohLookup(host, url: resolver.url)) ?? []
        let latency = Int(Date().timeIntervalSince(start) * 1000)
        let sys = await system
        let usable = sys.filter { !isSinkhole($0) }
        return DnsResult(
            host: host,
            resolver: resolver.label,
            addresses: doh,
            latencyMs: latency,
            systemAddresses: sys,
            networkBlocked: usable.isEmpty && !doh.isEmpty
        )
    }

    /// IPv4 addresses from the network's DNS (getaddrinfo).
    static func systemLookup(_ host: String) -> [String] {
        guard !host.isEmpty else { return [] }
        if isIPv4(host) { return [host] }
        var hints = addrinfo()
        hints.ai_family = AF_INET
        hints.ai_socktype = SOCK_STREAM
        var result: UnsafeMutablePointer<addrinfo>?
        guard getaddrinfo(host, nil, &hints, &result) == 0, let first = result else { return [] }
        defer { freeaddrinfo(first) }
        var out: [String] = []
        var cursor: UnsafeMutablePointer<addrinfo>? = first
        while let info = cursor {
            if let addr = info.pointee.ai_addr, info.pointee.ai_family == AF_INET {
                var sin = addr.withMemoryRebound(to: sockaddr_in.self, capacity: 1) { $0.pointee }
                var buffer = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
                inet_ntop(AF_INET, &sin.sin_addr, &buffer, socklen_t(INET_ADDRSTRLEN))
                let ip = String(cString: buffer)
                if !out.contains(ip) { out.append(ip) }
            }
            cursor = info.pointee.ai_next
        }
        return out
    }

    /// RFC 8484 DNS-over-HTTPS query (wire format, A records).
    static func dohLookup(_ host: String, url: String) async throws -> [String] {
        guard !host.isEmpty else { return [] }
        if isIPv4(host) { return [host] }
        var query = Data([0x00, 0x00, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
        for label in host.split(separator: ".") {
            let bytes = Array(label.utf8.prefix(63))
            query.append(UInt8(bytes.count))
            query.append(contentsOf: bytes)
        }
        query.append(contentsOf: [0x00, 0x00, 0x01, 0x00, 0x01])
        let encoded = query.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        let separator = url.contains("?") ? "&" : "?"
        guard let endpoint = URL(string: "\(url)\(separator)dns=\(encoded)") else { return [] }
        var request = URLRequest(url: endpoint, timeoutInterval: 6)
        request.setValue("application/dns-message", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { return [] }
        return parseA(Array(data)).filter { !isSinkhole($0) }
    }

    private static func parseA(_ b: [UInt8]) -> [String] {
        guard b.count >= 12 else { return [] }
        let qd = Int(b[4]) << 8 | Int(b[5])
        let an = Int(b[6]) << 8 | Int(b[7])
        var i = 12
        func skipName() {
            while i < b.count {
                let len = Int(b[i])
                if len == 0 { i += 1; return }
                if len & 0xC0 == 0xC0 { i += 2; return }
                i += len + 1
            }
        }
        for _ in 0..<qd { skipName(); i += 4 }
        var out: [String] = []
        for _ in 0..<an {
            skipName()
            guard i + 10 <= b.count else { break }
            let type = Int(b[i]) << 8 | Int(b[i + 1])
            let length = Int(b[i + 8]) << 8 | Int(b[i + 9])
            i += 10
            guard i + length <= b.count else { break }
            if type == 1, length == 4 { out.append("\(b[i]).\(b[i + 1]).\(b[i + 2]).\(b[i + 3])") }
            i += length
        }
        return out
    }
}

// MARK: - Speed test

nonisolated struct SpeedResult: Sendable {
    var downloadMbps: Double
    var latencyMs: Int
    var bytes: Int
}

/// Measures latency and download speed against Cloudflare's test server.
nonisolated enum SpeedTester {
    private static let latencyURL = URL(string: "https://speed.cloudflare.com/__down?bytes=1")!
    private static let downloadURL = URL(string: "https://speed.cloudflare.com/__down?bytes=10000000")!

    static func run() async throws -> SpeedResult {
        let config = URLSessionConfiguration.ephemeral
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 20
        config.timeoutIntervalForResource = 60
        let session = URLSession(configuration: config)
        defer { session.finishTasksAndInvalidate() }

        // First request warms up the connection; the second measures latency.
        _ = try? await session.data(from: latencyURL)
        let pingStart = Date()
        _ = try await session.data(from: latencyURL)
        let latency = Int(Date().timeIntervalSince(pingStart) * 1000)

        let start = Date()
        let (data, response) = try await session.data(from: downloadURL)
        let seconds = max(Date().timeIntervalSince(start), 0.001)
        guard (response as? HTTPURLResponse)?.statusCode == 200, !data.isEmpty else { throw SyncError.unreachable }
        let mbps = Double(data.count) * 8 / (seconds * 1_000_000)
        return SpeedResult(downloadMbps: mbps, latencyMs: latency, bytes: data.count)
    }
}
