import SwiftUI
import AVKit
import AVFoundation
import Observation
import Combine

/// Drives AVPlayer: loading, resume, progress saving, zapping, reconnect and
/// autoplay of the next episode.
@Observable
final class PlayerController {
    enum Phase: Equatable { case loading, playing, failed(String) }
    /// The iPhone player first (AirPlay, Picture in Picture, HLS); VLC for the
    /// containers and codecs it cannot read.
    enum Engine { case native, vlc }

    /// Containers the iPhone player cannot open: they go straight to VLC.
    static let vlcExtensions: Set<String> = ["mkv", "avi", "wmv", "flv", "webm", "divx", "xvid", "mpg", "mpeg", "vob", "ogv", "rmvb", "rm", "3gp", "asf", "m2ts", "mts"]

    let player = AVPlayer()
    let vlc = VLCPlayback()
    private(set) var engine: Engine = .native
    private(set) var request: PlaybackRequest
    private(set) var phase: Phase = .loading
    private(set) var countdown: Int?

    @ObservationIgnored private weak var model: AppModel?
    @ObservationIgnored private var timeObserver: Any?
    @ObservationIgnored private var statusObservation: NSKeyValueObservation?
    @ObservationIgnored private var rateObservation: NSKeyValueObservation?
    @ObservationIgnored private var endObserver: NSObjectProtocol?
    @ObservationIgnored private var countdownTask: Task<Void, Never>?
    @ObservationIgnored private var tickObserver: Any?
    @ObservationIgnored private var lastTick: Double = -1
    @ObservationIgnored private var retries = 0
    /// Stream asked for by the address encrypted DNS found, for when the
    /// operator's DNS hides the server from the iPhone player.
    @ObservationIgnored private var resolved: (original: String, url: URL, host: String)?
    @ObservationIgnored private var resolvedTried: String?
    /// Set when the iPhone player failed on this stream: it plays through VLC.
    @ObservationIgnored private var forceVLC = false

    init(request: PlaybackRequest, model: AppModel) {
        self.request = request
        self.model = model
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
        try? AVAudioSession.sharedInstance().setActive(true)
        timeObserver = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 10, preferredTimescale: 1), queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.saveProgress() }
        }
        // Live streams do not always report readyToPlay even though frames are
        // on screen: time moving forward is the surest sign that it plays.
        tickObserver = player.addPeriodicTimeObserver(forInterval: CMTime(value: 1, timescale: 2), queue: .main) { [weak self] time in
            MainActor.assumeIsolated { self?.tick(time.seconds) }
        }
        rateObservation = Self.watchRate(player) { [weak self] status in
            Task { @MainActor in
                #if DEBUG
                print("player_rate status=\(status.rawValue)")
                #endif
                if status == .playing { self?.markPlaying() }
            }
        }
        vlc.onEvent = { [weak self] event in self?.vlcEvent(event) }
        load(startAt: request.startAt)
    }

    // KVO fires on AVFoundation's own threads, so these are built outside the
    // main actor and hop back to it.
    nonisolated private static func watchStatus(_ item: AVPlayerItem, _ handler: @escaping @Sendable (AVPlayerItem.Status) -> Void) -> NSKeyValueObservation {
        item.observe(\.status, options: [.initial, .new]) { item, _ in handler(item.status) }
    }

    nonisolated private static func watchRate(_ player: AVPlayer, _ handler: @escaping @Sendable (AVPlayer.TimeControlStatus) -> Void) -> NSKeyValueObservation {
        player.observe(\.timeControlStatus, options: [.initial, .new]) { player, _ in handler(player.timeControlStatus) }
    }

    var currentIndex: Int? { request.channels.firstIndex { $0.id == request.entryId } }

    private func markPlaying() {
        guard phase == .loading else { return }
        phase = .playing
        retries = 0
    }

    private func tick(_ seconds: Double) {
        defer { lastTick = seconds }
        guard seconds.isFinite, lastTick >= 0, seconds > lastTick + 0.1, player.rate > 0 else { return }
        markPlaying()
    }

    private var extensionOfRequest: String {
        URL(string: request.url)?.pathExtension.lowercased() ?? ""
    }

    func load(startAt: Double) {
        phase = .loading
        lastTick = -1
        countdown = nil
        countdownTask?.cancel()
        if forceVLC || Self.vlcExtensions.contains(extensionOfRequest) {
            startVLC(startAt: startAt)
            return
        }
        if engine == .vlc {
            vlc.stop()
            engine = .native
        }
        let address = StreamURLs.forPlayback(request.url, kind: request.kind)
        guard let url = URL(string: address) else {
            phase = .failed(t("This address is not valid."))
            return
        }
        var options: [String: Any] = [AVURLAssetHTTPUserAgentKey: Net.playerAgent]
        var target = url
        if let resolved, resolved.original == address {
            target = resolved.url
            options["AVURLAssetHTTPHeaderFieldsKey"] = ["Host": resolved.host]
        }
        let asset = AVURLAsset(url: target, options: options)
        let item = AVPlayerItem(asset: asset)
        if let seconds = model?.settings.buffer.seconds, seconds > 0 {
            item.preferredForwardBufferDuration = seconds
        }
        player.replaceCurrentItem(with: item)
        #if DEBUG
        debugProbe(target, item: item)
        #endif
        if startAt > 5 { player.seek(to: CMTime(seconds: startAt, preferredTimescale: 600)) }
        player.play()
        if request.kind == .live { recordLive() }
        observe(item)
    }

    private func observe(_ item: AVPlayerItem) {
        statusObservation?.invalidate()
        statusObservation = Self.watchStatus(item) { [weak self] status in
            Task { @MainActor in
                guard let self, self.player.currentItem === item else { return }
                #if DEBUG
                print("player_item status=\(status.rawValue) error=\(item.error?.localizedDescription ?? "-")")
                #endif
                switch status {
                case .readyToPlay:
                    self.markPlaying()
                case .failed:
                    self.handleFailure(item.error)
                default: break
                }
            }
        }
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        endObserver = NotificationCenter.default.addObserver(forName: AVPlayerItem.didPlayToEndTimeNotification, object: item, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.didFinish() }
        }
    }

    /// Errors that say the stream arrived but iOS cannot decode it: asking for
    /// it again cannot help.
    private static func isUnsupportedFormat(_ error: Error?) -> Bool {
        var current = error as NSError?
        while let e = current {
            if e.domain == "CoreMediaErrorDomain", e.code == 1718449215 { return true } // 'fmt?'
            if e.domain == AVFoundationErrorDomain, [
                AVError.Code.fileFormatNotRecognized.rawValue,
                AVError.Code.decoderNotFound.rawValue,
                AVError.Code.decodeFailed.rawValue,
                AVError.Code.failedToParse.rawValue,
            ].contains(e.code) { return true }
            current = e.userInfo[NSUnderlyingErrorKey] as? NSError
        }
        return false
    }

    // MARK: VLC engine

    private func startVLC(startAt: Double) {
        if engine == .native {
            statusObservation?.invalidate()
            statusObservation = nil
            player.pause()
            player.replaceCurrentItem(with: nil)
        }
        engine = .vlc
        // VLC reads MPEG-TS itself, so live channels keep their original address.
        guard let url = URL(string: request.url) else {
            phase = .failed(t("This address is not valid."))
            return
        }
        vlc.start(url: url, agent: Net.playerAgent, startAt: startAt, bufferSeconds: model?.settings.buffer.seconds ?? 0)
        if request.kind == .live { recordLive() }
    }

    /// The iPhone player could not play this stream: hand it to VLC once.
    private func fallbackToVLC() -> Bool {
        guard !forceVLC else { return false }
        forceVLC = true
        retries = 0
        #if DEBUG
        print("player_fallback engine=vlc")
        #endif
        let resume = request.kind == .live ? 0 : player.currentTime().seconds
        load(startAt: resume.isFinite ? max(resume, request.startAt) : request.startAt)
        return true
    }

    private func vlcEvent(_ event: VLCPlayback.Event) {
        guard engine == .vlc else { return }
        switch event {
        case .playing:
            markPlaying()
        case .progress:
            saveProgress()
        case .ended:
            // A live channel never ends on purpose: treat it as a dropped stream.
            if request.kind == .live { vlcFailed() } else { didFinish() }
        case .error:
            vlcFailed()
        }
    }

    private func vlcFailed() {
        if model?.settings.autoReconnect == true, retries < 3 {
            retries += 1
            phase = .loading
            let resume = request.kind == .live ? 0 : vlc.position
            Task {
                try? await Task.sleep(for: .seconds(2 * retries))
                guard self.engine == .vlc else { return }
                self.load(startAt: resume)
            }
            return
        }
        vlc.stop()
        phase = .failed(t("The stream could not be played."))
        Haptics.error()
    }

    private func handleFailure(_ error: Error?) {
        if Self.isUnsupportedFormat(error), fallbackToVLC() { return }
        if tryResolvedAddress() { return }
        if model?.settings.autoReconnect == true, retries < 3 {
            retries += 1
            phase = .loading
            let resume = request.kind == .live ? 0 : player.currentTime().seconds
            Task {
                try? await Task.sleep(for: .seconds(2 * retries))
                self.load(startAt: resume.isFinite ? resume : 0)
            }
            return
        }
        // Before giving up, VLC gets its turn: it reads many streams the iPhone player refuses.
        if fallbackToVLC() { return }
        phase = .failed(error?.localizedDescription ?? t("The stream could not be played."))
        Haptics.error()
    }

    /// With encrypted DNS on, a plain http stream the player cannot reach is
    /// asked for once more at the address encrypted DNS finds, with its name
    /// in the Host header.
    private func tryResolvedAddress() -> Bool {
        let address = StreamURLs.forPlayback(request.url, kind: request.kind)
        guard EncryptedDNS.isActive, resolvedTried != address,
              let url = URL(string: address), url.scheme?.lowercased() == "http",
              let host = url.host(), !DnsCheck.isIPv4(host) else { return false }
        resolvedTried = address
        phase = .loading
        let resume = request.kind == .live ? 0 : player.currentTime().seconds
        Task {
            let ips = (try? await DnsCheck.dohLookup(host, url: "https://cloudflare-dns.com/dns-query")) ?? []
            guard let ip = ips.first, var parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
                self.handleFailure(nil)
                return
            }
            parts.host = ip
            guard let target = parts.url else { self.handleFailure(nil); return }
            let hostHeader = url.port.map { "\(host):\($0)" } ?? host
            self.resolved = (address, target, hostHeader)
            self.load(startAt: resume.isFinite ? resume : 0)
        }
        return true
    }

    #if DEBUG
    @ObservationIgnored private var debugTokens: [NSObjectProtocol] = []

    private func debugProbe(_ url: URL, item: AVPlayerItem) {
        let parts = url.pathComponents
        print("player_url host=\(url.host() ?? "-") tail=\(parts.suffix(1).joined()) ext=\(url.pathExtension)")
        debugTokens.forEach(NotificationCenter.default.removeObserver)
        debugTokens = [
            NotificationCenter.default.addObserver(forName: AVPlayerItem.newErrorLogEntryNotification, object: item, queue: .main) { _ in
                if let e = item.errorLog()?.events.last {
                    print("player_errlog status=\(e.errorStatusCode) domain=\(e.errorDomain) comment=\(e.errorComment ?? "-") uri=\(URL(string: e.uri ?? "")?.host() ?? "-")")
                }
            },
            NotificationCenter.default.addObserver(forName: AVPlayerItem.newAccessLogEntryNotification, object: item, queue: .main) { _ in
                if let e = item.accessLog()?.events.last {
                    print("player_access server=\(e.serverAddress ?? "-") bitrate=\(Int(e.indicatedBitrate)) stalls=\(e.numberOfStalls)")
                }
            },
        ]
    }
    #endif

    /// Where playback is now, whichever engine plays.
    private var currentSeconds: Double {
        engine == .vlc ? vlc.position : player.currentTime().seconds
    }

    private var durationSeconds: Double {
        engine == .vlc ? vlc.duration : (player.currentItem?.duration.seconds ?? 0)
    }

    func retry() {
        retries = 0
        let now = currentSeconds
        load(startAt: request.kind == .live ? 0 : max(now.isFinite ? now : 0, request.startAt))
    }

    // MARK: Live zapping

    func zap(_ offset: Int) {
        guard let index = currentIndex, !request.channels.isEmpty else { return }
        let next = request.channels[(index + offset + request.channels.count) % request.channels.count]
        switchTo(next)
    }

    func switchTo(_ channel: MediaEntry) {
        request.entryId = channel.id
        request.title = channel.title
        request.url = channel.streamUrl
        request.imageUrl = channel.logoUrl
        request.subtitle = model?.nowPlaying(channel)?.title
        retries = 0
        forceVLC = false
        resolvedTried = nil
        Haptics.select()
        load(startAt: 0)
    }

    private func recordLive() {
        model?.saveProgress(WatchProgress(entryId: request.entryId, title: request.title, imageUrl: request.imageUrl, streamUrl: request.url, kind: .live, position: 0, duration: 0, updated: Date()))
    }

    // MARK: Progress and autoplay

    func saveProgress() {
        guard request.kind != .live else { return }
        let position = currentSeconds
        let duration = durationSeconds
        guard position.isFinite, position > 5, duration.isFinite, duration > 0 else { return }
        model?.saveProgress(WatchProgress(
            entryId: request.entryId, title: request.title, imageUrl: request.imageUrl,
            streamUrl: request.url, kind: request.kind, position: position, duration: duration,
            updated: Date(), season: request.season, episodeNumber: request.episodeNumber,
            episodeTitle: request.subtitle
        ))
    }

    var nextEpisode: Episode? { request.nextEpisodes.first }

    private func didFinish() {
        saveProgress()
        guard request.kind == .series, nextEpisode != nil, model?.settings.autoplayNext == true else { return }
        countdown = 8
        countdownTask = Task { [weak self] in
            while let self, let value = self.countdown, value > 0 {
                try? await Task.sleep(for: .seconds(1))
                if Task.isCancelled { return }
                self.countdown = value - 1
            }
            self?.playNext()
        }
    }

    func cancelCountdown() {
        countdownTask?.cancel()
        countdown = nil
    }

    func playNext() {
        guard let next = nextEpisode else { return }
        countdownTask?.cancel()
        countdown = nil
        request.url = next.streamUrl
        request.season = next.season
        request.episodeNumber = next.number
        request.subtitle = "S\(next.season) · E\(next.number) — \(next.title)"
        request.nextEpisodes.removeFirst()
        forceVLC = false
        resolvedTried = nil
        load(startAt: 0)
    }

    func close() {
        saveProgress()
        statusObservation?.invalidate()
        statusObservation = nil
        rateObservation?.invalidate()
        rateObservation = nil
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        endObserver = nil
        countdownTask?.cancel()
        if let timeObserver { player.removeTimeObserver(timeObserver) }
        timeObserver = nil
        if let tickObserver { player.removeTimeObserver(tickObserver) }
        tickObserver = nil
        player.pause()
        player.replaceCurrentItem(with: nil)
        vlc.onEvent = nil
        vlc.stop()
    }
}

struct PlayerView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let request: PlaybackRequest
    @State private var controller: PlayerController?
    @State private var showChannels = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let controller {
                content(controller)
            }
        }
        .preferredColorScheme(.dark)
        .statusBarHidden()
        .onAppear {
            if controller == nil { controller = PlayerController(request: request, model: model) }
        }
        .onDisappear { controller?.close() }
    }

    @ViewBuilder
    private func content(_ c: PlayerController) -> some View {
        VStack(spacing: 0) {
            topBar(c)
            if let countdown = c.countdown, let next = c.nextEpisode {
                HStack(spacing: 12) {
                    Text(t("Next episode in %d s: %@", countdown, next.title))
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    Spacer()
                    Button(t("Cancel")) { c.cancelCountdown() }
                    Button(t("Play now")) { c.playNext() }
                        .fontWeight(.bold)
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(Nova.purple.opacity(0.35))
                .transition(.move(edge: .top).combined(with: .opacity))
            }
            ZStack {
                if c.engine == .vlc {
                    VLCSurface(playback: c.vlc)
                    if c.phase == .playing {
                        VLCControls(playback: c.vlc, isLive: c.request.kind == .live)
                    }
                } else {
                    PlayerSurface(player: c.player)
                }
                switch c.phase {
                case .loading:
                    ProgressView().controlSize(.large).tint(.white).allowsHitTesting(false)
                case .failed(let message):
                    VStack(spacing: 14) {
                        Image(systemName: "exclamationmark.triangle.fill").font(.largeTitle).foregroundStyle(Nova.amber)
                        Text(message).multilineTextAlignment(.center).foregroundStyle(.white)
                        Button(t("Try again")) { c.retry() }
                            .buttonStyle(.borderedProminent)
                            .tint(Nova.blue)
                    }
                    .padding(24)
                    .frame(maxWidth: 420)
                    .background(.black.opacity(0.75), in: .rect(cornerRadius: 20))
                case .playing:
                    EmptyView()
                }
            }
        }
        .animation(.spring(duration: 0.35), value: c.countdown)
        .sheet(isPresented: $showChannels) {
            NavigationStack {
                List(c.request.channels) { channel in
                    Button {
                        c.switchTo(channel)
                        showChannels = false
                    } label: {
                        ChannelRow(entry: channel, now: Date())
                    }
                    .buttonStyle(.plain)
                    .listRowBackground(channel.id == c.request.entryId ? Nova.greenSoft : Color.clear)
                }
                .listStyle(.plain)
                .navigationTitle(t("Channels"))
                .navigationBarTitleDisplayMode(.inline)
            }
            .presentationDetents([.medium, .large])
        }
    }

    private func topBar(_ c: PlayerController) -> some View {
        HStack(spacing: 14) {
            Button {
                c.close()
                dismiss()
            } label: {
                Image(systemName: "chevron.down")
                    .font(.body.weight(.bold))
                    .frame(width: 38, height: 38)
                    .background(.white.opacity(0.14), in: .circle)
            }
            .accessibilityLabel(t("Close"))
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    if c.request.kind == .live {
                        Text("LIVE")
                            .font(.caption2.weight(.heavy))
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Nova.coral, in: .rect(cornerRadius: 4))
                    }
                    Text(c.request.title).font(.headline).lineLimit(1)
                }
                if let sub = c.request.subtitle, !sub.isEmpty {
                    Text(sub).font(.caption).foregroundStyle(.white.opacity(0.7)).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            if c.request.kind == .live, c.request.channels.count > 1 {
                Button { c.zap(-1) } label: { Image(systemName: "chevron.up") }
                    .accessibilityLabel(t("Previous channel"))
                Button { c.zap(1) } label: { Image(systemName: "chevron.down.circle") }
                    .accessibilityLabel(t("Next channel"))
                Button { showChannels = true } label: { Image(systemName: "list.bullet") }
                    .accessibilityLabel(t("Channels"))
            }
            if c.request.kind == .series, c.nextEpisode != nil {
                Button { c.playNext() } label: { Image(systemName: "forward.end.fill") }
                    .accessibilityLabel(t("Next episode"))
            }
        }
        .font(.title3)
        .foregroundStyle(.white)
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }
}

/// AVPlayerViewController for native controls, AirPlay and Picture in Picture.
struct PlayerSurface: UIViewControllerRepresentable {
    let player: AVPlayer

    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let vc = AVPlayerViewController()
        vc.player = player
        vc.allowsPictureInPicturePlayback = true
        vc.canStartPictureInPictureAutomaticallyFromInline = true
        vc.videoGravity = .resizeAspect
        return vc
    }

    func updateUIViewController(_ vc: AVPlayerViewController, context: Context) {
        if vc.player !== player { vc.player = player }
    }
}
