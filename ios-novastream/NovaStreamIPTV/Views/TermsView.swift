import SwiftUI

/// Binding terms wording, kept in English on every language as on Android.
struct TermsView: View {
    @Environment(\.dismiss) private var dismiss

    private let intro = "Welcome. Before using this application, you must read, understand, and agree to the following Terms and Conditions:"
    private let clauses: [(String, String)] = [
        ("1. Disclaimer of Liability for Unlawful or Misuse:",
         "This application is provided on an 'as is' and 'as available' basis. It is intended solely for lawful, personal use in compliance with all applicable laws and regulations. The creator, developer, and distributor of this application shall not be held liable or responsible for any unlawful, unauthorized, or improper use of the application, or for any activity carried out by the user."),
        ("2. No Media Included:",
         "This application functions purely as a media player tool. It DOES NOT contain, provide, host, distribute, or promote any streams, channel lists, playlists, subscriptions, or copyrighted material. The user assumes sole and full legal responsibility for all content, links, or files loaded into, processed by, or viewed within the application."),
        ("3. Copyright Compliance:",
         "By using this app, you warrant and represent that you will not infringe upon any third-party intellectual property or copyright laws. The creator disclaims any and all liability arising from copyright violations or illegal streaming performed by users."),
    ]
    private let closing = "By continuing, you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions in their entirety."

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text(intro).font(.body.weight(.medium))
                ForEach(clauses, id: \.0) { clause in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(clause.0).font(.headline)
                        Text(clause.1).foregroundStyle(Nova.inkSecondary)
                    }
                }
                Text(closing).font(.callout).foregroundStyle(Nova.inkSecondary)
                HStack(spacing: 20) {
                    Link(t("Terms of Use"), destination: URL(string: "https://www.novastreamapp.com/terms")!)
                    Link(t("Privacy Policy"), destination: URL(string: "https://www.novastreamapp.com/privacy")!)
                }
                .font(.subheadline.weight(.semibold))
            }
            .padding(20)
            .frame(maxWidth: 680, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(Nova.canvas)
        .navigationTitle(t("Terms of use"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(t("Done")) { dismiss() }
            }
        }
    }
}
