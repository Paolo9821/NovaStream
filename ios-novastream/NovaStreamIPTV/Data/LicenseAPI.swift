import Foundation

/// The NovaStream licence server shared with the Android app.
nonisolated enum LicenseAPI {
    static let baseURL = "https://crea-un-applicazione-di-iptv-che-accetta-backend.rork.app"
    static let siteURL = "https://www.novastreamapp.com"

    enum Status: String, Codable, Sendable { case active, suspended, revoked, expired, none }

    struct Record: Codable, Sendable {
        var status: Status
        var plan: String
        var expiresAt: Date?
        var note: String
        var trialStartedAt: Date?
        var serverTime: Date?
        var checkedAt: Date
    }

    struct Sync: Sendable {
        var key: String
        var keyExpires: Date?
        var install: [PlaylistAccount]
        var remove: [String]
    }

    /// Asks the registry about this device. Returns nil when the server is out of reach.
    static func status(fresh: Bool) async -> Record? {
        let id = DeviceIdentity.current
        var body: [String: Any] = ["deviceId": id.deviceId, "mac": id.macAddress]
        if fresh { body["fresh"] = true }
        guard let json = await post("/api/license/status", body) else { return nil }
        let found = json["found"] as? Bool ?? false
        let status = found ? Status(rawValue: json["status"] as? String ?? "") ?? .none : .none
        return Record(
            status: status,
            plan: json["plan"] as? String ?? "",
            expiresAt: ms(json["expiresAt"]),
            note: json["note"] as? String ?? "",
            trialStartedAt: ms(json["trialStartedAt"]),
            serverTime: ms(json["serverTime"]),
            checkedAt: Date()
        )
    }

    /// Reconciles playlists with the website. Only name, kind and host are reported.
    static func sync(accounts: [PlaylistAccount]) async -> Sync? {
        let id = DeviceIdentity.current
        let playlists: [[String: Any]] = accounts.map {
            ["id": $0.id, "name": $0.name, "type": $0.type.rawValue, "host": $0.host]
        }
        guard let json = await post("/api/device/sync", ["deviceId": id.deviceId, "mac": id.macAddress, "playlists": playlists]) else { return nil }
        let install: [PlaylistAccount] = (json["install"] as? [[String: Any]] ?? []).compactMap { item in
            func text(_ k: String) -> String { (item[k] as? String) ?? "" }
            guard !text("id").isEmpty else { return nil }
            let type: AccountType = text("type") == "xtream" ? .xtream : .m3u
            if !text("hostNumber").isEmpty { return nil } // private hosts are Android-only for now
            return PlaylistAccount(
                id: text("id"),
                name: text("name").isEmpty ? (type == .xtream ? "Xtream" : "m3u") : text("name"),
                type: type,
                m3uUrl: text("m3uUrl"),
                server: text("server"),
                username: text("username"),
                password: text("password"),
                epgUrl: text("epgUrl"),
                fromWeb: true
            )
        }
        let skew: Double = ms(json["serverTime"]).map { Date().timeIntervalSince($0) } ?? 0
        return Sync(
            key: json["key"] as? String ?? "",
            keyExpires: ms(json["keyExpiresAt"]).map { $0.addingTimeInterval(skew) },
            install: install,
            remove: json["remove"] as? [String] ?? []
        )
    }

    private static func ms(_ value: Any?) -> Date? {
        guard let n = value as? NSNumber, n.doubleValue > 0 else { return nil }
        return Date(timeIntervalSince1970: n.doubleValue / 1000)
    }

    private static func post(_ path: String, _ body: [String: Any]) async -> [String: Any]? {
        guard let url = URL(string: baseURL + path) else { return nil }
        var request = URLRequest(url: url, timeoutInterval: 12)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }
}
