import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(LicenseManager.self) private var license
    @State private var showPaywall = false
    @State private var showLicense = false
    @State private var showTerms = false
    @State private var confirmClear = false

    var body: some View {
        @Bindable var model = model
        Form {
            licenseSection

            Section(t("Appearance")) {
                Picker(t("Theme"), selection: $model.settings.theme) {
                    ForEach(ThemeMode.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                Picker(t("Language"), selection: $model.settings.language) {
                    ForEach(Lang.available, id: \.self) { Text($0.nativeName).tag($0) }
                }
            }

            Section(t("Player")) {
                Toggle(t("Play next episode automatically"), isOn: $model.settings.autoplayNext)
                Toggle(t("Reconnect when the stream drops"), isOn: $model.settings.autoReconnect)
                Picker(t("Buffer"), selection: $model.settings.buffer) {
                    ForEach(BufferMode.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                NavigationLink { NetworkSettingsView() } label: {
                    Label(t("DNS and speed test"), systemImage: "network")
                }
            }

            Section {
                NavigationLink(value: Route.accounts) {
                    LabeledContent(t("Playlists"), value: "\(model.accounts.count)")
                }
                Picker(t("Automatic update"), selection: $model.settings.autoRefresh) {
                    ForEach(AutoRefresh.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                Button(t("Update playlist now")) { Task { await model.sync() } }
                    .disabled(model.activeAccount == nil)
                Button(t("Update TV guide")) { Task { await model.refreshGuide() } }
                    .disabled(model.activeAccount == nil || model.guideLoading)
            } header: { Text(t("Playlists")) }

            WebManageSection()

            NavigationLink { ParentalSettingsView() } label: {
                LabeledContent(t("Parental control"), value: model.settings.parentalEnabled ? t("On") : t("Off"))
            }

            Section(t("Storage")) {
                LabeledContent(t("Data on this iPhone"), value: ByteCountFormatter.string(fromByteCount: model.storageBytes, countStyle: .file))
                Button(t("Clear watch history"), role: .destructive) { confirmClear = true }
                Button(t("Clear recent searches")) { model.clearSearches() }
            }

            Section(t("About")) {
                LabeledContent(t("Version"), value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0")
                Button(t("Terms of use")) { showTerms = true }
                Link(t("Privacy Policy"), destination: URL(string: "https://www.novastreamapp.com/privacy")!)
                Link(t("Contact support"), destination: URL(string: "mailto:support@novastreamapp.com")!)
            }
        }
        .navigationTitle(t("Settings"))
        .sheet(isPresented: $showPaywall) { PaywallView(blocking: false) }
        .sheet(isPresented: $showLicense) { NavigationStack { ExistingLicenseView() }.presentationDetents([.medium, .large]) }
        .sheet(isPresented: $showTerms) { NavigationStack { TermsView() } }
        .confirmationDialog(t("Clear watch history?"), isPresented: $confirmClear, titleVisibility: .visible) {
            Button(t("Clear"), role: .destructive) { model.clearHistory() }
        }
    }

    private var licenseSection: some View {
        Section {
            HStack(spacing: 14) {
                IconTile(symbol: statusSymbol, color: statusColor, size: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text(statusTitle).font(.headline)
                    Text(statusDetail).font(.caption).foregroundStyle(Nova.inkSecondary)
                }
            }
            .padding(.vertical, 4)
            LabeledContent(t("Device ID")) {
                Text(DeviceIdentity.current.deviceId.uppercased())
                    .font(.system(.body, design: .monospaced))
                    .textSelection(.enabled)
            }
            if !isPaid {
                Button(t("Unlock NovaStream")) { showPaywall = true }.fontWeight(.semibold)
                Button(t("I already have a licence")) { showLicense = true }
            }
            Button(t("Restore Purchases")) { Task { await license.restore() } }
                .disabled(!license.purchasesAvailable || license.purchasing)
        } header: { Text(t("Licence")) }
    }

    private var isPaid: Bool {
        switch license.access {
        case .appStore, .website: true
        default: false
        }
    }

    private var statusTitle: String {
        switch license.access {
        case .checking: t("Checking…")
        case .trial(let days, _): t("Free trial: %d days left", days)
        case .appStore(let lifetime, _): lifetime ? t("Lifetime (App Store)") : t("Annual subscription (App Store)")
        case .website(let plan, _): plan == "lifetime" ? t("Lifetime licence") : t("Annual licence")
        case .trialEnded: t("Trial ended")
        case .suspended: t("Licence suspended")
        case .revoked: t("Licence revoked")
        case .websiteExpired: t("Licence expired")
        }
    }

    private var statusDetail: String {
        switch license.access {
        case .trial(_, let ends): t("Ends %@", ends.formatted(date: .abbreviated, time: .shortened))
        case .appStore(_, let exp), .website(_, let exp):
            exp.map { t("Valid until %@", $0.formatted(date: .abbreviated, time: .omitted)) } ?? t("Never expires")
        case .suspended(let note), .revoked(let note): note
        default: ""
        }
    }

    private var statusSymbol: String {
        switch license.access {
        case .appStore, .website: "checkmark.seal.fill"
        case .trial, .checking: "hourglass"
        default: "exclamationmark.triangle.fill"
        }
    }

    private var statusColor: Color {
        switch license.access {
        case .appStore, .website: Nova.green
        case .trial, .checking: Nova.amber
        default: Nova.coral
        }
    }
}

/// Website playlist manager: device and single-use key, as on Android.
struct WebManageSection: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Section {
            LabeledContent(t("Device")) {
                Text(DeviceIdentity.current.macAddress).font(.system(.body, design: .monospaced)).textSelection(.enabled)
            }
            TimelineView(.periodic(from: .now, by: 1)) { context in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(t("Website key"))
                        Spacer()
                        if model.webKey.isEmpty {
                            Text(t("Connecting to the server…")).foregroundStyle(Nova.inkSecondary)
                        } else {
                            Text(model.webKey)
                                .font(.system(.title3, design: .monospaced, weight: .bold))
                                .foregroundStyle(Nova.blue)
                                .textSelection(.enabled)
                        }
                    }
                    if let exp = model.webKeyExpires {
                        let left = max(0, Int(exp.timeIntervalSince(context.date)))
                        Text(t("New key in %@", String(format: "%d:%02d", left / 60, left % 60)))
                            .font(.caption.monospacedDigit()).foregroundStyle(Nova.inkSecondary)
                            .onChange(of: left == 0) { _, expired in
                                if expired { Task { await model.pushWebState() } }
                            }
                    }
                }
            }
            if let url = managerURL {
                Link(t("Open the website"), destination: url)
            }
        } header: {
            Text(t("Manage playlists from the website"))
        } footer: {
            Text(t("Add or delete playlists from a computer with this device and key. The key is single use and changes every 5 minutes. Do not share it."))
        }
    }

    private var managerURL: URL? {
        var parts = URLComponents(string: LicenseAPI.siteURL + "/playlist")
        parts?.queryItems = [URLQueryItem(name: "app", value: "1"), URLQueryItem(name: "device", value: DeviceIdentity.current.macAddress)]
        if !model.webKey.isEmpty { parts?.queryItems?.append(URLQueryItem(name: "key", value: model.webKey)) }
        return parts?.url
    }
}

struct ParentalSettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var settingPin = false
    @State private var askCurrent = false
    @State private var afterVerify: (() -> Void)?

    private var allGroups: [String] {
        var seen = Set<String>()
        return MediaKind.allCases.flatMap { model.catalog.orderedGroups($0, items: model.catalog.of($0)) }
            .filter { seen.insert($0).inserted }
    }

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                Toggle(t("Parental control"), isOn: Binding(
                    get: { model.settings.parentalEnabled },
                    set: { on in
                        if on {
                            settingPin = true
                        } else {
                            requirePin { model.settings.parentalEnabled = false }
                        }
                    }
                ))
            } footer: {
                Text(t("Locked categories ask for a 4-digit PIN. The lock comes back when you leave the app."))
            }
            if model.settings.parentalEnabled {
                Section {
                    Toggle(t("Hide locked categories"), isOn: $model.settings.hideLockedGroups)
                    Button(t("Change PIN")) { requirePin { settingPin = true } }
                }
                Section(t("Locked categories")) {
                    if allGroups.isEmpty {
                        Text(t("Load a playlist to choose categories.")).foregroundStyle(Nova.inkSecondary)
                    }
                    ForEach(allGroups, id: \.self) { group in
                        Toggle(group, isOn: Binding(
                            get: { model.settings.lockedGroups.contains(group) },
                            set: { lock in
                                if lock { model.settings.lockedGroups.append(group) }
                                else { requirePin { model.settings.lockedGroups.removeAll { $0 == group } } }
                            }
                        ))
                    }
                }
            }
        }
        .navigationTitle(t("Parental control"))
        .sheet(isPresented: $settingPin) {
            SetPinSheet { pin in
                model.settings.parentalPin = pin
                if !model.settings.parentalEnabled {
                    model.settings.parentalEnabled = true
                    let suggested = allGroups.filter { g in AppSettings.adultHints.contains { g.lowercased().contains($0) } }
                    model.settings.lockedGroups = Array(Set(model.settings.lockedGroups + suggested))
                }
            }
        }
        .sheet(isPresented: $askCurrent) {
            PinPrompt(title: t("Enter PIN"), verify: { $0 == model.settings.parentalPin }, onSuccess: { _ in
                let action = afterVerify
                afterVerify = nil
                DispatchQueue.main.async { action?() }
            })
        }
    }

    private func requirePin(_ action: @escaping () -> Void) {
        afterVerify = action
        askCurrent = true
    }
}
