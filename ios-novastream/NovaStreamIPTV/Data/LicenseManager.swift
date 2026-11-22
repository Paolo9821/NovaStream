import Foundation
import Observation
import RevenueCat

/// Decides whether NovaStream is unlocked on this iPhone.
///
/// Three things can unlock it: the 7-day trial (dated by the server, so a
/// reinstall does not restart it), an App Store purchase (RevenueCat
/// entitlement "pro"), or a licence for this device bought on another platform
/// (guideline 3.1.3(b): the same plans are also sold in the app).
@Observable
final class LicenseManager {
    enum Access: Equatable {
        case checking
        case trial(daysLeft: Int, ends: Date)
        case appStore(lifetime: Bool, expires: Date?)
        case website(plan: String, expires: Date?)
        case trialEnded
        case suspended(note: String)
        case revoked(note: String)
        case websiteExpired
    }

    static let trialDays = 7
    static let entitlement = "pro"

    private(set) var access: Access = .checking
    private(set) var record: LicenseAPI.Record?
    private(set) var appStoreActive = false
    private(set) var appStoreLifetime = false
    private(set) var appStoreExpires: Date?
    private(set) var offering: Offering?
    private(set) var purchasesAvailable = false
    var purchasing = false
    var lastError: String?

    var isUnlocked: Bool {
        switch access {
        case .checking, .trial, .appStore, .website: true
        default: false
        }
    }

    private let recordKey = "license_record"
    private let firstLaunchKey = "first_launch"

    init() {
        if let data = Keychain.data(recordKey), let saved = try? JSONDecoder().decode(LicenseAPI.Record.self, from: data) {
            record = saved
        }
        let key = (Config.allValues["RORK_PUBLIC_REVENUECAT_IOS_API_KEY"] ?? "").trimmed
        if !key.isEmpty {
            Purchases.logLevel = .warn
            Purchases.configure(withAPIKey: key, appUserID: DeviceIdentity.current.deviceId)
            purchasesAvailable = true
        }
        recompute()
    }

    func start() async {
        await refresh()
        guard purchasesAvailable else { return }
        Task { await loadOffering() }
        for await info in Purchases.shared.customerInfoStream {
            apply(info)
        }
    }

    func refresh() async {
        let fresh = Keychain.string(firstLaunchKey) == nil
        if fresh { Keychain.setString(String(Date().timeIntervalSince1970), for: firstLaunchKey) }
        if let answer = await LicenseAPI.status(fresh: fresh) {
            record = answer
            Keychain.set(try? JSONEncoder().encode(answer), for: recordKey)
        }
        if purchasesAvailable, let info = try? await Purchases.shared.customerInfo() {
            apply(info)
        }
        recompute()
    }

    func loadOffering() async {
        guard purchasesAvailable else { return }
        offering = try? await Purchases.shared.offerings().current
    }

    func purchase(_ package: Package) async {
        purchasing = true
        defer { purchasing = false }
        do {
            let result = try await Purchases.shared.purchase(package: package)
            if !result.userCancelled { apply(result.customerInfo) }
        } catch {
            if let rc = error as? RevenueCat.ErrorCode, rc == .purchaseCancelledError || rc == .paymentPendingError { return }
            lastError = error.localizedDescription
        }
    }

    func restore() async {
        purchasing = true
        defer { purchasing = false }
        do {
            apply(try await Purchases.shared.restorePurchases())
            if !appStoreActive { lastError = t("No App Store purchase was found for this Apple ID.") }
        } catch {
            lastError = error.localizedDescription
        }
    }

    private func apply(_ info: CustomerInfo) {
        let ent = info.entitlements[Self.entitlement]
        appStoreActive = ent?.isActive == true
        appStoreExpires = ent?.expirationDate
        appStoreLifetime = appStoreActive && ent?.expirationDate == nil
        recompute()
    }

    private func recompute() {
        if appStoreActive {
            access = .appStore(lifetime: appStoreLifetime, expires: appStoreExpires)
            return
        }
        let now = Date()
        if let record {
            switch record.status {
            case .active:
                if let exp = record.expiresAt, exp < now { access = .websiteExpired; return }
                access = .website(plan: record.plan, expires: record.expiresAt)
                return
            case .suspended: access = .suspended(note: record.note); return
            case .revoked: access = .revoked(note: record.note); return
            case .expired, .none: break
            }
        }
        let localStart = Keychain.string(firstLaunchKey).flatMap(Double.init).map(Date.init(timeIntervalSince1970:)) ?? now
        let start = record?.trialStartedAt ?? localStart
        let ends = start.addingTimeInterval(Double(Self.trialDays) * 86_400)
        if ends > now {
            let days = max(1, Int(ceil(ends.timeIntervalSince(now) / 86_400)))
            access = .trial(daysLeft: days, ends: ends)
        } else {
            access = record?.status == .expired ? .websiteExpired : .trialEnded
        }
    }
}

#if DEBUG && targetEnvironment(simulator)
extension LicenseManager {
    /// Trial for the app screens, ended trial (paywall) for the paywall capture.
    func seedScreenshotAccess(paywall: Bool) {
        if paywall {
            access = .trialEnded
            Task { await loadOffering() }
        } else {
            access = .trial(daysLeft: 6, ends: Date().addingTimeInterval(6 * 86400))
        }
    }
}
#endif
