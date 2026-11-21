import Foundation
import Security
import CryptoKit

/// Keychain wrapper. Items use "after first unlock, this device only", so
/// credentials never leave the phone through backups or iCloud.
nonisolated enum Keychain {
    private static let service = "app.novastream.ios"

    static func data(_ key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }

    static func set(_ data: Data?, for key: String) {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(base as CFDictionary)
        guard let data else { return }
        var add = base
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }

    static func string(_ key: String) -> String? {
        data(key).flatMap { String(data: $0, encoding: .utf8) }
    }

    static func setString(_ value: String?, for key: String) {
        set(value?.data(using: .utf8), for: key)
    }
}

/// JSON files in Application Support for the larger, non-secret data
/// (catalog, guide, history).
nonisolated enum FileStore {
    static var directory: URL {
        let url = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("NovaStream", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    static func url(_ name: String) -> URL { directory.appendingPathComponent(name) }

    static func load<T: Decodable>(_ type: T.Type, from name: String) -> T? {
        guard let data = try? Data(contentsOf: url(name)) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    static func save<T: Encodable>(_ value: T, to name: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        try? data.write(to: url(name), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    static func remove(_ name: String) {
        try? FileManager.default.removeItem(at: url(name))
    }

    static func size(prefix: String) -> Int64 {
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.fileSizeKey])) ?? []
        return files.filter { $0.lastPathComponent.hasPrefix(prefix) }
            .reduce(0) { $0 + Int64((try? $1.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }
    }
}

/// Stable identity of this iPhone. Kept in the Keychain so it survives a
/// reinstall, which is what the licence is bound to.
nonisolated struct DeviceIdentity: Sendable {
    let deviceId: String
    let macAddress: String

    static let current: DeviceIdentity = {
        let key = "device_id"
        let id: String
        if let stored = Keychain.string(key), !stored.isEmpty {
            id = stored
        } else {
            id = String(UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased().prefix(16))
            Keychain.setString(id, for: key)
        }
        return DeviceIdentity(deviceId: id, macAddress: deriveMac(id))
    }()

    /// Same derivation as the Android app: a locally administered MAC from the id.
    private static func deriveMac(_ id: String) -> String {
        var bytes = Array(SHA256.hash(data: Data("novastream-mac::\(id)".utf8)).prefix(6))
        bytes[0] = (bytes[0] & 0xFE) | 0x02
        return bytes.map { String(format: "%02X", $0) }.joined(separator: ":")
    }
}
