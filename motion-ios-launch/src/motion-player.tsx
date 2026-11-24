// @rork/motion-player 1.17.4 — copied unchanged from Rork's web-motion skill. Do not edit: Rork's export replaces it
// with the current 1.x copy, and app changes belong in src/motion.tsx.
import renderStatus from "./render-status.json";
import {
  FRAME_RATE,
  buildSceneTimeline,
  chapterIndexAt,
  chapterSeekTarget,
  checkFrameRate,
  checkAudioLength,
  checkTrackMedia,
  checkVideoMedia,
  effectTracks,
  indexClipDurations,
  indexClipLoudness,
  mixAudioTracksToWav,
  musicBedTrack,
  soundtrackTrack,
  narrationLevelWarning,
  narrationLoudness,
  renderAudioGains,
  renderSourceEnd,
  sceneChapters,
  sceneVideoClips,
  sceneVideoNeeds,
  shownScenesAt,
  starvedMediaHoldsClock,
  syncAudioTrack,
  trackHeard,
  trackLevelWarning,
  syncVideoClip,
  validateAudioTracks,
  validateVideoClips,
  videoSoundTracks,
  videoSourceTime,
  voiceoverTracks,
} from "./audio-mix.mjs";
import { MotionGlobalConfig, animate, frameData, frameSteps, motionValue, time } from "motion";
import { version as motionVersion } from "motion/package.json";
import {
  LayoutGroup,
  MotionConfig,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";

export const MOTION_PLAYER_VERSION = "1.17.4";

/**
 * A local video a scene shows from `sourceStart` for the whole scene and its transition out; `volume` above 0 mixes its
 * own sound until the scene ends.
 */
export type SceneVideo = { src: string; sourceStart?: number; volume?: number };

/**
 * A measured local sound effect played `at` seconds after its scene starts, on the frame of the event it answers.
 * `volume` is relative to the narration, 0.35 by default.
 */
export type SceneEffect = { src: string; at: number; volume?: number };

/**
 * One scene's timing. Silent scenes set `seconds`; a narrated scene sets `voiceover` to its own measured local clip,
 * whose length (plus a short lead-in and tail) sets the scene duration, and `minSeconds` optionally holds it longer.
 * `chapter` titles a chapter that starts with this scene and runs until the next scene with a different title.
 */
export type SceneContent = {
  id: string;
  seconds?: number;
  voiceover?: string;
  minSeconds?: number;
  video?: SceneVideo;
  chapter?: string;
  effects?: readonly SceneEffect[];
};

/** A titled section of the film, derived from the scenes' `chapter` titles. */
export type Chapter = { title: string; start: number; end: number };

/** A scene with the boundaries the player derived for it. */
export type TimedScene<Scene extends SceneContent> = Scene & {
  start: number;
  end: number;
  voiceoverStart?: number;
  voiceoverSeconds?: number;
};

/**
 * What a scene component receives. Animate from `clock`, or start Motion animations when `active` turns on, never
 * from timers, so pause, seek and export follow it.
 */
export type SceneRenderProps<Scene extends SceneContent> = {
  scene: TimedScene<Scene>;
  /** The shared composition clock in seconds. */
  clock: MotionValue<number>;
  /**
   * True from the scene's start to its end once the first Play or seek has started the film, so an entrance keyed on
   * it plays when the scene appears; the scene stays visible for `transitionSeconds` more beneath the next one. A
   * preview seek or Replay that moves the clock back remounts the scene it lands in, so the entrance plays again.
   * A preview that waits for Play first shows a poster: the opening scene is active on a clock held halfway through
   * it, with Motion animations skipped to their end, and the first Play or seek remounts it so its entrance plays.
   */
  active: boolean;
  reducedMotion: boolean;
  /**
   * The scene's synchronised video when it sets `video`, otherwise null. Place it inside a positioned wrapper sized
   * as you like; animate and clip that wrapper, never the video, because export draws each frame beside it.
   */
  video: ReactNode;
};

/** What a Backdrop or Overlay receives: it is drawn for the whole film, across every scene boundary. */
export type FilmLayerProps<Scene extends SceneContent> = {
  scenes: readonly TimedScene<Scene>[];
  /** The scene the clock is in; a layer can change backgrounds, colours or props between acts from it. */
  activeScene: TimedScene<Scene>;
  /** The shared composition clock in seconds. */
  clock: MotionValue<number>;
  reducedMotion: boolean;
};

export type MotionPlayerProps<Scene extends SceneContent> = {
  content: readonly Scene[];
  /** One optional local music bed, trimmed and faded to the derived film length and dipped under every line. */
  musicBed?: string | null;
  /**
   * One optional finished mix of the film's sound, a local file played from the start at its own level: not levelled,
   * dipped or faded, cut at the film's end, and followed only by the film's other tracks when it ends first. For a film
   * whose music and effects are mixed outside the player.
   */
  soundtrack?: string | null;
  voiceoverVolume?: number;
  /**
   * The bed's level relative to the narration when scripts/download-audio.mjs measured both: an explicit value sets
   * how far under the narration the bed sits, whatever the file's own loudness, so 1 is level with it, the default 0.5
   * is 6 LU under and 0.25 is 12 LU under, before the dip under each line. A bed or narration saved before loudness was
   * recorded takes it as the file's own gain instead, 0.25 by default.
   */
  musicVolume?: number;
  /**
   * The film's frame rate, 30 unless set: 60 for a film whose camera moves or fast motion step visibly at 30. A 60
   * film has twice the frames, so its MP4 takes about twice as long to export and is larger. Preview plays the same.
   */
  fps?: 30 | 60;
  /** The export size, which must match data-width and data-height on index.html's composition root. */
  width?: number;
  height?: number;
  /** Classes for the composition surface, such as its background colour. */
  surfaceClassName?: string;
  /**
   * Renders each scene. Every scene's `id` is its own, so two scenes that share a layout branch on a field of their
   * own, such as `layout`, rather than on the id.
   */
  Scene: ComponentType<SceneRenderProps<Scene>>;
  /** Drawn behind every scene for the whole film, such as a background that changes between acts. */
  Backdrop?: ComponentType<FilmLayerProps<Scene>>;
  /** Drawn above every scene for the whole film, such as a prop that travels between scenes or a transition wipe. */
  Overlay?: ComponentType<FilmLayerProps<Scene>>;
  /**
   * Seconds each scene stays visible beneath the next one after its end, so the next scene's entrance can cross-fade,
   * wipe or slide over it and the outgoing scene's exit stays in view. 0, the default, cuts between scenes.
   */
  transitionSeconds?: number;
};

// How far one arrow key press moves the focused seek bar; Page Up and Page Down move five times as far.
const SEEK_STEP_SECONDS = 1;
// How far the player's arrow key shortcuts move the clock, and how far J, L and the skip buttons move it.
const SHORTCUT_SEEK_SECONDS = 5;
const SKIP_SECONDS = 10;
// How far the clock moves before the control bar's time and chapter re-render; the seek bar itself follows every frame.
const CONTROL_REFRESH_SECONDS = 0.25;
const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const VOLUME_STEP = 0.1;
const SLIDER_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);
const FRAME_PREVIEW_MAX_WIDTH = 176;
const FRAME_PREVIEW_MAX_HEIGHT = 128;
// Laid out larger and scaled down, so container-unit text stays above browsers' minimum font size.
const FRAME_PREVIEW_OVERSCALE = 4;

/** Matches the VideoClip typedef in audio-mix.mjs, which plain JavaScript cannot export to TypeScript. */
type VideoClip = {
  sceneId: string;
  src: string;
  timelineStart: number;
  sourceStart: number;
  duration: number;
  soundDuration: number;
  volume: number;
};

// scripts/download-audio.mjs writes one measured duration and loudness per clip here; never type them by hand.
const measuredClips = Object.values(import.meta.glob("./audio-clips/*.json", { eager: true, import: "default" }));
const clipDurations = indexClipDurations(measuredClips);
const clipLoudness = indexClipLoudness(measuredClips);

/** A media source as an error names it: without its query, and cut so a long one leaves room for the reason. */
function shortSource(src: string) {
  const path = src.split(/[?#]/)[0] ?? src;
  return path.length > 120 ? `…${path.slice(-119)}` : path;
}

function resolveLocalMediaSource(src: string) {
  try {
    const url = new URL(src, window.location.href);
    return url.origin === window.location.origin ? url.href : null;
  } catch {
    return null;
  }
}

/** Every boundary and track derives from the same content, so a new clip or duration moves later scenes. */
function deriveComposition<Scene extends SceneContent>(
  content: readonly Scene[],
  musicBed: string | null,
  soundtrack: string | null,
  voiceoverVolume: number,
  musicVolume: number | undefined,
  transitionSeconds: number,
  fps: number,
) {
  const timeline = buildSceneTimeline(content, clipDurations, { frameRate: fps });
  const scenes = timeline.scenes as TimedScene<Scene>[];
  const duration: number = timeline.duration;
  const chapters: Chapter[] = sceneChapters(scenes);
  const videoClips: VideoClip[] = sceneVideoClips(scenes, transitionSeconds);
  const voiceovers = voiceoverTracks(scenes, voiceoverVolume);
  const narration: number | null = narrationLoudness(voiceovers, clipLoudness);
  const configuredAudioTracks = [
    ...voiceovers,
    ...(musicBed === null
      ? []
      : [
          musicBedTrack(musicBed, duration, {
            volume: musicVolume,
            loudness: clipLoudness.get(musicBed),
            narration,
            duckUnder: voiceovers,
          }),
        ]),
    ...(soundtrack === null ? [] : [soundtrackTrack(soundtrack, duration)]),
    ...effectTracks(scenes, clipDurations, { loudness: clipLoudness, narration }),
    ...videoSoundTracks(videoClips),
  ];
  const trackConfigError: string | null =
    timeline.error ?? validateVideoClips(videoClips) ?? validateAudioTracks(configuredAudioTracks, duration);
  const audioTracks = trackConfigError === null ? configuredAudioTracks : [];
  const videos = trackConfigError === null ? videoClips : [];
  const audioSources = audioTracks.map((track) => resolveLocalMediaSource(track.src));
  const videoSources = videos.map((clip) => resolveLocalMediaSource(clip.src));
  const configError =
    trackConfigError ??
    ([...audioSources, ...videoSources].some((source) => source === null)
      ? "Use audio and video files that are part of this Web app."
      : null);
  const narrationWarning: string | null =
    trackConfigError === null ? narrationLevelWarning(voiceovers, clipLoudness) : null;
  const levelWarnings = [
    ...(narrationWarning === null ? [] : [narrationWarning]),
    ...audioTracks.flatMap((track) => trackLevelWarning(track) ?? []),
  ];
  // A rate the film cannot have is an error, and the timeline was then laid out at the default.
  const frameRate: number = checkFrameRate(fps) === null ? fps : FRAME_RATE;
  return {
    scenes,
    duration,
    frameRate,
    chapters,
    audioTracks,
    audioSources,
    videos,
    videoSources,
    configError,
    levelWarnings,
  };
}

type Composition<Scene extends SceneContent = SceneContent> = ReturnType<typeof deriveComposition<Scene>>;

const MIX_SAMPLE_RATE = 48_000;

/**
 * A track's file once fetched and decoded: its length, what it weighs in memory as seconds of stereo, and its samples
 * when preview will mix them.
 */
type LoadedAudio = { seconds: number; stereoSeconds: number; buffer: AudioBuffer | null } | "unloaded" | "undecodable";

/**
 * Fetches and decodes every track's file and checks each track against its trim, and the files together against
 * the length a page can hold. Preview then mixes them into one WAV, which plays on a single element, so it keeps the
 * decoded samples. Export mixes the files itself and every render page loads the film, so there each file is
 * measured and let go. Files are decoded one after another and the film is refused as soon as they pass the limit, so
 * a film over it never holds more than the limit and one file. `stopped` ends the load between two files when its
 * stage is removed.
 */
async function loadAudioMix(
  composition: Composition,
  mix: boolean,
  stopped: AbortSignal,
): Promise<{ url: string | null } | { error: string }> {
  const { audioTracks, audioSources, duration } = composition;
  if (audioTracks.length === 0) return { url: null };
  const context = new OfflineAudioContext(2, 1, MIX_SAMPLE_RATE);
  async function load(source: string): Promise<LoadedAudio> {
    let bytes: ArrayBuffer;
    try {
      const response = await fetch(source, { signal: stopped });
      if (!response.ok) return "unloaded";
      bytes = await response.arrayBuffer();
    } catch {
      return "unloaded";
    }
    try {
      const buffer = await context.decodeAudioData(bytes);
      // A decoded file keeps its own channels: a 5.1 file weighs three times a stereo one.
      const stereoSeconds = (buffer.duration * buffer.numberOfChannels) / 2;
      return { seconds: buffer.duration, stereoSeconds, buffer: mix ? buffer : null };
    } catch {
      return "undecodable";
    }
  }
  // A sound effect used by several scenes is fetched and decoded once.
  const sources = [...new Set(audioSources.map((source) => source!))];
  const loaded = new Map<string, LoadedAudio>();
  let stereoSeconds = 0;
  for (const source of sources) {
    // The stage this load belongs to is gone (the film's tracks changed): load nothing more for it.
    if (stopped.aborted) return { url: null };
    const file = await load(source);
    loaded.set(source, file);
    if (typeof file === "string") continue;
    stereoSeconds += file.stereoSeconds;
    const lengthError: string | null = checkAudioLength(stereoSeconds);
    if (lengthError !== null) return { error: lengthError };
  }
  const buffers: AudioBuffer[] = [];
  for (const [index, track] of audioTracks.entries()) {
    const file = loaded.get(audioSources[index]!);
    if (file === "unloaded" || file === undefined) {
      return {
        error: `Audio track ${index + 1} (${shortSource(track.src)}) could not be loaded. Check that the file is in the app and reload it.`,
      };
    }
    if (file === "undecodable") {
      return {
        error:
          track.role === "video"
            ? `Scene video ${track.src} has no sound the browser can play. Set the video's volume to 0.`
            : `Audio track ${index + 1} could not be decoded. Save it again with scripts/download-audio.mjs.`,
      };
    }
    const mediaError = checkTrackMedia(track, index, file.seconds);
    if (mediaError !== null) return { error: mediaError };
    if (file.buffer !== null) buffers.push(file.buffer);
  }
  if (!mix || stopped.aborted) return { url: null };
  const wav: ArrayBuffer | null = await mixAudioTracksToWav(audioTracks, buffers, duration, MIX_SAMPLE_RATE, stopped);
  if (wav === null) return { url: null };
  return { url: URL.createObjectURL(new Blob([wav], { type: "audio/wav" })) };
}

// Rork's renderer opens the page with ?render-video, which also previews the export layout in a normal browser.
const renderMode = new URLSearchParams(window.location.search).has("render-video");

/** The frame rate Rork's renderer exports at: the film's own once its composition is ready, 30 until then. */
let renderFps: number = FRAME_RATE;
/** Samples per second of each audio track's gain curve in the export mix. */
const RENDER_GAIN_RATE = 1000;

/** What the export reads once the composition is ready; it mirrors @rork/motion-render's protocol. */
type RenderInfo = {
  /** The film's frame rate, which the export renders at. */
  fps: number;
  duration: number;
  chapters: Chapter[];
  audioTracks: { src: string; timelineStart: number; sourceStart: number; sourceEnd: number; gains: string }[];
};

/**
 * The API Rork's renderer drives on `window.__rorkMotionRender`. `version` tells a renderer that opens a hosted build
 * which player it holds, so it can render the build as it is or ask for a refreshed one.
 */
type RenderApi = { version: string; fps: number; ready: Promise<RenderInfo>; renderFrame(frame: number): Promise<void> };

let settleRenderReady: (result: { info: RenderInfo } | { error: string }) => void = () => {};
// Set once the composition is ready; brings it to one export frame.
let renderFrameTo: ((frame: number) => Promise<void>) | null = null;

/**
 * Whether export can run Motion on a manual clock. Before 14.6 Motion still hands plain tweens to the browser's clock
 * on one, and that clock does not follow the export's frames, so those tweens would freeze. Rork's export refreshes the
 * player without upgrading an app's dependencies, so an older Motion keeps the clock-only export instead.
 */
const manualMotionClock = (() => {
  const [major = 0, minor = 0] = motionVersion.split(".").map(Number);
  return major > 14 || (major === 14 && minor >= 6);
})();

if (renderMode) {
  // Export steps Motion's frameloop to each frame's own time, so springs, AnimatePresence exits, layout animations and
  // other free-running animations render the same frames on every export, whichever page renders them. Motion 14.6
  // and later also move the opacity and transform animations it would hand to the browser's clock into JavaScript.
  if (manualMotionClock) {
    MotionGlobalConfig.useManualTiming = true;
  } else {
    console.warn(
      `Motion ${motionVersion} exports clock-driven layers only; free-running animations need Motion 14.6 or later.`,
    );
  }
  // Registered before React mounts, so the renderer waits for fonts and media instead of drawing an empty page, and
  // a configuration or media error fails the export instead of rendering a silent or partial film.
  const ready = new Promise<RenderInfo>((resolve, reject) => {
    settleRenderReady = (result) => {
      if ("info" in result) return resolve(result.info);
      // The renderer fails the export with the text after this prefix.
      console.error(`Motion export failed: ${result.error}`);
      reject(new Error(result.error));
    };
  });
  ready.catch(() => {});
  const api: RenderApi = {
    version: MOTION_PLAYER_VERSION,
    get fps() {
      return renderFps;
    },
    ready,
    renderFrame: (frame) =>
      renderFrameTo === null ? Promise.reject(new Error("The composition is not ready to render.")) : renderFrameTo(frame),
  };
  (window as Window & { __rorkMotionRender?: RenderApi }).__rorkMotionRender = api;
}

/**
 * The page clock Rork's renderer installs before the film's scripts. Animation frames, CSS animations, timers,
 * `Date.now()`, `performance.now()` and `Math.random` all follow it, so the film is the same on every page that
 * renders a part of it. `enter`, `restart`, `settle` and `real` are missing from a renderer older than they are.
 */
type RenderClock = {
  advance(ms: number): void;
  enter?(ms: number): void;
  restart?(ms: number): void;
  settle?(): Promise<void>;
  real?: { setTimeout(handler: () => void, ms: number): number; clearTimeout(handle: number): void };
};

function renderClock() {
  return (window as Window & { __rorkRenderClock?: RenderClock }).__rorkRenderClock;
}

/**
 * Runs Motion's frame at `timestamp`. Under Rork's renderer, Motion's frameloop waits on the export's page clock, so
 * advancing the clock runs Motion's batch, and every other animation frame callback, exactly once with this frame's
 * time and delta, and seeks CSS animations to it. Without the clock, as when previewing the export layout, the steps
 * run here directly, as Motion's processFrame (14.6 and later) does.
 */
function processMotionFrame(timestamp: number) {
  // The player never steps Motion from inside a Motion frame, so a frame still processing means a callback threw inside
  // Motion's own frame, which leaves its flag set; returning here would freeze every later frame of the film.
  if (frameData.isProcessing) throw new Error("A Motion animation callback failed and stopped Motion's frameloop.");
  frameData.delta = timestamp - frameData.timestamp;
  time.set((frameData.timestamp = timestamp));
  const clock = renderClock();
  if (clock !== undefined) {
    clock.advance(timestamp);
    return;
  }
  frameData.isProcessing = true;
  try {
    // frameSteps lists Motion's steps in the order a frame runs them.
    for (const step of Object.values(frameSteps)) step.process(frameData);
  } finally {
    frameData.isProcessing = false;
  }
}

/**
 * Brings the whole composition, free-running Motion animations included, to one export frame at Motion's `timestamp`.
 * `remount` runs in the same commit, so remounted scenes start from that frame's clock and active scene.
 */
function renderFrameAt(clock: MotionValue<number>, seconds: number, timestamp: number, remount?: () => void) {
  // The film's own time starts here, before the scenes mount, so the timers they set count from the film's start.
  if (remount) renderClock()?.restart?.(timestamp);
  // Animations React starts while committing this frame begin at the frame's time.
  time.set(timestamp);
  // The film's timers due by this frame run before it commits, as between two frames in a browser, and the commit
  // reads the frame's own time.
  renderClock()?.enter?.(timestamp);
  // Commit the active scene and clock-driven state synchronously so the frame is complete when the step returns.
  flushSync(() => {
    remount?.();
    clock.set(seconds);
  });
  processMotionFrame(timestamp);
}

// The last export frame this page brought the composition to; -1 until the first.
let renderedFrame = -1;
// Whole milliseconds added to every frame's time on Motion's clock, so that clock keeps moving forward after a rewind.
let renderTimeOffset = 0;

/**
 * A frame's time on Motion's clock in whole milliseconds. Integers keep the offset exact: Motion subtracts an
 * animation's start from the frame time, which then matches a fresh page to the bit instead of to rounding error.
 */
function motionFrameTime(frame: number) {
  return Math.round((frame * 1000) / renderFps) + renderTimeOffset;
}

let clockOnlySeekStamp = 0;

/**
 * The export step for a Motion older than 14.6: it moves the clock and renders what derives from it. `remount` runs
 * in the same commit, as in {@link renderFrameAt}.
 */
function seekClockOnly(clock: MotionValue<number>, seconds: number, composition: Composition, remount?: () => void) {
  // The page clock is given the film's own time below, so the film starts where that reads 0.
  if (remount) renderClock()?.restart?.(0);
  // Motion schedules one render per time.now() value, so every step, including a backward one, needs a later stamp.
  clockOnlySeekStamp = Math.max(clockOnlySeekStamp + 1, performance.now());
  time.set(clockOnlySeekStamp);
  renderClock()?.enter?.(Math.round(seconds * 1000));
  flushSync(() => {
    remount?.();
    clock.set(Math.max(0, Math.min(composition.duration, seconds)));
  });
  // Apply the transforms derived from the clock now instead of on Motion's next animation frame.
  frameSteps.preRender.process(frameData);
  frameSteps.render.process(frameData);
  // CSS animations follow the film's time, not the time the export takes.
  renderClock()?.advance(Math.round(seconds * 1000));
}

/** Resolves once the tasks already queued, such as React's scheduled work, have run, as between two drawn frames. */
function nextTask() {
  return new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

const decodedBackgrounds = new Set<string>();

/** Decodes newly shown inline background images before a frame is drawn, so none is drawn half-loaded. */
async function decodeInlineBackgrounds() {
  const urls = new Set<string>();
  for (const element of document.querySelectorAll<HTMLElement>('[style*="background"]')) {
    for (const [, , url] of element.style.backgroundImage.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/g)) {
      if (url && !decodedBackgrounds.has(url)) urls.add(url);
    }
  }
  await Promise.all(
    [...urls].map(async (url) => {
      const image = new Image();
      image.src = url;
      try {
        await image.decode();
        decodedBackgrounds.add(url);
      } catch {
        // An image that cannot be decoded is drawn as the page shows it.
      }
    }),
  );
}

/**
 * Brings the composition to `target` the way playing every frame would. Each frame steps Motion's frameloop to its
 * own time, and between two frames the page runs its queued promises and tasks: a layout animation starts in a
 * microtask after its commit and an `await animate()` chain continues from a promise, so stepping several frames
 * inside one task would not match. Several pages render a film at once, each from its own later frame, and each steps
 * through every earlier frame this way without drawing it. Every run mounts the scenes anew at frame 0, the page's
 * first run and one that goes back to an earlier frame alike: what the scenes did while the page loaded, such as a
 * timer that ticked in real time, is discarded, and every page starts the film from the same state.
 */
async function stepRenderClock(
  target: number,
  clock: MotionValue<number>,
  composition: Composition,
  remountScenes: () => void,
) {
  if (target === renderedFrame) return;
  const rewinds = target < renderedFrame;
  // Motion's frameloop stops updating when its time runs backwards, so frame 0 of the new run continues Motion's time
  // one frame after the last frame rendered.
  if (rewinds) renderTimeOffset = motionFrameTime(renderedFrame + 1);
  const first = rewinds ? 0 : renderedFrame + 1;
  for (let frame = first; frame <= target; frame++) {
    try {
      const remount = frame === 0 ? remountScenes : undefined;
      const seconds = Math.min(composition.duration, frame / renderFps);
      // An older Motion is stepped the same way, frame by frame from a fresh mount, because the film's timers are:
      // a jump would run several frames' timers before React rendered once.
      if (manualMotionClock) renderFrameAt(clock, seconds, motionFrameTime(frame), remount);
      else seekClockOnly(clock, seconds, composition, remount);
      // After every frame, the one that is drawn included: a frame is the same whether or not the page draws it.
      await (renderClock()?.settle?.() ?? nextTask());
      renderedFrame = frame;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Frame ${frame} could not be rendered: ${reason}`);
    }
  }
}

/**
 * Resolves true when an image's pending request has loaded or failed, or false if `signal` gives the wait up first.
 * `decode()` alone would answer for the picture the image showed before a new `src`, which is already there, and the
 * wait would spin until the new one arrived.
 */
function imageSettled(image: HTMLImageElement, signal: AbortSignal) {
  return new Promise<boolean>((resolve) => {
    image.addEventListener("load", () => resolve(true), { once: true, signal });
    image.addEventListener("error", () => resolve(true), { once: true, signal });
    signal.addEventListener("abort", () => resolve(false), { once: true });
    if (image.complete) resolve(true);
  });
}

/**
 * Resolves once every font face and every shown image the frame about to be drawn uses has loaded and decoded. A face
 * first used after the page's start begins loading only when a frame that uses it is laid out, and a frame only stepped
 * through may never be, so the drawn frame is laid out here; an `<img>` mounted mid-film loads in real time. It waits
 * only if one is still loading, so a film whose fonts and images all loaded up front never waits, and it looks again
 * whenever the page changes or a wait ends: an arriving face or image can lay out more text or mount another image,
 * and an image removed meanwhile is no longer waited for. Without it, that frame drew text in a `font-display: block`
 * face as nothing, other text in the fallback face, and a late image as missing. Called once per drawn frame, never
 * per stepped one.
 */
async function assetsUsedByFrame() {
  // Decodes started by any look, so one that a page change interrupted is still finished before the frame is drawn.
  const decoding: Promise<unknown>[] = [];
  for (;;) {
    void document.body.getBoundingClientRect();
    // A hidden image, such as one in a scene that is not on screen, is not in this frame.
    const images = [...document.images].filter(
      (image) => !image.complete && image.checkVisibility({ visibilityProperty: true }),
    );
    if (document.fonts.status !== "loading" && images.length === 0) {
      if (decoding.length === 0) return;
      // An image can mount while the last decodes finish, with no observer watching: look once more after them.
      await Promise.all(decoding.splice(0));
      continue;
    }
    const scan = new AbortController();
    await new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => finish());
      function finish() {
        observer.disconnect();
        scan.abort();
        resolve();
      }
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      void Promise.all([
        document.fonts.ready,
        ...images.map(async (image) => {
          // A lazy image the frame shows has to load now: the export draws the whole composition.
          if (image.loading === "lazy") image.loading = "eager";
          if (!(await imageSettled(image, scan.signal))) return;
          // An image that fails to load is complete, and is drawn as the page shows it.
          const decoded = image.decode().catch(() => undefined);
          decoding.push(decoded);
          await decoded;
        }),
      ]).then(finish);
    });
  }
}

/** Resolves once `video` has finished seeking and can show its current frame. */
function videoFrameReady(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    if (!video.seeking && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return resolve();
    // The limit is on real time: the film's own timers stand still while a frame waits for its video.
    const real = renderClock()?.real ?? { setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window) };
    const timeout = real.setTimeout(() => {
      cleanup();
      reject(new Error(`The scene video ${video.currentSrc} did not show its frame.`));
    }, 30_000);
    const check = () => {
      if (video.seeking || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      cleanup();
      resolve();
    };
    const cleanup = () => {
      real.clearTimeout(timeout);
      for (const event of ["seeked", "loadeddata", "canplay"]) video.removeEventListener(event, check);
    };
    for (const event of ["seeked", "loadeddata", "canplay"]) video.addEventListener(event, check);
  });
}

/** Seeks each scene video to the frame's source time and waits until every one shows it. */
async function seekRenderVideos(videos: readonly (HTMLVideoElement | null)[], clips: Composition["videos"], seconds: number) {
  await Promise.all(
    clips.map(async (clip, index) => {
      const video = videos[index];
      if (!video) return;
      const target = videoSourceTime(clip, seconds, video.duration);
      if (Math.abs(video.currentTime - target) > 1e-4) video.currentTime = target;
      await videoFrameReady(video);
    }),
  );
}

/** Encodes a gain curve as base64 little-endian Float32, as the renderer reads it. */
function encodeGains(gains: Float32Array) {
  const bytes = new Uint8Array(gains.buffer, gains.byteOffset, gains.byteLength);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

/** What the export mixes: each track's same-origin file, placement, trim and gain curve. */
function renderInfo(composition: Composition): RenderInfo {
  return {
    fps: composition.frameRate,
    duration: composition.duration,
    chapters: composition.chapters,
    audioTracks: composition.audioTracks.map((track, index) => ({
      src: composition.audioSources[index]!,
      timelineStart: track.timelineStart,
      sourceStart: track.sourceStart,
      sourceEnd: renderSourceEnd(track, composition.duration),
      gains: encodeGains(renderAudioGains(track, composition.duration, RENDER_GAIN_RATE)),
    })),
  };
}

/**
 * Plays a timed composition in the browser and exposes it to Rork's renderer for frame-accurate MP4 export: one shared
 * clock drives every scene, voiceover, music bed, sound effect and scene video. A control bar below the artwork plays, pauses,
 * skips, seeks and mutes, and keyboard shortcuts work while the player has focus.
 */
export function MotionPlayer<Scene extends SceneContent>({
  content,
  musicBed = null,
  soundtrack = null,
  voiceoverVolume = 0.9,
  musicVolume,
  fps = FRAME_RATE,
  width = 1280,
  height = 720,
  surfaceClassName = "bg-indigo-950",
  Scene,
  Backdrop,
  Overlay,
  transitionSeconds = 0,
}: MotionPlayerProps<Scene>) {
  const composition = useMemo(
    () => deriveComposition(content, musicBed, soundtrack, voiceoverVolume, musicVolume, transitionSeconds, fps),
    [content, musicBed, soundtrack, voiceoverVolume, musicVolume, transitionSeconds, fps],
  );
  // Level notes are for whoever builds the film, who reads them in the browser console; viewers hear the same mix in
  // preview and export either way, and could not act on them.
  useEffect(() => {
    for (const warning of composition.levelWarnings) console.warn(`Motion player: ${warning}`);
  }, [composition.levelWarnings]);
  // Media readiness and load errors belong to one set of tracks, and an unchanged source never fires canplay again,
  // so new tracks, a new configuration error or a new length, which the preview mix spans, mount a fresh stage. Other
  // scene edits keep playback where it is.
  const mediaKey = JSON.stringify([
    composition.audioTracks,
    composition.videos,
    composition.configError,
    composition.duration,
  ]);
  return (
    <MotionStage
      key={mediaKey}
      composition={composition}
      width={width}
      height={height}
      surfaceClassName={surfaceClassName}
      Scene={Scene}
      Backdrop={Backdrop}
      Overlay={Overlay}
      transitionSeconds={transitionSeconds}
    />
  );
}

function MotionStage<Scene extends SceneContent>({
  composition,
  width,
  height,
  surfaceClassName,
  Scene,
  Backdrop,
  Overlay,
  transitionSeconds,
}: {
  composition: Composition<Scene>;
  width: number;
  height: number;
  surfaceClassName: string;
  Scene: ComponentType<SceneRenderProps<Scene>>;
  Backdrop: ComponentType<FilmLayerProps<Scene>> | undefined;
  Overlay: ComponentType<FilmLayerProps<Scene>> | undefined;
  transitionSeconds: number;
}) {
  const { scenes, duration, chapters, audioTracks, videos, videoSources } = composition;
  const clock = useMotionValue(0);
  const prefersReducedMotion = useReducedMotion() === true;
  const reducedMotion = !renderMode && prefersReducedMotion;
  const controls = useRef<ReturnType<typeof animate> | null>(null);
  // Every track plays through one element, which plays the whole film's mix from its start.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mixTrack = useMemo(() => ({ src: "", timelineStart: 0, sourceStart: 0, sourceEnd: duration, volume: 1 }), [duration]);
  const audioWasActiveRef = useRef(false);
  // Whether the mix was heard at its last sync: playing and not muted by the viewer.
  const audioHeardRef = useRef(false);
  const audioPlaybackFailedRef = useRef(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const videoReadyRef = useRef<boolean[]>([]);
  // Preview buffers only the scene videos playback is about to reach; the rest load their metadata until then.
  const [preloadVideos, setPreloadVideos] = useState<readonly number[]>(
    () => sceneVideoNeeds(scenes, videos, 0).preload,
  );
  const preloadVideosRef = useRef(preloadVideos);
  // Media that ran out of data while the film was playing; the clock holds until every one of them can play again.
  const waitingMediaRef = useRef(new Set<HTMLMediaElement>());
  const [buffering, setBuffering] = useState(false);
  const playingRef = useRef(false);
  // Set once fonts load for a film without audio, which starts by itself as soon as its opening videos can play too.
  const autoplayPendingRef = useRef(false);
  const activeSceneRef = useRef(0);
  const [activeScene, setActiveScene] = useState(0);
  // How often each scene, by ID, has restarted in preview; a restart remounts the scene under a new key.
  const [sceneRuns, setSceneRuns] = useState<Record<string, number>>({});
  // How often a backward export seek has remounted every scene and film layer; it keys the LayoutGroup around them.
  const [renderRun, setRenderRun] = useState(0);
  // Where a seek bar drag began, so the drag restarts its scene once when it ends rather than on every move.
  const scrubFromRef = useRef<number | null>(null);
  // The scene before the active one while it stays visible beneath it for transitionSeconds, otherwise -1.
  const outgoingSceneRef = useRef(-1);
  const [outgoingScene, setOutgoingScene] = useState(-1);
  const [playing, setPlaying] = useState(false);
  // Before the first Play or seek in preview no scene is active except on the poster, so the opening scene's entrance
  // plays when playback starts rather than while the page loads.
  const [started, setStarted] = useState(renderMode);
  const [fontsReady, setFontsReady] = useState(false);
  // The decoded mix: its WAV's object URL in preview, null in export, which mixes the files itself.
  const [audioMix, setAudioMix] = useState<{ url: string | null } | null>(null);
  const [audioCanPlay, setAudioCanPlay] = useState(false);
  const [readyVideos, setReadyVideos] = useState<readonly number[]>([]);
  const [mediaLoadError, setMediaLoadError] = useState(composition.configError);
  const [audioPlaybackError, setAudioPlaybackError] = useState<string | null>(null);
  // The viewer's mute overrides the mix, which otherwise unmutes each track only while it is audible.
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  // Never 0: turning it down to 0 mutes instead, so Unmute has a level to restore.
  const volumeRef = useRef(1);
  const [volume, setVolume] = useState(1);
  // The level a volume gesture started from, which Unmute restores after the gesture reaches 0.
  const volumeGestureStartRef = useRef<number | null>(null);
  const speedRef = useRef(1);
  const [speed, setSpeed] = useState(1);
  // Read out where a chapter control moved the clock; playback crossing into a chapter stays quiet over the narration.
  const [chapterAnnouncement, setChapterAnnouncement] = useState("");
  // Full screen is styled with :fullscreen rather than state, so entering it never re-renders the scenes, whose Motion
  // layout animations would otherwise glide to the new size. iPhone Safari cannot show an element full screen.
  const playerRef = useRef<HTMLDivElement>(null);
  const canFullscreen = !renderMode && document.fullscreenEnabled;
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const audioReady = audioTracks.length === 0 || (audioMix !== null && (audioMix.url === null || audioCanPlay));
  // Preview starts once the videos on screen at the start and the next scene's can play, and holds the clock later if
  // playback reaches one still loading. Export waits for each video's frame as it renders that frame instead.
  const startupVideos = sceneVideoNeeds(scenes, videos, 0).needed;
  const videoReady = renderMode || startupVideos.every((index) => readyVideos.includes(index));
  const ready = fontsReady && ((audioReady && videoReady) || mediaLoadError !== null);
  useEffect(() => {
    if (!renderMode && mediaLoadError !== null) console.error(`Motion player: ${mediaLoadError}`);
  }, [mediaLoadError]);
  const audioError = mediaLoadError ?? audioPlaybackError;
  const playerError = audioError ?? fullscreenError;
  // A film without sound starts by itself, but sound must never autoplay, so a narrated film waits for Play. Until then
  // preview shows a poster rather than the blank pose before the opening entrance: the opening scene halfway through,
  // active, with every Motion animation skipped to its end. Leaving the poster remounts every scene and film layer, so
  // the entrance plays from the start with playback. Export starts at once and never shows it.
  const poster = !started && (audioTracks.length > 0 || reducedMotion);
  const posterAt = scenes[0] === undefined ? 0 : (scenes[0].start + scenes[0].end) / 2;
  // The poster's own clock keeps the controls, audio and scene videos at the start while layers draw the poster time.
  // It starts at 0 and moves to the poster time in a layout effect, so layers that derive React state through
  // `useMotionValueEvent(clock, "change", …)` receive that change before the first paint, as on the real clock.
  const posterClock = useMemo(() => motionValue(0), [posterAt]);
  useLayoutEffect(() => {
    if (poster) posterClock.set(posterAt);
  }, [poster, posterAt, posterClock]);
  const layerClock = poster ? posterClock : clock;
  const shownScene = scenes[activeScene];
  const filmLayer: FilmLayerProps<Scene> | null =
    shownScene === undefined ? null : { scenes, activeScene: shownScene, clock: layerClock, reducedMotion };

  function updatePlaying(next: boolean) {
    playingRef.current = next;
    setPlaying(next);
  }

  /** Whether the clock is advancing: playing, and not holding for media that ran out of data. */
  function clockRunning() {
    return playingRef.current && waitingMediaRef.current.size === 0;
  }

  /**
   * Holds the clock while `media` buffers during playback. Letting the clock run on would leave the media behind it,
   * and catching up would hard-seek it again and again; held, the film resumes in sync once it can play.
   */
  function waitForMedia(media: HTMLMediaElement) {
    const playback = controls.current;
    if (renderMode || !playback || !playingRef.current || waitingMediaRef.current.has(media)) return;
    waitingMediaRef.current.add(media);
    if (waitingMediaRef.current.size > 1) return;
    playback.pause();
    setBuffering(true);
    // Pause every track and video as a pause would, so each resumes from the clock when the wait ends.
    syncAudioToClock(clock.get());
    syncVideosToClock(clock.get());
  }

  /** A `waiting` or `stalled` event: media the clock is playing has run out of data. */
  function handleMediaStarved(media: HTMLMediaElement) {
    // The mix holds the clock only while the viewer hears it.
    const needed = media !== audioRef.current || audioHeardRef.current;
    if (starvedMediaHoldsClock(media, needed)) waitForMedia(media);
  }

  function canContinue(media: HTMLMediaElement) {
    const videoIndex = videoRefs.current.findIndex((video) => video === media);
    if (videoIndex !== -1 && !videoReadyRef.current[videoIndex]) return false;
    return media.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA || media.ended;
  }

  /** Restarts the clock once every element it was holding for can play. */
  function resumeAfterBuffering() {
    const waiting = waitingMediaRef.current;
    if (waiting.size === 0) return;
    for (const media of waiting) {
      if (canContinue(media)) waiting.delete(media);
    }
    if (waiting.size > 0) return;
    endWait();
    const playback = controls.current;
    if (!playback || !playingRef.current) return;
    playback.play();
    syncAudioToClock(clock.get());
    syncVideosToClock(clock.get());
  }

  /** Ends a hold for media and makes the scene change it deferred, so the new scene starts with the clock. */
  function endWait() {
    waitingMediaRef.current.clear();
    setBuffering(false);
    showSceneAt(clock.get());
  }

  /** Stops waiting for media, for a pause, replay or end of the film that decides on playback itself. */
  function clearBuffering() {
    if (waitingMediaRef.current.size === 0) return;
    endWait();
  }

  /** Stops waiting for media and carries on playing, for a seek or load error that makes the wait moot. */
  function stopWaiting() {
    if (waitingMediaRef.current.size === 0) return;
    clearBuffering();
    if (playingRef.current) controls.current?.play();
  }

  /** Starts buffering the scene videos playback is about to reach in full. A video, once buffering, keeps it. */
  function preloadVideosAt(at: number) {
    const added = sceneVideoNeeds(scenes, videos, at).preload.filter(
      (index) => !preloadVideosRef.current.includes(index),
    );
    if (added.length === 0) return;
    preloadVideosRef.current = [...preloadVideosRef.current, ...added];
    setPreloadVideos(preloadVideosRef.current);
  }

  function syncAudioToClock(at: number) {
    const audio = audioRef.current;
    if (!audio) return;
    if (mediaLoadError !== null || audioPlaybackFailedRef.current) {
      audio.pause();
      audio.volume = 0;
      audio.muted = true;
      audioWasActiveRef.current = false;
      audioHeardRef.current = false;
      return;
    }
    const syncState = syncAudioTrack(audio, mixTrack, at, duration, clockRunning(), audioWasActiveRef.current, {
      speed: speedRef.current,
      gain: volumeRef.current,
    });
    audioWasActiveRef.current = syncState.active;
    if (mutedRef.current) audio.muted = true;
    if (!syncState.shouldPlay) {
      audio.pause();
    } else if (audio.paused) {
      void audio.play().catch(handleAudioPlaybackFailure);
    }
    const heard = trackHeard(mixTrack, syncState.active, mutedRef.current);
    const startsBeingHeard = heard && !audioHeardRef.current;
    audioHeardRef.current = heard;
    // Sound muted by the viewer that ran out of data need not report it again. A seek, such as the one that starts or
    // resumes the mix, reports `waiting` itself if it lands short of data.
    if (startsBeingHeard && !audio.seeking && starvedMediaHoldsClock(audio, true)) waitForMedia(audio);
  }

  function handleAudioPlaybackFailure(error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    audioPlaybackFailedRef.current = true;
    audioWasActiveRef.current = false;
    audioHeardRef.current = false;
    const audio = audioRef.current;
    audio?.pause();
    if (audio) {
      audio.volume = 0;
      audio.muted = true;
    }
    setAudioPlaybackError("The sound could not play. The visual preview continues; pause and press Play to try again.");
  }

  function handleAudioCanPlay() {
    resumeAfterBuffering();
    setAudioCanPlay(true);
  }

  function handleAudioError() {
    setMediaLoadError("The sound could not be played. Reload the app.");
    stopWaiting();
    const audio = audioRef.current;
    audio?.pause();
    if (audio) {
      audio.volume = 0;
      audio.muted = true;
    }
  }

  function syncVideosToClock(at: number) {
    for (const [index, clip] of videos.entries()) {
      const video = videoRefs.current[index];
      if (!video) continue;
      if (!videoReadyRef.current[index]) {
        // Playback that reaches a scene whose video has not loaded yet holds there instead of showing it blank.
        const shown = at >= clip.timelineStart && at < clip.timelineStart + clip.duration;
        if (shown && playingRef.current && mediaLoadError === null) waitForMedia(video);
        continue;
      }
      const { shouldPlay } = syncVideoClip(
        video,
        clip,
        at,
        clockRunning() && mediaLoadError === null,
        speedRef.current,
      );
      if (!shouldPlay) {
        video.pause();
      } else if (video.paused) {
        // A muted video that cannot autoplay still shows the frame each pause or seek lands on.
        void video.play().catch(() => {});
      }
    }
  }

  function handleVideoCanPlay(index: number) {
    if (videoReadyRef.current[index]) {
      // A restarted scene mounts a new video element, which waits on its first frame until it is synced here.
      syncVideosToClock(clock.get());
      resumeAfterBuffering();
      return;
    }
    const video = videoRefs.current[index];
    const clip = videos[index];
    if (!video || !clip) return;
    // An offset past the end would hold the file's last frame for the whole scene, in preview and export alike.
    const mediaError = checkVideoMedia(clip, index, video.duration);
    if (mediaError !== null) {
      setMediaLoadError(mediaError);
      return;
    }
    videoReadyRef.current[index] = true;
    setReadyVideos((ready) => [...ready, index]);
    syncVideosToClock(clock.get());
    resumeAfterBuffering();
    autoplayWhenVideosReady();
  }

  /** Starts a pending autoplay once the opening scene videos can play, so the film does not open on a blank video. */
  function autoplayWhenVideosReady() {
    const playback = controls.current;
    if (!autoplayPendingRef.current || !playback) return;
    if (startupVideos.some((index) => !videoReadyRef.current[index])) return;
    autoplayPendingRef.current = false;
    startPlayback(playback);
  }

  function handleVideoError(index: number) {
    const src = shortSource(videos[index]?.src ?? "");
    setMediaLoadError(`Scene video ${index + 1} (${src}) could not be loaded. Check that the file is in the app and reload it.`);
    stopWaiting();
  }

  /** Plays from the clock's position, or replays from the beginning once the film has ended. */
  function startPlayback(playback: ReturnType<typeof animate>) {
    clearBuffering();
    setAudioPlaybackError(null);
    audioPlaybackFailedRef.current = false;
    if (clock.get() >= duration) {
      updatePlaying(false);
      const audio = audioRef.current;
      if (audio && mediaLoadError === null) {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0;
        audio.muted = true;
      }
      moveClock(playback, 0);
    }
    updatePlaying(true);
    setStarted(true);
    syncAudioToClock(clock.get());
    syncVideosToClock(clock.get());
    // The sync above holds the clock when a scene video at the start position is still loading.
    if (clockRunning()) playback.play();
  }

  function finishPlayback() {
    clearBuffering();
    // A seek to the end leaves Motion running, which would carry on drawing a film the controls show as stopped.
    controls.current?.pause();
    const audio = audioRef.current;
    audio?.pause();
    if (audio) {
      audio.muted = true;
      // The mix is still active on the last frame, so its sync nudge is undone here.
      audio.playbackRate = 1;
    }
    updatePlaying(false);
  }

  useMotionValueEvent(clock, "change", (at) => {
    // The clock reaching the end finishes playback. Motion's onComplete is not used: once an animation has finished,
    // moving its time and playing again leaves its finished promise settled, so onComplete fires at once and would
    // stop a replay that is still running.
    if (playingRef.current && at >= duration) finishPlayback();
    // Export audio and video come from the elements' data attributes, not from playing them.
    if (!renderMode) {
      preloadVideosAt(at);
      syncAudioToClock(at);
      syncVideosToClock(at);
    }
    showSceneAt(at);
  });

  function showSceneAt(at: number) {
    // Motion animations a scene starts from `active` run on their own time, so while the clock holds for media the
    // scene change waits too, and the new scene's entrance plays once its video can play rather than ahead of it.
    if (waitingMediaRef.current.size > 0) return;
    const { active: next, outgoing } = shownScenesAt(scenes, at, transitionSeconds);
    if (next !== activeSceneRef.current) {
      activeSceneRef.current = next;
      setActiveScene(next);
    }
    if (outgoing !== outgoingSceneRef.current) {
      outgoingSceneRef.current = outgoing;
      setOutgoingScene(outgoing);
    }
  }

  // Scene edits keep this stage and its clock, so the scene shown is found again for the new list, which may be
  // shorter or retimed.
  useEffect(() => {
    showSceneAt(clock.get());
  }, [scenes, transitionSeconds]);

  useEffect(() => {
    let cancelled = false;
    clock.set(0);
    setFontsReady(false);
    updatePlaying(false);
    // A paused animation still owns its MotionValue; export must own the clock exclusively.
    const playback = renderMode
      ? null
      : animate(clock, duration, {
          duration,
          ease: "linear",
          autoplay: false,
        });
    if (playback) playback.speed = speedRef.current;
    controls.current = playback;
    // Avoid a font swap after the composition has already started.
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      setFontsReady(true);
      if (audioTracks.length === 0 && !reducedMotion && playback) {
        autoplayPendingRef.current = true;
        autoplayWhenVideosReady();
      }
    });
    return () => {
      cancelled = true;
      autoplayPendingRef.current = false;
      clearBuffering();
      playback?.cancel();
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.muted = true;
      for (const video of videoRefs.current) video?.pause();
      controls.current = null;
    };
  }, [clock, duration, reducedMotion]);

  // New tracks, a new configuration error or a new length mount a new stage, so the mix loads once per stage.
  useEffect(() => {
    if (composition.configError !== null || audioTracks.length === 0) return;
    let cancelled = false;
    let url: string | null = null;
    const stop = new AbortController();
    void loadAudioMix(composition, !renderMode, stop.signal)
      // A failure the loader does not name, such as running out of memory for a long film's mix, still shows instead
      // of leaving Play disabled.
      .catch((error: unknown) => ({
        error: `The sound could not be prepared: ${error instanceof Error ? error.message : String(error)}`,
      }))
      .then((result) => {
        if (cancelled) {
          if ("url" in result && result.url !== null) URL.revokeObjectURL(result.url);
          return;
        }
        if ("error" in result) {
          setMediaLoadError(result.error);
          return;
        }
        url = result.url;
        setAudioMix(result);
      });
    return () => {
      cancelled = true;
      stop.abort();
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, []);

  // A hidden tab stops the frames that steer audio sync, so an unattended rate nudge would carry the audio off.
  useEffect(() => {
    function resetRates() {
      if (document.hidden && audioRef.current) audioRef.current.playbackRate = speedRef.current;
    }
    document.addEventListener("visibilitychange", resetRates);
    return () => document.removeEventListener("visibilitychange", resetRates);
  }, []);

  // Export seeks the same clock as playback; no wall-clock recording or dropped frames.
  useEffect(() => {
    if (!renderMode) return;
    if (mediaLoadError !== null) {
      settleRenderReady({ error: mediaLoadError });
    } else if (ready) {
      const remountScenes = () => setRenderRun((run) => run + 1);
      renderFps = composition.frameRate;
      renderFrameTo = async (frame) => {
        await stepRenderClock(frame, clock, composition, remountScenes);
        await assetsUsedByFrame();
        await decodeInlineBackgrounds();
        await seekRenderVideos(videoRefs.current, composition.videos, Math.min(composition.duration, frame / renderFps));
      };
      settleRenderReady({ info: renderInfo(composition) });
    }
  }, [clock, composition, duration, ready, mediaLoadError]);

  function togglePlayback() {
    const playback = controls.current;
    if (!playback || !ready) return;
    if (playingRef.current) {
      playback.pause();
      clearBuffering();
      updatePlaying(false);
      syncAudioToClock(clock.get());
      syncVideosToClock(clock.get());
    } else {
      startPlayback(playback);
    }
  }

  /**
   * Moves the animation and the shared clock together, for seeks and replays alike, so scenes, audio and scene
   * videos all resync from the clock's change listener. Playing continues from there and paused stays paused.
   */
  function moveClock(playback: ReturnType<typeof animate>, seconds: number) {
    const from = clock.get();
    const at = Math.max(0, Math.min(duration, seconds));
    // A finished animation holds the new time as paused, so Play after a seek past the end resumes from here.
    playback.time = at;
    // Playback leaves the media it was waiting for. The clock change below holds it again if the new position needs
    // to, keeping the scene change waiting; otherwise the wait ends and a playing film carries on from there. A seek
    // to where the clock already is fires no change, and still needs the same media, so its wait stays.
    if (at !== from) {
      const wasWaiting = waitingMediaRef.current.size > 0;
      waitingMediaRef.current.clear();
      clock.set(at);
      if (wasWaiting && waitingMediaRef.current.size === 0) {
        endWait();
        if (playingRef.current) playback.play();
      }
    }
    // A seek before the first Play starts the film too, so the scene it lands in plays its entrance. On the poster
    // even a seek to where the clock already is leaves it, so Home before Play shows the opening frame.
    if (at !== from || poster) setStarted(true);
    if (scrubFromRef.current === null) restartSceneIfRewound(from, at);
  }

  /**
   * Motion animations that a scene starts when `active` turns on run on their own, and a backward seek cannot rewind
   * them. Moving the clock back, by a seek or Replay, therefore remounts the scene it lands in, so they start again
   * from their first frame; a forward seek leaves them running.
   */
  function restartSceneIfRewound(from: number, at: number) {
    if (at >= from) return;
    const scene = scenes[shownScenesAt(scenes, at, transitionSeconds).active];
    if (!scene) return;
    setSceneRuns((runs) => ({ ...runs, [scene.id]: (runs[scene.id] ?? 0) + 1 }));
  }

  function startScrub() {
    scrubFromRef.current = clock.get();
  }

  function endScrub() {
    const from = scrubFromRef.current;
    scrubFromRef.current = null;
    if (from !== null) restartSceneIfRewound(from, clock.get());
  }

  function seek(seconds: number) {
    const playback = controls.current;
    if (!playback || !ready || !Number.isFinite(seconds)) return;
    moveClock(playback, seconds);
  }

  /** Seeks to a chapter control's target and announces the chapter it lands in. */
  function seekToChapter(seconds: number) {
    if (!controls.current || !ready) return;
    seek(seconds);
    const index = chapterIndexAt(chapters, seconds);
    const text =
      seconds >= duration ? "End" : `Chapter ${index + 1} of ${chapters.length}: ${chapters[index]?.title ?? ""}`;
    // A repeated announcement must still change the live region's text to be read again.
    setChapterAnnouncement((previous) => (previous === text ? `${text}\u00a0` : text));
  }

  function stepChapter(direction: "previous" | "next") {
    seekToChapter(chapterSeekTarget(chapters, clock.get(), direction, duration));
  }

  function toggleMute() {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    syncAudioToClock(clock.get());
  }

  /** Sets the mix volume from 0 to 1; 0 mutes and keeps the level the gesture started from. */
  function changeVolume(level: number) {
    // Rounded so tenth steps do not accumulate floating-point error.
    const next = Math.round(Math.max(0, Math.min(1, level)) * 100) / 100;
    const kept = volumeGestureStartRef.current;
    const restored = kept !== null && kept > 0 ? kept : volumeRef.current;
    mutedRef.current = next === 0;
    volumeRef.current = next === 0 ? restored : next;
    setVolume(volumeRef.current);
    setMuted(mutedRef.current);
    syncAudioToClock(clock.get());
  }

  function changeSpeed(rate: number) {
    speedRef.current = rate;
    setSpeed(rate);
    if (controls.current) controls.current.speed = rate;
    syncAudioToClock(clock.get());
    syncVideosToClock(clock.get());
  }

  function stepSpeed(direction: 1 | -1) {
    const index = PLAYBACK_SPEEDS.indexOf(speedRef.current as (typeof PLAYBACK_SPEEDS)[number]);
    const next = PLAYBACK_SPEEDS[Math.max(0, Math.min(PLAYBACK_SPEEDS.length - 1, index + direction))];
    if (next !== undefined && next !== speedRef.current) changeSpeed(next);
  }

  function toggleFullscreen() {
    setFullscreenError(null);
    const request =
      document.fullscreenElement === playerRef.current
        ? document.exitFullscreen()
        : playerRef.current?.requestFullscreen();
    request?.catch((error: unknown) => {
      setFullscreenError(`Full screen is unavailable: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  function handleShortcut(event: KeyboardEvent<HTMLDivElement>) {
    // The seek bar handles its own arrow, page and Home/End keys first.
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!(event.target instanceof Element)) return;
    // Typing in a field inside a scene keeps its keys, and a focused button keeps Space and Enter.
    const field = event.target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])");
    if (field !== null && !field.matches("[data-slot='time-range'], [data-slot='volume']")) return;
    if ((event.key === " " || event.key === "Enter") && event.target.closest("button, a") !== null) return;
    if (event.shiftKey && chapters.length > 0 && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      stepChapter(event.key === "ArrowLeft" ? "previous" : "next");
      event.preventDefault();
      return;
    }
    const at = clock.get();
    switch (event.key.toLowerCase()) {
      case " ":
      case "k":
        togglePlayback();
        break;
      case "arrowleft":
        seek(at - SHORTCUT_SEEK_SECONDS);
        break;
      case "arrowright":
        seek(at + SHORTCUT_SEEK_SECONDS);
        break;
      case "j":
        seek(at - SKIP_SECONDS);
        break;
      case "l":
        seek(at + SKIP_SECONDS);
        break;
      case "m":
        if (audioTracks.length === 0) return;
        toggleMute();
        break;
      case "arrowup":
      case "arrowdown":
        if (audioTracks.length === 0) return;
        if (!event.repeat) volumeGestureStartRef.current = volumeRef.current;
        changeVolume(
          (mutedRef.current ? 0 : volumeRef.current) + (event.key === "ArrowUp" ? VOLUME_STEP : -VOLUME_STEP),
        );
        break;
      case "<":
        stepSpeed(-1);
        break;
      case ">":
        stepSpeed(1);
        break;
      case "home":
        seek(0);
        break;
      case "end":
        seek(duration);
        break;
      case "f":
        // A held key repeats, which would flip full screen on every repeat.
        if (!canFullscreen || event.repeat) return;
        toggleFullscreen();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  const previewWidth = `min(100%, calc(80dvh * ${width} / ${height}))`;
  // Export captures the bare composition. Preview wraps it in a player that a click anywhere focuses, so its
  // keyboard shortcuts work without first tabbing to a control.
  const playerProps = renderMode
    ? {}
    : {
        role: "group",
        "aria-label": "Video player",
        "aria-keyshortcuts": `Space K ArrowLeft ArrowRight J L${audioTracks.length > 0 ? " M ArrowUp ArrowDown" : ""}${canFullscreen ? " F" : ""} Home End < >${chapters.length > 0 ? " Shift+ArrowLeft Shift+ArrowRight" : ""}`,
        "data-state": playing ? "playing" : "paused",
        tabIndex: 0,
        onKeyDown: handleShortcut,
        ref: playerRef,
        // The browser sizes a full screen element to the screen; the artwork then fits the space above the controls.
        className:
          "max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-white/70 [&:fullscreen]:flex [&:fullscreen]:flex-col [&:fullscreen]:rounded-none [&:fullscreen]:border-0 [&:fullscreen]:bg-black [&:fullscreen]:focus-visible:ring-inset",
        style: { width: previewWidth },
      };

  return (
    <main
      className={
        renderMode
          ? "bg-neutral-950 text-white"
          : "flex min-h-dvh flex-col items-center justify-center gap-3 bg-neutral-950 p-4 text-white"
      }
    >
      <div {...playerProps}>
        <div className="[:fullscreen>&]:relative [:fullscreen>&]:grid [:fullscreen>&]:min-h-0 [:fullscreen>&]:flex-1 [:fullscreen>&]:place-items-center [:fullscreen>&]:[container-type:size]">
          <div
            className={`relative overflow-hidden [container-type:inline-size] ${renderMode ? "" : "w-full [:fullscreen>*>&]:w-[var(--fullscreen-width)]"} ${surfaceClassName}`}
            // Export renders at exactly the root's size; preview scales the same aspect ratio to fit the window, or the
            // frame around it in full screen.
            style={
              renderMode
                ? { width, height }
                : ({
                    aspectRatio: `${width} / ${height}`,
                    "--fullscreen-width": `min(100cqw, calc(100cqh * ${width} / ${height}))`,
                  } as CSSProperties)
            }
          >
            {/*
              A backward export seek, or leaving the preview poster, remounts everything in this group under a new key.
              The group's id namespaces each run's layoutIds, so a remounted element does not resume a shared layout
              animation from the previous run.
            */}
            <LayoutGroup
              key={poster ? `poster-${posterAt}` : renderRun}
              id={poster ? "poster" : `run-${renderRun}`}
            >
              {/* Under reduced motion, Motion's own transform and layout animations jump to their end; on the poster,
                  every Motion animation does. Off the poster the prop is left out, because even an undefined value
                  would override an enclosing MotionConfig. */}
              <MotionConfig
                reducedMotion={reducedMotion ? "always" : "never"}
                {...(poster ? { skipAnimations: true } : {})}
              >
                {Backdrop && filmLayer && <Backdrop {...filmLayer} />}
                {scenes.map((scene, index) => {
                  const videoIndex = videos.findIndex((clip) => clip.sceneId === scene.id);
                  const active = activeScene === index;
                  return (
                    // Every scene stays mounted for the whole film, so export finds its media when the page is ready.
                    <div
                      key={scene.id}
                      aria-hidden={!active}
                      inert={!active}
                      className="absolute inset-0"
                      style={{ visibility: active || index === outgoingScene ? "visible" : "hidden" }}
                    >
                      {/* Each run of a scene has its own layoutId namespace, so a restarted scene does not glide from the
                          last run's shared layout. */}
                      <LayoutGroup key={sceneRuns[scene.id] ?? 0} id={`${scene.id}-${sceneRuns[scene.id] ?? 0}`}>
                        <Scene
                          scene={scene}
                          clock={layerClock}
                          active={active && (started || poster)}
                          reducedMotion={reducedMotion}
                          video={
                            videoIndex === -1 ? null : (
                              <video
                                ref={(video) => {
                                  videoRefs.current[videoIndex] = video;
                                }}
                                src={videoSources[videoIndex] ?? undefined}
                                muted
                                playsInline
                                preload={renderMode || preloadVideos.includes(videoIndex) ? "auto" : "metadata"}
                                aria-hidden="true"
                                className="absolute inset-0 h-full w-full object-cover"
                                onCanPlay={() => handleVideoCanPlay(videoIndex)}
                                onWaiting={renderMode ? undefined : (event) => handleMediaStarved(event.currentTarget)}
                                onStalled={renderMode ? undefined : (event) => handleMediaStarved(event.currentTarget)}
                                // Sync skips a video that is still seeking, so a paused scrub lands on the latest
                                // position here.
                                onSeeked={
                                  renderMode
                                    ? undefined
                                    : () => {
                                        syncVideosToClock(clock.get());
                                        resumeAfterBuffering();
                                      }
                                }
                                onError={() => handleVideoError(videoIndex)}
                              />
                            )
                          }
                        />
                      </LayoutGroup>
                    </div>
                  );
                })}
                {Overlay && filmLayer && <Overlay {...filmLayer} />}
              </MotionConfig>
            </LayoutGroup>
          </div>
          {/* The status line below the player is off screen in full screen; it stays the announced copy. */}
          {(buffering || playerError) && (
            <p
              aria-hidden="true"
              className={`absolute inset-x-0 top-3 mx-auto hidden w-fit max-w-[90%] rounded-full bg-black/70 px-3 py-1 text-center text-sm [:fullscreen>*>&]:block ${playerError ? "text-rose-300" : "text-white"}`}
            >
              {playerError ?? "Loading…"}
            </p>
          )}
        </div>
        {!renderMode && (
          <ControlBar
            clock={clock}
            duration={duration}
            ready={ready}
            playing={playing}
            hasAudio={audioTracks.length > 0}
            muted={muted}
            volume={volume}
            onVolumeChange={changeVolume}
            onVolumeGesture={(started) => {
              volumeGestureStartRef.current = started ? volumeRef.current : null;
            }}
            speed={speed}
            onSpeedChange={changeSpeed}
            onTogglePlayback={togglePlayback}
            onSeek={seek}
            onScrubStart={startScrub}
            onScrubEnd={endScrub}
            onToggleMute={toggleMute}
            chapters={chapters}
            onStepChapter={stepChapter}
            onJumpToChapter={(index) => seekToChapter(chapters[index]?.start ?? 0)}
            renderFrame={(seconds) => (
              <FramePreview
                at={seconds}
                composition={composition}
                width={width}
                height={height}
                surfaceClassName={surfaceClassName}
                Scene={Scene}
                Backdrop={Backdrop}
                Overlay={Overlay}
                transitionSeconds={transitionSeconds}
                reducedMotion={reducedMotion}
                loadableVideos={playing ? preloadVideos : null}
              />
            )}
            fullscreenTarget={canFullscreen ? playerRef : null}
            onToggleFullscreen={toggleFullscreen}
          />
        )}
        {!renderMode && chapters.length > 0 && (
          <span aria-live="polite" aria-atomic="true" className="sr-only">
            {chapterAnnouncement}
          </span>
        )}
      </div>
      {audioMix?.url && (
        <audio
          ref={audioRef}
          src={audioMix.url}
          preload="auto"
          aria-hidden="true"
          className="hidden"
          onCanPlay={handleAudioCanPlay}
          onWaiting={(event) => handleMediaStarved(event.currentTarget)}
          onStalled={(event) => handleMediaStarved(event.currentTarget)}
          // Sync skips the mix while it is still seeking, so a paused scrub lands on the latest position here.
          onSeeked={() => {
            syncAudioToClock(clock.get());
            resumeAfterBuffering();
          }}
          onError={handleAudioError}
        />
      )}
      {!renderMode && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-white/70">
          <span>
            Scene {activeScene + 1} of {scenes.length}
          </span>
          {buffering && <span role="status">Loading…</span>}
          {renderStatus.file && (
            <a
              href={renderStatus.file}
              download
              className="rounded-full border border-white/30 px-4 py-1.5 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              Download MP4
            </a>
          )}
        </div>
      )}
      {!renderMode && playerError && (
        <p role="alert" className="text-sm text-rose-300">
          {playerError}
        </p>
      )}
    </main>
  );
}

/** The film at `at` for the seek bar's hover preview, on its own clock; as on the poster, animations show their end. */
function FramePreview<Scene extends SceneContent>({
  at,
  composition,
  width,
  height,
  surfaceClassName,
  Scene,
  Backdrop,
  Overlay,
  transitionSeconds,
  reducedMotion,
  loadableVideos,
}: {
  at: number;
  composition: Composition<Scene>;
  width: number;
  height: number;
  surfaceClassName: string;
  Scene: ComponentType<SceneRenderProps<Scene>>;
  Backdrop: ComponentType<FilmLayerProps<Scene>> | undefined;
  Overlay: ComponentType<FilmLayerProps<Scene>> | undefined;
  transitionSeconds: number;
  reducedMotion: boolean;
  /** Scene videos the still may load, or null for all. */
  loadableVideos: readonly number[] | null;
}) {
  const { active, outgoing } = shownScenesAt(composition.scenes, at, transitionSeconds);
  const scale = Math.min(FRAME_PREVIEW_MAX_WIDTH / width, FRAME_PREVIEW_MAX_HEIGHT / height);
  const frameWidth = Math.round(width * scale);
  const frameHeight = Math.round(height * scale);
  return (
    <div
      data-slot="frame-preview"
      className="relative overflow-hidden rounded-md border border-white/20 bg-neutral-950 shadow-lg"
      style={{ width: frameWidth, height: frameHeight }}
    >
      <div
        className={`absolute left-0 top-0 overflow-hidden [container-type:inline-size] ${surfaceClassName}`}
        style={{
          width: frameWidth * FRAME_PREVIEW_OVERSCALE,
          aspectRatio: `${width} / ${height}`,
          transform: `scale(${1 / FRAME_PREVIEW_OVERSCALE})`,
          transformOrigin: "top left",
        }}
      >
        <FrameStill
          key={`${outgoing}:${active}`}
          at={at}
          composition={composition}
          active={active}
          outgoing={outgoing}
          Scene={Scene}
          Backdrop={Backdrop}
          Overlay={Overlay}
          reducedMotion={reducedMotion}
          loadableVideos={loadableVideos}
        />
      </div>
    </div>
  );
}

function FrameStill<Scene extends SceneContent>({
  at,
  composition,
  active,
  outgoing,
  Scene,
  Backdrop,
  Overlay,
  reducedMotion,
  loadableVideos,
}: {
  at: number;
  composition: Composition<Scene>;
  active: number;
  outgoing: number;
  Scene: ComponentType<SceneRenderProps<Scene>>;
  Backdrop: ComponentType<FilmLayerProps<Scene>> | undefined;
  Overlay: ComponentType<FilmLayerProps<Scene>> | undefined;
  reducedMotion: boolean;
  loadableVideos: readonly number[] | null;
}) {
  const { scenes, videos, videoSources } = composition;
  // Starts at 0 and moves in a layout effect, as the poster's does, so useMotionValueEvent layers see a change.
  const [clock] = useState(() => motionValue(0));
  const atRef = useRef(at);
  const videoRefs = useRef(new Map<number, HTMLVideoElement>());

  function syncVideos() {
    for (const [index, video] of videoRefs.current) {
      const clip = videos[index];
      if (clip) syncVideoClip(video, clip, atRef.current, false);
    }
  }

  useLayoutEffect(() => {
    atRef.current = at;
    clock.set(at);
    syncVideos();
  }, [at, clock]);

  // Without `at`, so hovering re-renders no scene.
  const layers = useMemo(() => {
    function stillVideo(videoIndex: number) {
      if (videoIndex === -1) return null;
      // During playback, leave the bandwidth to the film's own buffering.
      if (loadableVideos !== null && !loadableVideos.includes(videoIndex)) {
        return <div aria-hidden="true" className="absolute inset-0 bg-neutral-800" />;
      }
      return (
        <video
          ref={(video) => {
            if (video) videoRefs.current.set(videoIndex, video);
            else videoRefs.current.delete(videoIndex);
          }}
          src={videoSources[videoIndex] ?? undefined}
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          onLoadedMetadata={syncVideos}
          // Sync skips a video that is still seeking, so a fast hover lands on the latest frame here.
          onSeeked={syncVideos}
        />
      );
    }
    const activeScene = scenes[active];
    if (activeScene === undefined) return null;
    const filmLayer: FilmLayerProps<Scene> = { scenes, activeScene, clock, reducedMotion };
    return (
      <>
        {Backdrop && <Backdrop {...filmLayer} />}
        {[outgoing, active].flatMap((index) => {
          const scene = scenes[index];
          if (scene === undefined) return [];
          const videoIndex = videos.findIndex((clip) => clip.sceneId === scene.id);
          return (
            <div key={scene.id} className="absolute inset-0">
              <Scene
                scene={scene}
                clock={clock}
                active={index === active}
                reducedMotion={reducedMotion}
                video={stillVideo(videoIndex)}
              />
            </div>
          );
        })}
        {Overlay && <Overlay {...filmLayer} />}
      </>
    );
  }, [scenes, videos, videoSources, active, outgoing, clock, reducedMotion, Scene, Backdrop, Overlay, loadableVideos]);

  return (
    <LayoutGroup id="frame-preview">
      <MotionConfig reducedMotion={reducedMotion ? "always" : "never"} skipAnimations>
        <div aria-hidden="true" inert className="absolute inset-0">
          {layers}
        </div>
      </MotionConfig>
    </LayoutGroup>
  );
}

/** Whole minutes and seconds, such as 1:05, for the elapsed and total time. */
function formatClock(seconds: number) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Where a seek bar key moves the clock, or null for a key the bar leaves alone. */
function seekKeyTarget(key: string, at: number, duration: number) {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return at - SEEK_STEP_SECONDS;
    case "ArrowRight":
    case "ArrowUp":
      return at + SEEK_STEP_SECONDS;
    case "PageDown":
      return at - SEEK_STEP_SECONDS * 5;
    case "PageUp":
      return at + SEEK_STEP_SECONDS * 5;
    case "Home":
      return 0;
    case "End":
      return duration;
    default:
      return null;
  }
}

/**
 * Skip back, play or pause, skip forward, the seek bar, elapsed and total time, playback speed, and mute with a volume
 * slider when the film has sound; a film with chapters adds previous and next chapter buttons and a chapter list. It
 * follows the clock on its own, so playback re-renders only the bar, and every seek goes through `onSeek`.
 */
function ControlBar({
  clock,
  duration,
  ready,
  playing,
  hasAudio,
  muted,
  volume,
  onVolumeChange,
  onVolumeGesture,
  speed,
  onSpeedChange,
  onTogglePlayback,
  onSeek,
  onScrubStart,
  onScrubEnd,
  onToggleMute,
  chapters,
  onStepChapter,
  onJumpToChapter,
  renderFrame,
  fullscreenTarget,
  onToggleFullscreen,
}: {
  clock: MotionValue<number>;
  duration: number;
  ready: boolean;
  playing: boolean;
  hasAudio: boolean;
  muted: boolean;
  volume: number;
  onVolumeChange: (level: number) => void;
  /** A slider drag or key press starts (true) or ends (false). */
  onVolumeGesture: (started: boolean) => void;
  speed: number;
  onSpeedChange: (rate: number) => void;
  onTogglePlayback: () => void;
  onSeek: (seconds: number) => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
  onToggleMute: () => void;
  chapters: readonly Chapter[];
  onStepChapter: (direction: "previous" | "next") => void;
  onJumpToChapter: (index: number) => void;
  renderFrame: (seconds: number) => ReactNode;
  /** The element full screen shows, or null where the browser cannot show one. */
  fullscreenTarget: RefObject<HTMLDivElement | null> | null;
  onToggleFullscreen: () => void;
}) {
  const [at, setAt] = useState(() => clock.get());
  // Kept here so toggling full screen re-renders only the controls. Escape and the browser's own exit report it too.
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    if (fullscreenTarget === null) return;
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === fullscreenTarget.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, [fullscreenTarget]);
  const shownAtRef = useRef(at);
  // The time reads in whole seconds and the seek bar draws itself from the clock, so playback re-renders the bar a few
  // times a second rather than on every frame. A seek, a new second and either end of the film show at once.
  useMotionValueEvent(clock, "change", (next) => {
    const shown = shownAtRef.current;
    const settled = Math.abs(next - shown) < CONTROL_REFRESH_SECONDS && Math.floor(next) === Math.floor(shown);
    if (settled && next > 0 && next < duration) return;
    shownAtRef.current = next;
    setAt(next);
  });
  // Play at the end replays from the beginning, so the button says so.
  const ended = !playing && at >= duration;
  const hasChapters = chapters.length > 0;
  return (
    // Media controls read left to right in every language.
    <div
      dir="ltr"
      className="relative flex flex-wrap items-center gap-0.5 border-t border-white/10 px-1.5 py-1 text-white sm:flex-nowrap sm:gap-1 sm:px-2"
    >
      {/* A phone-width bar keeps its seek bar wide by leaving chapter steps to the chapter list on its own row. */}
      {hasChapters && (
        <IconButton
          label="Previous chapter"
          disabled={!ready}
          hideWhenNarrow
          onClick={() => onStepChapter("previous")}
        >
          <path d="M19 20 9 12l10-8Z" fill="currentColor" />
          <path d="M5 19V5" />
        </IconButton>
      )}
      <IconButton
        label={`Back ${SKIP_SECONDS} seconds`}
        disabled={!ready}
        onClick={() => onSeek(clock.get() - SKIP_SECONDS)}
      >
        <path d="M11 19 2 12l9-7Z" />
        <path d="M22 19l-9-7 9-7Z" />
      </IconButton>
      <PlayButton playing={playing} ended={ended} disabled={!ready} onClick={onTogglePlayback} />
      <IconButton
        label={`Forward ${SKIP_SECONDS} seconds`}
        disabled={!ready}
        onClick={() => onSeek(clock.get() + SKIP_SECONDS)}
      >
        <path d="m13 19 9-7-9-7Z" />
        <path d="m2 19 9-7-9-7Z" />
      </IconButton>
      {hasChapters && (
        <IconButton label="Next chapter" disabled={!ready} hideWhenNarrow onClick={() => onStepChapter("next")}>
          <path d="m5 4 10 8-10 8Z" fill="currentColor" />
          <path d="M19 5v14" />
        </IconButton>
      )}
      <TimeRange
        clock={clock}
        at={at}
        duration={duration}
        disabled={!ready}
        chapters={chapters}
        onSeek={onSeek}
        onScrubStart={onScrubStart}
        onScrubEnd={onScrubEnd}
        renderFrame={renderFrame}
      />
      <span className="shrink-0 px-1 text-xs tabular-nums text-white/80 sm:px-1.5">
        {formatClock(at)} / {formatClock(duration)}
      </span>
      {/* At phone width the chapter title and speed take a second row, keeping the seek bar wide. */}
      <div aria-hidden="true" className="order-last basis-full sm:hidden" />
      {hasChapters && (
        <ChapterMenu
          chapters={chapters}
          current={chapterIndexAt(chapters, at)}
          disabled={!ready}
          onJump={onJumpToChapter}
        />
      )}
      <MenuButton
        label={`Playback speed ${speed}×`}
        menuLabel="Playback speed"
        disabled={!ready}
        items={PLAYBACK_SPEEDS.map((rate) => ({
          key: String(rate),
          content: <span className={rate === speed ? "font-semibold" : ""}>{speedLabel(rate)}</span>,
        }))}
        current={PLAYBACK_SPEEDS.indexOf(speed as (typeof PLAYBACK_SPEEDS)[number])}
        onPick={(index) => onSpeedChange(PLAYBACK_SPEEDS[index] ?? 1)}
        className="order-last ml-auto flex shrink-0 sm:order-none sm:ml-0"
        triggerClassName="tabular-nums"
      >
        {`${speed}×`}
      </MenuButton>
      {hasAudio && (
        <IconButton label={muted ? "Unmute" : "Mute"} disabled={!ready} onClick={onToggleMute}>
          <path d="M11 5 6 9H2v6h4l5 4Z" fill="currentColor" />
          {muted ? (
            <>
              <path d="m22 9-6 6" />
              <path d="m16 9 6 6" />
            </>
          ) : (
            <>
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M19 5a10 10 0 0 1 0 14" />
            </>
          )}
        </IconButton>
      )}
      {/* Phones set the volume with their own buttons, and iOS ignores a page's volume, so the slider is wider-only. */}
      {hasAudio && (
        <input
          type="range"
          data-slot="volume"
          aria-label="Volume"
          aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          disabled={!ready}
          onChange={(event) => onVolumeChange(event.currentTarget.valueAsNumber)}
          onPointerDown={() => onVolumeGesture(true)}
          onKeyDown={(event) => {
            if (!event.repeat) onVolumeGesture(true);
            // The slider keeps its own keys; the rest reach the player's shortcuts.
            if (SLIDER_KEYS.has(event.key)) event.stopPropagation();
          }}
          onPointerUp={() => onVolumeGesture(false)}
          onPointerCancel={() => onVolumeGesture(false)}
          onKeyUp={() => onVolumeGesture(false)}
          onBlur={() => onVolumeGesture(false)}
          className="hidden h-9 w-16 shrink-0 cursor-pointer accent-white disabled:pointer-events-none disabled:opacity-50 sm:block"
        />
      )}
      {fullscreenTarget !== null && (
        <IconButton
          label={fullscreen ? "Exit full screen" : "Full screen"}
          disabled={false}
          onClick={onToggleFullscreen}
        >
          {fullscreen ? (
            <>
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </>
          ) : (
            <>
              <path d="M8 3H5a2 2 0 0 0-2 2v3" />
              <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
              <path d="M3 16v3a2 2 0 0 0 2 2h3" />
              <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
            </>
          )}
        </IconButton>
      )}
    </div>
  );
}

function PlayButton({
  playing,
  ended,
  disabled,
  onClick,
}: {
  playing: boolean;
  ended: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  if (playing) {
    return (
      <IconButton label="Pause" disabled={disabled} onClick={onClick}>
        <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
        <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
      </IconButton>
    );
  }
  if (ended) {
    return (
      <IconButton label="Replay" disabled={disabled} onClick={onClick}>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
      </IconButton>
    );
  }
  return (
    <IconButton label="Play" disabled={disabled} onClick={onClick}>
      <path d="M7 4v16l13-8Z" fill="currentColor" />
    </IconButton>
  );
}

/** A square ghost button with a 24-unit stroked icon, labelled for assistive technology and as a tooltip. */
function IconButton({
  label,
  disabled,
  hideWhenNarrow = false,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  hideWhenNarrow?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`${hideWhenNarrow ? "hidden sm:inline-flex" : "inline-flex"} size-9 shrink-0 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-50`}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}

function speedLabel(rate: number) {
  return rate === 1 ? "Normal" : `${rate}×`;
}

/** The current chapter's title, which opens a list of every chapter with its start time. */
function ChapterMenu({
  chapters,
  current,
  disabled,
  onJump,
}: {
  chapters: readonly Chapter[];
  /** The playing chapter's index. */
  current: number;
  disabled: boolean;
  onJump: (index: number) => void;
}) {
  const title = chapters[current]?.title ?? "";
  return (
    <MenuButton
      label={`Chapter: ${title}`}
      title={title}
      menuLabel="Chapters"
      disabled={disabled}
      items={chapters.map((chapter, index) => ({
        key: `${chapter.start}:${chapter.title}`,
        content: (
          <>
            <span className="w-9 shrink-0 text-xs tabular-nums text-white/60">{formatClock(chapter.start)}</span>
            <span className={`min-w-0 truncate ${index === current ? "font-semibold" : ""}`}>{chapter.title}</span>
          </>
        ),
      }))}
      current={current}
      onPick={onJump}
      className="order-last flex min-w-0 flex-1 sm:order-none sm:flex-none"
      triggerClassName="min-w-0 sm:max-w-48"
    >
      <span className="truncate">{title}</span>
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="m6 15 6-6 6 6" />
      </svg>
    </MenuButton>
  );
}

/**
 * A control bar button opening a menu of radio items above the bar. Arrows, Home and End move between items, Left and
 * Right are swallowed, and Escape, Tab or a click outside closes it.
 */
function MenuButton({
  label,
  title,
  menuLabel,
  disabled,
  items,
  current,
  onPick,
  className,
  triggerClassName = "",
  children,
}: {
  label: string;
  title?: string;
  menuLabel: string;
  disabled: boolean;
  items: readonly { key: string; content: ReactNode }[];
  current: number;
  onPick: (index: number) => void;
  className: string;
  triggerClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const options = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitemradio']") ?? [])];
    (options.find((option) => option.getAttribute("aria-checked") === "true") ?? options[0])?.focus();
    const closeOutside = (event: globalThis.PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (menuRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const options = [...event.currentTarget.querySelectorAll<HTMLElement>("[role='menuitemradio']")];
    const focused = options.findIndex((option) => option === document.activeElement);
    switch (event.key) {
      case "ArrowDown":
        options[(focused + 1) % options.length]?.focus();
        break;
      case "ArrowUp":
        options[(focused - 1 + options.length) % options.length]?.focus();
        break;
      case "Home":
        options[0]?.focus();
        break;
      case "End":
        options[options.length - 1]?.focus();
        break;
      case "ArrowLeft":
      case "ArrowRight":
        break;
      case "Escape":
        close();
        break;
      case "Tab":
        // Tab carries on from the trigger, so focus stays in the player rather than leaving the removed list.
        close();
        return;
      default:
        return;
    }
    // Keeps the player's own shortcuts, such as Home or the arrow skips, from also handling the key.
    event.preventDefault();
  }

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={title ?? label}
        disabled={disabled}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={`inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-50 ${triggerClassName}`}
      >
        {children}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={menuLabel}
          onKeyDown={handleMenuKey}
          className="absolute bottom-full right-1.5 z-10 mb-1.5 max-h-44 w-max max-w-[calc(100%-0.75rem)] overflow-y-auto rounded-xl border border-white/10 bg-neutral-900/95 p-1 shadow-2xl sm:max-h-72 sm:max-w-80"
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              role="menuitemradio"
              aria-checked={index === current}
              tabIndex={-1}
              onClick={() => {
                onPick(index);
                close();
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm outline-none hover:bg-white/10 focus-visible:bg-white/15 ${index === current ? "text-white" : "text-white/75"}`}
            >
              {item.content}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The seek bar: a range input for keyboards and assistive technology under a drawn track. Pointer and touch input
 * land on the track itself, so a tap jumps there on every platform and a drag scrubs. Hovering it with a mouse shows
 * the film's frame and the time there. With chapters, the track marks where each one starts, and the hover, or focusing
 * the input, shows the chapter there too.
 */
function TimeRange({
  clock,
  at,
  duration,
  disabled,
  chapters,
  onSeek,
  onScrubStart,
  onScrubEnd,
  renderFrame,
}: {
  clock: MotionValue<number>;
  /** The clock as the control bar last rendered it, a few times a second during playback. */
  at: number;
  duration: number;
  disabled: boolean;
  chapters: readonly Chapter[];
  onSeek: (seconds: number) => void;
  /** A pointer drag starts and ends, so the player handles the drag's seeks as one. */
  onScrubStart: () => void;
  onScrubEnd: () => void;
  renderFrame: (seconds: number) => ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);
  const [hoverAt, setHoverAt] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  // Drawn by Motion from the clock on every frame, without re-rendering the bar.
  const progress = useTransform(clock, (seconds) =>
    duration > 0 ? `${(Math.max(0, Math.min(seconds, duration)) / duration) * 100}%` : "0%",
  );
  const chapter = chapters[chapterIndexAt(chapters, at)];
  const previewAt = hoverAt ?? (focused && chapters.length > 0 ? at : null);
  const previewChapter = previewAt === null ? undefined : chapters[chapterIndexAt(chapters, previewAt)];
  const previewPercent = previewAt === null || duration <= 0 ? 0 : (previewAt / duration) * 100;
  // Measured before paint, so the tooltip centres on the time and stops at the bar's ends.
  useLayoutEffect(() => {
    const width = tooltipRef.current?.offsetWidth ?? 0;
    if (width !== tooltipWidth) setTooltipWidth(width);
  });

  function pointerTime(event: PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track) return null;
    const bounds = track.getBoundingClientRect();
    return ((event.clientX - bounds.left) / bounds.width) * duration;
  }

  function seekToPointer(event: PointerEvent<HTMLDivElement>) {
    const seconds = pointerTime(event);
    if (seconds !== null) onSeek(seconds);
  }

  return (
    <div
      className={`group/range relative flex h-9 min-w-0 flex-1 touch-pan-y items-center rounded-md px-1.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-white ${disabled ? "opacity-50" : "cursor-pointer"}`}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        onScrubStart();
        seekToPointer(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) seekToPointer(event);
        if (event.pointerType !== "mouse") return;
        const seconds = pointerTime(event);
        if (seconds !== null) setHoverAt(Math.max(0, Math.min(duration, seconds)));
      }}
      onPointerLeave={() => setHoverAt(null)}
      // Fires when the pointer is released or cancelled, after the drag's last move.
      onLostPointerCapture={onScrubEnd}
    >
      <div ref={trackRef} className="relative h-1 w-full rounded-full bg-white/25 transition-[height] group-hover/range:h-1.5">
        <motion.div className="h-full rounded-full bg-white" style={{ width: progress }} />
        {chapters.map((mark) =>
          mark.start > 0 && duration > 0 ? (
            <div
              key={mark.start}
              aria-hidden="true"
              // A dark gap splits the played bar and a light mark the dim unplayed track.
              className={`absolute inset-y-0 w-0.5 -translate-x-1/2 ${mark.start <= at ? "bg-neutral-900" : "bg-white/70"}`}
              style={{ left: `${(mark.start / duration) * 100}%` }}
            />
          ) : null,
        )}
        <motion.div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-transform group-hover/range:scale-125"
          style={{ left: progress }}
        />
      </div>
      {previewAt !== null && (
        // The input's value text already reads the chapter out, so this is for sighted viewers only.
        <div
          ref={tooltipRef}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full mb-1 flex max-w-[min(16rem,100%)] -translate-x-1/2 flex-col items-center gap-1"
          // The track sits inside the bar's 0.375rem side padding.
          style={{
            left: `clamp(${tooltipWidth / 2}px, calc(0.375rem + (100% - 0.75rem) * ${previewPercent / 100}), calc(100% - ${tooltipWidth / 2}px))`,
          }}
        >
          {hoverAt !== null && renderFrame(hoverAt)}
          <div className="max-w-full rounded-md bg-neutral-950/90 px-2 py-1 text-center text-xs text-white shadow-lg">
            {previewChapter && <span className="block truncate font-medium">{previewChapter.title}</span>}
            <span className="block tabular-nums text-white/70">{formatClock(previewAt)}</span>
          </div>
        </div>
      )}
      <input
        type="range"
        data-slot="time-range"
        aria-label="Seek"
        aria-valuetext={`${formatClock(at)} of ${formatClock(duration)}${chapter ? `, ${chapter.title}` : ""}`}
        min={0}
        max={duration}
        // Any step keeps assistive technology adjustments exact; keys move by whole seconds instead.
        step="any"
        value={Math.min(at, duration)}
        disabled={disabled}
        onChange={(event) => onSeek(event.currentTarget.valueAsNumber)}
        onFocus={(event) => setFocused(event.currentTarget.matches(":focus-visible"))}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          // Shift with Left or Right moves between chapters, which the player handles.
          if (event.shiftKey && chapters.length > 0 && (event.key === "ArrowLeft" || event.key === "ArrowRight")) return;
          const target = seekKeyTarget(event.key, clock.get(), duration);
          if (target === null) return;
          event.preventDefault();
          onSeek(target);
        }}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </div>
  );
}
