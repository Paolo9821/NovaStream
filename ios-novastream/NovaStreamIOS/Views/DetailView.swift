import SwiftUI

struct DetailView: View {
    @Environment(AppModel.self) private var model
    let entry: MediaEntry
    @State private var details: MediaDetails?
    @State private var episodes: [Episode] = []
    @State private var season = 1
    @State private var loadingEpisodes = false
    @State private var episodesError: String?

    private var seasons: [Int] { Array(Set(episodes.map(\.season))).sorted() }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                hero
                VStack(alignment: .leading, spacing: 20) {
                    actions
                    if let plot = details?.plot ?? entry.plot, !plot.isEmpty {
                        Text(plot).font(.body).foregroundStyle(Nova.ink.opacity(0.9))
                    }
                    credits
                    if entry.kind == .series { episodeSection }
                }
                .padding(.horizontal, 20)
            }
            .padding(.bottom, 40)
            .frame(maxWidth: 900)
            .frame(maxWidth: .infinity)
        }
        .background(Nova.canvas)
        .ignoresSafeArea(edges: .top)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { model.toggleFavorite(entry.id) } label: {
                    Image(systemName: model.isFavorite(entry.id) ? "star.fill" : "star")
                        .foregroundStyle(model.isFavorite(entry.id) ? Nova.amber : Nova.ink)
                        .symbolEffect(.bounce, value: model.isFavorite(entry.id))
                }
                .accessibilityLabel(t("Favourite"))
            }
        }
        .task {
            details = await model.details(for: entry)
            if entry.kind == .series { await loadEpisodes() }
        }
    }

    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            RemoteImage(url: details?.backdropUrl ?? details?.coverUrl ?? entry.logoUrl, kind: entry.kind, title: entry.title)
                .frame(height: 320)
                .frame(maxWidth: .infinity)
                .clipped()
                .blur(radius: details?.backdropUrl == nil ? 18 : 0)
                .overlay {
                    LinearGradient(colors: [.clear, Nova.canvas.opacity(0.6), Nova.canvas], startPoint: .top, endPoint: .bottom)
                }
            HStack(alignment: .bottom, spacing: 16) {
                RemoteImage(url: details?.coverUrl ?? entry.logoUrl, kind: entry.kind, title: entry.title)
                    .frame(width: 110, height: 165)
                    .clipShape(.rect(cornerRadius: 14, style: .continuous))
                    .shadow(color: .black.opacity(0.4), radius: 14, y: 6)
                VStack(alignment: .leading, spacing: 8) {
                    Text(entry.title)
                        .font(.system(.title2, design: .rounded, weight: .bold))
                        .lineLimit(3)
                    FlowChips(items: metaChips)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20)
        }
        .frame(height: 340)
    }

    private var metaChips: [String] {
        var list: [String] = []
        if let y = entry.year { list.append(String(y)) }
        if let r = details?.rating { list.append("★ \(r)") }
        if let d = details?.duration { list.append(d) }
        if let q = entry.quality { list.append(q) }
        list += (details?.genres.isEmpty == false ? details!.genres : entry.genres).prefix(3)
        return list
    }

    @ViewBuilder
    private var actions: some View {
        let saved = model.progress[entry.id]
        if entry.kind == .movie {
            VStack(alignment: .leading, spacing: 8) {
                Button {
                    model.play(entry)
                } label: {
                    Label(saved.map { !$0.completed && $0.position > 30 } == true ? t("Resume") : t("Play"), systemImage: "play.fill")
                }
                .buttonStyle(PrimaryButtonStyle())
                if let saved, !saved.completed, saved.position > 30 {
                    ProgressView(value: saved.fraction).tint(Nova.blue)
                    Text(t("%d min left", saved.remainingMinutes)).font(.caption).foregroundStyle(Nova.inkSecondary)
                }
            }
        } else if let saved, !saved.completed, let ep = episodes.first(where: { $0.season == saved.season && $0.number == saved.episodeNumber }) {
            Button {
                model.play(episode: ep, of: entry, all: episodes)
            } label: {
                Label(t("Resume S%d E%d", ep.season, ep.number), systemImage: "play.fill")
            }
            .buttonStyle(PrimaryButtonStyle(color: Nova.purple))
        } else if let first = episodes.first {
            Button {
                model.play(episode: first, of: entry, all: episodes)
            } label: {
                Label(t("Play S%d E%d", first.season, first.number), systemImage: "play.fill")
            }
            .buttonStyle(PrimaryButtonStyle(color: Nova.purple))
        }
    }

    @ViewBuilder
    private var credits: some View {
        if let details, !details.cast.isEmpty || details.director != nil {
            VStack(alignment: .leading, spacing: 8) {
                if let director = details.director {
                    LabeledContent(t("Director"), value: director)
                }
                if !details.cast.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(t("Cast")).foregroundStyle(Nova.inkSecondary)
                        Text(details.cast.joined(separator: ", "))
                    }
                }
            }
            .font(.subheadline)
        }
    }

    @ViewBuilder
    private var episodeSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(t("Episodes")).font(.title3.weight(.bold))
                Spacer()
                if seasons.count > 1 {
                    Picker(t("Season"), selection: $season) {
                        ForEach(seasons, id: \.self) { Text(t("Season %d", $0)).tag($0) }
                    }
                    .pickerStyle(.menu)
                }
            }
            if loadingEpisodes {
                ProgressView().frame(maxWidth: .infinity).padding()
            } else if let episodesError {
                VStack(spacing: 10) {
                    Text(episodesError).font(.footnote).foregroundStyle(Nova.coral)
                    Button(t("Try again")) { Task { await loadEpisodes() } }
                }
            } else if episodes.isEmpty {
                Text(t("No episodes found.")).foregroundStyle(Nova.inkSecondary)
            }
            ForEach(episodes.filter { $0.season == season }) { ep in
                Button { model.play(episode: ep, of: entry, all: episodes) } label: {
                    EpisodeRow(episode: ep, current: model.progress[entry.id].map { $0.season == ep.season && $0.episodeNumber == ep.number } ?? false)
                }
                .buttonStyle(PressableStyle())
            }
        }
    }

    private func loadEpisodes() async {
        loadingEpisodes = true
        episodesError = nil
        do {
            episodes = try await model.episodes(for: entry)
            if let saved = model.progress[entry.id], seasons.contains(saved.season) { season = saved.season }
            else { season = seasons.first ?? 1 }
        } catch {
            episodesError = error.localizedDescription
        }
        loadingEpisodes = false
    }
}

struct EpisodeRow: View {
    let episode: Episode
    let current: Bool

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RemoteImage(url: episode.thumbUrl, kind: .series, title: "\(episode.number)")
                Image(systemName: "play.fill").foregroundStyle(.white).shadow(radius: 4)
            }
            .frame(width: 120, height: 68)
            .clipShape(.rect(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(t("Episode %d", episode.number))
                    .font(.caption.weight(.bold))
                    .foregroundStyle(current ? Nova.purple : Nova.inkSecondary)
                Text(episode.title).font(.subheadline.weight(.semibold)).foregroundStyle(Nova.ink).lineLimit(2)
                if let plot = episode.plot {
                    Text(plot).font(.caption).foregroundStyle(Nova.inkSecondary).lineLimit(2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .background(current ? Nova.purpleSoft : Nova.surface, in: .rect(cornerRadius: 16, style: .continuous))
        .multilineTextAlignment(.leading)
    }
}

/// Wrapping row of small chips.
struct FlowChips: View {
    let items: [String]
    var body: some View {
        FlowLayout(spacing: 6) {
            ForEach(items, id: \.self) { Chip(text: $0) }
        }
    }
}

struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0, maxX: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > width, x > 0 { x = 0; y += row + spacing; row = 0 }
            x += size.width + spacing
            maxX = max(maxX, x - spacing)
            row = max(row, size.height)
        }
        return CGSize(width: min(maxX, width), height: y + row)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, row: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX { x = bounds.minX; y += row + spacing; row = 0 }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            row = max(row, size.height)
        }
    }
}
