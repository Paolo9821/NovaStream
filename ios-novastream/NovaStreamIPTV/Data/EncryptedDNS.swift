import Foundation
import Network
import os

/// Name resolution for the whole app, as on Android.
///
/// "System default" uses the iPhone's own DNS. Many operators hide IPTV
/// servers in their DNS (no answer, or a dead address): when a provider server
/// cannot be reached and the operator's DNS is the reason, the app switches by
/// itself to encrypted DNS (DNS-over-HTTPS) and keeps it. Choosing Cloudflare,
/// Google, Quad9 or a custom resolver uses that one from the start.
/// The setting applies to every connection the app opens (URLSession and
/// getaddrinfo), through the default privacy context of the Network framework.
nonisolated enum EncryptedDNS {
    private static let active = OSAllocatedUnfairLock(initialState: false)
    private static let autoKey = "dns_auto_encrypted"

    static var isActive: Bool { active.withLock { $0 } }

    /// True when the switch was made automatically on "System default".
    static var autoEnabled: Bool { UserDefaults.standard.bool(forKey: autoKey) }

    /// Applies the saved choice. Called at launch.
    static func configure(_ settings: DnsSettings = .load()) {
        let wanted = settings.preset == .system ? autoEnabled : true
        apply(wanted ? resolver(for: settings) : nil)
    }

    /// The user picked a resolver: start again from that choice.
    static func userChanged(_ settings: DnsSettings) {
        UserDefaults.standard.removeObject(forKey: autoKey)
        configure(settings)
    }

    /// The operator's DNS hides a provider server: switch to encrypted DNS.
    /// Returns false when it was already on, so there is nothing new to try.
    @discardableResult
    static func enableAutomatically() -> Bool {
        guard !isActive else { return false }
        UserDefaults.standard.set(true, forKey: autoKey)
        apply(resolver(for: DnsSettings(preset: .cloudflare)))
        return true
    }

    private static func apply(_ resolver: (url: URL, addresses: [String])?) {
        let context = NWParameters.PrivacyContext.default
        if let resolver {
            let endpoints = resolver.addresses.map { NWEndpoint.hostPort(host: NWEndpoint.Host($0), port: 443) }
            context.requireEncryptedNameResolution(true, fallbackResolver: .https(resolver.url, serverAddresses: endpoints))
        } else {
            context.requireEncryptedNameResolution(false, fallbackResolver: nil)
        }
        active.withLock { $0 = resolver != nil }
        Net.resetSession()
    }

    private static func resolver(for settings: DnsSettings) -> (url: URL, addresses: [String]) {
        let cloudflare = (URL(string: "https://cloudflare-dns.com/dns-query")!, ["1.1.1.1", "1.0.0.1"])
        switch settings.preset {
        case .system, .cloudflare:
            return cloudflare
        case .google:
            return (URL(string: "https://dns.google/dns-query")!, ["8.8.8.8", "8.8.4.4"])
        case .quad9:
            return (URL(string: "https://dns.quad9.net/dns-query")!, ["9.9.9.9", "149.112.112.112"])
        case .custom:
            let doh = settings.customDoH.trimmingCharacters(in: .whitespaces)
            if doh.lowercased().hasPrefix("https://"), let url = URL(string: doh) { return (url, []) }
            let ip = settings.customIP.trimmingCharacters(in: .whitespaces)
            if DnsCheck.isIPv4(ip), let url = URL(string: "https://\(ip)/dns-query") { return (url, [ip]) }
            return cloudflare
        }
    }

    /// Whether the network's DNS is what keeps `host` out of reach: it finds
    /// nothing usable, or only addresses the encrypted resolver does not know.
    static func networkHides(_ host: String) async -> Bool {
        guard !host.isEmpty, !DnsCheck.isIPv4(host) else { return false }
        async let system = Task.detached(priority: .userInitiated) { DnsCheck.systemLookup(host) }.value
        let doh = (try? await DnsCheck.dohLookup(host, url: "https://cloudflare-dns.com/dns-query")) ?? []
        let sys = await system.filter { !DnsCheck.isSinkhole($0) }
        guard !doh.isEmpty else { return false }
        return sys.isEmpty || Set(sys).isDisjoint(with: doh)
    }
}
