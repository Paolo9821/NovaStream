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
    @State private var showGuide = false

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
        CategorySplit(kind: .live, selection: $group, onLocked: { locked in
            pendingGroup = locked
            askPin = true
        }) {
        ScrollViewReader { proxy in
        TimelineView(.periodic(from: .now, by: 60)) { context in
            List {
                Section {
                    ForEach(Array(list.enumerated()), id: \.element.id) { index, entry in
                        HStack(spacing: 8) {
                            Button {
                                remember(group)
                                model.play(entry, channels: list)
                            } label: {
                                ChannelRow(entry: entry, now: context.date)
                            }
                            .buttonStyle(.borderless)
                            .tint(Nova.ink)
                            Button { guideFor = entry } label: {
                                Image(systemName: "list.bullet.rectangle.portrait")
                                    .font(.footnote.weight(.bold))
                                    .foregroundStyle(Nova.blue)
                                    .frame(width: 34, height: 34)
                                    .background(Nova.blue.opacity(0.14), in: .circle)
                            }
                            .buttonStyle(.borderless)
                            .accessibilityLabel(t("TV guide"))
                        }
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 6, leading: 10, bottom: 6, trailing: 10))
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
                    CategoryHeader(title: GroupFilter.title(group), countLabel: t("%d channels", list.count))
                        .textCase(nil)
                        .padding(.vertical, 6)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .overlay {
                if model.activeAccount == nil {
                    EmptyView()
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
        }
        .background(NovaBackdrop())
        .overlay {
            if model.activeAccount == nil {
                EmptyStateView(symbol: "play.tv", title: t("No playlist"), message: t("Add a playlist from the Home tab to see your channels."))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(NovaBackdrop())
            }
        }
        .navigationTitle(MediaKind.live.title)
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .automatic), prompt: t("Search channels"))
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showGuide = true } label: {
                    if model.guideLoading {
                        ProgressView()
                    } else {
                        Label(t("TV guide"), systemImage: "list.bullet.rectangle.portrait")
                    }
                }
                .disabled(model.activeAccount == nil)
            }
        }
        .sheet(isPresented: $showGuide) {
            NavigationStack { GuideOverview(title: GroupFilter.title(group), channels: channels) }
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
        HStack(spacing: 10) {
            RemoteImage(url: entry.logoUrl, kind: .live, title: entry.title, contentMode: .fit)
                .padding(5)
                .frame(width: 54, height: 42)
                .background(Nova.surfaceHigh, in: .rect(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(entry.title).font(.subheadline.weight(.semibold)).lineLimit(1).foregroundStyle(Nova.ink)
                    if model.isFavorite(entry.id) {
                        Image(systemName: "star.fill").font(.caption2).foregroundStyle(Nova.amber)
                    }
                }
                if let programme {
                    Text(programme.title).font(.footnote).foregroundStyle(Nova.inkSecondary).lineLimit(1)
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
                    Text(entry.group).font(.footnote).foregroundStyle(Nova.inkSecondary).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
        .contentShape(.rect)
    }
}

/// TV guide for the channels on screen: what is on now and what follows,
/// with the full schedule of a channel one tap away.
struct GuideOverview: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let title: String
    let channels: [MediaEntry]
    @State private var selected: MediaEntry?

    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { context in
            let now = context.date.timeIntervalSince1970
            List {
                if model.guide.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(model.activeAccount?.epgCandidates.isEmpty == false
                             ? (model.guideLoading ? t("Loading the TV guide…") : t("The TV guide is not available yet."))
                             : t("Add a TV guide (XMLTV) address to the playlist to see programmes."))
                            .foregroundStyle(Nova.inkSecondary)
                        if model.activeAccount?.epgCandidates.isEmpty == false, !model.guideLoading {
                            Button(t("Update TV guide")) { Task { await model.refreshGuide() } }
                                .buttonStyle(.borderedProminent)
                        }
                    }
                    .padding(.vertical, 6)
                }
                ForEach(channels.prefix(400)) { entry in
                    let programmes = model.guide.programmes(for: entry).filter { $0.stop > now }.prefix(2)
                    Button { selected = entry } label: {
                        HStack(alignment: .top, spacing: 12) {
                            RemoteImage(url: entry.logoUrl, kind: .live, title: entry.title, contentMode: .fit)
                                .padding(4)
                                .frame(width: 48, height: 36)
                                .background(Nova.surfaceHigh, in: .rect(cornerRadius: 9, style: .continuous))
                            VStack(alignment: .leading, spacing: 4) {
                                Text(entry.title).font(.subheadline.weight(.bold)).foregroundStyle(Nova.ink).lineLimit(1)
                                if programmes.isEmpty {
                                    Text(t("No guide data for this channel.")).font(.caption).foregroundStyle(Nova.inkSecondary)
                                }
                                ForEach(Array(programmes.enumerated()), id: \.offset) { index, programme in
                                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                                        Text(Date(timeIntervalSince1970: programme.start).formatted(date: .omitted, time: .shortened))
                                            .font(.caption.monospacedDigit().weight(.semibold))
                                            .foregroundStyle(programme.isOnAir(now) ? Nova.green : Nova.inkSecondary)
                                        Text(programme.title)
                                            .font(index == 0 ? .footnote.weight(.semibold) : .footnote)
                                            .foregroundStyle(index == 0 ? Nova.ink : Nova.inkSecondary)
                                            .lineLimit(1)
                                    }
                                }
                            }
                            Spacer(minLength: 0)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .listStyle(.plain)
        }
        .navigationTitle(t("TV guide"))
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await model.refreshGuide() }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button(t("Close")) { dismiss() }
            }
            ToolbarItem(placement: .principal) {
                VStack(spacing: 0) {
                    Text(t("TV guide")).font(.headline)
                    Text(title).font(.caption).foregroundStyle(Nova.inkSecondary).lineLimit(1)
                }
            }
        }
        .navigationDestination(item: $selected) { entry in
            GuideSheet(entry: entry) { chosen in
                dismiss()
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(450))
                    model.play(chosen, channels: channels)
                }
            }
        }
        .task { if model.guideIsStale { await model.refreshGuide() } }
    }
}

/// Upcoming programmes for one channel.
struct GuideSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let entry: MediaEntry
    var onWatch: ((MediaEntry) -> Void)? = nil

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
                    if let onWatch {
                        onWatch(entry)
                    } else {
                        dismiss()
                        model.play(entry, channels: model.entries(.live))
                    }
                }
            }
        }
    }
}
