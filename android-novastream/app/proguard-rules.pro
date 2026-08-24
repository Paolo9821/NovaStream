# ============================================================================
# NovaStream — R8 configuration for the release bundle.
#
# The app is fully shrunk and obfuscated. Only the pieces below are protected,
# because they are reached through reflection, through serialization, or
# because their *names* are written to persistent storage and must survive an
# app update (licence records, trial clock, cached catalogues).
#
# Upload build/outputs/mapping/release/mapping.txt to Play Console so crash
# stack traces stay readable.
# ============================================================================

# Keep the original source file name / line numbers in stack traces.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Annotations, generics and Kotlin metadata are needed by serialization and
# by Compose/coroutines internals.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,RuntimeVisible*Annotations,AnnotationDefault

# ----------------------------------------------------------------------------
# Application entry points (instantiated by the framework, by name)
# ----------------------------------------------------------------------------
-keep class com.rork.novastream.NovaStreamApp { *; }
-keep class com.rork.novastream.MainActivity { *; }

# ----------------------------------------------------------------------------
# Licensing, hardware identity and 7-day trial
#
# LicenseStore persists `RemoteStatus.name` and the device id inside the sealed
# record, and reads it back with `RemoteStatus.valueOf(...)`. If R8 renamed the
# enum constants, every already-activated device would fail to recognise its
# own licence after an update and fall back to the trial gate. The MAC/hardware
# id derivation is kept for the same reason: its output is the licence key of
# the device and must stay byte-for-byte identical across releases.
# ----------------------------------------------------------------------------
-keep class com.rork.novastream.data.local.DeviceIdentity { *; }
-keep class com.rork.novastream.data.local.DeviceIdentityResolver { *; }
-keep class com.rork.novastream.data.local.LicenseStore { *; }
-keep class com.rork.novastream.data.local.LicenseState { *; }
-keep class com.rork.novastream.data.local.LicenseStatus { *; }
-keep class com.rork.novastream.data.local.LicenseStatus$* { *; }
-keep class com.rork.novastream.data.local.SecureStore { *; }
-keep class com.rork.novastream.data.local.SettingsStore { *; }
-keep class com.rork.novastream.data.local.CrashReporter { *; }
-keep class com.rork.novastream.data.remote.LicenseApi { *; }
-keep class com.rork.novastream.data.remote.RemoteLicense { *; }
-keep class com.rork.novastream.data.remote.LicenseCheck { *; }
-keep class com.rork.novastream.data.remote.LicenseCheck$* { *; }

# Enum constant names of this app are part of the on-disk format
# (licence status, account type, media kind, block reason, sort order).
-keep enum com.rork.novastream.** { *; }
-keepclassmembers enum com.rork.novastream.** {
    public static **[] values();
    public static ** valueOf(java.lang.String);
    <fields>;
}

# Android Keystore / AES-256-GCM sealing of the credentials and licence cache.
-keep class javax.crypto.** { *; }
-keep class java.security.** { *; }
-dontwarn javax.crypto.**

# ----------------------------------------------------------------------------
# Data models: M3U / Xtream parsing, EPG and networking payloads
#
# Every model is @Serializable and is stored as JSON on disk; property and enum
# names are the wire format, so they cannot be renamed.
# ----------------------------------------------------------------------------
-keep class com.rork.novastream.data.model.** { *; }
-keep class com.rork.novastream.data.parser.** { *; }
-keep class com.rork.novastream.data.remote.XtreamClient { *; }
# Xtream response models and their lenient string serializer.
-keep class com.rork.novastream.data.remote.XtreamCategoryDto { *; }
-keep class com.rork.novastream.data.remote.XtreamLiveDto { *; }
-keep class com.rork.novastream.data.remote.XtreamVodDto { *; }
-keep class com.rork.novastream.data.remote.XtreamSeriesDto { *; }
-keep class com.rork.novastream.data.remote.LooseText { *; }
-keep class com.rork.novastream.data.repo.** { *; }
-keep class com.rork.novastream.data.net.** { *; }

# kotlinx.serialization — generated serializers are looked up reflectively.
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault
-keepclassmembers class **$WhenMappings { <fields>; }
-keepclassmembers @kotlinx.serialization.Serializable class * {
    static <1>$$serializer INSTANCE;
    kotlinx.serialization.KSerializer serializer(...);
    *** Companion;
}
-keep,includedescriptorclasses class com.rork.novastream.**$$serializer { *; }
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1> {
    static **$* *;
}
-keepclassmembers class <1>$Companion {
    kotlinx.serialization.KSerializer serializer(...);
}
-dontnote kotlinx.serialization.**

# Ktor client (no consumer rules shipped): the Android engine and its config
# are resolved through a service-loader style factory.
-keep class io.ktor.client.engine.android.** { *; }
-keep class io.ktor.client.HttpClient { *; }
-keep class io.ktor.client.HttpClientConfig { *; }
-keepclassmembers class io.ktor.** { volatile <fields>; }
-dontwarn io.ktor.**
-dontwarn org.slf4j.**
-dontwarn kotlinx.io.**
-dontwarn java.lang.management.**

# XMLTV parsing uses the platform XmlPullParser factory (reflective lookup).
-keep class org.xmlpull.v1.** { *; }
-keep class org.kxml2.** { *; }
-dontwarn org.xmlpull.v1.**

# ----------------------------------------------------------------------------
# Video player: Media3 / ExoPlayer + HLS, and the Android TV surfaces
#
# media3 ships consumer rules for its reflective renderer/decoder loading; the
# rules below additionally pin the pieces this app touches directly, so track
# selection, HLS playback and the PlayerView surface can never be stripped.
# ----------------------------------------------------------------------------
-keep class androidx.media3.common.** { *; }
-keep class androidx.media3.exoplayer.ExoPlayer { *; }
-keep class androidx.media3.exoplayer.ExoPlayer$Builder { *; }
-keep class androidx.media3.exoplayer.DefaultRenderersFactory { *; }
-keep class androidx.media3.exoplayer.DefaultLoadControl { *; }
-keep class androidx.media3.exoplayer.DefaultLoadControl$Builder { *; }
-keep class androidx.media3.exoplayer.hls.** { *; }
-keep class androidx.media3.exoplayer.source.** { *; }
-keep class androidx.media3.exoplayer.trackselection.** { *; }
-keep class androidx.media3.datasource.** { *; }
-keep class androidx.media3.extractor.** { *; }
-keep class androidx.media3.ui.PlayerView { *; }
-keepclassmembers class androidx.media3.ui.** {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
    public <init>(android.content.Context, android.util.AttributeSet, int);
}
-keep interface androidx.media3.common.Player$Listener { *; }
-keep class * implements androidx.media3.common.Player$Listener { *; }
-dontwarn androidx.media3.**

# Every custom View kept for XML/reflective inflation on TV surfaces.
-keepclasseswithmembers class * extends android.view.View {
    public <init>(android.content.Context, android.util.AttributeSet);
    public <init>(android.content.Context, android.util.AttributeSet, int);
}

# Android TV: leanback launcher entry and D-pad focus handling live in Compose,
# but the manifest-declared banner/leanback feature must not warn.
-dontwarn android.support.**
-keep class androidx.compose.ui.platform.** { *; }

# ----------------------------------------------------------------------------
# Third-party
# ----------------------------------------------------------------------------
# ZXing — QR code shown on Android TV to move the purchase to a phone.
-keep class com.google.zxing.** { *; }
-dontwarn com.google.zxing.**

# Coil 3 image loading (ships consumer rules; silence optional integrations).
-dontwarn coil3.**
-dontwarn okhttp3.**
-dontwarn okio.**

# Kotlin coroutines internals touched reflectively by the debug agent.
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }
-dontwarn kotlinx.coroutines.**

# Keep Compose runtime annotations used by the compiler-generated code.
-dontwarn androidx.compose.**
