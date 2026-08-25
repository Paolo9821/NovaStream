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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
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
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.ui.components.rememberFocusRequester
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
    val settings = viewModel.settings.value
    val entry = remember(entryId) { viewModel.entryById(entryId) }

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
    val resumeFromMs = remember(entryId, streamUrl) { viewModel.resumePositionFor(entryId) }
    var resumeNoticeVisible by remember(streamUrl) { mutableStateOf(resumeFromMs > 0L) }

    val player = remember(streamUrl) {
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
                setMediaItem(MediaItem.fromUri(streamUrl))
                // Keeps the box awake while a stream is running: without it a TV
                // suspends the CPU and the picture dies mid-programme.
                setWakeMode(C.WAKE_MODE_NETWORK)
                // Picks the film back up where it was left instead of restarting it.
                if (resumeFromMs > 0L) seekTo(resumeFromMs)
                playWhenReady = true
                prepare()
            }
    }

    // A television turns itself off after its own idle timeout, and watching a
    // channel counts as idle because nothing is being pressed. While a stream is
    // running the screen is held on, exactly as any other TV app does; the
    // moment playback stops the timeout goes back to normal.
    val hostView = LocalView.current
    val screenBusy = isPlaying || buffering || reconnecting
    DisposableEffect(hostView, screenBusy) {
        hostView.keepScreenOn = screenBusy
        onDispose { hostView.keepScreenOn = false }
    }

    fun showControls() {
        controlsVisible = true
        interactionTick += 1
    }

    val isLiveStream = entry?.kind == MediaKind.LIVE

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
                    streamUrl = streamUrl,
                    positionMs = player.currentPosition,
                    durationMs = player.duration.coerceAtLeast(0L),
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
                        streamUrl = streamUrl,
                        positionMs = player.currentPosition,
                        durationMs = player.duration.coerceAtLeast(0L),
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
                    streamUrl = streamUrl,
                    positionMs = player.currentPosition,
                    durationMs = player.duration.coerceAtLeast(0L),
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

    // Reopens the stream after the backoff delay and restores the position.
    LaunchedEffect(reconnectTick) {
        if (reconnectTick == 0 || !reconnecting) return@LaunchedEffect
        error = null
        delay(reconnectDelayMs(reconnectAttempt))
        player.stop()
        player.setMediaItem(MediaItem.fromUri(streamUrl))
        player.prepare()
        // Live channels always rejoin at the edge; on-demand resumes where it froze.
        if (!isLiveStream && resumePositionMs > 0L) player.seekTo(resumePositionMs)
        player.playWhenReady = true
    }

    // Watchdog for a stream that never errors out but stops delivering data.
    LaunchedEffect(player, streamUrl) {
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

    LaunchedEffect(controlsVisible, isPlaying, scrubbing, error, interactionTick) {
        if (controlsVisible && isPlaying && !scrubbing && error == null) {
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
    LaunchedEffect(streamUrl) {
        runCatching { keyFocus.requestFocus() }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .onPreviewKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                when (event.key) {
                    Key.DirectionLeft, Key.MediaRewind -> {
                        nudgeSeek(-SEEK_STEP_MS)
                        true
                    }
                    Key.DirectionRight, Key.MediaFastForward -> {
                        nudgeSeek(SEEK_STEP_MS)
                        true
                    }
                    Key.DirectionCenter, Key.Enter, Key.NumPadEnter, Key.Spacebar,
                    Key.MediaPlayPause -> {
                        togglePlayback()
                        true
                    }
                    Key.MediaPlay -> {
                        player.play()
                        showControls()
                        true
                    }
                    Key.MediaPause -> {
                        player.pause()
                        showControls()
                        true
                    }
                    Key.MediaStop -> {
                        onBack()
                        true
                    }
                    Key.DirectionUp, Key.DirectionDown, Key.Menu, Key.Info -> {
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
                        player.setMediaItem(MediaItem.fromUri(streamUrl))
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

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(28.dp),
    ) {
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
                .background(Color.White.copy(alpha = 0.16f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            IconButton(
                onClick = onTogglePlay,
                modifier = Modifier.size(76.dp),
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
    }
}

@Composable
private fun GlassIconButton(
    icon: @Composable (Color) -> Unit,
    size: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .size(size.dp)
            .background(Color.White.copy(alpha = 0.10f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        IconButton(onClick = onClick, modifier = Modifier.size(size.dp)) {
            icon(Color.White)
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
