import SwiftUI

struct SearchView: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""

    var body: some View {
        let results = model.search(query)
        List {
            if query.trimmed.count < 2 {
                if !model.recentSearches.isEmpty {
                    Section {
                        ForEach(model.recentSearches, id: \.self) { recent in
                            Button { query = recent } label: {
                                Label(recent, systemImage: "clock.arrow.circlepath")
                                    .foregroundStyle(Nova.ink)
                            }
                        }
                    } header: {
                        HStack {
                            Text(t("Recent searches"))
                            Spacer()
                            Button(t("Clear")) { model.clearSearches() }.font(.caption.weight(.semibold))
                        }
                    }
                }
            } else {
                ForEach(MediaKind.allCases, id: \.self) { kind in
                    let group = results.filter { $0.kind == kind }
                    if !group.isEmpty {
                        Section(kind.title) {
                            ForEach(group.prefix(60)) { entry in
                                row(entry, siblings: group)
                            }
                        }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(NovaBackdrop())
        .overlay {
            if model.activeAccount == nil {
                EmptyStateView(symbol: "magnifyingglass", title: t("No playlist"), message: t("Add a playlist from the Home tab, then search channels, movies and series here."))
            } else if query.trimmed.count >= 2, results.isEmpty {
                ContentUnavailableView.search(text: query)
            } else if query.trimmed.count < 2, model.recentSearches.isEmpty {
                EmptyStateView(symbol: "magnifyingglass", title: t("Search everything"), message: t("Channels, movies and series from the playlist in use."))
            }
        }
        .navigationTitle(t("Search"))
        .searchable(text: $query, prompt: t("Channels, movies, series"))
        .onSubmit(of: .search) { model.rememberSearch(query) }
    }

    @ViewBuilder
    private func row(_ entry: MediaEntry, siblings: [MediaEntry]) -> some View {
        if entry.kind == .live {
            Button {
                model.rememberSearch(query)
                model.play(entry, channels: siblings)
            } label: {
                ChannelRow(entry: entry, now: Date())
            }
            .buttonStyle(.plain)
        } else {
            NavigationLink(value: Route.detail(entry)) {
                HStack(spacing: 12) {
                    RemoteImage(url: entry.logoUrl, kind: entry.kind, title: entry.title)
                        .frame(width: 44, height: 66)
                        .clipShape(.rect(cornerRadius: 8, style: .continuous))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(entry.title).font(.body.weight(.semibold)).lineLimit(2)
                        Text([entry.year.map(String.init), entry.group].compactMap { $0 }.joined(separator: " · "))
                            .font(.caption).foregroundStyle(Nova.inkSecondary).lineLimit(1)
                    }
                }
            }
            .simultaneousGesture(TapGesture().onEnded { model.rememberSearch(query) })
        }
    }
}
