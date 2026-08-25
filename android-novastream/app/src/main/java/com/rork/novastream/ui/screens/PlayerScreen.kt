package com.rork.novastream.ui.screens

import android.view.ViewGroup
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Forward10
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Replay10
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.SkipPrevious
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.rork.novastream.data.model.Episode
import com.rork.novastream.data.model.MediaEntry
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.ui.components.rememberFocusRequester
import com.rork.novastream.ui.components.tvFocusFrame
import com.rork.novastream.ui.i18n.LocalStrings
import com.rork.novastream.ui.vm.AppViewModel
import kotlinx.coroutines.delay
import java.util.Locale

private const val CONTROLS_TIMEOUT_MS = 4_000L
private const val SEEK_STEP_MS = 10_000L

/**
 * Grace period after the last D-pad press before the jump is actually made, so
 * holding left or right scrubs in one go instead of firing a seek per press.
 */
private const val SEEK_COMMIT_DELAY_MS = 400L

/** How often playback position is written down while watching. */
private const val PROGRESS_SAVE_INTERVAL_MS = 15_000L

/** How many times a dropped stream is picked up again before giving up. */
private const val MAX_RECONNECT_ATTEMPTS = 6

/** A stream stuck buffering this long is treated as dead and reopened. */
private const val STALL_TIMEOUT_MS = 18_000L

/** Backoff between attempts: 2s, 4s, 8s, then a steady 12s. */
private fun reconnectDelayMs(attempt: Int): Long =
    (2_000L shl (attempt - 1).coerceIn(0, 3)).coerceAtMost(12_000L)

@OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(
    viewModel: AppViewModel,
    entryId: String,
    streamUrl: String,
    onBack: () -> Unit,
) {
    val strings = LocalStrings.current
    val context = LocalContext.current
    val haptics = LocalHapticFeedback.current
    val settings by viewModel.settings.collectAsStateWithLifecycle()

    // What is on screen right now. It starts from what was opened, then follows
    // the viewer as they zap channels or move through a series without ever
    // leaving the player.
    var activeEntryId by remember(entryId) { mutableStateOf(entryId) }
    var activeStreamUrl by remember(streamUrl) { mutableStateOf(streamUrl) }
    val entry = remember(activeEntryId) { viewModel.entryById(activeEntryId) }

    var error by remember { mutableStateOf<String?>(null) }
    var buffering by remember { mutableStateOf(true) }
    var isPlaying by remember { mutableStateOf(true) }
    var controlsVisible by remember { mutableStateOf(true) }
    var positionMs by remember { mutableLongStateOf(0L) }
    var durationMs by remember { mutableLongStateOf(0L) }
    var scrubbing by remember { mutableStateOf(false) }
    var scrubValue by remember { mutableFloatStateOf(0f) }
    /** Auto-recovery state: a weak line should not end the evening. */
    var reconnecting by remember(streamUrl) { mutableStateOf(false) }
    var reconnectAttempt by remember(streamUrl) { mutableIntStateOf(0) }
    var reconnectTick by remember(streamUrl) { mutableIntStateOf(0) }
    var resumePositionMs by remember(streamUrl) { mutableLongStateOf(0L) }
    /** Bumped on every interaction so the auto-hide countdown restarts. */
    var interactionTick by remember { mutableLongStateOf(0L) }
    /** Pending D-pad jump: shown right away, applied once the presses stop. */
    var pendingSeekMs by remember(streamUrl) { mutableStateOf<Long?>(null) }

    /** Where this title was left last time, 0 when it should start from the top. */
    val resumeFromMs = remember(activeEntryId, activeStreamUrl) {
        viewModel.resumePositionFor(activeEntryId, activeStreamUrl)
    }
    var resumeNoticeVisible by remember(activeStreamUrl) { mutableStateOf(resumeFromMs > 0L) }

    // One player for the whole session. Rebuilding it on every channel change
    // detached the video surface, which is why a zap used to leave the sound
    // playing over a black picture; only a settings change rebuilds it now.
    val player = remember(settings.bufferSeconds, settings.hardwareDecoding) {
        val bufferMs = settings.bufferSeconds * 1000
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                bufferMs.coerceAtLeast(5_000),
                (bufferMs * 2).coerceAtLeast(20_000),
                1_500,
                3_000,
            )
            .build()

        val renderersFactory = DefaultRenderersFactory(context).setExtensionRendererMode(
            if (settings.hardwareDecoding) DefaultRenderersFactory.EXTENSION_RENDERER_MODE_OFF
            else DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER
        )

        ExoPlayer.Builder(context, renderersFactory)
            .setLoadControl(loadControl)
            .build()
            .apply {
                // Keeps the box awake while a stream is running: without it a TV
                // suspends the CPU and the picture dies mid-programme.
                setWakeMode(C.WAKE_MODE_NETWORK)
                playWhenReady = true
            }
    }

    // Loads whatever should be on screen into the running player, so switching
    // channel or episode swaps the source and keeps the same video surface.
    LaunchedEffect(player, activeStreamUrl) {
        buffering = true
        player.stop()
        player.setMediaItem(MediaItem.fromUri(activeStreamUrl))
        player.prepare()
        // Picks the film back up where it was left instead of restarting it.
        if (resumeFromMs > 0L) player.seekTo(resumeFromMs)
        player.playWhenReady = true
    }

    /** Set when the stream reaches its natural end, to offer what comes next. */
    var playbackEnded by remember(activeStreamUrl) { mutableStateOf(false) }
    var upNextDismissed by remember(activeStreamUrl) { mutableStateOf(false) }
    var secondsLeft by remember(activeStreamUrl) { mutableIntStateOf(0) }

    fun showControls() {
        controlsVisible = true
        interactionTick += 1
    }

    val isLiveStream = entry?.kind == MediaKind.LIVE
    val isSeries = entry?.kind == MediaKind.SERIES

    // Episodes of the series being watched, so the player can move on by itself
    // and offer previous/next without going back to the series page.
    val episodes by viewModel.episodes.collectAsStateWithLifecycle()
    LaunchedEffect(entry?.id) {
        entry?.let { if (it.kind == MediaKind.SERIES) viewModel.loadEpisodes(it) }
    }

    // The episode on screen, so the history remembers exactly where the series
    // was left and can offer to carry on from its page.
    val currentEpisode = remember(episodes, activeStreamUrl, isSeries) {
        if (isSeries) episodes.firstOrNull { it.streamUrl == activeStreamUrl } else null
    }

    val nextEpisode = remember(episodes, activeStreamUrl, isSeries) {
        if (isSeries) viewModel.episodeNeighbour(activeStreamUrl, 1) else null
    }
    val previousEpisode = remember(episodes, activeStreamUrl, isSeries) {
        if (isSeries) viewModel.episodeNeighbour(activeStreamUrl, -1) else null
    }
    val nextChannel = remember(activeEntryId, isLiveStream) {
        if (isLiveStream) viewModel.channelNeighbour(activeEntryId, 1) else null
    }
    val previousChannel = remember(activeEntryId, isLiveStream) {
        if (isLiveStream) viewModel.channelNeighbour(activeEntryId, -1) else null
    }

    val upNextVisible = playbackEnded && !upNextDismissed && nextEpisode != null
    val endOfSeriesVisible = playbackEnded && !upNextDismissed && isSeries && nextEpisode == null

    // A television turns itself off after its own idle timeout, and watching a
    // channel counts as idle because nothing is being pressed. While a stream is
    // running the screen is held on, exactly as any other TV app does; the
    // moment playback stops the timeout goes back to normal.
    val hostView = LocalView.current
    val screenBusy = isPlaying || buffering || reconnecting || upNextVisible
    DisposableEffect(hostView, screenBusy) {
        hostView.keepScreenOn = screenBusy
        onDispose { hostView.keepScreenOn = false }
    }

    /** Swaps what is playing in place, keeping the viewer inside the player. */
    fun switchTo(newEntryId: String, newStreamUrl: String) {
        if (newStreamUrl.isBlank()) return
        activeEntryId = newEntryId
        activeStreamUrl = newStreamUrl
        controlsVisible = true
        interactionTick += 1
    }

    fun playEpisode(episode: Episode) = switchTo(activeEntryId, episode.streamUrl)

    fun playChannel(channel: MediaEntry) = switchTo(channel.id, channel.streamUrl)

    /**
     * Queues another attempt at the same stream. Anything already playing keeps
     * its position, so a movie resumes exactly where the connection dropped.
     */
    fun scheduleReconnect(fromPositionMs: Long) {
        if (reconnecting || reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) return
        resumePositionMs = fromPositionMs.coerceAtLeast(0L)
        reconnectAttempt += 1
        reconnecting = true
        reconnectTick += 1
        controlsVisible = false
    }

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                buffering = playbackState == Player.STATE_BUFFERING
                if (playbackState == Player.STATE_ENDED) {
                    playbackEnded = true
                    controlsVisible = true
                    // Marks the episode as watched right away, so the series page
                    // offers the next one even if the box is switched off here.
                    entry?.let {
                        viewModel.saveProgress(
                            entry = it,
                            streamUrl = activeStreamUrl,
                            positionMs = player.duration.coerceAtLeast(0L),
                            durationMs = player.duration.coerceAtLeast(0L),
                            episode = currentEpisode,
                        )
                    }
                }
            }

            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
                // Frames are flowing again: the recovery budget is refilled.
                if (playing) {
                    reconnecting = false
                    reconnectAttempt = 0
                }
            }

            override fun onPlayerError(playerError: PlaybackException) {
                if (reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
                    scheduleReconnect(player.currentPosition)
                } else {
                    reconnecting = false
                    error = strings.playerReconnectFailed.format(MAX_RECONNECT_ATTEMPTS)
                }
            }
        }
        player.addListener(listener)

        onDispose {
            entry?.let {
                viewModel.saveProgress(
                    entry = it,
                    streamUrl = activeStreamUrl,
                    positionMs = player.currentPosition,
                    durationMs = player.duration.coerceAtLeast(0L),
                    episode = currentEpisode,
                )
            }
            player.removeListener(listener)
            player.release()
        }
    }

    LaunchedEffect(player) {
        var sinceLastSaveMs = 0L
        while (true) {
            if (!scrubbing && pendingSeekMs == null) {
                positionMs = player.currentPosition.coerceAtLeast(0L)
            }
            val reported = player.duration
            durationMs = if (reported == C.TIME_UNSET) 0L else reported.coerceAtLeast(0L)

            // Position is written down as we go, so a film keeps its place even
            // if the box is switched off instead of leaving the player.
            sinceLastSaveMs += 400
            if (sinceLastSaveMs >= PROGRESS_SAVE_INTERVAL_MS) {
                sinceLastSaveMs = 0L
                entry?.let {
                    viewModel.saveProgress(
                        entry = it,
                        streamUrl = activeStreamUrl,
                        positionMs = player.currentPosition,
                        durationMs = player.duration.coerceAtLeast(0L),
                        episode = currentEpisode,
                    )
                }
            }
            delay(400)
        }
    }

    // Leaving the app must silence it. Pressing Home only stops the activity, so
    // without this the stream would keep playing out loud behind the launcher.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, player) {
        val observer = LifecycleEventObserver { _, event ->
            if (event != Lifecycle.Event.ON_STOP) return@LifecycleEventObserver
            player.pause()
            controlsVisible = true
            entry?.let {
                viewModel.saveProgress(
                    entry = it,
                    streamUrl = activeStreamUrl,
                    positionMs = player.currentPosition,
                    durationMs = player.duration.coerceAtLeast(0L),
                    episode = currentEpisode,
                )
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // The resume hint is a courtesy, not a dialog: it fades out on its own.
    LaunchedEffect(resumeNoticeVisible) {
        if (!resumeNoticeVisible) return@LaunchedEffect
        delay(5_000)
        resumeNoticeVisible = false
    }

    // Applies the accumulated D-pad jump once the user stops pressing.
    LaunchedEffect(pendingSeekMs) {
        val target = pendingSeekMs ?: return@LaunchedEffect
        delay(SEEK_COMMIT_DELAY_MS)
        player.seekTo(target)
        positionMs = target
        pendingSeekMs = null
    }

    // The end of an episode is announced rather than sprung on the viewer: the
    // card names what comes next and counts down the delay set in Settings, and
    // anyone who does not want it can stop the countdown.
    LaunchedEffect(playbackEnded, nextEpisode, upNextDismissed, settings.autoplayNextEpisode) {
        val next = nextEpisode
        if (!playbackEnded || upNextDismissed || next == null) return@LaunchedEffect
        if (!settings.autoplayNextEpisode) {
            secondsLeft = 0
            return@LaunchedEffect
        }
        secondsLeft = settings.nextEpisodeDelaySeconds.coerceIn(3, 60)
        while (secondsLeft > 0) {
            delay(1_000)
            secondsLeft -= 1
        }
        playEpisode(next)
    }

    // Reopens the stream after the backoff delay and restores the position.
    LaunchedEffect(reconnectTick) {
        if (reconnectTick == 0 || !reconnecting) return@LaunchedEffect
        error = null
        delay(reconnectDelayMs(reconnectAttempt))
        player.stop()
        player.setMediaItem(MediaItem.fromUri(activeStreamUrl))
        player.prepare()
        // Live channels always rejoin at the edge; on-demand resumes where it froze.
        if (!isLiveStream && resumePositionMs > 0L) player.seekTo(resumePositionMs)
        player.playWhenReady = true
    }

    // Watchdog for a stream that never errors out but stops delivering data.
    LaunchedEffect(player, activeStreamUrl) {
        var lastPosition = -1L
        var lastProgressAtMs = System.currentTimeMillis()
        while (true) {
            delay(1_000)
            val now = System.currentTimeMillis()
            val position = player.currentPosition
            val paused = !player.playWhenReady
            val stalled = player.playbackState == Player.STATE_BUFFERING
            if (paused || position != lastPosition) {
                lastPosition = position
                lastProgressAtMs = now
                continue
            }
            if (stalled && !reconnecting && now - lastProgressAtMs >= STALL_TIMEOUT_MS) {
                lastProgressAtMs = now
                if (reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
                    scheduleReconnect(position)
                } else {
                    error = strings.playerReconnectFailed.format(MAX_RECONNECT_ATTEMPTS)
                }
            }
        }
    }

    LaunchedEffect(controlsVisible, isPlaying, scrubbing, error, interactionTick, upNextVisible) {
        if (controlsVisible && isPlaying && !scrubbing && error == null && !upNextVisible) {
            delay(CONTROLS_TIMEOUT_MS)
            controlsVisible = false
        }
    }

    val isLive = isLiveStream || durationMs <= 0L
    val seekable = !isLive && durationMs > 0L

    /** Queues a jump of [deltaMs], stacking with presses that came just before. */
    fun nudgeSeek(deltaMs: Long) {
        if (!seekable) {
            showControls()
            return
        }
        val base = pendingSeekMs ?: player.currentPosition
        val target = (base + deltaMs).coerceIn(0L, durationMs)
        pendingSeekMs = target
        positionMs = target
        showControls()
    }

    fun togglePlayback() {
        if (player.isPlaying) player.pause() else player.play()
        showControls()
    }

    // The remote drives the player directly: the D-pad never has to hunt for a
    // button, so left/right scrub, OK pauses and resumes, and any other key
    // simply brings the controls back on screen.
    val keyFocus = rememberFocusRequester()
    /** Where the highlight lands when the controls come up. */
    val controlsFocus = rememberFocusRequester()
    LaunchedEffect(controlsVisible, activeStreamUrl, error) {
        if (controlsVisible && error == null) {
            // The control row is only laid out once the overlay has faded in.
            repeat(3) { withFrameNanos { } }
            runCatching { controlsFocus.requestFocus() }
        } else {
            runCatching { keyFocus.requestFocus() }
        }
    }

    /** What the up/down keys and the side buttons do on this stream. */
    val goNext: (() -> Unit)? = when {
        isLiveStream -> nextChannel?.let { channel -> { playChannel(channel) } }
        nextEpisode != null -> {
            { playEpisode(nextEpisode) }
        }
        else -> null
    }
    val goPrevious: (() -> Unit)? = when {
        isLiveStream -> previousChannel?.let { channel -> { playChannel(channel) } }
        previousEpisode != null -> {
            { playEpisode(previousEpisode) }
        }
        else -> null
    }
    val nextLabel = if (isLiveStream) strings.nextChannelAction else strings.nextEpisodeAction
    val previousLabel =
        if (isLiveStream) strings.previousChannelAction else strings.previousEpisodeAction

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .onPreviewKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                // While the up-next card is on screen the remote drives it: OK
                // starts the episode straight away, Back calls the whole thing off.
                if (upNextVisible && nextEpisode != null) {
                    when (event.key) {
                        Key.DirectionCenter, Key.Enter, Key.NumPadEnter, Key.MediaPlay,
                        Key.MediaPlayPause, Key.MediaNext -> {
                            playEpisode(nextEpisode)
                            return@onPreviewKeyEvent true
                        }
                        Key.Back, Key.Escape -> {
                            upNextDismissed = true
                            return@onPreviewKeyEvent true
                        }
                        else -> Unit
                    }
                }
                // Keys that exist only on a remote's media block are never hit by
                // accident, so they keep acting straight away.
                when (event.key) {
                    Key.ChannelUp, Key.MediaNext -> {
                        goNext?.invoke() ?: showControls()
                        return@onPreviewKeyEvent true
                    }
                    Key.ChannelDown, Key.MediaPrevious -> {
                        goPrevious?.invoke() ?: showControls()
                        return@onPreviewKeyEvent true
                    }
                    Key.MediaPlay -> {
                        player.play()
                        showControls()
                        return@onPreviewKeyEvent true
                    }
                    Key.MediaPause -> {
                        player.pause()
                        showControls()
                        return@onPreviewKeyEvent true
                    }
                    Key.MediaPlayPause -> {
                        togglePlayback()
                        return@onPreviewKeyEvent true
                    }
                    Key.MediaStop -> {
                        onBack()
                        return@onPreviewKeyEvent true
                    }
                    Key.Menu, Key.Info -> {
                        showControls()
                        return@onPreviewKeyEvent true
                    }
                    else -> Unit
                }

                // With the controls on screen the D-pad belongs to the buttons:
                // the viewer walks the highlight and presses OK, so a stray press
                // can no longer change channel on its own.
                if (controlsVisible && error == null) {
                    interactionTick += 1
                    return@onPreviewKeyEvent false
                }

                when (event.key) {
                    Key.DirectionLeft, Key.MediaRewind -> {
                        nudgeSeek(-SEEK_STEP_MS)
                        true
                    }
                    Key.DirectionRight, Key.MediaFastForward -> {
                        nudgeSeek(SEEK_STEP_MS)
                        true
                    }
                    Key.DirectionCenter, Key.Enter, Key.NumPadEnter, Key.Spacebar -> {
                        togglePlayback()
                        true
                    }
                    Key.DirectionUp, Key.DirectionDown -> {
                        showControls()
                        true
                    }
                    else -> false
                }
            }
            .focusRequester(keyFocus)
            .focusable()
    ) {
        AndroidView(
            factory = { viewContext ->
                PlayerView(viewContext).apply {
                    this.player = player
                    useController = false
                    // The video surface must never hold the highlight, or the
                    // remote keys stop reaching the controls above it.
                    isFocusable = false
                    descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                }
            },
            update = { view ->
                // Re-attaches the surface whenever the player instance changes,
                // otherwise the picture would be lost while the audio carries on.
                if (view.player !== player) view.player = player
            },
            modifier = Modifier.fillMaxSize(),
        )

        // Tap surface: single tap toggles the controls, double tap jumps ±10 s.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(seekable) {
                    detectTapGestures(
                        onTap = {
                            if (controlsVisible) controlsVisible = false else showControls()
                        },
                        onDoubleTap = { offset ->
                            if (!seekable) {
                                showControls()
                                return@detectTapGestures
                            }
                            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                            val forward = offset.x > size.width / 2f
                            val target = (player.currentPosition + if (forward) SEEK_STEP_MS else -SEEK_STEP_MS)
                                .coerceIn(0L, durationMs)
                            player.seekTo(target)
                            positionMs = target
                            showControls()
                        },
                    )
                }
        )

        if (buffering && error == null && !reconnecting) {
            CircularProgressIndicator(
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(42.dp),
                color = Color.White,
            )
        }

        if (reconnecting && error == null) {
            ReconnectOverlay(
                title = strings.playerReconnecting,
                attemptLabel = strings.playerReconnectAttempt.format(
                    reconnectAttempt,
                    MAX_RECONNECT_ATTEMPTS,
                ),
                retryNowLabel = strings.playerReconnectNow,
                closeLabel = strings.close,
                onRetryNow = {
                    reconnectTick += 1
                },
                onClose = onBack,
                modifier = Modifier.align(Alignment.Center),
            )
        }

        AnimatedVisibility(
            visible = controlsVisible && error == null,
            enter = fadeIn(tween(180)),
            exit = fadeOut(tween(220)),
            modifier = Modifier.fillMaxSize(),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            0f to Color.Black.copy(alpha = 0.62f),
                            0.32f to Color.Black.copy(alpha = 0.12f),
                            0.68f to Color.Black.copy(alpha = 0.18f),
                            1f to Color.Black.copy(alpha = 0.78f),
                        )
                    )
            ) {
                CenterControls(
                    isPlaying = isPlaying,
                    seekable = seekable,
                    playLabel = strings.playAction,
                    pauseLabel = strings.pauseAction,
                    rewindLabel = strings.rewindTen,
                    forwardLabel = strings.forwardTen,
                    previousLabel = previousLabel,
                    nextLabel = nextLabel,
                    previousCaption = if (isLiveStream) previousChannel?.title else previousEpisode
                        ?.let { "S${it.season}E${it.number}" },
                    nextCaption = if (isLiveStream) nextChannel?.title else nextEpisode
                        ?.let { "S${it.season}E${it.number}" },
                    focusRequester = controlsFocus,
                    hint = if (goNext != null || goPrevious != null) strings.playerPickerHint else null,
                    onPrevious = goPrevious?.let { action ->
                        {
                            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                            action()
                        }
                    },
                    onNext = goNext?.let { action ->
                        {
                            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                            action()
                        }
                    },
                    onRewind = {
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        val target = (player.currentPosition - SEEK_STEP_MS).coerceAtLeast(0L)
                        player.seekTo(target)
                        positionMs = target
                        showControls()
                    },
                    onTogglePlay = {
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        if (player.isPlaying) player.pause() else player.play()
                        showControls()
                    },
                    onForward = {
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        val target = (player.currentPosition + SEEK_STEP_MS).coerceIn(0L, durationMs)
                        player.seekTo(target)
                        positionMs = target
                        showControls()
                    },
                    modifier = Modifier.align(Alignment.Center),
                )

                BottomBar(
                    isLive = isLive,
                    seekable = seekable,
                    liveBadge = strings.liveBadge,
                    seekBarLabel = strings.seekBarLabel,
                    positionMs = if (scrubbing) scrubValue.toLong() else positionMs,
                    durationMs = durationMs,
                    onScrub = { value ->
                        scrubbing = true
                        scrubValue = value
                    },
                    onScrubFinished = {
                        val target = scrubValue.toLong().coerceIn(0L, durationMs)
                        player.seekTo(target)
                        positionMs = target
                        scrubbing = false
                        showControls()
                    },
                    modifier = Modifier.align(Alignment.BottomStart),
                )
            }
        }

        if (upNextVisible && nextEpisode != null && error == null) {
            val total = settings.nextEpisodeDelaySeconds.coerceIn(3, 60).toFloat()
            UpNextCard(
                title = strings.upNextTitle,
                episodeLabel = "S${nextEpisode.season}E${nextEpisode.number} · ${nextEpisode.title}",
                countdownLabel = if (settings.autoplayNextEpisode) {
                    strings.upNextCountdown.format(secondsLeft)
                } else null,
                progress = if (total > 0f) (secondsLeft / total).coerceIn(0f, 1f) else 0f,
                playNowLabel = strings.upNextPlayNow,
                cancelLabel = strings.cancel,
                onPlayNow = { playEpisode(nextEpisode) },
                onCancel = { upNextDismissed = true },
                modifier = Modifier.align(Alignment.BottomEnd),
            )
        }

        if (endOfSeriesVisible && error == null) {
            Column(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(24.dp)
                    .background(Color.Black.copy(alpha = 0.82f), RoundedCornerShape(20.dp))
                    .padding(horizontal = 22.dp, vertical = 18.dp),
            ) {
                Text(
                    text = strings.lastEpisodeNotice,
                    color = Color.White,
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(onClick = onBack) { Text(strings.close) }
                    OutlinedButton(onClick = { upNextDismissed = true }) { Text(strings.cancel) }
                }
            }
        }

        // The title stays on screen for as long as the film is paused, so a
        // room coming back to a frozen picture knows what is playing.
        AnimatedVisibility(
            visible = error == null && (controlsVisible || !isPlaying),
            enter = fadeIn(tween(180)),
            exit = fadeOut(tween(220)),
            modifier = Modifier.align(Alignment.TopStart),
        ) {
            PlayerTopBar(
                title = entry?.title.orEmpty(),
                subtitle = when {
                    !isPlaying && !buffering && !reconnecting -> strings.playerPausedBadge
                    resumeNoticeVisible && resumeFromMs > 0L ->
                        strings.playerResumedFrom.format(formatTime(resumeFromMs))
                    seekable -> "${formatTime(positionMs)} / ${formatTime(durationMs)}"
                    else -> null
                },
                closeLabel = strings.closePlayer,
                onBack = onBack,
            )
        }

        error?.let { message ->
            Column(
                modifier = Modifier
                    .align(Alignment.Center)
                    .fillMaxWidth()
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = message,
                    color = Color.White,
                    style = MaterialTheme.typography.bodyLarge,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(16.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = {
                        error = null
                        reconnectAttempt = 0
                        player.setMediaItem(MediaItem.fromUri(activeStreamUrl))
                        player.prepare()
                        if (!isLiveStream && resumePositionMs > 0L) player.seekTo(resumePositionMs)
                        player.play()
                        showControls()
                    }) { Text(strings.retry) }
                    OutlinedButton(onClick = onBack) { Text(strings.close) }
                }
            }
        }
    }
}

/** Calm, non-blocking notice while the stream is being picked up again. */
@Composable
private fun ReconnectOverlay(
    title: String,
    attemptLabel: String,
    retryNowLabel: String,
    closeLabel: String,
    onRetryNow: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .padding(24.dp)
            .background(Color.Black.copy(alpha = 0.72f), RoundedCornerShape(20.dp))
            .padding(horizontal = 26.dp, vertical = 22.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(34.dp),
            color = Color.White,
            strokeWidth = 3.dp,
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = title,
            color = Color.White,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = attemptLabel,
            color = Color.White.copy(alpha = 0.72f),
            style = MaterialTheme.typography.bodySmall,
        )
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(onClick = onRetryNow) { Text(retryNowLabel) }
            OutlinedButton(onClick = onClose) { Text(closeLabel) }
        }
    }
}

@Composable
private fun PlayerTopBar(
    title: String,
    subtitle: String?,
    closeLabel: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(
                Brush.verticalGradient(
                    0f to Color.Black.copy(alpha = 0.78f),
                    1f to Color.Transparent,
                )
            )
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .padding(horizontal = 8.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onBack) {
            Icon(
                imageVector = Icons.Rounded.Close,
                contentDescription = closeLabel,
                tint = Color.White,
            )
        }
        Spacer(Modifier.width(4.dp))
        Column {
            Text(
                text = title,
                color = Color.White,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    color = Color.White.copy(alpha = 0.76f),
                    style = MaterialTheme.typography.labelMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun CenterControls(
    isPlaying: Boolean,
    seekable: Boolean,
    playLabel: String,
    pauseLabel: String,
    rewindLabel: String,
    forwardLabel: String,
    previousLabel: String,
    nextLabel: String,
    previousCaption: String?,
    nextCaption: String?,
    focusRequester: FocusRequester,
    hint: String?,
    onPrevious: (() -> Unit)?,
    onNext: (() -> Unit)?,
    onRewind: () -> Unit,
    onTogglePlay: () -> Unit,
    onForward: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val pulse by animateFloatAsState(
        targetValue = if (isPlaying) 1f else 1.08f,
        animationSpec = tween(220),
        label = "playPulse",
    )

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(22.dp),
        ) {
            if (onPrevious != null) {
                GlassIconButton(
                    icon = { tint ->
                        Icon(
                            Icons.Rounded.SkipPrevious,
                            contentDescription = previousLabel,
                            tint = tint,
                        )
                    },
                    size = 52,
                    caption = previousCaption,
                    onClick = onPrevious,
                )
            }

            if (seekable) {
                GlassIconButton(
                    icon = { tint ->
                        Icon(Icons.Rounded.Replay10, contentDescription = rewindLabel, tint = tint)
                    },
                    size = 52,
                    onClick = onRewind,
                )
            }

            Box(
                modifier = Modifier
                    .scale(pulse)
                    .size(76.dp)
                    .background(Color.White.copy(alpha = 0.16f), CircleShape)
                    .tvFocusFrame(cornerRadius = 38.dp),
                contentAlignment = Alignment.Center,
            ) {
                IconButton(
                    onClick = onTogglePlay,
                    modifier = Modifier
                        .size(76.dp)
                        .focusRequester(focusRequester),
                ) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                        contentDescription = if (isPlaying) pauseLabel else playLabel,
                        tint = Color.White,
                        modifier = Modifier.size(40.dp),
                    )
                }
            }

            if (seekable) {
                GlassIconButton(
                    icon = { tint ->
                        Icon(Icons.Rounded.Forward10, contentDescription = forwardLabel, tint = tint)
                    },
                    size = 52,
                    onClick = onForward,
                )
            }

            if (onNext != null) {
                GlassIconButton(
                    icon = { tint ->
                        Icon(Icons.Rounded.SkipNext, contentDescription = nextLabel, tint = tint)
                    },
                    size = 52,
                    caption = nextCaption,
                    onClick = onNext,
                )
            }
        }

        // Spells out how the remote drives this row, since nothing here moves
        // until the viewer confirms a button.
        if (hint != null) {
            Spacer(Modifier.height(14.dp))
            Text(
                text = hint,
                color = Color.White.copy(alpha = 0.68f),
                style = MaterialTheme.typography.labelMedium,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/**
 * End-of-episode card: names what comes next, counts down the delay chosen in
 * Settings and leaves the viewer in charge of both outcomes.
 */
@Composable
private fun UpNextCard(
    title: String,
    episodeLabel: String,
    countdownLabel: String?,
    progress: Float,
    playNowLabel: String,
    cancelLabel: String,
    onPlayNow: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .padding(24.dp)
            .background(Color.Black.copy(alpha = 0.82f), RoundedCornerShape(20.dp))
            .padding(horizontal = 22.dp, vertical = 18.dp),
    ) {
        Text(
            text = title,
            color = Color.White.copy(alpha = 0.68f),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            text = episodeLabel,
            color = Color.White,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.width(300.dp),
        )
        if (countdownLabel != null) {
            Spacer(Modifier.height(12.dp))
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .width(300.dp)
                    .height(4.dp),
                color = MaterialTheme.colorScheme.primary,
                trackColor = Color.White.copy(alpha = 0.22f),
                drawStopIndicator = {},
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = countdownLabel,
                color = Color.White.copy(alpha = 0.78f),
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(onClick = onPlayNow) { Text(playNowLabel) }
            OutlinedButton(onClick = onCancel) { Text(cancelLabel) }
        }
    }
}

@Composable
private fun GlassIconButton(
    icon: @Composable (Color) -> Unit,
    size: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    caption: String? = null,
) {
    Column(
        modifier = modifier.width((size + 44).dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(size.dp)
                .background(Color.White.copy(alpha = 0.10f), CircleShape)
                .tvFocusFrame(cornerRadius = (size / 2).dp),
            contentAlignment = Alignment.Center,
        ) {
            IconButton(onClick = onClick, modifier = Modifier.size(size.dp)) {
                icon(Color.White)
            }
        }
        // Names where the button leads, so zapping is a decision rather than a
        // surprise.
        if (caption != null) {
            Spacer(Modifier.height(6.dp))
            Text(
                text = caption,
                color = Color.White.copy(alpha = 0.76f),
                style = MaterialTheme.typography.labelSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun BottomBar(
    isLive: Boolean,
    seekable: Boolean,
    liveBadge: String,
    seekBarLabel: String,
    positionMs: Long,
    durationMs: Long,
    onScrub: (Float) -> Unit,
    onScrubFinished: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .padding(horizontal = 18.dp, vertical = 12.dp),
    ) {
        if (seekable) {
            Slider(
                value = positionMs.coerceIn(0L, durationMs).toFloat(),
                onValueChange = onScrub,
                onValueChangeFinished = onScrubFinished,
                valueRange = 0f..durationMs.toFloat(),
                colors = SliderDefaults.colors(
                    thumbColor = Color.White,
                    activeTrackColor = MaterialTheme.colorScheme.primary,
                    inactiveTrackColor = Color.White.copy(alpha = 0.28f),
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                TimeLabel(formatTime(positionMs), seekBarLabel)
                TimeLabel(formatTime(durationMs))
            }
        } else if (isLive) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .background(
                            MaterialTheme.colorScheme.error.copy(alpha = 0.92f),
                            RoundedCornerShape(6.dp),
                        )
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = liveBadge,
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

@Composable
private fun TimeLabel(text: String, semanticLabel: String? = null) {
    Text(
        text = text,
        color = Color.White.copy(alpha = 0.86f),
        style = MaterialTheme.typography.labelMedium,
        modifier = Modifier.semantics {
            if (semanticLabel != null) contentDescription = semanticLabel
        },
    )
}

/** Formats milliseconds as `m:ss` or `h:mm:ss` for the scrub bar labels. */
private fun formatTime(ms: Long): String {
    val totalSeconds = (ms.coerceAtLeast(0L)) / 1000
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) {
        String.format(Locale.US, "%d:%02d:%02d", hours, minutes, seconds)
    } else {
        String.format(Locale.US, "%d:%02d", minutes, seconds)
    }
}
