import SwiftUI
import UIKit
import MobileVLCKit
import Observation

/// Second playback engine, built on VLC: it reads the containers and codecs the
/// iPhone player refuses (MKV, AVI, WMV, FLV, WebM, MPEG-TS, AC3/DTS audio,
/// MPEG-2 or VC-1 video...).
@Observable
final class VLCPlayback {
    enum Event { case playing, ended, error, progress }

    struct Track: Identifiable, Hashable {
        let id: Int32
        let name: String
    }

    private(set) var isPlaying = false
    private(set) var position: Double = 0
    private(set) var duration: Double = 0
    private(set) var audioTracks: [Track] = []
    private(set) var subtitleTracks: [Track] = []
    private(set) var currentAudio: Int32 = -1
    private(set) var currentSubtitle: Int32 = -1

    /// Surface the video is drawn into.
    @ObservationIgnored let view: UIView = {
        let view = UIView()
        view.backgroundColor = .black
        return view
    }()
    @ObservationIgnored var onEvent: ((Event) -> Void)?
    @ObservationIgnored private var player: VLCMediaPlayer?
    @ObservationIgnored private var timer: Timer?
    @ObservationIgnored private var reported = false
    @ObservationIgnored private var finished = false
    @ObservationIgnored private var lastPosition: Double = -1
    @ObservationIgnored private var lastSave: Date = .distantPast

    var isActive: Bool { player != nil }

    func start(url: URL, agent: String, startAt: Double, bufferSeconds: Double) {
        stop()
        let player = VLCMediaPlayer()
        player.drawable = view
        let media = VLCMedia(url: url)
        media.addOption(":http-user-agent=\(agent)")
        media.addOption(":http-reconnect")
        let caching = Int(max(bufferSeconds, 1.5) * 1000)
        media.addOption(":network-caching=\(caching)")
        if startAt > 5 { media.addOption(":start-time=\(Int(startAt))") }
        player.media = media
        self.player = player
        reported = false
        finished = false
        lastPosition = -1
        position = max(startAt, 0)
        duration = 0
        audioTracks = []
        subtitleTracks = []
        #if DEBUG
        print("vlc_start host=\(url.host() ?? "-") ext=\(url.pathExtension)")
        #endif
        player.play()
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.poll() }
        }
    }

    private func poll() {
        guard let player else { return }
        isPlaying = player.isPlaying
        let seconds = Double(player.time.intValue) / 1000
        if seconds.isFinite, seconds >= 0 { position = seconds }
        let length = Double(player.media?.length.intValue ?? 0) / 1000
        if length > 0 { duration = length }
        refreshTracks(player)

        switch player.state {
        case .error:
            guard !finished else { return }
            finished = true
            #if DEBUG
            print("vlc_state error")
            #endif
            onEvent?(.error)
            return
        case .ended:
            guard !finished else { return }
            finished = true
            onEvent?(.ended)
            return
        default:
            break
        }
        if !reported, player.isPlaying, lastPosition >= 0, position > lastPosition {
            reported = true
            #if DEBUG
            print("vlc_state playing duration=\(Int(duration))")
            #endif
            onEvent?(.playing)
        }
        lastPosition = position
        if Date().timeIntervalSince(lastSave) > 10 {
            lastSave = Date()
            onEvent?(.progress)
        }
    }

    private func refreshTracks(_ player: VLCMediaPlayer) {
        let audio = Self.tracks(player.audioTrackIndexes, player.audioTrackNames)
        if audio != audioTracks { audioTracks = audio }
        let subs = Self.tracks(player.videoSubTitlesIndexes, player.videoSubTitlesNames)
        if subs != subtitleTracks { subtitleTracks = subs }
        currentAudio = player.currentAudioTrackIndex
        currentSubtitle = player.currentVideoSubTitleIndex
    }

    private static func tracks(_ ids: [Any]?, _ names: [Any]?) -> [Track] {
        let ids = (ids ?? []).compactMap { ($0 as? NSNumber)?.int32Value }
        let names = (names ?? []).map { "\($0)" }
        return zip(ids, names).map { Track(id: $0.0, name: $0.1) }
    }

    // MARK: Controls

    func togglePlay() {
        guard let player else { return }
        if player.isPlaying { player.pause() } else { player.play() }
        isPlaying = !player.isPlaying
    }

    func pause() { player?.pause() }

    func jump(_ seconds: Int32) {
        guard let player else { return }
        if seconds >= 0 { player.jumpForward(seconds) } else { player.jumpBackward(-seconds) }
    }

    func seek(to seconds: Double) {
        guard let player else { return }
        position = seconds
        player.time = VLCTime(int: Int32(max(seconds, 0) * 1000))
    }

    func selectAudio(_ id: Int32) {
        player?.currentAudioTrackIndex = id
        currentAudio = id
    }

    func selectSubtitle(_ id: Int32) {
        player?.currentVideoSubTitleIndex = id
        currentSubtitle = id
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        if let player {
            player.stop()
            player.drawable = nil
        }
        player = nil
        isPlaying = false
    }
}

/// Hosts the view VLC draws into.
struct VLCSurface: UIViewRepresentable {
    let playback: VLCPlayback

    func makeUIView(context: Context) -> UIView {
        let container = UIView()
        container.backgroundColor = .black
        attach(playback.view, to: container)
        return container
    }

    func updateUIView(_ container: UIView, context: Context) {
        if playback.view.superview !== container { attach(playback.view, to: container) }
    }

    private func attach(_ view: UIView, to container: UIView) {
        view.removeFromSuperview()
        view.frame = container.bounds
        view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        container.addSubview(view)
    }
}

/// Play/pause, ±10 s, a seek bar and audio and subtitle tracks for the VLC engine.
struct VLCControls: View {
    let playback: VLCPlayback
    let isLive: Bool
    @State private var visible = true
    @State private var scrub: Double?
    @State private var hideTask: Task<Void, Never>?

    var body: some View {
        ZStack {
            Color.clear
                .contentShape(.rect)
                .onTapGesture { toggle() }
            if visible {
                controls
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: visible)
        .onAppear { scheduleHide() }
        .onDisappear { hideTask?.cancel() }
    }

    private var controls: some View {
        VStack {
            Spacer()
            HStack(spacing: 44) {
                if !isLive {
                    button("gobackward.10", t("Back 10 seconds")) { playback.jump(-10) }
                }
                button(playback.isPlaying ? "pause.fill" : "play.fill", playback.isPlaying ? t("Pause") : t("Play"), size: 34) {
                    playback.togglePlay()
                    Haptics.select()
                }
                if !isLive {
                    button("goforward.10", t("Forward 10 seconds")) { playback.jump(10) }
                }
            }
            Spacer()
            VStack(spacing: 6) {
                if !isLive, playback.duration > 0 {
                    Slider(
                        value: Binding(
                            get: { scrub ?? min(playback.position, playback.duration) },
                            set: { scrub = $0 }
                        ),
                        in: 0...playback.duration
                    ) { editing in
                        if editing {
                            hideTask?.cancel()
                        } else if let value = scrub {
                            playback.seek(to: value)
                            scrub = nil
                            scheduleHide()
                        }
                    }
                    .tint(Nova.blue)
                }
                HStack {
                    if !isLive, playback.duration > 0 {
                        Text("\(Self.format(scrub ?? playback.position)) / \(Self.format(playback.duration))")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.white.opacity(0.85))
                    }
                    Spacer()
                    if playback.audioTracks.count > 1 {
                        Menu {
                            Picker(t("Audio"), selection: Binding(get: { playback.currentAudio }, set: { playback.selectAudio($0) })) {
                                ForEach(playback.audioTracks) { Text($0.name).tag($0.id) }
                            }
                        } label: {
                            Image(systemName: "speaker.wave.2.fill").frame(width: 40, height: 36)
                        }
                        .accessibilityLabel(t("Audio"))
                    }
                    if !playback.subtitleTracks.isEmpty {
                        Menu {
                            Picker(t("Subtitles"), selection: Binding(get: { playback.currentSubtitle }, set: { playback.selectSubtitle($0) })) {
                                ForEach(playback.subtitleTracks) { track in
                                    Text(track.id < 0 ? t("Off") : track.name).tag(track.id)
                                }
                            }
                        } label: {
                            Image(systemName: "captions.bubble.fill").frame(width: 40, height: 36)
                        }
                        .accessibilityLabel(t("Subtitles"))
                    }
                }
                .foregroundStyle(.white)
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 12)
            .padding(.top, 28)
            .background(LinearGradient(colors: [.clear, .black.opacity(0.7)], startPoint: .top, endPoint: .bottom))
        }
    }

    private func button(_ symbol: String, _ label: String, size: CGFloat = 26, action: @escaping () -> Void) -> some View {
        Button {
            action()
            scheduleHide()
        } label: {
            Image(systemName: symbol)
                .font(.system(size: size, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 64, height: 64)
                .background(.black.opacity(0.35), in: .circle)
        }
        .accessibilityLabel(label)
    }

    private func toggle() {
        visible.toggle()
        if visible { scheduleHide() }
    }

    private func scheduleHide() {
        hideTask?.cancel()
        hideTask = Task {
            try? await Task.sleep(for: .seconds(4))
            if Task.isCancelled { return }
            if playback.isPlaying, scrub == nil { visible = false }
        }
    }

    static func format(_ seconds: Double) -> String {
        guard seconds.isFinite else { return "0:00" }
        let total = Int(max(seconds, 0))
        let h = total / 3600, m = (total % 3600) / 60, s = total % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
    }
}
