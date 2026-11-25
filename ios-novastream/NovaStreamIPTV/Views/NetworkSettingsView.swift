import SwiftUI

/// DNS check and speed test, as on Android.
struct NetworkSettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var dns = DnsSettings.load()
    @State private var checking = false
    @State private var dnsResult: DnsResult?
    @State private var autoEncrypted = EncryptedDNS.autoEnabled
    @State private var testing = false
    @State private var speed: SpeedResult?
    @State private var speedError: String?

    /// Server checked: the playlist in use. A private host is never spelled out.
    private var target: (label: String, host: String)? {
        guard let account = model.activeAccount else { return nil }
        let raw = account.type == .xtream ? account.server : account.m3uUrl
        let host = DnsCheck.hostName(from: raw)
        guard !host.isEmpty else { return nil }
        return (account.isPrivateHost ? account.host : host, host)
    }

    var body: some View {
        Form {
            Section {
                Picker(t("Resolver"), selection: $dns.preset) {
                    ForEach(DnsPreset.allCases, id: \.self) { preset in
                        VStack(alignment: .leading) {
                            Text(preset.label)
                            Text(preset.detail).font(.caption).foregroundStyle(Nova.inkSecondary)
                        }
                        .tag(preset)
                    }
                }
                .pickerStyle(.inline)
                .labelsHidden()
                if dns.preset == .system && autoEncrypted {
                    Label(t("Your operator's DNS hides the playlist server: the app is using encrypted DNS."), systemImage: "lock.shield.fill")
                        .font(.subheadline)
                        .foregroundStyle(Nova.amber)
                }
            } header: { Text("DNS") } footer: {
                Text(t("System default uses the iPhone's DNS and switches by itself to encrypted DNS (DNS-over-HTTPS) when your operator hides the playlist server. The other choices use encrypted DNS for playlists, TV guide and covers from the start."))
            }

            if dns.preset == .custom {
                Section(t("Custom")) {
                    TextField(t("Primary DNS (IP), e.g. 94.140.14.14"), text: $dns.customIP)
                        .keyboardType(.decimalPad)
                    TextField("https://dns.example.com/dns-query", text: $dns.customDoH)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
            }

            Section {
                if let target {
                    LabeledContent(t("Server"), value: target.label)
                    Button {
                        Task { await runDns(target.host) }
                    } label: {
                        HStack {
                            Text(checking ? t("Checking…") : t("Check DNS resolution"))
                            Spacer()
                            if checking { ProgressView() }
                        }
                    }
                    .disabled(checking)
                } else {
                    Text(t("Add a playlist to check its server.")).foregroundStyle(Nova.inkSecondary)
                }
                if let r = dnsResult { dnsSummary(r) }
            } header: { Text(t("DNS check")) }

            Section {
                Button {
                    Task { await runSpeed() }
                } label: {
                    HStack {
                        Text(testing ? t("Testing…") : t("Start speed test"))
                        Spacer()
                        if testing { ProgressView() }
                    }
                }
                .disabled(testing)
                if let speed {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(speed.downloadMbps, format: .number.precision(.fractionLength(1)))
                            .font(.system(size: 40, weight: .bold, design: .rounded))
                            .foregroundStyle(Nova.blue)
                            .contentTransition(.numericText())
                        Text("Mbps").font(.headline).foregroundStyle(Nova.inkSecondary)
                    }
                    Text(t("Latency %@ ms · %@ MB downloaded", "\(speed.latencyMs)", String(format: "%.1f", Double(speed.bytes) / 1_000_000)))
                        .font(.caption).foregroundStyle(Nova.inkSecondary)
                    Text(verdict(speed.downloadMbps)).font(.subheadline)
                }
                if let speedError {
                    Label(speedError, systemImage: "exclamationmark.triangle.fill").foregroundStyle(Nova.coral)
                }
            } header: { Text(t("Speed test")) } footer: {
                Text(t("Measures this connection with Cloudflare's test server, not your provider's server."))
            }
        }
        .navigationTitle(t("Network"))
        .onChange(of: dns) { _, value in
            value.save()
            EncryptedDNS.userChanged(value)
            autoEncrypted = EncryptedDNS.autoEnabled
            dnsResult = nil
        }
    }

    @ViewBuilder
    private func dnsSummary(_ r: DnsResult) -> some View {
        let hideAddresses = model.activeAccount?.isPrivateHost == true
        if r.addresses.isEmpty && r.systemAddresses.isEmpty {
            Label(t("The server name does not exist or cannot be resolved."), systemImage: "xmark.octagon.fill")
                .foregroundStyle(Nova.coral)
        } else if r.networkBlocked {
            Label(t("Your network's DNS does not find this server, but %@ does: the network may be blocking it.", r.resolver), systemImage: "exclamationmark.shield.fill")
                .foregroundStyle(Nova.amber)
        } else {
            Label(t("The server is reachable by name."), systemImage: "checkmark.seal.fill")
                .foregroundStyle(Nova.green)
        }
        LabeledContent(t("Resolver"), value: r.resolver)
        LabeledContent(t("Response time"), value: "\(r.latencyMs) ms")
        if !hideAddresses {
            if !r.addresses.isEmpty {
                LabeledContent(r.resolver, value: r.addresses.prefix(3).joined(separator: ", "))
            }
            LabeledContent(t("Network DNS"), value: r.systemAddresses.isEmpty ? "—" : r.systemAddresses.prefix(3).joined(separator: ", "))
        }
    }

    private func runDns(_ host: String) async {
        checking = true
        let result = await DnsCheck.run(host: host, settings: dns)
        withAnimation { dnsResult = result }
        if result.addresses.isEmpty && result.systemAddresses.isEmpty { Haptics.error() } else { Haptics.success() }
        checking = false
    }

    private func runSpeed() async {
        testing = true
        speedError = nil
        do {
            let result = try await SpeedTester.run()
            withAnimation { speed = result }
            Haptics.success()
        } catch {
            speedError = t("The speed test could not be completed. Check your connection.")
            Haptics.error()
        }
        testing = false
    }

    private func verdict(_ mbps: Double) -> String {
        switch mbps {
        case ..<5: t("Enough for SD channels only.")
        case ..<15: t("Good for HD channels.")
        case ..<30: t("Good for Full HD.")
        default: t("Good for 4K streams.")
        }
    }
}
