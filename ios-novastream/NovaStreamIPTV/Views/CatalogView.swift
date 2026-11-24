import SwiftUI

/// Movies or series: categories, sort, year filter and an adaptive poster grid.
struct CatalogView: View {
    @Environment(AppModel.self) private var model
    let kind: MediaKind
    var initialGroup: String = GroupFilter.all
    @State private var group = GroupFilter.all
    @State private var query = ""
    @State private var year: Int?
    @State private var pendingGroup: String?
    @State private var askPin = false
    @State private var didInit = false
    @State private var anchor: String?

    private func memoryKey(_ group: String) -> String {
        ScrollMemory.key(account: model.activeAccountId, kind: kind, group: group)
    }

    private func restore(_ proxy: ScrollViewProxy, in list: [MediaEntry], orTop: Bool = false) {
        guard query.trimmed.isEmpty, year == nil else { return }
        let saved = ScrollMemory.shared.spot(memoryKey(group)).flatMap { id in list.contains { $0.id == id } ? id : nil }
        guard let target = saved ?? (orTop ? "catalog-top" : nil) else { return }
        Task { @MainActor in
            await Task.yield()
            proxy.scrollTo(target, anchor: .top)
        }
    }

    private var items: [MediaEntry] {
        var list = model.entries(kind)
        switch group {
        case GroupFilter.all: list = list.filter { !model.isLocked($0.group) }
        case GroupFilter.favourites: list = list.filter { model.isFavorite($0.id) && !model.isLocked($0.group) }
        default: list = list.filter { $0.inGroup(group) }
        }
        if let year { list = list.filter { $0.year == year } }
        if !query.trimmed.isEmpty { list = list.filter { $0.title.localizedStandardContains(query.trimmed) } }
        return model.sorted(list, by: model.settings.sort)
    }

    private var years: [Int] {
        Array(Set(model.entries(kind).compactMap(\.year))).sorted(by: >)
    }

    var body: some View {
        @Bindable var model = model
        let list = items
        ScrollViewReader { proxy in
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12, pinnedViews: [.sectionHeaders]) {
                Section {
                    Text(t("%d titles", list.count))
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Nova.inkSecondary)
                        .padding(.horizontal, 16)
                        .id("catalog-top")
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 108, maximum: 170), spacing: 12, alignment: .top)], spacing: 18) {
                        ForEach(list) { entry in
                            NavigationLink(value: Route.detail(entry)) {
                                PosterCard(entry: entry)
                            }
                            .buttonStyle(PressableStyle())
                            .contextMenu {
                                Button(model.isFavorite(entry.id) ? t("Remove from favourites") : t("Add to favourites"), systemImage: "star") {
                                    model.toggleFavorite(entry.id)
                                }
                            }
                        }
                    }
                    .scrollTargetLayout()
                    .padding(.horizontal, 16)
                } header: {
                    GroupChips(kind: kind, groups: model.groups(kind), selection: $group) { locked in
                        pendingGroup = locked
                        askPin = true
                    }
                    .background(.bar)
                }
            }
            .padding(.bottom, 30)
        }
        .scrollPosition(id: $anchor, anchor: .top)
        .onChange(of: anchor) { _, id in
            guard let id, query.trimmed.isEmpty, year == nil else { return }
            ScrollMemory.shared.save(id, for: memoryKey(group))
        }
        .onAppear { restore(proxy, in: list) }
        .onChange(of: group) { _, _ in restore(proxy, in: list, orTop: true) }
        .onChange(of: list.isEmpty) { _, empty in
            if !empty { restore(proxy, in: list) }
        }
        }
        .background(NovaBackdrop())
        .overlay {
            if model.activeAccount == nil {
                EmptyStateView(symbol: kind.symbol, title: t("No playlist"), message: t("Add a playlist from the Home tab to browse the catalog."))
            } else if list.isEmpty, case .running = model.syncState {
                ProgressView(t("Loading catalog…"))
            } else if list.isEmpty {
                EmptyStateView(symbol: "magnifyingglass", title: t("Nothing here"), message: t("Nothing matches this filter."))
            }
        }
        .navigationTitle(kind.title)
        .searchable(text: $query, prompt: kind == .movie ? t("Search movies") : t("Search series"))
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker(t("Sort"), selection: $model.settings.sort) {
                        ForEach(SortOption.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    if !years.isEmpty {
                        Picker(t("Year"), selection: $year) {
                            Text(t("Any year")).tag(Int?.none)
                            ForEach(years, id: \.self) { Text(String($0)).tag(Int?.some($0)) }
                        }
                        .pickerStyle(.menu)
                    }
                } label: {
                    Image(systemName: year == nil ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
                }
                .accessibilityLabel(t("Sort and filter"))
            }
        }
        .onAppear {
            if !didInit { group = initialGroup; didInit = true }
        }
        .parentalPrompt(isPresented: $askPin, model: model) {
            if let pendingGroup { group = pendingGroup }
        }
    }
}

struct PosterCard: View {
    @Environment(AppModel.self) private var model
    let entry: MediaEntry
    var width: CGFloat? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Color.clear
                .aspectRatio(2 / 3, contentMode: .fit)
                .overlay { RemoteImage(url: entry.logoUrl, kind: entry.kind, title: entry.title) }
                .clipShape(.rect(cornerRadius: 14, style: .continuous))
                .overlay(alignment: .topTrailing) {
                    if model.isFavorite(entry.id) {
                        Image(systemName: "star.fill")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(Nova.amber)
                            .padding(6)
                            .background(.ultraThinMaterial, in: .circle)
                            .padding(6)
                    }
                }
                .overlay(alignment: .bottom) {
                    if let p = model.progress[entry.id], !p.completed, p.fraction > 0 {
                        GeometryReader { geo in
                            VStack {
                                Spacer()
                                Rectangle().fill(Nova.accent(for: entry.kind)).frame(width: geo.size.width * p.fraction, height: 3)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                        .clipShape(.rect(cornerRadius: 14, style: .continuous))
                    }
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Nova.hairline.opacity(0.6))
                }
            Text(entry.title)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Nova.ink)
                .lineLimit(2, reservesSpace: true)
                .multilineTextAlignment(.leading)
            if let year = entry.year {
                Text(String(year)).font(.caption2).foregroundStyle(Nova.inkSecondary)
            }
        }
        .frame(width: width)
    }
}
