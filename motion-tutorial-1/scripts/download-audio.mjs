import { randomUUID } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { lstat, mkdir, open, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_FILENAME = "rork-narration-v1.mp3";
const OUTPUT_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,59}\.mp3$/;
const PROJECT_ID = /^[a-z0-9]{21}$/;
const KILL_GRACE_MS = 2_000;
const PROJECT_AUDIO_HOST = /^[a-z0-9]{21}\.rork\.app$/;
const PROJECT_AUDIO_PATH = /^\/~assets\/aud\/[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const TRUSTED_R2_HOSTS = new Set(["r2-pub.rork.com", "pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev"]);
const R2_AUDIO_PATH = /^\/generated-audio\/[a-z0-9]{21}\/[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const INTEGRATED_LOUDNESS = /^\s*I:\s+(-?(?:\d+(?:\.\d+)?|inf)) LUFS$/m;
const TRUE_PEAK = /^\s*Peak:\s+(-?(?:\d+(?:\.\d+)?|inf)) dBFS$/m;
// The export mixes every track through this pan, and a browser plays a mono clip the same way: on both channels at
// full level, 3 LU louder than the mono file measures on its own.
const MIX_CHANNELS = "pan=stereo|FL=FL+FC|FR=FR+FC";
// ffmpeg's ebur128 reports silence at the -70 LUFS absolute gate, or as -inf.
const SILENCE_LUFS = -70;
// A clip shorter than ebur128's 400 ms block measures as silence, so a short effect is padded to one block.
const MIN_MEASURED_SECONDS = 0.4;
// A quieter clip is raised towards this level when it is saved, because the player can only turn a track down: an
// audio element's volume stops at 1 in the browser, and the export mixes each track at the same gain.
const REFERENCE_LUFS = -16;
const TRUE_PEAK_CEILING = -1.5;
const MIN_LEVEL_GAIN_DB = 0.5;
// Lossy coding can lift a raised clip's peak past the ceiling; each further pass lowers the gain by the overshoot
// and this margin.
const MAX_LEVEL_PASSES = 3;
const TRUE_PEAK_MARGIN_DB = 0.1;

/**
 * Validates a canonical project-audio URL or a URL from Rork's public audio bucket.
 * This checks the URL format, transport and owning project; it does not verify publishing rights.
 *
 * @param {string} audioUrl - The hosted URL `rork ai audio` or `rork ai assets info` printed.
 * @param {string} projectId - This sandbox's project ID, from {@link currentProjectId}.
 * @returns {URL} The parsed, restricted HTTPS URL.
 * @example validateProjectAudioUrl("https://abcdefghijklmnopqrstu.rork.app/~assets/aud/intro.mp3", projectId)
 */
export function validateProjectAudioUrl(audioUrl, projectId) {
  let url;
  try {
    url = new URL(audioUrl);
  } catch {
    throw new Error("Use only an audioUrl that rork ai audio or rork ai assets info printed.");
  }

  const isProjectAudio = PROJECT_AUDIO_HOST.test(url.hostname) && PROJECT_AUDIO_PATH.test(url.pathname);
  const isPublicR2Audio = TRUSTED_R2_HOSTS.has(url.hostname) && R2_AUDIO_PATH.test(url.pathname);
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    (!isProjectAudio && !isPublicR2Audio)
  ) {
    throw new Error("Use only an HTTPS Rork project audio URL that rork ai audio or rork ai assets info printed.");
  }
  // The project is the asset host's subdomain, or the segment after generated-audio/ on the public bucket.
  const assetProjectId = isProjectAudio ? url.hostname.slice(0, -".rork.app".length) : url.pathname.split("/")[2];
  if (assetProjectId !== projectId) {
    throw new Error("The audio belongs to another Rork project; use only this project's assets.");
  }

  if (!url.pathname.toLowerCase().endsWith(".mp3")) {
    throw new Error("The returned project audio asset must be an MP3 file.");
  }

  return url;
}

/**
 * Every value the app's .env assigns to `EXPO_PUBLIC_PROJECT_ID`, read line by line as Rork's sandbox reads .env.
 * Rork appends envs when it creates an app, so the key can appear more than once.
 */
async function dotenvProjectIds() {
  const contents = await readFile(".env", "utf8").catch((error) => {
    if (error?.code === "ENOENT") return "";
    throw error;
  });
  const values = [];
  for (const line of contents.split("\n")) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (match?.[1] === "EXPO_PUBLIC_PROJECT_ID") values.push(match[2].replace(/^["']|["']$/g, ""));
  }
  return [...new Set(values)];
}

/**
 * This sandbox's project ID. Rork writes `EXPO_PUBLIC_PROJECT_ID` to each app's .env when the sandbox starts or the
 * app is created, and to the shell environment once the agent changes envs; every value set must agree.
 */
export async function currentProjectId() {
  const fromEnvironment = process.env["EXPO_PUBLIC_PROJECT_ID"] ?? "";
  const fromDotenv = await dotenvProjectIds();
  if (fromDotenv.length > 1) {
    throw new Error(`The app's .env sets EXPO_PUBLIC_PROJECT_ID to different values (${fromDotenv.join(", ")}).`);
  }
  const values = new Set([fromEnvironment, ...fromDotenv].filter((value) => value !== ""));
  if (values.size > 1) {
    throw new Error(`EXPO_PUBLIC_PROJECT_ID differs between the environment and the app's .env (${[...values].join(", ")}).`);
  }
  const [projectId] = values;
  if (projectId === undefined) {
    throw new Error("Run this from the motion app's directory, whose .env sets EXPO_PUBLIC_PROJECT_ID.");
  }
  if (!PROJECT_ID.test(projectId)) throw new Error(`EXPO_PUBLIC_PROJECT_ID is not a Rork project ID: ${projectId}`);
  return projectId;
}

/**
 * Returns `relativePath` inside the app, creating missing folders one level at a time. Every folder on the way must
 * already be a real directory or be created here, so a symlinked src/ or public/ cannot place anything outside the app.
 */
async function appDirectory(relativePath) {
  let directory = await realpath(process.cwd());
  const walked = [];
  for (const segment of relativePath.split("/")) {
    directory = join(directory, segment);
    walked.push(segment);
    const stats = await lstat(directory).catch((error) => {
      if (error?.code === "ENOENT") return undefined;
      throw error;
    });
    if (stats === undefined) {
      await mkdir(directory);
    } else if (!stats.isDirectory()) {
      throw new Error(`${walked.join("/")}/ must be a real directory inside the app, not a symlink.`);
    }
  }
  return directory;
}

/**
 * Runs an FFmpeg tool with a time limit: SIGTERM at the limit, then SIGKILL after a short grace period for a process
 * that ignores it, so a stuck probe or decode cannot hold the download open.
 */
export function runWithTimeout(command, args, timeoutMs) {
  return new Promise((resolvePromise, rejectPromise) => {
    let timedOut = false;
    let killTimer;
    const child = execFileCallback(command, args, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      clearTimeout(terminateTimer);
      clearTimeout(killTimer);
      if (timedOut) {
        rejectPromise(new Error(`${command} did not finish within ${timeoutMs / 1000} seconds.`));
      } else if (error) {
        rejectPromise(Object.assign(error, { stderr }));
      } else {
        resolvePromise({ stdout, stderr });
      }
    });
    const terminateTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS);
    }, timeoutMs);
  });
}

async function verifyMp3Audio(path) {
  const { stdout } = await runWithTimeout(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=codec_type,codec_name,duration:format=duration,format_name",
      "-of",
      "json",
      path,
    ],
    10_000,
  );
  const probe = JSON.parse(stdout);
  const audio = probe.streams?.[0];
  const duration = Number(audio?.duration ?? probe.format?.duration);
  // The container too: an MP3 stream inside Matroska or MP4 would be published under an .mp3 name as it came.
  if (
    audio?.codec_type !== "audio" ||
    audio.codec_name !== "mp3" ||
    probe.format?.format_name !== "mp3" ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    throw new Error("The returned asset is not a valid MP3 audio file.");
  }
  return Math.ceil(duration * 1000) / 1000;
}

/**
 * Measures the clip's integrated loudness (EBU R128) and true peak as it plays in the mix.
 *
 * @returns {Promise<{ loudness: number, truePeak: number } | undefined>} LUFS and dBTP, or undefined for a silent clip.
 */
async function measureLoudness(path) {
  const { stderr } = await runWithTimeout(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-i",
      path,
      "-map",
      "0:a:0",
      "-af",
      `${MIX_CHANNELS},apad=whole_dur=${MIN_MEASURED_SECONDS},ebur128=peak=true:framelog=quiet`,
      "-f",
      "null",
      "-",
    ],
    20_000,
  );
  const loudness = INTEGRATED_LOUDNESS.exec(stderr)?.[1];
  const truePeak = TRUE_PEAK.exec(stderr)?.[1];
  if (loudness === undefined || truePeak === undefined) {
    throw new Error("FFmpeg did not report the audio asset's loudness.");
  }
  if (loudness === "-inf" || Number(loudness) <= SILENCE_LUFS) return undefined;
  return { loudness: Number(loudness), truePeak: Number(truePeak) };
}

/**
 * Verifies a saved clip and records the loudness the mixer levels it by. A clip quieter than REFERENCE_LUFS is first
 * raised towards it with a plain gain, so the bed and effects can reach their level under the narration by turning
 * down alone. A raised clip keeps its true peak under TRUE_PEAK_CEILING, checked on the encoded MP3 because lossy
 * coding moves peaks; a clip that is not raised is saved as it came.
 *
 * @returns {Promise<{ seconds: number, loudness: number | undefined }>} The clip's length and LUFS, none when silent.
 */
async function levelClip(path) {
  const seconds = await verifyMp3Audio(path);
  const measured = await measureLoudness(path);
  let gain =
    measured === undefined
      ? 0
      : Math.min(REFERENCE_LUFS - measured.loudness, TRUE_PEAK_CEILING - measured.truePeak);
  if (!(gain >= MIN_LEVEL_GAIN_DB)) return { seconds, loudness: measured?.loudness };

  const levelledPath = `${path}.level`;
  let levelled;
  let underCeiling = false;
  try {
    for (let pass = 0; pass < MAX_LEVEL_PASSES; pass += 1) {
      await encodeWithGain(path, levelledPath, gain);
      levelled = await measureLoudness(levelledPath);
      if (!(levelled && levelled.truePeak > TRUE_PEAK_CEILING)) {
        underCeiling = true;
        break;
      }
      gain -= levelled.truePeak - TRUE_PEAK_CEILING + TRUE_PEAK_MARGIN_DB;
      if (!(gain >= MIN_LEVEL_GAIN_DB)) break;
    }
    // No pass stayed under the ceiling with a gain worth applying, so the clip keeps its original level.
    if (!underCeiling) {
      await rm(levelledPath, { force: true });
      return { seconds, loudness: measured.loudness };
    }
    await rename(levelledPath, path);
  } catch (error) {
    await rm(levelledPath, { force: true }).catch(() => {});
    throw error;
  }
  return { seconds: await verifyMp3Audio(path), loudness: levelled?.loudness };
}

/** Re-encodes `source` into `destination` with a plain `gain` in dB. */
async function encodeWithGain(source, destination, gain) {
  await runWithTimeout(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      source,
      "-map",
      "0:a:0",
      "-af",
      `volume=${gain.toFixed(2)}dB`,
      "-c:a",
      "libmp3lame",
      "-q:a",
      "2",
      "-y",
      "-f",
      "mp3",
      destination,
    ],
    60_000,
  );
}

async function writeAtomically(destination, contents) {
  const temporaryPath = `${destination}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, contents, { flag: "wx" });
    await rename(temporaryPath, destination);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function readBoundedBody(body, maxBytes) {
  if (!body) throw new Error("The returned audio asset has no response body.");

  const chunks = [];
  let byteLength = 0;
  for await (const chunk of body) {
    if (byteLength + chunk.byteLength > maxBytes) {
      throw new Error(`The audio asset exceeds the ${maxBytes}-byte download limit.`);
    }
    const bytes = Buffer.from(chunk);
    byteLength += bytes.byteLength;
    chunks.push(bytes);
  }
  if (byteLength === 0) throw new Error("The returned audio asset is empty.");

  return Buffer.concat(chunks, byteLength);
}

/**
 * Downloads a trusted project audio asset into the motion project's public directory and records its
 * measured duration and loudness in src/audio-clips/, one file per clip so parallel downloads never share a manifest.
 * A quiet clip is saved raised towards -16 LUFS, within a -1.5 dBTP true peak; a louder one is saved as it came.
 *
 * @param {string} audioUrl - The hosted URL `rork ai audio` or `rork ai assets info` printed.
 * @param {string} [filename="rork-narration-v1.mp3"] - A safe MP3 basename inside `public/`.
 * @returns {Promise<{ path: string, src: string, seconds: number, loudness?: number }>} The validated local MP3, its
 *   duration and its integrated loudness in LUFS, which a silent clip has none of.
 * @example await downloadProjectAudio(audioUrl, "rork-vo-opening-v1.mp3")
 */
export async function downloadProjectAudio(audioUrl, filename = DEFAULT_FILENAME) {
  if (typeof filename !== "string" || !OUTPUT_FILENAME.test(filename)) {
    throw new Error("Choose a versioned MP3 filename without a directory path.");
  }

  const url = validateProjectAudioUrl(audioUrl, await currentProjectId());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  let audioBytes;
  try {
    response = await fetch(url.href, {
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Could not load the project audio asset (HTTP ${response.status}).`);

    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "audio/mpeg") throw new Error("The project audio asset did not return MP3 audio.");

    const contentLength = response.headers.get("content-length");
    if (contentLength !== null) {
      const declaredLength = Number(contentLength);
      if (!Number.isSafeInteger(declaredLength) || declaredLength <= 0 || declaredLength > MAX_AUDIO_BYTES) {
        throw new Error(`The audio asset exceeds the ${MAX_AUDIO_BYTES}-byte download limit.`);
      }
    }

    audioBytes = await readBoundedBody(response.body, MAX_AUDIO_BYTES);
  } catch (error) {
    controller.abort();
    if (response?.body && !response.body.locked) {
      void response.body.cancel().catch(() => {});
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  return saveClip(audioBytes, filename);
}

/**
 * Saves MP3 bytes as `public/<filename>`, levelled as {@link levelClip} describes, and records the clip's measured
 * duration and loudness in src/audio-clips/, one file per clip so parallel saves never share a manifest.
 */
async function saveClip(audioBytes, filename) {
  const publicDirectory = await appDirectory("public");
  const clipsDirectory = await appDirectory("src/audio-clips");
  const destination = resolve(publicDirectory, filename);
  if (dirname(destination) !== publicDirectory) {
    throw new Error("Choose a versioned MP3 filename without a directory path.");
  }
  const temporaryPath = `${destination}.${randomUUID()}.tmp`;
  let seconds;
  let loudness;
  try {
    await writeFile(temporaryPath, audioBytes, { flag: "wx" });
    ({ seconds, loudness } = await levelClip(temporaryPath));
    await rename(temporaryPath, destination);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }

  const src = `/${filename}`;
  const measurement = { src, seconds, ...(loudness === undefined ? {} : { loudness }) };
  await writeAtomically(
    resolve(clipsDirectory, `${filename.slice(0, -".mp3".length)}.json`),
    JSON.stringify(measurement) + "\n",
  );

  return { path: destination, ...measurement };
}

/**
 * Brings an MP3 that is already on disk into the film: one the user uploaded to the project, or one a script made.
 * It is checked, levelled and measured exactly as a downloaded clip is, so the player times and mixes it the same way.
 * The file itself is left where it is. This does not check publishing rights.
 *
 * @param {string} sourcePath - The MP3's path, absolute or relative to the motion app's directory.
 * @param {string} [filename="rork-narration-v1.mp3"] - A safe MP3 basename inside `public/`.
 * @returns {Promise<{ path: string, src: string, seconds: number, loudness?: number }>} As {@link downloadProjectAudio}.
 * @example await saveLocalAudio("../uploads/theme.mp3", "rork-music-v1.mp3")
 */
export async function saveLocalAudio(sourcePath, filename = DEFAULT_FILENAME) {
  if (typeof filename !== "string" || !OUTPUT_FILENAME.test(filename)) {
    throw new Error("Choose a versioned MP3 filename without a directory path.");
  }
  if (typeof sourcePath !== "string" || !sourcePath.toLowerCase().endsWith(".mp3")) {
    throw new Error("Pass the path of an MP3 file.");
  }
  const source = resolve(sourcePath);
  const stats = await stat(source).catch((error) => {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  });
  if (!stats?.isFile()) throw new Error(`There is no audio file at ${source}.`);
  if (stats.size === 0) throw new Error("The audio file is empty.");
  if (stats.size > MAX_AUDIO_BYTES) throw new Error(`The audio file exceeds the ${MAX_AUDIO_BYTES}-byte limit.`);
  // Saving levels the clip and replaces public/<filename>: onto itself, the source would be the file that is lost.
  const destination = resolve(await appDirectory("public"), filename);
  if ((await realpath(source)) === (await realpath(destination).catch(() => destination))) {
    throw new Error(`${source} is already public/${filename}. Save it under a new versioned filename.`);
  }
  return saveClip(await readBoundedFile(source, MAX_AUDIO_BYTES), filename);
}

/** Reads a file of at most `maxBytes`, however large it has grown since it was measured. */
async function readBoundedFile(path, maxBytes) {
  const file = await open(path, "r");
  try {
    const buffer = Buffer.alloc(maxBytes + 1);
    let length = 0;
    for (;;) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, length);
      if (bytesRead === 0) break;
      length += bytesRead;
      if (length > maxBytes) throw new Error(`The audio file exceeds the ${maxBytes}-byte limit.`);
    }
    return buffer.subarray(0, length);
  } finally {
    await file.close();
  }
}

/**
 * The line the script prints for a saved clip. A clip left more than the smallest raise under REFERENCE_LUFS was held
 * there by its peaks, and the player can only turn a track down, so it says how far under, while the clip is new.
 *
 * @param {{ path: string, seconds: number, loudness?: number }} saved - What {@link downloadProjectAudio} returned.
 * @returns {string}
 * @example describeSavedClip({ path: "/app/public/rork-sfx-bowl-v1.mp3", seconds: 2.4, loudness: -28.1 })
 */
export function describeSavedClip({ path, seconds, loudness }) {
  if (loudness === undefined) return `Saved validated audio to ${path} (${seconds}s, silent)`;
  const saved = `Saved validated audio to ${path} (${seconds}s, ${loudness} LUFS)`;
  const held = Math.round((REFERENCE_LUFS - loudness) * 10) / 10;
  if (!(held > MIN_LEVEL_GAIN_DB)) return saved;
  return `${saved}. Its peaks held it ${held} LU under ${REFERENCE_LUFS} LUFS, so beside the narration it may play quieter than its volume asks (.rork/skills/web-motion/audio.md).`;
}

async function main() {
  const audioUrl = process.argv[2];
  if (!audioUrl) {
    throw new Error(
      "Pass the audioUrl that rork ai audio or rork ai assets info printed, or --file and the path of an MP3 on disk.",
    );
  }

  const saved =
    audioUrl === "--file"
      ? await saveLocalAudio(process.argv[3], process.argv[4] ?? DEFAULT_FILENAME)
      : await downloadProjectAudio(audioUrl, process.argv[3] ?? DEFAULT_FILENAME);
  process.stdout.write(`${describeSavedClip(saved)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Could not save the project audio asset.");
    process.exitCode = 1;
  });
}
