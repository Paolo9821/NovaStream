import SwiftUI

/// Pseudo-groups shown before the provider's categories.
enum GroupFilter {
    static let all = ""
    static let favourites = "\u{1}fav"
}

/// Horizontal category chips (All, Favourites, provider categories).
struct GroupChips: View {
    @Environment(AppModel.self) private var model
    let kind: MediaKind
    let groups: [String]
    @Binding var selection: String
    var onLocked: (String) -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    chip(GroupFilter.all, t("All"), symbol: "square.grid.2x2")
                    chip(GroupFilter.favourites, t("Favourites"), symbol: "star.fill")
                    ForEach(groups, id: \.self) { group in
                        chip(group, group, symbol: model.isLocked(group) ? "lock.fill" : nil)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 6)
            }
            .onAppear { proxy.scrollTo(selection, anchor: .center) }
        }
    }

    private func chip(_ value: String, _ label: String, symbol: String?) -> some View {
        let active = selection == value
        let accent = Nova.accent(for: kind)
        return Button {
            if model.isLocked(value) { onLocked(value) } else { selection = value }
            Haptics.select()
        } label: {
            HStack(spacing: 5) {
                if let symbol { Image(systemName: symbol).font(.caption2.weight(.bold)) }
                Text(label).lineLimit(1)
            }
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .foregroundStyle(active ? .white : Nova.ink)
            .background(active ? AnyShapeStyle(accent.gradient) : AnyShapeStyle(Nova.surfaceHigh), in: .capsule)
            .overlay { Capsule().strokeBorder(active ? .clear : Nova.hairline) }
        }
        .buttonStyle(PressableStyle())
        .id(value)
    }
}

/// Four-digit PIN entry used by parental control.
struct PinPrompt: View {
    let title: String
    var message: String = ""
    var verify: (String) -> Bool
    var dismissOnSuccess = true
    var onSuccess: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var pin = ""
    @State private var shake = 0
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 22) {
            IconTile(symbol: "lock.fill", color: Nova.amber, size: 56)
            VStack(spacing: 6) {
                Text(title).font(.title3.weight(.bold))
                if !message.isEmpty {
                    Text(message).font(.subheadline).foregroundStyle(Nova.inkSecondary).multilineTextAlignment(.center)
                }
            }
            HStack(spacing: 14) {
                ForEach(0..<4, id: \.self) { i in
                    Circle()
                        .fill(i < pin.count ? Nova.blue : Nova.surfaceHigh)
                        .overlay { Circle().strokeBorder(Nova.hairline) }
                        .frame(width: 18, height: 18)
                }
            }
            .modifier(Shake(animatableData: CGFloat(shake)))
            .background {
                TextField("", text: $pin)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .focused($focused)
                    .opacity(0.01)
                    .frame(width: 1, height: 1)
            }
            .onTapGesture { focused = true }
            Button(t("Cancel")) { dismiss() }
                .font(.subheadline.weight(.semibold))
        }
        .padding(28)
        .onAppear { focused = true }
        .onChange(of: pin) { _, value in
            let digits = String(value.filter(\.isNumber).prefix(4))
            if digits != value { pin = digits; return }
            guard digits.count == 4 else { return }
            if verify(digits) {
                Haptics.success()
                onSuccess(digits)
                if dismissOnSuccess { dismiss() }
            } else {
                Haptics.error()
                withAnimation(.default) { shake += 1 }
                pin = ""
            }
        }
        .presentationDetents([.height(320)])
    }
}

struct Shake: GeometryEffect {
    var animatableData: CGFloat
    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: 10 * sin(animatableData * .pi * 4), y: 0))
    }
}

/// Choose a new PIN, then type it again to confirm.
struct SetPinSheet: View {
    var onDone: (String) -> Void
    @State private var first: String?

    var body: some View {
        PinPrompt(
            title: first == nil ? t("Choose a PIN") : t("Confirm PIN"),
            message: first == nil ? t("4 digits, to unlock protected categories.") : t("Type the same PIN again."),
            verify: { pin in first.map { $0 == pin } ?? true },
            dismissOnSuccess: first != nil,
            onSuccess: { pin in
                if first != nil { onDone(pin) } else { first = pin }
            }
        )
        .id(first == nil ? 0 : 1)
    }
}

extension View {
    /// Asks for the parental PIN, then unlocks locked groups for the session.
    func parentalPrompt(isPresented: Binding<Bool>, model: AppModel, onSuccess: @escaping () -> Void) -> some View {
        sheet(isPresented: isPresented) {
            PinPrompt(
                title: t("Enter PIN"),
                message: t("This category is protected by parental control."),
                verify: { $0 == model.settings.parentalPin },
                onSuccess: { _ in
                    model.parentalUnlocked = true
                    onSuccess()
                }
            )
        }
    }
}
