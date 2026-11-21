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

    let player = AVPlayer()
    private(set) var request: PlaybackRequest
    private(set) var phase: Phase = .loading
    private(set) var countdown: Int?
    var showChannels = false

    @ObservationIgnored private weak var model: AppModel?
    @ObservationIgnored private var timeObserver: Any?
    @ObservationIgnored private var statusTask: Task<Void, Never>?
    @ObservationIgnored private var endTask: Task<Void, Never>?
    @ObservationIgnored private var countdownTask: Task<Void, Never>?
    @ObservationIgnored private var retries = 0

    init(request: PlaybackRequest, model: AppModel) {
        self.request = request
        self.model = model
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
        try? AVAudioSession.sharedInstance().setActive(true)
        timeObserver = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 10, preferredTimescale: 1), queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.saveProgress() }
        }
        load(startAt: request.startAt)
    }

    var currentIndex: Int? { request.channels.firstIndex { $0.id == request.entryId } }

    func load(startAt: Double) {
        phase = .loading
        countdown = nil
        countdownTask?.cancel()
        guard let url = URL(string: StreamURLs.forPlayback(request.url, kind: request.kind)) else {
            phase = .failed(t("This address is not valid."))
            return
        }
        let item = AVPlayerItem(url: url)
        if let seconds = model?.settings.buffer.seconds, seconds > 0 {
            item.preferredForwardBufferDuration = seconds
        }
        player.replaceCurrentItem(with: item)
        if startAt > 5 { player.seek(to: CMTime(seconds: startAt, preferredTimescale: 600)) }
        player.play()
        if request.kind == .live { recordLive() }
        observe(item)
    }

    private func observe(_ item: AVPlayerItem) {
        statusTask?.cancel()
        statusTask = Task { [weak self] in
            for await status in item.publisher(for: \.status).values {
                guard let self else { return }
                switch status {
                case .readyToPlay:
                    self.phase = .playing
                    self.retries = 0
                case .failed:
                    self.handleFailure(item.error)
                default: break
                }
            }
        }
        endTask?.cancel()
        endTask = Task { [weak self] in
            for await _ in NotificationCenter.default.notifications(named: AVPlayerItem.didPlayToEndTimeNotification, object: item) {
                self?.didFinish()
            }
        }
    }

    private func handleFailure(_ error: Error?) {
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
        let ext = URL(string: request.url)?.pathExtension.lowercased() ?? ""
        if ["mkv", "avi", "wmv", "flv"].contains(ext) {
            phase = .failed(t("This video format (%@) is not supported by the iPhone player.", ext.uppercased()))
        } else {
            phase = .failed(error?.localizedDescription ?? t("The stream could not be played."))
        }
        Haptics.error()
    }

    func retry() {
        retries = 0
        load(startAt: request.kind == .live ? 0 : max(player.currentTime().seconds, request.startAt))
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
        Haptics.select()
        load(startAt: 0)
    }

    private func recordLive() {
        model?.saveProgress(WatchProgress(entryId: request.entryId, title: request.title, imageUrl: request.imageUrl, streamUrl: request.url, kind: .live, position: 0, duration: 0, updated: Date()))
    }

    // MARK: Progress and autoplay

    func saveProgress() {
        guard request.kind != .live, let item = player.currentItem else { return }
        let position = player.currentTime().seconds
        let duration = item.duration.seconds
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
        load(startAt: 0)
    }

    func close() {
        saveProgress()
        statusTask?.cancel()
        endTask?.cancel()
        countdownTask?.cancel()
        if let timeObserver { player.removeTimeObserver(timeObserver) }
        timeObserver = nil
        player.pause()
        player.replaceCurrentItem(with: nil)
    }
}

struct PlayerView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let request: PlaybackRequest
    @State private var controller: PlayerController?

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
        @Bindable var c = c
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
                PlayerSurface(player: c.player)
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
        .sheet(isPresented: $c.showChannels) {
            NavigationStack {
                List(c.request.channels) { channel in
                    Button {
                        c.switchTo(channel)
                        c.showChannels = false
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
                Button { c.showChannels = true } label: { Image(systemName: "list.bullet") }
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
