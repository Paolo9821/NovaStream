import SwiftUI

struct LiveView: View {
    @Environment(AppModel.self) private var model
    var initialGroup: String = GroupFilter.all
    @State private var group = GroupFilter.all
    @State private var query = ""
    @State private var pendingGroup: String?
    @State private var askPin = false
    @State private var guideFor: MediaEntry?
    @State private var didInit = false
    @State private var visible = VisibleRows()

    private func memoryKey(_ group: String) -> String {
        ScrollMemory.key(account: model.activeAccountId, kind: .live, group: group)
    }

    private func remember(_ group: String) {
        guard query.trimmed.isEmpty, let top = visible.top else { return }
        ScrollMemory.shared.save(top, for: memoryKey(group))
    }

    private func restore(_ proxy: ScrollViewProxy, in list: [MediaEntry], orTop: Bool = false) {
        guard query.trimmed.isEmpty else { return }
        let saved = ScrollMemory.shared.spot(memoryKey(group)).flatMap { id in list.contains { $0.id == id } ? id : nil }
        guard let target = saved ?? (orTop ? list.first?.id : nil) else { return }
        Task { @MainActor in
            await Task.yield()
            proxy.scrollTo(target, anchor: .top)
        }
    }

    private var channels: [MediaEntry] {
        var items = model.entries(.live)
        switch group {
        case GroupFilter.all: items = items.filter { !model.isLocked($0.group) }
        case GroupFilter.favourites: items = items.filter { model.isFavorite($0.id) && !model.isLocked($0.group) }
        default: items = items.filter { $0.inGroup(group) }
        }
        if !query.trimmed.isEmpty { items = items.filter { $0.title.localizedStandardContains(query.trimmed) } }
        return items.sorted { $0.providerOrder < $1.providerOrder }
    }

    var body: some View {
        let list = channels
        ScrollViewReader { proxy in
        TimelineView(.periodic(from: .now, by: 60)) { context in
            List {
                Section {
                    ForEach(Array(list.enumerated()), id: \.element.id) { index, entry in
                        Button {
                            remember(group)
                            model.play(entry, channels: list)
                        } label: {
                            ChannelRow(entry: entry, now: context.date)
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(Color.clear)
                        .onAppear { visible.appeared(entry.id, at: index) }
                        .onDisappear { visible.disappeared(entry.id) }
                        .swipeActions(edge: .trailing) {
                            Button {
                                model.toggleFavorite(entry.id)
                            } label: {
                                Label(model.isFavorite(entry.id) ? t("Remove") : t("Favourite"), systemImage: model.isFavorite(entry.id) ? "star.slash" : "star")
                            }
                            .tint(Nova.amber)
                            Button { guideFor = entry } label: { Label(t("Guide"), systemImage: "list.bullet.rectangle") }
                                .tint(Nova.blue)
                        }
                        .contextMenu {
                            Button(model.isFavorite(entry.id) ? t("Remove from favourites") : t("Add to favourites"), systemImage: "star") { model.toggleFavorite(entry.id) }
                            Button(t("TV guide"), systemImage: "list.bullet.rectangle") { guideFor = entry }
                        }
                    }
                } header: {
                    GroupChips(kind: .live, groups: model.groups(.live), selection: $group) { locked in
                        pendingGroup = locked
                        askPin = true
                    }
                    .padding(.horizontal, -16)
                    .textCase(nil)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .overlay {
                if model.activeAccount == nil {
                    EmptyStateView(symbol: "play.tv", title: t("No playlist"), message: t("Add a playlist from the Home tab to see your channels."))
                } else if list.isEmpty, case .running = model.syncState {
                    ProgressView(t("Loading channels…"))
                } else if list.isEmpty {
                    EmptyStateView(symbol: group == GroupFilter.favourites ? "star" : "magnifyingglass", title: t("No channels"), message: group == GroupFilter.favourites ? t("Swipe left on a channel to add it to your favourites.") : t("Nothing matches this filter."))
                }
            }
        }
        .onAppear { restore(proxy, in: list) }
        .onDisappear { remember(group) }
        .onChange(of: group) { old, _ in
            remember(old)
            visible.reset()
            restore(proxy, in: list, orTop: true)
        }
        .onChange(of: list.isEmpty) { _, empty in
            if !empty { restore(proxy, in: list) }
        }
        .onChange(of: model.playback == nil) { _, closed in
            if closed { restore(proxy, in: list) }
        }
        }
        .background(NovaBackdrop())
        .navigationTitle(MediaKind.live.title)
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .automatic), prompt: t("Search channels"))
        .toolbar {
            if model.guideLoading {
                ToolbarItem(placement: .topBarTrailing) { ProgressView() }
            }
        }
        .refreshable { await model.refreshGuide() }
        .onAppear {
            if !didInit { group = initialGroup; didInit = true }
        }
        .parentalPrompt(isPresented: $askPin, model: model) {
            if let pendingGroup { group = pendingGroup }
        }
        .sheet(item: $guideFor) { entry in
            NavigationStack { GuideSheet(entry: entry) }
                .presentationDetents([.medium, .large])
        }
    }
}

struct ChannelRow: View {
    @Environment(AppModel.self) private var model
    let entry: MediaEntry
    let now: Date

    var body: some View {
        let programme = model.nowPlaying(entry)
        HStack(spacing: 14) {
            RemoteImage(url: entry.logoUrl, kind: .live, title: entry.title, contentMode: .fit)
                .padding(6)
                .frame(width: 64, height: 48)
                .background(Nova.surfaceHigh, in: .rect(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(entry.title).font(.body.weight(.semibold)).lineLimit(1)
                    if model.isFavorite(entry.id) {
                        Image(systemName: "star.fill").font(.caption2).foregroundStyle(Nova.amber)
                    }
                }
                if let programme {
                    Text(programme.title).font(.subheadline).foregroundStyle(Nova.inkSecondary).lineLimit(1)
                    HStack(spacing: 8) {
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Nova.green.opacity(0.18))
                                Capsule().fill(Nova.green).frame(width: geo.size.width * programme.progress(now.timeIntervalSince1970))
                            }
                        }
                        .frame(height: 4)
                        Text(Date(timeIntervalSince1970: programme.stop).formatted(date: .omitted, time: .shortened))
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(Nova.inkSecondary)
                    }
                } else {
                    Text(entry.group).font(.subheadline).foregroundStyle(Nova.inkSecondary).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "play.fill")
                .font(.caption.weight(.bold))
                .foregroundStyle(Nova.green)
                .frame(width: 30, height: 30)
                .background(Nova.greenSoft, in: .circle)
        }
        .padding(.vertical, 4)
        .contentShape(.rect)
    }
}

/// Upcoming programmes for one channel.
struct GuideSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let entry: MediaEntry

    var body: some View {
        let items = model.upcoming(entry, limit: 40)
        List {
            if items.isEmpty {
                Text(model.activeAccount?.effectiveEpgUrl.isEmpty == false
                     ? t("No guide data for this channel.")
                     : t("Add a TV guide (XMLTV) address to the playlist to see programmes."))
                    .foregroundStyle(Nova.inkSecondary)
            }
            ForEach(items, id: \.self) { programme in
                let onAir = programme.isOnAir(Date().timeIntervalSince1970)
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("\(Date(timeIntervalSince1970: programme.start).formatted(date: .omitted, time: .shortened)) – \(Date(timeIntervalSince1970: programme.stop).formatted(date: .omitted, time: .shortened))")
                            .font(.caption.monospacedDigit().weight(.semibold))
                            .foregroundStyle(onAir ? Nova.green : Nova.inkSecondary)
                        if onAir { Chip(text: t("On air"), color: Nova.green) }
                    }
                    Text(programme.title).font(.body.weight(.semibold))
                    if let desc = programme.desc, !desc.isEmpty {
                        Text(desc).font(.footnote).foregroundStyle(Nova.inkSecondary).lineLimit(3)
                    }
                }
                .padding(.vertical, 2)
            }
        }
        .navigationTitle(entry.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(t("Watch")) {
                    dismiss()
                    model.play(entry, channels: model.entries(.live))
                }
            }
        }
    }
}
