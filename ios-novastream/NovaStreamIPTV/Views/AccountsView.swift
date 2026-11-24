import SwiftUI

struct AccountsView: View {
    @Environment(AppModel.self) private var model
    @State private var showAdd = false
    @State private var editing: PlaylistAccount?
    @State private var deleting: PlaylistAccount?

    var body: some View {
        List {
            if model.accounts.isEmpty {
                Text(t("No playlists yet.")).foregroundStyle(Nova.inkSecondary)
            }
            ForEach(model.accounts) { account in
                Button { model.select(account.id); Haptics.select() } label: {
                    HStack(spacing: 14) {
                        IconTile(symbol: account.isPrivateHost ? "lock.shield" : (account.type == .xtream ? "server.rack" : "link"), color: account.type == .xtream ? Nova.purple : Nova.blue, size: 42)
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 6) {
                                Text(account.name).font(.body.weight(.semibold)).foregroundStyle(Nova.ink)
                                Chip(text: account.typeLabel)
                                if account.fromWeb { Chip(text: t("From website"), color: Nova.green) }
                            }
                            Text(account.host.isEmpty ? "—" : account.host)
                                .font(.caption).foregroundStyle(Nova.inkSecondary)
                            if let last = account.lastSync {
                                Text(t("Updated %@", last.formatted(.relative(presentation: .named))))
                                    .font(.caption2).foregroundStyle(Nova.inkSecondary)
                            }
                        }
                        Spacer()
                        if account.id == model.activeAccountId {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(Nova.green).font(.title3)
                        }
                    }
                }
                .swipeActions {
                    Button(t("Delete"), role: .destructive) { deleting = account }
                    Button(t("Edit")) { editing = account }.tint(Nova.blue)
                }
                .contextMenu {
                    Button(t("Edit"), systemImage: "pencil") { editing = account }
                    Button(t("Delete"), systemImage: "trash", role: .destructive) { deleting = account }
                }
            }
            Section {
                Button { showAdd = true } label: {
                    Label(t("Add playlist"), systemImage: "plus.circle.fill").font(.body.weight(.semibold))
                }
            } footer: {
                Text(t("Credentials are stored only in this iPhone's Keychain."))
            }
        }
        .navigationTitle(t("Playlists"))
        .sheet(isPresented: $showAdd) { NavigationStack { AddAccountView() } }
        .sheet(item: $editing) { account in NavigationStack { AddAccountView(existing: account) } }
        .confirmationDialog(t("Delete this playlist?"), isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button(t("Delete"), role: .destructive) {
                if let deleting { model.remove(deleting) }
                deleting = nil
            }
        } message: {
            Text(t("Favourites and history of this playlist will be removed from this iPhone."))
        }
    }
}

struct AddAccountView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    var existing: PlaylistAccount?

    /// What the form asks for: a link, a full Xtream account, or a host number.
    private enum FormKind: Hashable { case m3u, xtream, privateHost }

    @State private var kind: FormKind = .m3u
    private var type: AccountType { kind == .m3u ? .m3u : .xtream }
    private var privateHost: Bool { kind == .privateHost }
    @State private var name = ""
    @State private var m3uUrl = ""
    @State private var server = ""
    @State private var username = ""
    @State private var password = ""
    @State private var epgUrl = ""
    @State private var hostNumber = ""
    @State private var working = false
    @State private var error: String?
    @State private var loaded = false

    var body: some View {
        Form {
            Section {
                Picker(t("Type"), selection: $kind.animation()) {
                    Text("m3u / m3u8").tag(FormKind.m3u)
                    Text("Xtream Codes").tag(FormKind.xtream)
                    Text(t("Private host")).tag(FormKind.privateHost)
                }
                .pickerStyle(.segmented)
                .disabled(existing != nil)
                TextField(t("Name (optional)"), text: $name)
            }
            if type == .m3u {
                Section {
                    TextField("https://…/playlist.m3u", text: $m3uUrl, axis: .vertical)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: { Text(t("Playlist address")) } footer: {
                    Text(t("The link you received from your provider."))
                }
            } else {
                Section {
                    if privateHost {
                        TextField(t("Host number"), text: $hostNumber)
                            .keyboardType(.asciiCapable)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                            .font(.body.monospaced())
                            .onChange(of: hostNumber) { _, value in
                                let cleaned = PrivateHosts.clean(value)
                                if cleaned != value { hostNumber = cleaned }
                            }
                    } else {
                        TextField(t("Server (e.g. http://example.com:8080)"), text: $server)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                    TextField(t("Username"), text: $username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textContentType(.username)
                    SecureField(t("Password"), text: $password)
                        .textContentType(.password)
                } header: { Text(privateHost ? t("Private host") : t("Xtream Codes account")) } footer: {
                    if privateHost {
                        Text(t("Type the host number you received with your subscription. The server address is found automatically."))
                    }
                }
            }
            Section {
                TextField(t("XMLTV address (optional)"), text: $epgUrl)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            } header: { Text(t("TV guide")) } footer: {
                Text(type == .xtream ? t("Leave empty to use the guide of your Xtream server.") : t("Leave empty to use the guide announced by the playlist, if any."))
            }
            if let error {
                Section {
                    Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(Nova.coral)
                }
            }
        }
        .navigationTitle(existing == nil ? t("Add playlist") : t("Edit playlist"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button(t("Cancel")) { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                if working { ProgressView() } else {
                    Button(t("Save")) { Task { await save() } }.fontWeight(.bold)
                }
            }
        }
        .interactiveDismissDisabled(working)
        .onAppear {
            guard !loaded, let existing else { return }
            loaded = true
            kind = existing.isPrivateHost ? .privateHost : (existing.type == .m3u ? .m3u : .xtream)
            name = existing.name
            m3uUrl = existing.m3uUrl
            server = existing.isPrivateHost ? "" : existing.server
            hostNumber = existing.hostNumber ?? ""
            username = existing.username
            password = existing.password
            epgUrl = existing.epgUrl
        }
    }

    private func save() async {
        working = true
        error = nil
        var account = existing ?? PlaylistAccount(name: name, type: type)
        account.name = name
        account.type = type
        account.m3uUrl = m3uUrl
        if type == .xtream && privateHost {
            guard !PrivateHosts.clean(hostNumber).isEmpty else {
                error = t("Enter the host number.")
                working = false
                Haptics.error()
                return
            }
            account.hostNumber = PrivateHosts.clean(hostNumber)
        } else {
            account.hostNumber = nil
            account.server = server
        }
        account.username = username
        account.password = password
        account.epgUrl = epgUrl.trimmed
        do {
            let checked = try await model.validate(account)
            dismiss()
            if existing == nil { await model.add(checked) } else { await model.update(checked) }
        } catch {
            self.error = error.localizedDescription
            Haptics.error()
        }
        working = false
    }
}
