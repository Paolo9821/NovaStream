import SwiftUI
import UIKit

/// NovaStream palette, ported from the Android theme. Dark is the house style;
/// every colour also has a light counterpart that follows the chosen scheme.
enum Nova {
    static let canvas = dyn(light: 0xF7F8FA, dark: 0x0B0F1A)
    static let surface = dyn(light: 0xFFFFFF, dark: 0x151B29)
    static let surfaceHigh = dyn(light: 0xF1F3F7, dark: 0x1C222D)
    static let surfaceLow = dyn(light: 0xFBFCFD, dark: 0x11161F)
    static let hairline = dyn(light: 0xE5E7EB, dark: 0x262D3A)
    static let ink = dyn(light: 0x111827, dark: 0xF3F4F6)
    static let inkSecondary = dyn(light: 0x6B7280, dark: 0x9CA3AF)

    static let blue = dyn(light: 0x2563EB, dark: 0x6E9BFF)
    static let blueSoft = dyn(light: 0xDCE7FF, dark: 0x1C2C4C)
    static let green = dyn(light: 0x10B981, dark: 0x3DDCA4)
    static let greenSoft = dyn(light: 0xD5F5E8, dark: 0x102A22)
    static let purple = dyn(light: 0x7C6CE0, dark: 0xA79BF5)
    static let purpleSoft = dyn(light: 0xE6E2FB, dark: 0x241F45)
    static let amber = dyn(light: 0xF59E0B, dark: 0xFBBF24)
    static let amberSoft = dyn(light: 0xFDF3D3, dark: 0x33290A)
    static let coral = dyn(light: 0xFF6B5B, dark: 0xFF8A7A)
    static let danger = dyn(light: 0xDC2626, dark: 0xF87171)

    static func accent(for kind: MediaKind) -> Color {
        switch kind {
        case .live: green
        case .movie: blue
        case .series: purple
        }
    }

    static func soft(for kind: MediaKind) -> Color {
        switch kind {
        case .live: greenSoft
        case .movie: blueSoft
        case .series: purpleSoft
        }
    }

    private static func dyn(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

extension MediaKind {
    var symbol: String {
        switch self {
        case .live: "play.tv.fill"
        case .movie: "film.fill"
        case .series: "tv.fill"
        }
    }

    var title: String {
        switch self {
        case .live: t("Live TV")
        case .movie: t("Movies")
        case .series: t("TV Series")
        }
    }
}

/// Rounded surface used for every card in the app.
struct NovaCard<Content: View>: View {
    var padding: CGFloat = 16
    var tint: Color? = nil
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Nova.surface)
                    .overlay {
                        if let tint {
                            RoundedRectangle(cornerRadius: 22, style: .continuous)
                                .fill(LinearGradient(colors: [tint.opacity(0.16), tint.opacity(0.02)], startPoint: .topLeading, endPoint: .bottomTrailing))
                        }
                    }
            }
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .strokeBorder((tint ?? Nova.hairline).opacity(tint == nil ? 1 : 0.35), lineWidth: 1)
            }
    }
}

/// Coloured square with a symbol, as on the Android home cards.
struct IconTile: View {
    let symbol: String
    let color: Color
    var size: CGFloat = 52

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(color.gradient, in: .rect(cornerRadius: size * 0.3, style: .continuous))
    }
}

/// Small rounded label (m3u, Xtream, 4K…).
struct Chip: View {
    let text: String
    var color: Color = Nova.inkSecondary

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(color)
            .background(color.opacity(0.14), in: .capsule)
    }
}

/// Springy press feedback for custom tappable surfaces.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

/// Primary filled button used for the main action of a screen.
struct PrimaryButtonStyle: ButtonStyle {
    var color: Color = Nova.blue
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(color.gradient, in: .rect(cornerRadius: 16, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

/// Atmospheric backdrop: navy canvas with soft blue and mint glows.
struct NovaBackdrop: View {
    var body: some View {
        ZStack {
            Nova.canvas
            RadialGradient(colors: [Nova.blue.opacity(0.16), .clear], center: .topLeading, startRadius: 0, endRadius: 420)
            RadialGradient(colors: [Nova.green.opacity(0.08), .clear], center: .bottomTrailing, startRadius: 0, endRadius: 380)
        }
        .ignoresSafeArea()
    }
}

/// Remote poster or logo with a tidy placeholder.
struct RemoteImage: View {
    let url: String?
    var kind: MediaKind = .movie
    var title: String = ""
    var contentMode: ContentMode = .fill

    var body: some View {
        Group {
            if let url, let parsed = URL(string: url) {
                AsyncImage(url: parsed, transaction: Transaction(animation: .easeOut(duration: 0.2))) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().aspectRatio(contentMode: contentMode)
                    default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
    }

    private var placeholder: some View {
        ZStack {
            LinearGradient(colors: [Nova.accent(for: kind).opacity(0.55), Nova.accent(for: kind).opacity(0.18)], startPoint: .topLeading, endPoint: .bottomTrailing)
            Text(initials)
                .font(.system(size: 22, weight: .heavy, design: .rounded))
                .foregroundStyle(.white.opacity(0.92))
                .minimumScaleFactor(0.5)
                .padding(6)
        }
    }

    private var initials: String {
        let words = title.split(separator: " ").prefix(2)
        let letters = words.compactMap { $0.first }.map { String($0) }.joined()
        return letters.isEmpty ? "NS" : letters.uppercased()
    }
}

struct EmptyStateView: View {
    let symbol: String
    let title: String
    let message: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: symbol)
        } description: {
            Text(message)
        } actions: {
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(.borderedProminent)
                    .tint(Nova.blue)
            }
        }
    }
}
