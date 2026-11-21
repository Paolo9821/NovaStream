import SwiftUI
import RevenueCat

/// Unlock screen. In-app purchases follow App Review rules: price and period
/// are the most prominent text, trials say what is charged afterwards, and
/// Restore, Terms and Privacy are always visible. Licences bought elsewhere
/// for this device are recognised by ID (guideline 3.1.3(b)), with no link out.
struct PaywallView: View {
    var blocking: Bool
    @Environment(LicenseManager.self) private var license
    @Environment(\.dismiss) private var dismiss
    @State private var selected: String?
    @State private var showLicense = false

    var body: some View {
        @Bindable var license = license
        ZStack {
            NovaBackdrop()
            ScrollView {
                VStack(spacing: 22) {
                    header
                    benefits
                    plans
                    purchaseButton
                    footer
                }
                .padding(20)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
            }
        }
        .overlay(alignment: .topTrailing) {
            if !blocking {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.body.weight(.bold))
                        .frame(width: 34, height: 34)
                        .background(.ultraThinMaterial, in: .circle)
                }
                .buttonStyle(.plain)
                .padding(16)
                .accessibilityLabel(t("Close"))
            }
        }
        .task { await license.loadOffering() }
        .onChange(of: license.access) { _, new in
            if case .appStore = new, !blocking { dismiss() }
        }
        .alert(t("Something went wrong"), isPresented: Binding(get: { license.lastError != nil }, set: { if !$0 { license.lastError = nil } })) {
            Button(t("OK"), role: .cancel) {}
        } message: {
            Text(license.lastError ?? "")
        }
        .sheet(isPresented: $showLicense) {
            NavigationStack { ExistingLicenseView() }
                .presentationDetents([.medium, .large])
        }
    }

    private var header: some View {
        VStack(spacing: 12) {
            Image("BrandMark")
                .resizable().scaledToFit()
                .frame(width: 84, height: 84)
                .clipShape(.rect(cornerRadius: 22, style: .continuous))
                .shadow(color: Nova.blue.opacity(0.4), radius: 20)
                .padding(.top, 28)
            Text(headline)
                .font(.system(.title, design: .rounded, weight: .bold))
                .multilineTextAlignment(.center)
            Text(subheadline)
                .font(.subheadline)
                .foregroundStyle(Nova.inkSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private var headline: String {
        switch license.access {
        case .trialEnded: t("Your free trial has ended")
        case .websiteExpired: t("Your licence has expired")
        case .suspended: t("Licence suspended")
        case .revoked: t("Licence revoked")
        case .trial(let days, _): t("%d days left in your trial", days)
        default: t("Unlock NovaStream")
        }
    }

    private var subheadline: String {
        switch license.access {
        case .suspended(let note), .revoked(let note):
            note.isEmpty ? t("Contact support@novastreamapp.com for help.") : note
        default:
            t("Keep using every feature on this iPhone.")
        }
    }

    private var benefits: some View {
        NovaCard {
            VStack(alignment: .leading, spacing: 12) {
                benefit("play.tv.fill", Nova.green, t("Live TV with the programme guide"))
                benefit("film.stack.fill", Nova.blue, t("Movies and series with Continue Watching"))
                benefit("list.bullet.rectangle.fill", Nova.purple, t("Unlimited playlists and favourites"))
                benefit("lock.shield.fill", Nova.amber, t("Parental control with PIN"))
                Text(t("NovaStream is a player: channels and videos come from your own provider."))
                    .font(.footnote)
                    .foregroundStyle(Nova.inkSecondary)
            }
        }
    }

    private func benefit(_ symbol: String, _ color: Color, _ text: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol).foregroundStyle(color).frame(width: 24)
            Text(text).font(.subheadline.weight(.medium))
        }
    }

    private var packages: [Package] {
        guard let offering = license.offering else { return [] }
        return offering.availablePackages.sorted { order($0) < order($1) }
    }

    private func order(_ p: Package) -> Int {
        switch p.packageType {
        case .annual: 0
        case .lifetime: 1
        default: 2
        }
    }

    @ViewBuilder
    private var plans: some View {
        if !license.purchasesAvailable || (license.offering == nil && !license.purchasing) {
            NovaCard(tint: Nova.amber) {
                Label(t("In-app purchases are not available right now. Try again later."), systemImage: "exclamationmark.triangle.fill")
                    .font(.subheadline)
            }
        } else {
            VStack(spacing: 12) {
                ForEach(packages, id: \.identifier) { package in
                    planRow(package)
                }
            }
            .onAppear { if selected == nil { selected = packages.first?.identifier } }
        }
    }

    private func planRow(_ package: Package) -> some View {
        let isSelected = selected == package.identifier
        let product = package.storeProduct
        return Button {
            selected = package.identifier
            Haptics.select()
        } label: {
            HStack(alignment: .center, spacing: 14) {
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.title2)
                    .foregroundStyle(isSelected ? Nova.blue : Nova.inkSecondary)
                VStack(alignment: .leading, spacing: 4) {
                    Text(priceLine(package))
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Nova.ink)
                    Text(detailLine(package))
                        .font(.footnote)
                        .foregroundStyle(Nova.inkSecondary)
                }
                Spacer(minLength: 0)
                if package.packageType == .lifetime {
                    Chip(text: t("One-time"), color: Nova.green)
                } else if product.introductoryDiscount != nil {
                    Chip(text: t("Free trial"), color: Nova.amber)
                }
            }
            .padding(16)
            .background(Nova.surface, in: .rect(cornerRadius: 20, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .strokeBorder(isSelected ? Nova.blue : Nova.hairline, lineWidth: isSelected ? 2 : 1)
            }
        }
        .buttonStyle(PressableStyle())
    }

    private func priceLine(_ package: Package) -> String {
        let price = package.storeProduct.localizedPriceString
        switch package.packageType {
        case .annual: return t("%@ / year", price)
        case .monthly: return t("%@ / month", price)
        case .lifetime: return t("%@ once", price)
        default: return price
        }
    }

    private func detailLine(_ package: Package) -> String {
        let price = package.storeProduct.localizedPriceString
        if package.packageType == .lifetime {
            return t("Lifetime access on this Apple ID. No subscription.")
        }
        if let intro = package.storeProduct.introductoryDiscount, intro.price == 0 {
            return t("%@ free, then %@ per year. Renews automatically, cancel anytime.", periodText(intro.subscriptionPeriod), price)
        }
        return t("Renews automatically every year. Cancel anytime in Settings.")
    }

    private func periodText(_ period: SubscriptionPeriod) -> String {
        switch period.unit {
        case .day: t("%d days", period.value)
        case .week: t("%d weeks", period.value)
        case .month: t("%d months", period.value)
        case .year: t("%d years", period.value)
        }
    }

    private var selectedPackage: Package? { packages.first { $0.identifier == selected } }

    private var purchaseButton: some View {
        Button {
            guard let package = selectedPackage else { return }
            Task { await license.purchase(package) }
        } label: {
            HStack(spacing: 8) {
                if license.purchasing { ProgressView().tint(.white) }
                Text(selectedPackage.map { t("Continue — %@", priceLine($0)) } ?? t("Continue"))
            }
        }
        .buttonStyle(PrimaryButtonStyle())
        .disabled(selectedPackage == nil || license.purchasing)
        .opacity(selectedPackage == nil ? 0.5 : 1)
    }

    private var footer: some View {
        VStack(spacing: 14) {
            HStack(spacing: 18) {
                Button(t("Restore Purchases")) { Task { await license.restore() } }
                    .disabled(!license.purchasesAvailable || license.purchasing)
                Button(t("I already have a licence")) { showLicense = true }
            }
            .font(.subheadline.weight(.semibold))

            Text(t("Payment is charged to your Apple ID. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the period. Manage or cancel them in your Apple ID settings."))
                .font(.caption2)
                .foregroundStyle(Nova.inkSecondary)
                .multilineTextAlignment(.center)

            HStack(spacing: 16) {
                Link(t("Terms of Use"), destination: URL(string: "https://www.novastreamapp.com/terms")!)
                Link(t("Privacy Policy"), destination: URL(string: "https://www.novastreamapp.com/privacy")!)
            }
            .font(.caption.weight(.semibold))
        }
        .padding(.bottom, 20)
    }
}

/// Licence bought for this device on another platform: shows the device ID
/// and checks the registry again. No purchase links (outside the US storefront rules).
struct ExistingLicenseView: View {
    @Environment(LicenseManager.self) private var license
    @Environment(\.dismiss) private var dismiss
    @State private var checking = false
    @State private var result: String?

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    Text(t("Device ID")).font(.caption).foregroundStyle(Nova.inkSecondary)
                    Text(DeviceIdentity.current.deviceId.uppercased())
                        .font(.system(.title3, design: .monospaced, weight: .bold))
                        .textSelection(.enabled)
                }
                .padding(.vertical, 4)
                Button(t("Copy ID"), systemImage: "doc.on.doc") {
                    UIPasteboard.general.string = DeviceIdentity.current.deviceId.uppercased()
                    Haptics.success()
                }
            } footer: {
                Text(t("If you already activated a NovaStream licence for this device ID, tap Verify to unlock the app."))
            }
            Section {
                Button {
                    Task {
                        checking = true
                        await license.refresh()
                        checking = false
                        if case .website = license.access {
                            Haptics.success()
                            dismiss()
                        } else {
                            result = t("No active licence was found for this device yet.")
                            Haptics.error()
                        }
                    }
                } label: {
                    HStack {
                        Text(t("Verify"))
                        Spacer()
                        if checking { ProgressView() }
                    }
                }
                if let result {
                    Text(result).font(.footnote).foregroundStyle(Nova.coral)
                }
            }
        }
        .navigationTitle(t("Existing licence"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) { Button(t("Done")) { dismiss() } }
        }
    }
}
