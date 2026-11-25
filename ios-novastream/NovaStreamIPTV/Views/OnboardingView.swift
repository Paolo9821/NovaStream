import SwiftUI

/// First launch: welcome, language, and acceptance of the terms of use.
struct OnboardingView: View {
    @Environment(AppModel.self) private var model
    @State private var accepted = false
    @State private var showTerms = false
    @State private var glow = false

    var body: some View {
        @Bindable var model = model
        ZStack {
            NovaBackdrop()
            ScrollView {
                VStack(spacing: 28) {
                    Spacer(minLength: 24)
                    Image("BrandMark")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 108, height: 108)
                        .clipShape(.rect(cornerRadius: 28, style: .continuous))
                        .shadow(color: Nova.blue.opacity(glow ? 0.55 : 0.2), radius: glow ? 32 : 14)
                        .onAppear {
                            withAnimation(.easeInOut(duration: 2.4).repeatForever(autoreverses: true)) { glow = true }
                        }

                    VStack(spacing: 10) {
                        Text(t("Welcome to NovaStream"))
                            .font(.system(.largeTitle, design: .rounded, weight: .bold))
                            .multilineTextAlignment(.center)
                        Text(t("A clean, fast player for the playlists you already have from your provider."))
                            .font(.body)
                            .foregroundStyle(Nova.inkSecondary)
                            .multilineTextAlignment(.center)
                    }

                    VStack(spacing: 12) {
                        feature("list.bullet.rectangle.fill", Nova.blue, t("Your playlists"), t("Add m3u links, Xtream Codes accounts or a private host. Credentials stay only on this iPhone."))
                        feature("play.tv.fill", Nova.green, t("Live TV with guide"), t("See what's on now and next, with the TV guide from your provider."))
                        feature("film.stack.fill", Nova.purple, t("Movies and series"), t("Posters, plots, seasons and Continue Watching where you left off."))
                        feature("exclamationmark.shield.fill", Nova.amber, t("No content included"), t("NovaStream does not provide channels or videos: you need a playlist from your own provider."))
                    }

                    NovaCard(padding: 14) {
                        HStack {
                            Label(t("Language"), systemImage: "globe")
                            Spacer()
                            Picker(t("Language"), selection: $model.settings.language) {
                                ForEach(Lang.available, id: \.self) { Text($0.nativeName).tag($0) }
                            }
                            .labelsHidden()
                        }
                    }

                    Button {
                        accepted.toggle()
                        Haptics.select()
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: accepted ? "checkmark.square.fill" : "square")
                                .font(.title3)
                                .foregroundStyle(accepted ? Nova.blue : Nova.inkSecondary)
                                .contentTransition(.symbolEffect(.replace))
                            Text(t("I accept the terms of use and confirm I will only play content I have the right to watch."))
                                .font(.subheadline)
                                .foregroundStyle(Nova.ink)
                                .multilineTextAlignment(.leading)
                        }
                    }
                    .buttonStyle(.plain)

                    Button(t("Read the terms of use")) { showTerms = true }
                        .font(.subheadline.weight(.semibold))

                    Button(t("Continue")) {
                        model.settings.termsAccepted = true
                        model.settings.onboardingDone = true
                        Haptics.success()
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!accepted)
                    .opacity(accepted ? 1 : 0.45)
                    .padding(.bottom, 24)
                }
                .padding(.horizontal, 24)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
            }
        }
        .sheet(isPresented: $showTerms) {
            NavigationStack { TermsView() }
        }
    }

    private func feature(_ symbol: String, _ color: Color, _ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            IconTile(symbol: symbol, color: color, size: 42)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(text).font(.subheadline).foregroundStyle(Nova.inkSecondary)
            }
            Spacer(minLength: 0)
        }
    }
}
