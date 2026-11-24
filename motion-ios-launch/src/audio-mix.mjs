// Timeline, chapter and media-sync helpers shared by the motion player and its export.

// One voiceover clip per scene, a music bed and a few sound effects; voiceover clips never overlap, so the cap is not
// a mix-density limit. It bounds the export's audio mix, which decodes one file after another: about 0.08 s a track,
// 11 s for 101 tracks and 17 s for 201 on the export sandbox (14 November 2026), and that mix has to finish while the
// frames are captured, in 25 to 40 s once exports fan out. Memory follows the audio's total length, not the track
// count.
export const MAX_AUDIO_TRACKS = 100;
// Preview decodes every audio file to mix them, 48 kHz Float32, about 23 MB a minute of stereo: 30 minutes are 0.7 GB
// in the viewer's tab. A file counts by its channels, so mono is half and 5.1 three times its length. A 10-minute film
// with narration throughout and a full-length bed is 20 minutes.
export const MAX_AUDIO_SECONDS = 30 * 60;
// Every scene video stays loaded for the whole film in preview and export.
export const MAX_VIDEO_CLIPS = 8;
// The frame rate a film has unless it asks for another, and the rates a film may ask for.
export const FRAME_RATE = 30;
export const FRAME_RATES = [30, 60];
export const VOICEOVER_LEAD_IN = 0.3;
export const VOICEOVER_TAIL = 0.6;
// Browsers and ffprobe can disagree by an MP3 frame or two about the same file's duration.
const MEDIA_DURATION_TOLERANCE = 0.1;
// Chrome reports the position being heard, so after a start or seek playing audio trails the clock by the output
// latency (hundreds of milliseconds over Bluetooth), and each seek restarts that latency, so seeking it away loops.
// A pitch-preserving playbackRate nudge closes that gap without restarting it, then returns to exactly 1. Seeks are
// for drift clearly beyond the gap a seek itself leaves, so a latency larger than the seek bound cannot loop either.
const HARD_SEEK_DRIFT = 0.5;
const SEEK_GAP_MARGIN = 0.2;
// Consecutive voiceovers are at least a lead-in and a tail apart, so a trailing clip may play that long past its end.
const MAX_TRAILING_TAIL = VOICEOVER_LEAD_IN + VOICEOVER_TAIL;
// Paused audio has no output latency, so it is aligned to within a frame.
const PAUSED_AUDIO_DRIFT = 1 / FRAME_RATE;
// Playback counts as steady once the reported position moves within 10% of the clock over a quarter of a second.
// A buffering track never does, so its stall is not mistaken for the gap a seek leaves.
const SETTLE_WINDOW = 0.25;
const SETTLED_DRIFT_RATE = 0.1;
const DRIFT_SMOOTHING_SECONDS = 0.3;
// Hysteresis keeps the rate at exactly 1 while in sync instead of chasing every frame of timer jitter.
const NUDGE_START_DRIFT = 0.04;
const NUDGE_STOP_DRIFT = 0.01;
const NUDGE_GAIN = 0.5;
const MAX_RATE_NUDGE = 0.05;
// A half-percent nudge closes the last few milliseconds slowly and was seen held at 1.0 in Chromium, so none is smaller.
const MIN_RATE_NUDGE = 0.01;
// Whole half-percent steps avoid writing a new playbackRate on every frame.
const RATE_STEPS_PER_UNIT = 200;
const FALLBACK_SCENE_SECONDS = 3;
// ffmpeg's ebur128 reports silence as -70 LUFS, the absolute gate, which no gain could match.
const SILENCE_LUFS = -70;
// A measured bed and effect sit at this gain relative to the narration's loudness: 0.5 puts the bed 6 LU under it.
// Without a measurement, the gain applies to the file as it is, as before loudness was recorded.
const MUSIC_VOLUME = { matched: 0.5, unmeasured: 0.25 };
const EFFECT_VOLUME = { matched: 0.35, unmeasured: 0.35 };
// The bed dips 6 dB under every line: down before the first syllable, back after the last word.
const DUCK_GAIN = 0.5;
const DUCK_ATTACK = 0.15;
const DUCK_RELEASE = 0.5;
// Lines closer than this share one dip, so the bed does not swell in the short pause between two scenes.
const DUCK_JOIN_GAP = 1.5;

/**
 * Index the measured clip durations written by scripts/download-audio.mjs.
 * @param {unknown[]} clips
 * @returns {Map<string, number>}
 * @example indexClipDurations([{ src: "/rork-vo-opening-v1.mp3", seconds: 2.4 }]).get("/rork-vo-opening-v1.mp3") // 2.4
 */
export function indexClipDurations(clips) {
  const durations = new Map();
  for (const clip of clips) {
    if (clip && typeof clip.src === "string" && Number.isFinite(clip.seconds) && clip.seconds > 0) {
      durations.set(clip.src, clip.seconds);
    }
  }
  return durations;
}

/**
 * Index the integrated loudness, in LUFS, that scripts/download-audio.mjs measured for each clip.
 * @param {unknown[]} clips
 * @returns {Map<string, number>}
 * @example indexClipLoudness([{ src: "/rork-music-v1.mp3", seconds: 26, loudness: -13.1 }]).get("/rork-music-v1.mp3") // -13.1
 */
export function indexClipLoudness(clips) {
  const loudness = new Map();
  for (const clip of clips) {
    if (clip && typeof clip.src === "string" && Number.isFinite(clip.loudness) && clip.loudness > SILENCE_LUFS) {
      loudness.set(clip.src, clip.loudness);
    }
  }
  return loudness;
}

/**
 * The narration's loudness as mixed: each clip's loudness plus its track gain, averaged by energy over the clips'
 * lengths as an integrated measurement of the whole narration would be. A level from only some of the clips would
 * match the bed to part of the narration, so every audible clip must have been measured.
 * @param {AudioTrack[]} voiceovers
 * @param {Map<string, number>} clipLoudness
 * @returns {number | null} LUFS, or null when an audible voiceover clip, or every one, was not measured.
 * @example narrationLoudness(voiceoverTracks(scenes, 0.9), indexClipLoudness(clips)) // -25.3
 */
export function narrationLoudness(voiceovers, clipLoudness) {
  let energy = 0;
  let seconds = 0;
  for (const track of voiceovers) {
    if (!(track.volume > 0)) continue;
    const loudness = clipLoudness.get(track.src);
    if (loudness === undefined) return null;
    const length = track.sourceEnd - track.sourceStart;
    energy += length * 10 ** (loudness / 10) * track.volume ** 2;
    seconds += length;
  }
  return seconds > 0 ? 10 * Math.log10(energy / seconds) : null;
}

/**
 * Why the bed and effects are not levelled to the narration, for the preview to show: some voiceovers were saved
 * with a loudness and some without, as when one scene's clip is replaced in an older film. Null when every audible
 * voiceover, or none, was measured.
 * @param {AudioTrack[]} voiceovers
 * @param {Map<string, number>} clipLoudness
 * @returns {string | null}
 * @example narrationLevelWarning(voiceoverTracks(scenes, 0.9), indexClipLoudness(clips))
 */
export function narrationLevelWarning(voiceovers, clipLoudness) {
  const audible = voiceovers.filter((track) => track.volume > 0);
  const unmeasured = audible.filter((track) => !clipLoudness.has(track.src));
  if (unmeasured.length === 0 || unmeasured.length === audible.length) return null;
  return `Voiceover ${unmeasured.map((track) => track.src).join(", ")} has no measured loudness, so the music and sound effects are not levelled to the narration. Save it again with scripts/download-audio.mjs.`;
}

/**
 * A track's gain: `volume` relative to the narration when the clip and the narration were both measured, so a loud
 * file is turned down further than a quiet one, otherwise `volume` applied to the file as it is. A track is never
 * amplified: scripts/download-audio.mjs already raised a quiet clip as far as its peaks allow, so more gain would
 * clip it. A file too quiet to reach its level plays at 1 and records how many LU it falls short by.
 * @param {number | undefined} volume
 * @param {{ matched: number, unmeasured: number }} defaults
 * @param {number | undefined} loudness
 * @param {number | null} narration
 * @returns {{ volume: number, levelShortfall?: number }}
 */
function mixLevel(volume, defaults, loudness, narration) {
  if (loudness === undefined || narration === null) return { volume: volume ?? defaults.unmeasured };
  const relative = volume ?? defaults.matched;
  // An out-of-range volume is returned unchanged so validateAudioTracks reports it instead of the clamp hiding it.
  if (!(relative >= 0 && relative <= 1)) return { volume: relative };
  const gain = relative * 10 ** ((narration - loudness) / 20);
  if (gain <= 1) return { volume: gain };
  const levelShortfall = Math.round(200 * Math.log10(gain)) / 10;
  return levelShortfall > 0 ? { volume: 1, levelShortfall } : { volume: 1 };
}

/**
 * Why a bed or effect plays quieter than its level under the narration, for whoever builds the film, or null when it
 * reaches it.
 * @param {AudioTrack} track
 * @returns {string | null}
 * @example trackLevelWarning({ src: "/rork-music-v1.mp3", role: "music", timelineStart: 0, sourceStart: 0, volume: 1, levelShortfall: 3.2 })
 */
export function trackLevelWarning(track) {
  if (!(track.levelShortfall > 0)) return null;
  const name = track.role === "effect" ? "Sound effect" : "Music bed";
  return `${name} ${track.src} plays ${track.levelShortfall} LU under its level beside the narration at full volume, because its peaks stopped scripts/download-audio.mjs raising it further. Generate one with a fuller body, such as a softer attack or a longer tail; save it again only if it was saved before that script raised quiet clips.`;
}

/**
 * Check the frame rate a film asks for.
 * @param {unknown} frameRate
 * @returns {string | null}
 * @example checkFrameRate(24) // "A film runs at 30 or 60 frames a second, not 24. Set the player's fps to 30 or 60, or leave it out."
 */
export function checkFrameRate(frameRate) {
  if (FRAME_RATES.includes(frameRate)) return null;
  return `A film runs at ${FRAME_RATES.join(" or ")} frames a second, not ${String(frameRate)}. Set the player's fps to ${FRAME_RATES.join(" or ")}, or leave it out.`;
}

/**
 * Derive scene boundaries on the frame grid. A narrated scene lasts for its lead-in, measured clip and tail,
 * so the total length is the sum of the scenes rather than a number chosen before the narration exists.
 * @param {SceneContent[]} content
 * @param {Map<string, number>} clipDurations
 * @param {{ leadIn?: number, tail?: number, frameRate?: number }} [options] `frameRate` is the film's, 30 or 60.
 * @returns {{ scenes: TimedScene[], duration: number, error: string | null }}
 * @example buildSceneTimeline([{ id: "opening", voiceover: "/rork-vo-opening-v1.mp3" }], durations)
 */
export function buildSceneTimeline(
  content,
  clipDurations,
  { leadIn = VOICEOVER_LEAD_IN, tail = VOICEOVER_TAIL, frameRate = FRAME_RATE } = {},
) {
  let error = checkFrameRate(frameRate);
  // A film with a rate it cannot have is laid out at the default, so its error can be shown on a page that renders.
  const rate = error === null ? frameRate : FRAME_RATE;
  let startFrame = 0;
  const seenIds = new Set();
  const scenes = content.map((scene) => {
    // A scene's id keys its element and finds its video, so a repeated one would show another scene's video.
    if (seenIds.has(scene.id)) error ??= `Scene id "${scene.id}" is used more than once. Give every scene its own id.`;
    seenIds.add(scene.id);
    let seconds;
    let voiceoverSeconds;
    if (scene.voiceover !== undefined) {
      voiceoverSeconds = clipDurations.get(scene.voiceover);
      if (voiceoverSeconds === undefined) {
        error ??= `Scene "${scene.id}" voiceover ${scene.voiceover} has no measured duration. Save it with scripts/download-audio.mjs.`;
        seconds = scene.minSeconds ?? scene.seconds ?? FALLBACK_SCENE_SECONDS;
      } else {
        seconds = Math.max(scene.minSeconds ?? 0, leadIn + voiceoverSeconds + tail);
      }
    } else if (Number.isFinite(scene.seconds) && scene.seconds > 0) {
      seconds = scene.seconds;
    } else {
      error ??= `Scene "${scene.id}" needs a voiceover or a positive seconds value.`;
      seconds = FALLBACK_SCENE_SECONDS;
    }

    const frames = Math.max(1, Math.ceil(seconds * rate - 1e-6));
    for (const effect of scene.effects ?? []) {
      // An effect answers an event inside its own scene; one outside it would sound against another scene's picture.
      if (!(Number.isFinite(effect.at) && effect.at >= 0 && effect.at < frames / rate)) {
        error ??= `Scene "${scene.id}" sound effect ${effect.src} needs an at between 0 and the scene's ${Math.round((frames / rate) * 100) / 100} s.`;
      }
    }
    const start = startFrame / rate;
    startFrame += frames;
    return {
      ...scene,
      start,
      end: startFrame / rate,
      ...(voiceoverSeconds === undefined ? {} : { voiceoverStart: start + leadIn, voiceoverSeconds }),
    };
  });
  return { scenes, duration: startFrame / rate, error };
}

/**
 * Place each scene's measured voiceover clip at that scene's start plus the lead-in, untrimmed.
 * @param {TimedScene[]} scenes
 * @param {number} [volume]
 * @returns {AudioTrack[]}
 * @example voiceoverTracks(buildSceneTimeline(content, durations).scenes, 0.9)
 */
export function voiceoverTracks(scenes, volume = 0.9) {
  return scenes.flatMap((scene) =>
    scene.voiceoverSeconds === undefined
      ? []
      : [{
          src: scene.voiceover,
          role: "voiceover",
          timelineStart: scene.voiceoverStart,
          sourceStart: 0,
          sourceEnd: scene.voiceoverSeconds,
          volume,
        }],
  );
}

/**
 * Place each scene's sound effects `at` seconds after the scene starts, untrimmed, quiet under the narration.
 * @param {TimedScene[]} scenes
 * @param {Map<string, number>} clipDurations
 * @param {{ loudness?: Map<string, number>, narration?: number | null }} [options]
 * @returns {AudioTrack[]}
 * @example effectTracks(buildSceneTimeline([{ id: "reveal", seconds: 3, effects: [{ src: "/rork-sfx-pop-v1.mp3", at: 1.2 }] }], durations).scenes, durations)
 */
export function effectTracks(scenes, clipDurations, { loudness = new Map(), narration = null } = {}) {
  return scenes.flatMap((scene) =>
    (scene.effects ?? []).map((effect) => ({
      src: effect.src,
      role: "effect",
      timelineStart: scene.start + effect.at,
      sourceStart: 0,
      ...(clipDurations.has(effect.src) ? { sourceEnd: clipDurations.get(effect.src) } : {}),
      ...mixLevel(effect.volume, EFFECT_VOLUME, loudness.get(effect.src), narration),
    })),
  );
}

/**
 * Trim one music bed to the composition length, fade it out before the end and dip it under the voiceovers.
 * A bed with a measured `loudness` is matched to the `narration`, so `volume` is relative to the narration: the
 * default 0.5 sits it 6 LU under, whatever the generated file's own level. Without either, `volume` (default 0.25) is
 * the file's gain.
 * @param {string} src
 * @param {number} duration
 * @param {{ volume?: number, fadeOut?: number, loudness?: number, narration?: number | null, duckUnder?: AudioTrack[] }} [options]
 * @returns {AudioTrack}
 * @example musicBedTrack("/rork-music-v1.mp3", 14.2, { loudness: -13.1, narration: -25.3, duckUnder: voiceovers })
 */
export function musicBedTrack(src, duration, { volume, fadeOut = 1.5, loudness, narration = null, duckUnder = [] } = {}) {
  const ducks = duckRanges(duckUnder, duration);
  return {
    src,
    role: "music",
    timelineStart: 0,
    sourceStart: 0,
    sourceEnd: duration,
    fadeOut: Math.min(fadeOut, duration),
    ...mixLevel(volume, MUSIC_VOLUME, loudness, narration),
    ...(ducks.length > 0 ? { ducks } : {}),
  };
}

/**
 * A film's finished soundtrack: one mix made outside the player, such as a score with dozens of effects already laid
 * on it, played from the film's first frame at its own level. The player neither levels it, nor dips it under
 * narration, nor fades it: whoever mixed it decided all of that. A file longer than the film is cut at the film's end,
 * and a shorter one plays to its own end, after which only the film's other tracks play.
 * @param {string} src
 * @param {number} duration
 * @returns {AudioTrack}
 * @example soundtrackTrack("/film-soundtrack-v1.wav", 24.5)
 */
export function soundtrackTrack(src, duration) {
  return { src, role: "soundtrack", timelineStart: 0, sourceStart: 0, sourceEnd: duration, volume: 1 };
}

/**
 * The spans the bed dips under: each voiceover, with lines closer than DUCK_JOIN_GAP, and the film's edges, joined
 * into one.
 * @param {AudioTrack[]} voiceovers
 * @param {number} duration
 * @returns {{ start: number, end: number }[]}
 */
function duckRanges(voiceovers, duration) {
  const ranges = voiceovers
    .filter((track) => track.volume > 0)
    .map((track) => ({
      start: track.timelineStart,
      end: Math.min(duration, track.timelineStart + (track.sourceEnd ?? duration) - track.sourceStart),
    }))
    .toSorted((first, second) => first.start - second.start);
  const joined = [];
  for (const range of ranges) {
    const last = joined.at(-1);
    if (last && range.start - last.end < DUCK_JOIN_GAP) last.end = Math.max(last.end, range.end);
    else joined.push({ ...range });
  }
  const first = joined[0];
  const last = joined.at(-1);
  if (first && first.start < DUCK_JOIN_GAP) first.start = 0;
  if (last && duration - last.end < DUCK_JOIN_GAP) last.end = duration;
  return joined;
}

function fadeGain(track, sourceTime, mediaEnd) {
  if (!(track.fadeOut > 0)) return 1;
  return Math.max(0, Math.min(1, (mediaEnd - sourceTime) / track.fadeOut));
}

/**
 * The gain a ducked track keeps at composition `time`. Ramps are linear in gain, so the export's millisecond gain
 * samples reproduce them exactly.
 * @param {AudioTrack} track
 * @param {number} time
 * @returns {number}
 */
function duckGain(track, time) {
  if (!track.ducks) return 1;
  let depth = 0;
  for (const { start, end } of track.ducks) {
    if (time < start) depth = Math.max(depth, 1 - (start - time) / DUCK_ATTACK);
    else if (time > end) depth = Math.max(depth, 1 - (time - end) / DUCK_RELEASE);
    else depth = 1;
  }
  return 1 - Math.max(0, depth) * (1 - DUCK_GAIN);
}

/**
 * The closest position to `time` that a seek can reach now, or null while a seek is pending.
 * Media served without byte-range support reports only 0 as seekable and snaps other seeks back to 0.
 * @param {{ seeking: boolean, seekable: { length: number, start(index: number): number, end(index: number): number } }} media
 * @param {number} time
 * @returns {number | null}
 */
function reachableSeekTime(media, time) {
  if (media.seeking) return null;
  let closest = null;
  for (let index = 0; index < media.seekable.length; index += 1) {
    const reachable = Math.min(Math.max(time, media.seekable.start(index)), media.seekable.end(index));
    if (closest === null || Math.abs(reachable - time) < Math.abs(closest - time)) closest = reachable;
  }
  return closest;
}

/** @type {WeakMap<object, AudioSyncState>} */
const audioSyncStates = new WeakMap();

/**
 * Seek toward `time` when the element can get strictly closer, so a seek that cannot land is never repeated.
 * @returns {boolean} whether a seek was issued
 */
function seekToward(audio, time) {
  const seekTime = reachableSeekTime(audio, time);
  if (seekTime === null || Math.abs(seekTime - time) >= Math.abs(audio.currentTime - time)) return false;
  audio.currentTime = seekTime;
  return true;
}

/** @returns {AudioSyncState} */
function createSyncState(time) {
  return { settledDrift: 0, settle: null, retried: false, seekOwed: false, smoothedError: 0, nudging: false, rate: 1, lastTime: time };
}

function startSettling(state, time) {
  state.settle = { anchorTime: time, anchorDrift: null };
  state.smoothedError = 0;
  state.nudging = false;
  state.rate = 1;
}

/**
 * Wait for the reported position to advance with the clock, then record the gap the seek left. A gap beyond the
 * hard bound gets one corrective seek; if the next settled gap is as large, it is output latency for the rate to close.
 */
function settleAudio(state, audio, time, drift, targetTime) {
  const { settle } = state;
  const elapsed = time - settle.anchorTime;
  if (audio.seeking || settle.anchorDrift === null || elapsed < SETTLE_WINDOW) {
    if (audio.seeking || settle.anchorDrift === null) Object.assign(settle, { anchorTime: time, anchorDrift: drift });
    return;
  }
  if (Math.abs(drift - settle.anchorDrift) > SETTLED_DRIFT_RATE * elapsed) {
    Object.assign(settle, { anchorTime: time, anchorDrift: drift });
    return;
  }
  if (Math.abs(drift) > HARD_SEEK_DRIFT && !state.retried && seekToward(audio, targetTime)) {
    state.retried = true;
    startSettling(state, time);
    return;
  }
  state.settle = null;
  state.retried = false;
  state.settledDrift = drift;
}

function setPlaybackRate(audio, rate) {
  if (typeof audio.playbackRate === "number" && audio.playbackRate !== rate) audio.playbackRate = rate;
}

/**
 * Synchronise one preview audio element to the composition clock and trim.
 * Start, resume and large drift seek; smaller drift from a playing track's baseline nudges its playbackRate around the
 * viewer's playback `speed`. The viewer's `gain` scales the mixed volume.
 * Seeks go only as far as the element can reach, so a host without byte ranges keeps the track playing.
 * @param {{ currentTime: number, loop: boolean, volume: number, muted: boolean, seeking: boolean, seekable: { length: number, start(index: number): number, end(index: number): number }, playbackRate?: number, preservesPitch?: boolean, ended?: boolean }} audio
 * @param {AudioTrack} track
 * @param {number} time
 * @param {number} mediaEnd
 * @param {boolean} playing
 * @param {boolean} wasActive
 * @param {{ speed?: number, gain?: number }} [viewer] Playback speed and volume the viewer chose, 1 by default.
 * @returns {{ active: boolean, shouldPlay: boolean }}
 * @example syncAudioTrack(audio, track, 2, 6, true, false, { speed: 1.5, gain: 0.8 })
 */
export function syncAudioTrack(audio, track, time, mediaEnd, playing, wasActive, { speed = 1, gain = 1 } = {}) {
  const trackOffset = time - track.timelineStart;
  const sourceTime = track.sourceStart + Math.max(0, trackOffset);
  // The heard position can trail the clock, so a clip that was playing finishes its tail rather than being cut off.
  // `ended` guards against play() restarting a file that stopped short of the trim point.
  const playingTail =
    wasActive && audio.ended !== true && audio.currentTime < mediaEnd && sourceTime < mediaEnd + MAX_TRAILING_TAIL;
  const active = playing && trackOffset >= 0 && (sourceTime < mediaEnd || playingTail);
  const shouldPlay = playing && (trackOffset < 0 || sourceTime < mediaEnd || playingTail);
  const boundedTime = Math.min(mediaEnd, sourceTime);

  // Muted looping prevents short clips ending before a delayed start, without another play call after the gesture.
  audio.loop = playing && trackOffset < 0;
  // Negative when the audio is behind the clock.
  const drift = audio.currentTime - boundedTime;
  let state = audioSyncStates.get(audio);
  if (!active) {
    audioSyncStates.delete(audio);
    if (!playing && Math.abs(drift) > PAUSED_AUDIO_DRIFT) seekToward(audio, boundedTime);
  } else if (!wasActive || state === undefined || time < state.lastTime) {
    // Start, resume and a rewound clock all restart output, so each seeks exactly and settles a new baseline.
    state = createSyncState(time);
    audioSyncStates.set(audio, state);
    // Rate nudges must not bend the pitch; Safari before 18 and old Firefox only know the prefixed names.
    for (const property of ["preservesPitch", "webkitPreservesPitch", "mozPreservesPitch"]) {
      if (property in audio) audio[property] = true;
    }
    // Checked before seeking: a seek this call issues leaves `seeking` set, which reads as unreachable.
    state.seekOwed = reachableSeekTime(audio, boundedTime) !== boundedTime;
    seekToward(audio, boundedTime);
    startSettling(state, time);
  } else {
    if (state.seekOwed && reachableSeekTime(audio, boundedTime) === boundedTime) {
      // A start or resume that could not reach its target yet (pending seek, ranges not loaded) still owes that seek.
      state.seekOwed = false;
      seekToward(audio, boundedTime);
      startSettling(state, time);
    } else if (state.settle !== null) {
      settleAudio(state, audio, time, drift, boundedTime);
    } else if (
      // A seek recreates the gap the last one left, so it only helps beyond that gap.
      (drift < Math.min(-HARD_SEEK_DRIFT, state.settledDrift - SEEK_GAP_MARGIN) ||
        drift > Math.max(HARD_SEEK_DRIFT, state.settledDrift + SEEK_GAP_MARGIN)) &&
      seekToward(audio, boundedTime)
    ) {
      startSettling(state, time);
    } else {
      const elapsed = Math.max(0, time - state.lastTime);
      state.smoothedError += (drift - state.smoothedError) * (1 - Math.exp(-elapsed / DRIFT_SMOOTHING_SECONDS));
      const size = Math.abs(state.smoothedError);
      state.nudging = size > NUDGE_START_DRIFT || (state.nudging && size > NUDGE_STOP_DRIFT);
      // A track behind the clock (negative error) speeds up; one ahead slows down.
      const nudge = Math.sign(-state.smoothedError) *
        Math.min(MAX_RATE_NUDGE, Math.max(MIN_RATE_NUDGE, NUDGE_GAIN * Math.abs(state.smoothedError)));
      state.rate = state.nudging ? 1 + Math.round(nudge * RATE_STEPS_PER_UNIT) / RATE_STEPS_PER_UNIT : 1;
    }
    state.lastTime = time;
  }
  setPlaybackRate(audio, active ? speed * state.rate : 1);
  audio.volume = active ? gain * track.volume * fadeGain(track, sourceTime, mediaEnd) * duckGain(track, time) : 0;
  audio.muted = !active;

  return { active, shouldPlay };
}

const TRACK_ROLES = new Set([undefined, "voiceover", "music", "soundtrack", "effect", "video"]);

/**
 * Check the film's audio files, decoded, against the length preview can hold in memory at once.
 * @param {number} totalSeconds The decoded length of every distinct audio file as seconds of stereo, added up.
 * @returns {string | null}
 * @example checkAudioLength(1900) // "The film's audio files are more than 30 minutes long together, counted as stereo…"
 */
export function checkAudioLength(totalSeconds) {
  if (totalSeconds <= MAX_AUDIO_SECONDS) return null;
  return `The film's audio files are more than ${MAX_AUDIO_SECONDS / 60} minutes long together, counted as stereo (a mono file counts half, a 5.1 file three times). Use fewer or shorter audio files.`;
}

/**
 * Validate the complete track list before enabling playback or rendering.
 * @param {AudioTrack[]} tracks
 * @param {number} duration
 * @returns {string | null}
 * @example validateAudioTracks([{ src: "/voice.mp3", timelineStart: 0, sourceStart: 0, volume: 0.9 }], 20)
 */
export function validateAudioTracks(tracks, duration) {
  if (!Array.isArray(tracks)) return "Audio tracks must be configured as an array.";
  if (tracks.length > MAX_AUDIO_TRACKS) return `Use no more than ${MAX_AUDIO_TRACKS} audio tracks.`;
  if (!Number.isFinite(duration) || duration <= 0) return "Audio requires a valid composition duration.";

  for (const [index, track] of tracks.entries()) {
    const number = index + 1;
    if (!track || typeof track.src !== "string" || track.src.trim() === "") {
      return `Audio track ${number} needs a local file path.`;
    }
    if (!Number.isFinite(track.timelineStart) || track.timelineStart < 0 || track.timelineStart >= duration) {
      return `Audio track ${number} must start within the composition.`;
    }
    if (!Number.isFinite(track.sourceStart) || track.sourceStart < 0) {
      return `Audio track ${number} source start must be zero or greater.`;
    }
    if (track.sourceEnd !== undefined && (!Number.isFinite(track.sourceEnd) || track.sourceEnd <= track.sourceStart)) {
      return `Audio track ${number} source end must be later than its source start.`;
    }
    if (!Number.isFinite(track.volume) || track.volume < 0 || track.volume > 1) {
      return `Audio track ${number} volume must be between 0 and 1.`;
    }
    if (track.fadeOut !== undefined && (!Number.isFinite(track.fadeOut) || track.fadeOut < 0)) {
      return `Audio track ${number} fade-out must be zero or more seconds.`;
    }
    if (!TRACK_ROLES.has(track.role)) {
      return `Audio track ${number} role must be "voiceover", "music", "soundtrack", "effect" or "video".`;
    }
    if (track.role === "voiceover") {
      if (track.sourceEnd === undefined) return `Voiceover track ${number} needs its measured clip length as source end.`;
      if (track.timelineStart + track.sourceEnd - track.sourceStart > duration + 1e-6) {
        return `Voiceover track ${number} would be cut off by the end of the composition.`;
      }
    }
    if (track.role === "effect") {
      if (track.sourceEnd === undefined) {
        return `Sound effect ${track.src} has no measured duration. Save it with scripts/download-audio.mjs.`;
      }
      if (track.timelineStart + track.sourceEnd - track.sourceStart > duration + 1e-6) {
        return `Sound effect ${track.src} would be cut off by the end of the composition; play it earlier.`;
      }
    }
    if (
      track.ducks !== undefined &&
      (!Array.isArray(track.ducks) ||
        track.ducks.some(({ start, end }) => !(Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start)))
    ) {
      return `Audio track ${number} dips must each end after they start.`;
    }
    if (track.levelShortfall !== undefined && !(track.levelShortfall > 0)) {
      return `Audio track ${number} level shortfall must be a positive number of LU.`;
    }
  }

  const voiceovers = tracks
    .filter((track) => track.role === "voiceover")
    .toSorted((first, second) => first.timelineStart - second.timelineStart);
  for (const [index, track] of voiceovers.entries()) {
    const next = voiceovers[index + 1];
    if (next && track.timelineStart + track.sourceEnd - track.sourceStart > next.timelineStart + 1e-6) {
      return `Voiceover ${track.src} overlaps ${next.src}; derive scene timing from the measured clips.`;
    }
  }

  return null;
}

/**
 * Compare a track with its loaded media so neither preview nor export trims speech or plays past a file.
 * @param {AudioTrack} track
 * @param {number} index
 * @param {number} mediaSeconds
 * @returns {string | null}
 * @example checkTrackMedia(track, 0, audio.duration)
 */
export function checkTrackMedia(track, index, mediaSeconds) {
  const number = index + 1;
  if (!Number.isFinite(mediaSeconds) || mediaSeconds <= 0) return `Audio track ${number} has no readable duration.`;
  if (
    track.sourceStart >= mediaSeconds ||
    (track.role !== "soundtrack" && (track.sourceEnd ?? 0) > mediaSeconds + MEDIA_DURATION_TOLERANCE)
  ) {
    if (track.role === "music") {
      return `Music track ${number} is shorter than the composition. Generate a bed at least as long as the film.`;
    }
    return track.role === "video"
      ? `The sound of scene video ${track.src} runs past the end of its file. Shorten the scene or set the video's volume to 0.`
      : `Audio track ${number} trim points are outside its local file.`;
  }
  if ((track.role === "voiceover" || track.role === "effect") && mediaSeconds > track.sourceEnd + MEDIA_DURATION_TOLERANCE) {
    const kind = track.role === "voiceover" ? "Voiceover" : "Sound effect";
    return `${kind} track ${number} is longer than its measured duration. Save it again with scripts/download-audio.mjs.`;
  }
  return null;
}

/**
 * The last source second a track can play before the composition ends.
 * @param {AudioTrack} track
 * @param {number} duration
 * @returns {number}
 * @example renderSourceEnd(musicBedTrack("/rork-music-v1.mp3", 12), 12) // 12
 */
export function renderSourceEnd(track, duration) {
  const latestSourceEnd = track.sourceStart + duration - track.timelineStart;
  return Math.min(track.sourceEnd ?? latestSourceEnd, latestSourceEnd);
}

/**
 * A track's gain in the export mix at composition time `time`: its volume, fade-out and dips under narration, as
 * preview applies them.
 * @param {AudioTrack} track
 * @param {number} time
 * @param {number} duration
 * @returns {number}
 * @example renderAudioGain(musicBedTrack("/rork-music-v1.mp3", 12), 11.25, 12) // 0.125
 */
export function renderAudioGain(track, time, duration) {
  const sourceTime = track.sourceStart + Math.max(0, time - track.timelineStart);
  return track.volume * fadeGain(track, sourceTime, renderSourceEnd(track, duration)) * duckGain(track, time);
}

/**
 * A track's export gain sampled `rate` times a second from its start until it stops playing, for a mixer that places
 * the track's samples itself and interpolates between these.
 * @param {AudioTrack} track
 * @param {number} duration
 * @param {number} rate
 * @returns {Float32Array}
 * @example renderAudioGains(musicBedTrack("/rork-music-v1.mp3", 12), 12, 1000).length // 12001
 */
export function renderAudioGains(track, duration, rate) {
  const seconds = Math.max(0, renderSourceEnd(track, duration) - track.sourceStart);
  const gains = new Float32Array(Math.ceil(seconds * rate) + 1);
  for (let index = 0; index < gains.length; index++) {
    gains[index] = renderAudioGain(track, track.timelineStart + index / rate, duration);
  }
  return gains;
}

// Samples per second of the gain curves the preview mix applies, as the export mix samples them.
const MIX_GAIN_RATE = 1000;
// The longest the mix runs before letting the page draw a frame and handle input.
const MIX_YIELD_MS = 16;

/**
 * Mix decoded tracks into one 16-bit stereo WAV file, placed, trimmed and gained exactly as the export mixes them.
 * Preview plays this one file instead of one media element per track: a dozen elements decoding at once, each seeking
 * at its start and holding the clock while it refills, stuttered at scene changes in some browsers. The mix is summed
 * a second at a time straight into the file, so it needs no full-length buffer beyond the file itself, and clips what
 * the sum pushes past full scale as the speakers would. It yields to the page between seconds, so a long film's mix
 * does not freeze the poster and controls while it is built.
 * @param {AudioTrack[]} tracks
 * @param {{ numberOfChannels: number, getChannelData(channel: number): Float32Array }[]} buffers Decoded at `sampleRate`.
 * @param {number} duration
 * @param {number} sampleRate
 * @param {AbortSignal} [stopped] Ends the mix at the next second's boundary: nobody wants the file any more.
 * @returns {Promise<ArrayBuffer | null>} The WAV file, or null when the mix was stopped.
 * @example new Blob([await mixAudioTracksToWav(tracks, decodedBuffers, 12, 48000)], { type: "audio/wav" })
 */
export async function mixAudioTracksToWav(tracks, buffers, duration, sampleRate, stopped) {
  const frames = Math.round(duration * sampleRate);
  const placed = tracks.flatMap((track, index) => {
    const buffer = buffers[index];
    if (!buffer || !(track.volume > 0)) return [];
    const offset = Math.round(track.sourceStart * sampleRate);
    const start = Math.round(track.timelineStart * sampleRate);
    const length = Math.min(
      Math.round((renderSourceEnd(track, duration) - track.sourceStart) * sampleRate),
      buffer.getChannelData(0).length - offset,
      frames - start,
    );
    return [{
      start,
      end: start + length,
      offset,
      gains: renderAudioGains(track, duration, MIX_GAIN_RATE),
      // The export's pan=stereo|FL=FL+FC|FR=FR+FC: mono on both sides at full level, and the centre, the third channel
      // of 3.0, 5.0, 5.1 and 7.1, added to both. Quad has no centre.
      sides: [buffer.getChannelData(0), buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1))],
      centre: buffer.numberOfChannels === 3 || buffer.numberOfChannels >= 5 ? buffer.getChannelData(2) : null,
    }];
  });

  const view = new DataView(new ArrayBuffer(44 + frames * 4));
  writeWavHeader(view, frames, sampleRate);
  const chunk = [new Float32Array(sampleRate), new Float32Array(sampleRate)];
  let workStart = performance.now();
  for (let chunkStart = 0; chunkStart < frames; chunkStart += sampleRate) {
    if (performance.now() - workStart > MIX_YIELD_MS) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      workStart = performance.now();
    }
    // After the yield, which is when the page can have removed the stage.
    if (stopped?.aborted) return null;
    const chunkEnd = Math.min(frames, chunkStart + sampleRate);
    for (const side of chunk) side.fill(0);
    for (const { start, end, offset, gains, sides, centre } of placed) {
      for (let frame = Math.max(start, chunkStart); frame < Math.min(end, chunkEnd); frame++) {
        const position = ((frame - start) / sampleRate) * MIX_GAIN_RATE;
        const before = Math.min(gains.length - 1, Math.floor(position));
        const after = Math.min(gains.length - 1, before + 1);
        const gain = gains[before] + (gains[after] - gains[before]) * (position - before);
        const source = offset + frame - start;
        const shared = centre === null ? 0 : centre[source];
        for (const channel of [0, 1]) chunk[channel][frame - chunkStart] += (sides[channel][source] + shared) * gain;
      }
    }
    for (let frame = chunkStart; frame < chunkEnd; frame++) {
      for (const channel of [0, 1]) {
        const sample = Math.max(-1, Math.min(1, chunk[channel][frame - chunkStart]));
        view.setInt16(44 + frame * 4 + channel * 2, Math.round(sample * 0x7fff), true);
      }
    }
  }
  return view.buffer;
}

function writeWavHeader(view, frames, sampleRate) {
  const text = (offset, value) => {
    for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + frames * 4, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, frames * 4, true);
}

/**
 * Place each scene's video at the scene's start, beginning `sourceStart` seconds into the file. The picture lasts as
 * long as the scene is visible: through the `transitionSeconds` it stays beneath the next scene, but no longer than
 * that scene, whose own end hides it. Its sound stops at the scene's end, as the narration does.
 * @param {TimedScene[]} scenes
 * @param {number} [transitionSeconds]
 * @returns {VideoClip[]}
 * @example sceneVideoClips(buildSceneTimeline([{ id: "demo", seconds: 5, video: { src: "/rork-demo-v1.mp4" } }], new Map()).scenes, 0.6)
 */
export function sceneVideoClips(scenes, transitionSeconds = 0) {
  return scenes.flatMap((scene, index) => {
    if (scene.video === undefined) return [];
    const next = scenes[index + 1];
    const visibleEnd = next === undefined ? scene.end : Math.min(scene.end + Math.max(0, transitionSeconds), next.end);
    return [{
      sceneId: scene.id,
      src: scene.video.src,
      timelineStart: scene.start,
      sourceStart: scene.video.sourceStart ?? 0,
      duration: visibleEnd - scene.start,
      soundDuration: scene.end - scene.start,
      volume: scene.video.volume ?? 0,
    }];
  });
}

/**
 * A video's own sound, mixed like any other track at its own volume. The video element itself stays muted in
 * preview and export, so the sound plays once.
 * @param {VideoClip[]} clips
 * @returns {AudioTrack[]}
 * @example videoSoundTracks([{ sceneId: "demo", src: "/rork-demo-v1.mp4", timelineStart: 5, sourceStart: 2, duration: 4, soundDuration: 4, volume: 0.5 }])
 */
export function videoSoundTracks(clips) {
  return clips.flatMap((clip) =>
    clip.volume > 0
      ? [{
          src: clip.src,
          role: "video",
          timelineStart: clip.timelineStart,
          sourceStart: clip.sourceStart,
          sourceEnd: clip.sourceStart + clip.soundDuration,
          volume: clip.volume,
        }]
      : [],
  );
}

/**
 * Validate every scene video before enabling playback or rendering.
 * @param {VideoClip[]} clips
 * @returns {string | null}
 * @example validateVideoClips([{ sceneId: "demo", src: "/rork-demo-v1.mp4", timelineStart: 0, sourceStart: 0, duration: 5, soundDuration: 5, volume: 0 }])
 */
export function validateVideoClips(clips) {
  if (clips.length > MAX_VIDEO_CLIPS) return `Use no more than ${MAX_VIDEO_CLIPS} scene videos.`;
  for (const clip of clips) {
    if (typeof clip.src !== "string" || clip.src.trim() === "") return `Scene "${clip.sceneId}" video needs a local file path.`;
    if (!Number.isFinite(clip.sourceStart) || clip.sourceStart < 0) {
      return `Scene "${clip.sceneId}" video needs a sourceStart of 0 seconds or more.`;
    }
    if (!Number.isFinite(clip.volume) || clip.volume < 0 || clip.volume > 1) {
      return `Scene "${clip.sceneId}" video volume must be between 0 and 1.`;
    }
  }
  return null;
}

/**
 * Check a loaded scene video against its clip: its first shown frame must be inside the file.
 * @param {VideoClip} clip
 * @param {number} index
 * @param {number} mediaSeconds
 * @returns {string | null}
 * @example checkVideoMedia({ sceneId: "demo", src: "/rork-demo-v1.mp4", timelineStart: 0, sourceStart: 40, duration: 5, soundDuration: 5, volume: 0 }, 0, 30) // 'Scene "demo" video starts at 40 s, but its file is only 30 s long.'
 */
export function checkVideoMedia(clip, index, mediaSeconds) {
  if (!Number.isFinite(mediaSeconds) || mediaSeconds <= 0) return `Scene video ${index + 1} has no readable duration.`;
  if (clip.sourceStart >= mediaSeconds) {
    return `Scene "${clip.sceneId}" video starts at ${clip.sourceStart} s, but its file is only ${Math.round(mediaSeconds * 10) / 10} s long.`;
  }
  return null;
}

/**
 * The file position a scene video shows at composition time `time`: its first frame before the scene and its last
 * frame after it, so preview and export both hold the last frame when the file is shorter than the scene.
 * @param {VideoClip} clip
 * @param {number} time
 * @param {number} mediaSeconds
 * @returns {number}
 * @example videoSourceTime({ sceneId: "demo", src: "/rork-demo-v1.mp4", timelineStart: 5, sourceStart: 2, duration: 4, soundDuration: 4, volume: 0 }, 6.5, 30) // 3.5
 */
export function videoSourceTime(clip, time, mediaSeconds) {
  const offset = Math.max(0, Math.min(clip.duration, time - clip.timelineStart));
  return Math.min(clip.sourceStart + offset, Number.isFinite(mediaSeconds) ? mediaSeconds : Infinity);
}

/**
 * Synchronise one preview video to the composition clock. A playing video only seeks when it drifts, so normal
 * playback stays smooth; a paused one lands on the exact frame. Like audio, it seeks only as far as the element can
 * reach and only when that reduces the drift, so a seek that a host without byte ranges snaps back is not repeated
 * on every `seeked` event. A playing video runs at the viewer's playback `speed`.
 * @param {{ currentTime: number, duration: number, seeking: boolean, playbackRate?: number, seekable: { length: number, start(index: number): number, end(index: number): number } }} video
 * @param {VideoClip} clip
 * @param {number} time
 * @param {boolean} playing
 * @param {number} [speed]
 * @returns {{ shouldPlay: boolean }}
 * @example syncVideoClip(video, clip, 6.5, true, 1.5)
 */
export function syncVideoClip(video, clip, time, playing, speed = 1) {
  const target = videoSourceTime(clip, time, video.duration);
  const inScene = time >= clip.timelineStart && time < clip.timelineStart + clip.duration;
  const shouldPlay = playing && inScene && target < video.duration;
  const tolerance = shouldPlay ? 0.25 : 1 / FRAME_RATE / 2;
  const drift = Math.abs(video.currentTime - target);
  const seekTime = drift > tolerance ? reachableSeekTime(video, target) : null;
  if (seekTime !== null && Math.abs(seekTime - target) < drift) video.currentTime = seekTime;
  if (shouldPlay) setPlaybackRate(video, speed);
  return { shouldPlay };
}

// How far ahead of its scene preview starts buffering a scene video in full.
export const VIDEO_PRELOAD_AHEAD_SECONDS = 6;

/**
 * Which scene videos preview needs at composition time `time`. `needed` lists the clips on screen then and the next
 * scene's, which playback must be able to start without waiting; `preload` adds every clip starting within
 * {@link VIDEO_PRELOAD_AHEAD_SECONDS}, so a later scene's video buffers in full just before it is shown while the rest
 * load only their metadata.
 * @param {readonly { id: string, end: number }[]} scenes
 * @param {readonly VideoClip[]} clips
 * @param {number} time
 * @returns {{ needed: number[], preload: number[] }} Indices into `clips`.
 * @example sceneVideoNeeds(scenes, clips, 0) // { needed: [0, 1], preload: [0, 1] }
 */
export function sceneVideoNeeds(scenes, clips, time) {
  const current = scenes.findIndex((scene) => time < scene.end);
  const nextSceneId = current === -1 ? undefined : scenes[current + 1]?.id;
  const needed = [];
  const preload = [];
  for (const [index, clip] of clips.entries()) {
    const shown = time >= clip.timelineStart && time < clip.timelineStart + clip.duration;
    const isNeeded = shown || clip.sceneId === nextSceneId;
    if (isNeeded) needed.push(index);
    if (isNeeded || (clip.timelineStart > time && clip.timelineStart - time <= VIDEO_PRELOAD_AHEAD_SECONDS)) {
      preload.push(index);
    }
  }
  return { needed, preload };
}

// HTMLMediaElement.HAVE_FUTURE_DATA: enough data to play on from the current position.
const HAVE_FUTURE_DATA = 3;

/**
 * Whether a preview element that fired `waiting` or `stalled` holds the clock: only one the viewer needs now, still
 * playing and short of data. A paused element resyncs once it is needed. An audio track plays muted and looped ahead
 * of its start, so it is needed only while {@link trackHeard}; one that starts being heard is checked again, because
 * a track that ran out of data while unheard need not report it again.
 * @param {{ paused: boolean, readyState: number }} media
 * @param {boolean} needed
 * @returns {boolean}
 * @example starvedMediaHoldsClock(audio, trackHeard(track, syncAudioTrack(audio, track, 4.9, 3, true, false).active, false)) // false before the track starts
 */
export function starvedMediaHoldsClock(media, needed) {
  return needed && !media.paused && media.readyState < HAVE_FUTURE_DATA;
}

/**
 * Whether the viewer hears a preview track now: active at its last syncAudioTrack, not muted by the viewer and mixed
 * above silence. Only a heard track is needed by {@link starvedMediaHoldsClock}.
 * @param {AudioTrack} track
 * @param {boolean} active
 * @param {boolean} muted
 * @returns {boolean}
 * @example trackHeard(track, syncAudioTrack(audio, track, 5.1, 3, true, false).active, false) // true
 */
export function trackHeard(track, active, muted) {
  return active && !muted && track.volume > 0;
}

/**
 * Which scenes are on screen at composition time `time`: the scene the clock is in, the final one at the exact end,
 * and, within `transitionSeconds` of its start, the scene before it, still visible beneath it.
 * @param {readonly { end: number, start: number }[]} scenes
 * @param {number} time
 * @param {number} transitionSeconds
 * @returns {{ active: number, outgoing: number }} Scene indices; `outgoing` is -1 outside a transition.
 * @example shownScenesAt([{ start: 0, end: 4 }, { start: 4, end: 9 }], 4.2, 0.5) // { active: 1, outgoing: 0 }
 */
export function shownScenesAt(scenes, time, transitionSeconds) {
  const found = scenes.findIndex((scene) => time < scene.end);
  const active = found === -1 ? scenes.length - 1 : found;
  const outgoing = active > 0 && time < scenes[active].start + transitionSeconds ? active - 1 : -1;
  return { active, outgoing };
}

// Further than this into a chapter, Previous restarts it, as media players do; nearer its start it goes back one chapter.
export const CHAPTER_RESTART_SECONDS = 2;

/**
 * Group timed scenes into chapters. A scene with a `chapter` title starts one that runs until the next scene with a
 * different title, so untitled scenes, or scenes repeating the title, continue the chapter before them. The first
 * chapter starts at 0, taking in any untitled opening scenes, and a film without titles has none.
 * @param {(TimedScene & { chapter?: string })[]} scenes
 * @returns {Chapter[]}
 * @example sceneChapters([{ id: "logo", start: 0, end: 2 }, { id: "intro", start: 2, end: 9, chapter: "Setup" }]) // [{ title: "Setup", start: 0, end: 9 }]
 */
export function sceneChapters(scenes) {
  const chapters = [];
  for (const scene of scenes) {
    const title = typeof scene.chapter === "string" ? scene.chapter.replace(/\s+/g, " ").trim() : "";
    const current = chapters.at(-1);
    if (title !== "" && title !== current?.title) {
      chapters.push({ title, start: current ? scene.start : 0, end: scene.end });
    } else if (current) {
      current.end = scene.end;
    }
  }
  return chapters;
}

/**
 * The index of the chapter playing at composition time `time`.
 * @param {readonly Chapter[]} chapters
 * @param {number} time
 * @returns {number}
 * @example chapterIndexAt([{ title: "Setup", start: 0, end: 4 }, { title: "Demo", start: 4, end: 9 }], 5) // 1
 */
export function chapterIndexAt(chapters, time) {
  return Math.max(0, chapters.findLastIndex((chapter) => chapter.start <= time));
}

/**
 * Where the previous or next chapter control moves the clock. Next after the last chapter goes to the end.
 * @param {readonly Chapter[]} chapters
 * @param {number} time
 * @param {"previous" | "next"} direction
 * @param {number} duration
 * @returns {number}
 * @example chapterSeekTarget([{ title: "Setup", start: 0, end: 5 }, { title: "Demo", start: 5, end: 9 }], 6, "previous", 9) // 0
 */
export function chapterSeekTarget(chapters, time, direction, duration) {
  const starts = chapters.map((chapter) => chapter.start);
  if (direction === "next") return starts.find((start) => start > time) ?? duration;
  const current = chapterIndexAt(chapters, time);
  const start = starts[current] ?? 0;
  // Frame times are thirtieths, so exactly 2 seconds in can subtract to a hair over 2.
  const restarts = time - start - CHAPTER_RESTART_SECONDS > 1e-6;
  return restarts ? start : (starts[Math.max(0, current - 1)] ?? 0);
}

/** @typedef {{ src: string, timelineStart: number, sourceStart: number, sourceEnd?: number, volume: number, fadeOut?: number, ducks?: { start: number, end: number }[], levelShortfall?: number, role?: "voiceover" | "music" | "soundtrack" | "effect" | "video" }} AudioTrack */
/** @typedef {{ src: string, sourceStart?: number, volume?: number }} SceneVideo */
/** @typedef {{ src: string, at: number, volume?: number }} SceneEffect */
/** @typedef {{ sceneId: string, src: string, timelineStart: number, sourceStart: number, duration: number, soundDuration: number, volume: number }} VideoClip */
/** @typedef {{ id: string, seconds?: number, voiceover?: string, minSeconds?: number, video?: SceneVideo, effects?: SceneEffect[] }} SceneContent */
/** @typedef {SceneContent & { start: number, end: number, voiceoverStart?: number, voiceoverSeconds?: number }} TimedScene */
/** @typedef {{ settledDrift: number, settle: { anchorTime: number, anchorDrift: number | null } | null, retried: boolean, seekOwed: boolean, smoothedError: number, nudging: boolean, rate: number, lastTime: number }} AudioSyncState */
/** @typedef {{ title: string, start: number, end: number }} Chapter */
