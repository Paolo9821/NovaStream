import SwiftUI

struct HomeView: View {
    @Environment(AppModel.self) private var model
    @Environment(LicenseManager.self) private var license
    @State private var showPaywall = false
    @State private var showAdd = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                if let account = model.activeAccount {
                    PlaylistCard(account: account)
                } else {
                    noPlaylist
                }
                trialBanner
                if model.activeAccount != nil {
                    sections
                    continueWatching
                    favorites
                    recentChannels
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 30)
            .frame(maxWidth: 900)
            .frame(maxWidth: .infinity)
        }
        .background(NovaBackdrop())
        .navigationTitle("NovaStream")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: Route.accounts) {
                    Image(systemName: "list.bullet.rectangle")
                }
                .accessibilityLabel(t("Playlists"))
            }
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: Route.settings) {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel(t("Settings"))
            }
        }
        .refreshable { await model.sync() }
        .sheet(isPresented: $showPaywall) { PaywallView(blocking: false) }
        .sheet(isPresented: $showAdd) { NavigationStack { AddAccountView() } }
    }

    private var noPlaylist: some View {
        NovaCard(padding: 22, tint: Nova.blue) {
            VStack(alignment: .leading, spacing: 14) {
                IconTile(symbol: "plus.rectangle.on.rectangle", color: Nova.blue)
                Text(t("Add your first playlist"))
                    .font(.title2.weight(.bold))
                Text(t("Paste the m3u link or the Xtream Codes details you received from your provider."))
                    .foregroundStyle(Nova.inkSecondary)
                Button(t("Add playlist")) { showAdd = true }
                    .buttonStyle(PrimaryButtonStyle())
            }
        }
        .padding(.top, 8)
    }

    @ViewBuilder
    private var trialBanner: some View {
        if case .trial(let days, _) = license.access {
            Button { showPaywall = true } label: {
                NovaCard(padding: 14, tint: Nova.amber) {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Image(systemName: "hourglass").foregroundStyle(Nova.amber)
                            Text(t("Free trial: %d days left", days)).font(.subheadline.weight(.semibold))
                            Spacer()
                            Text(t("Unlock")).font(.subheadline.weight(.bold)).foregroundStyle(Nova.amber)
                        }
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Nova.amber.opacity(0.18))
                                Capsule().fill(Nova.amber)
                                    .frame(width: geo.size.width * CGFloat(days) / CGFloat(LicenseManager.trialDays))
                            }
                        }
                        .frame(height: 6)
                    }
                }
            }
            .buttonStyle(PressableStyle())
        }
    }

    private var sections: some View {
        VStack(spacing: 12) {
            ForEach(MediaKind.allCases, id: \.self) { kind in
                SectionCard(kind: kind, count: model.entries(kind).count)
            }
        }
    }

    @ViewBuilder
    private var continueWatching: some View {
        let items = model.continueWatching
        if !items.isEmpty {
            Rail(title: t("Continue watching")) {
                ForEach(items) { item in
                    Button {
                        if let entry = model.entry(item.entryId) {
                            if item.kind == .series {
                                model.playback = PlaybackRequest(
                                    entryId: item.entryId, title: item.title,
                                    subtitle: item.episodeTitle, url: item.streamUrl, kind: .series,
                                    imageUrl: item.imageUrl, startAt: item.position,
                                    season: item.season, episodeNumber: item.episodeNumber
                                )
                            } else {
                                model.play(entry)
                            }
                        }
                    } label: {
                        ContinueCard(item: item)
                    }
                    .buttonStyle(PressableStyle())
                    .contextMenu {
                        Button(t("Remove from Continue watching"), systemImage: "xmark.circle", role: .destructive) {
                            model.clearProgress(item.entryId)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var favorites: some View {
        let items = model.favoriteEntries()
        if !items.isEmpty {
            Rail(title: t("Favourites")) {
                ForEach(items) { entry in
                    if entry.kind == .live {
                        Button { model.play(entry, channels: model.favoriteEntries(.live)) } label: {
                            ChannelTile(entry: entry)
                        }
                        .buttonStyle(PressableStyle())
                    } else {
                        NavigationLink(value: Route.detail(entry)) {
                            PosterCard(entry: entry, width: 120)
                        }
                        .buttonStyle(PressableStyle())
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var recentChannels: some View {
        let items = model.recentChannels
        if !items.isEmpty {
            Rail(title: t("Recent channels")) {
                ForEach(items) { entry in
                    Button { model.play(entry, channels: items) } label: { ChannelTile(entry: entry) }
                        .buttonStyle(PressableStyle())
                }
            }
        }
    }
}

/// Gradient card with the playlist in use, provider expiry and sync state.
struct PlaylistCard: View {
    @Environment(AppModel.self) private var model
    let account: PlaylistAccount

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(t("Playlist in use").uppercased())
                    .font(.caption.weight(.bold))
                    .kerning(1.2)
                    .foregroundStyle(.white.opacity(0.75))
                Spacer()
                Text(account.typeLabel)
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 9).padding(.vertical, 4)
                    .background(.white.opacity(0.2), in: .capsule)
                    .foregroundStyle(.white)
            }
            Text(account.name)
                .font(.system(.title, design: .rounded, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(2)
            HStack(spacing: 14) {
                if let expires = model.providerInfo?.expires {
                    Label(t("Expires %@", expires.formatted(date: .abbreviated, time: .omitted)), systemImage: "calendar")
                } else if model.providerInfo?.known == true {
                    Label(t("No expiry"), systemImage: "infinity")
                }
                if let last = account.lastSync {
                    Label(last.formatted(.relative(presentation: .named)), systemImage: "arrow.triangle.2.circlepath")
                }
            }
            .font(.footnote.weight(.medium))
            .foregroundStyle(.white.opacity(0.85))

            syncRow
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(LinearGradient(colors: [Color(UIColor(hex: 0x2B5BE0)), Color(UIColor(hex: 0x1A8F8A))], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(alignment: .topTrailing) {
                    Circle().fill(.white.opacity(0.08)).frame(width: 180).offset(x: 60, y: -70)
                }
                .clipShape(.rect(cornerRadius: 26, style: .continuous))
        }
        .shadow(color: Color(UIColor(hex: 0x2B5BE0)).opacity(0.35), radius: 18, y: 8)
        .padding(.top, 8)
    }

    @ViewBuilder
    private var syncRow: some View {
        switch model.syncState {
        case .running(let message):
            HStack(spacing: 10) {
                ProgressView().tint(.white)
                Text(message).font(.subheadline.weight(.medium)).foregroundStyle(.white)
            }
        case .failed(let message):
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "exclamationmark.triangle.fill")
                Text(message).font(.footnote)
                Spacer()
                retry
            }
            .foregroundStyle(.white)
            .padding(12)
            .background(.black.opacity(0.22), in: .rect(cornerRadius: 14))
        default:
            HStack {
                Text(t("%d channels · %d movies · %d series", model.catalog.of(.live).count, model.catalog.of(.movie).count, model.catalog.of(.series).count))
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.9))
                Spacer()
                retry
            }
        }
    }

    private var retry: some View {
        Button {
            Task { await model.sync() }
        } label: {
            Label(t("Update"), systemImage: "arrow.clockwise")
                .font(.footnote.weight(.bold))
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(.white, in: .capsule)
                .foregroundStyle(Color(UIColor(hex: 0x2B5BE0)))
        }
        .buttonStyle(PressableStyle())
    }
}

struct SectionCard: View {
    let kind: MediaKind
    let count: Int

    var body: some View {
        NavigationLink(value: Route.group(kind, "")) {
            NovaCard(padding: 16, tint: Nova.accent(for: kind)) {
                HStack(spacing: 16) {
                    IconTile(symbol: kind.symbol, color: Nova.accent(for: kind), size: 56)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(kind.title).font(.title3.weight(.bold)).foregroundStyle(Nova.ink)
                        Text(subtitle).font(.subheadline).foregroundStyle(Nova.inkSecondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.body.weight(.bold))
                        .foregroundStyle(Nova.accent(for: kind))
                }
            }
        }
        .buttonStyle(PressableStyle())
    }

    private var subtitle: String {
        switch kind {
        case .live: t("%d channels", count)
        case .movie: t("%d movies", count)
        case .series: t("%d series", count)
        }
    }
}

/// Horizontal carousel with a title.
struct Rail<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.title3.weight(.bold))
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(alignment: .top, spacing: 12) { content }
                    .padding(.horizontal, 20)
            }
            .padding(.horizontal, -20)
            .scrollClipDisabled()
        }
    }
}

struct ContinueCard: View {
    let item: WatchProgress

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .bottomLeading) {
                RemoteImage(url: item.imageUrl, kind: item.kind, title: item.title)
                    .frame(width: 220, height: 124)
                    .clipped()
                LinearGradient(colors: [.clear, .black.opacity(0.7)], startPoint: .center, endPoint: .bottom)
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 34))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .shadow(radius: 6)
                GeometryReader { geo in
                    VStack {
                        Spacer()
                        ZStack(alignment: .leading) {
                            Rectangle().fill(.white.opacity(0.25))
                            Rectangle().fill(Nova.accent(for: item.kind)).frame(width: geo.size.width * item.fraction)
                        }
                        .frame(height: 4)
                    }
                }
            }
            .frame(width: 220, height: 124)
            .clipShape(.rect(cornerRadius: 16, style: .continuous))
            Text(item.title).font(.subheadline.weight(.semibold)).lineLimit(1).foregroundStyle(Nova.ink)
            Text(item.episodeTitle ?? t("%d min left", item.remainingMinutes))
                .font(.caption).foregroundStyle(Nova.inkSecondary).lineLimit(1)
        }
        .frame(width: 220)
    }
}

struct ChannelTile: View {
    let entry: MediaEntry

    var body: some View {
        VStack(spacing: 8) {
            RemoteImage(url: entry.logoUrl, kind: .live, title: entry.title, contentMode: .fit)
                .padding(10)
                .frame(width: 96, height: 72)
                .background(Nova.surfaceHigh, in: .rect(cornerRadius: 16, style: .continuous))
            Text(entry.title).font(.caption.weight(.semibold)).lineLimit(1).foregroundStyle(Nova.ink)
        }
        .frame(width: 96)
    }
}
