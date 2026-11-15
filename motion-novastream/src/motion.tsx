import "@fontsource-variable/archivo/wdth.css";

import type { CSSProperties, ReactNode } from "react";
import { MotionPlayer, type FilmLayerProps, type SceneContent, type SceneRenderProps } from "./motion-player";
import { backOut, easeInOut, easeOut, spring } from "motion";
import { motion, useTransform, type MotionValue } from "motion/react";

/*
 * NovaStream — 30 s vertical social promo (1080 × 1920), English narration.
 * Visual language: the icon's night-sky navy, its electric blue → cyan play mark and the mint orbit.
 * Condensed heavy headlines, wide-tracked kickers, real app screenshots in glass phone frames.
 * Portrait safe area: key content sits between 15 % from the top and 20 % from the bottom, left of the right 12 %.
 */

type FilmScene = SceneContent &
  (
    | { id: "hook"; kicker: string; line1: string; line2: string }
    | { id: "live"; kicker: string; line1: string; line2: string }
    | { id: "movies"; kicker: string; line1: string; line2: string }
    | { id: "resume"; kicker: string; line1: string; line2: string }
    | { id: "playlist"; kicker: string; line1: string; line2: string }
    | { id: "transfer"; kicker: string; line1: string; line2: string; url: string; facts: string[] }
    | { id: "close"; name: string; line: string; cta: string; fine: string }
  );

const content: FilmScene[] = [
  {
    id: "hook",
    kicker: "NovaStream",
    line1: "All your TV.",
    line2: "One app.",
    voiceover: "/rork-vo-hook-v1.mp3",
    minSeconds: 4.2,
    effects: [{ src: "/rork-sfx-reveal-v1.mp3", at: 0.05, volume: 0.3 }],
  },
  {
    id: "live",
    chapter: "Live TV",
    kicker: "Live TV",
    line1: "Every channel.",
    line2: "Real TV guide.",
    voiceover: "/rork-vo-live-v1.mp3",
    minSeconds: 4,
  },
  {
    id: "movies",
    chapter: "Movies & series",
    kicker: "Movies & series",
    line1: "Endless films.",
    line2: "Found fast.",
    voiceover: "/rork-vo-movies-v1.mp3",
    minSeconds: 4.2,
  },
  {
    id: "resume",
    kicker: "Phone · TV",
    line1: "Stop here.",
    line2: "Resume there.",
    voiceover: "/rork-vo-resume-v1.mp3",
    minSeconds: 4.6,
  },
  {
    id: "playlist",
    chapter: "Playlists",
    kicker: "Your playlists",
    line1: "Add them",
    line2: "from the web.",
    voiceover: "/rork-vo-playlist-v1.mp3",
    minSeconds: 4.3,
  },
  {
    id: "transfer",
    chapter: "Licence transfer",
    kicker: "New",
    line1: "New TV?",
    line2: "Move your licence.",
    url: "novastreamapp.com/transfer",
    facts: ["Free", "Same plan", "Same expiry"],
    voiceover: "/rork-vo-transfer-v1.mp3",
    minSeconds: 4.6,
    effects: [
      { src: "/rork-sfx-swipe-v1.mp3", at: 1.05, volume: 0.28 },
      { src: "/rork-sfx-done-v1.mp3", at: 2.25, volume: 0.32 },
    ],
  },
  {
    id: "close",
    chapter: "Get the app",
    name: "NovaStream",
    line: "All your TV. One app.",
    cta: "Get it on Google Play",
    fine: "Bring your own playlist · No channels or content included",
    voiceover: "/rork-vo-close-v1.mp3",
    minSeconds: 4.4,
    effects: [{ src: "/rork-sfx-reveal-v1.mp3", at: 0.05, volume: 0.22 }],
  },
];

const musicBed: string | null = "/rork-music-v1.mp3";

const TRANSITION_SECONDS = 0.5;

const C = {
  ink: "#05080F",
  navy: "#0A1124",
  blue: "#2F7BFF",
  cyan: "#38D5F5",
  mint: "#34E0A1",
  coral: "#FF6B7A",
  text: "#EAF1FF",
  muted: "rgba(214,226,255,0.62)",
};

const DISPLAY: CSSProperties = {
  fontFamily: "'Archivo Variable', system-ui, sans-serif",
  fontStretch: "78%",
  fontWeight: 860,
  letterSpacing: "-0.025em",
  lineHeight: 0.92,
};
const WIDE: CSSProperties = {
  fontFamily: "'Archivo Variable', system-ui, sans-serif",
  fontStretch: "125%",
  fontWeight: 640,
  letterSpacing: "0.32em",
  textTransform: "uppercase",
};
const BODY: CSSProperties = {
  fontFamily: "'Archivo Variable', system-ui, sans-serif",
  fontStretch: "100%",
};
const GRADIENT_TEXT: CSSProperties = {
  backgroundImage: `linear-gradient(100deg, ${C.blue} 0%, ${C.cyan} 55%, ${C.mint} 100%)`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const settle = spring({ keyframes: [0, 1], visualDuration: 0.7, bounce: 0.28 });

type SceneProps<Id extends FilmScene["id"]> = SceneRenderProps<Extract<FilmScene, { id: Id }>>;

export default function MotionPresentation() {
  return (
    <MotionPlayer
      content={content}
      musicBed={musicBed}
      width={1080}
      height={1920}
      surfaceClassName="bg-[#05080F]"
      Scene={FilmSceneView}
      Backdrop={Backdrop}
      transitionSeconds={TRANSITION_SECONDS}
    />
  );
}

function FilmSceneView(props: SceneRenderProps<FilmScene>) {
  const { scene } = props;
  switch (scene.id) {
    case "hook":
      return <HookScene {...props} scene={scene} />;
    case "live":
      return <LiveScene {...props} scene={scene} />;
    case "movies":
      return <MoviesScene {...props} scene={scene} />;
    case "resume":
      return <ResumeScene {...props} scene={scene} />;
    case "playlist":
      return <PlaylistScene {...props} scene={scene} />;
    case "transfer":
      return <TransferScene {...props} scene={scene} />;
    case "close":
      return <CloseScene {...props} scene={scene} />;
  }
}

/* ───────────────────────── shared motion helpers ───────────────────────── */

function useLocal(scene: { start: number }, clock: MotionValue<number>) {
  return useTransform(clock, (time) => time - scene.start);
}

/** Cross-fade with a gentle push: the incoming scene settles from 1.04, the outgoing one lifts away. */
function useSceneShell(scene: { start: number; end: number }, clock: MotionValue<number>, reducedMotion: boolean) {
  const opacity = useTransform(clock, (time) => {
    const fadeIn = scene.start === 0 ? 1 : (time - scene.start) / TRANSITION_SECONDS;
    const fadeOut = (scene.end + TRANSITION_SECONDS - time) / TRANSITION_SECONDS;
    return Math.max(0, Math.min(1, fadeIn, fadeOut));
  });
  const scale = useTransform(clock, (time) => {
    if (reducedMotion) return 1;
    if (time > scene.end) return 1 - 0.04 * Math.min(1, (time - scene.end) / TRANSITION_SECONDS);
    if (scene.start === 0) return 1;
    const p = Math.min(1, Math.max(0, (time - scene.start) / 0.7));
    return 1.04 - 0.04 * easeOut(p);
  });
  return { opacity, scale };
}

/** Clock-driven 0→1 progress between two scene-local times. */
function useProgress(local: MotionValue<number>, from: number, to: number, ease = easeOut) {
  return useTransform(local, [from, to], [0, 1], { ease, clamp: true });
}

function useRise(local: MotionValue<number>, at: number, reducedMotion: boolean, distance = 8) {
  const p = useProgress(local, at, at + 0.6);
  const opacity = p;
  const y = useTransform(p, (v) => (reducedMotion ? "0cqw" : `${(1 - v) * distance}cqw`));
  return { opacity, y };
}

function Section({
  opacity,
  scale,
  children,
}: {
  opacity: MotionValue<number>;
  scale: MotionValue<number>;
  children: ReactNode;
}) {
  return (
    <motion.section className="absolute inset-0 overflow-hidden" style={{ opacity, scale, color: C.text }}>
      {children}
    </motion.section>
  );
}

/** Kicker + two-line headline, top of the safe area. */
function Headline({
  local,
  reducedMotion,
  kicker,
  line1,
  line2,
  top = 29,
  size = 12.5,
  kickerColor = C.mint,
}: {
  local: MotionValue<number>;
  reducedMotion: boolean;
  kicker: string;
  line1: string;
  line2: string;
  top?: number;
  size?: number;
  kickerColor?: string;
}) {
  const k = useRise(local, 0.15, reducedMotion, 3);
  const a = useRise(local, 0.25, reducedMotion);
  const b = useRise(local, 0.42, reducedMotion);
  return (
    <div className="absolute left-[7cqw] right-[12cqw]" style={{ top: `${top}cqw` }}>
      <motion.div
        className="flex items-center gap-[1.8cqw] text-[2.6cqw]"
        style={{ ...WIDE, color: kickerColor, opacity: k.opacity, y: k.y }}
      >
        <span
          className="inline-block h-[1.6cqw] w-[1.6cqw] rounded-full"
          style={{ background: kickerColor, boxShadow: `0 0 2.4cqw ${kickerColor}` }}
        />
        {kicker}
      </motion.div>
      <motion.h2 className="mt-[2.4cqw]" style={{ ...DISPLAY, fontSize: `${size}cqw`, opacity: a.opacity, y: a.y }}>
        {line1}
      </motion.h2>
      <motion.h2
        className="pb-[1cqw]"
        style={{ ...DISPLAY, ...GRADIENT_TEXT, fontSize: `${size}cqw`, opacity: b.opacity, y: b.y }}
      >
        {line2}
      </motion.h2>
    </div>
  );
}

/** A real app screenshot in a glass phone frame. */
function Phone({ src, width, style }: { src: string; width: number; style?: CSSProperties }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: `${width}cqw`,
        aspectRatio: "680 / 1336",
        borderRadius: `${width * 0.13}cqw`,
        padding: `${width * 0.022}cqw`,
        background: "linear-gradient(160deg, rgba(150,180,255,0.35), rgba(20,30,60,0.6) 40%, rgba(120,160,255,0.25))",
        boxShadow: `0 ${width * 0.06}cqw ${width * 0.18}cqw rgba(0,0,0,0.6), 0 0 ${width * 0.2}cqw rgba(47,123,255,0.18)`,
        ...style,
      }}
    >
      <div className="h-full w-full overflow-hidden bg-[#0B0F1A]" style={{ borderRadius: `${width * 0.115}cqw` }}>
        <img src={src} alt="" draggable={false} className="h-full w-full object-cover object-top" />
      </div>
    </div>
  );
}

function Chip({ children, style, glow = C.mint }: { children: ReactNode; style?: CSSProperties; glow?: string }) {
  return (
    <div
      className="flex items-center gap-[1.6cqw] rounded-full border px-[3cqw] py-[1.6cqw] text-[2.9cqw] font-semibold"
      style={{
        ...BODY,
        background: "rgba(10,17,36,0.82)",
        borderColor: "rgba(160,190,255,0.22)",
        boxShadow: `0 1.6cqw 5cqw rgba(0,0,0,0.5), 0 0 3cqw ${glow}22`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ───────────────────────────── backdrop ───────────────────────────── */

const SCENE_GLOW: Record<FilmScene["id"], [string, string]> = {
  hook: [C.blue, C.cyan],
  live: [C.mint, C.blue],
  movies: [C.blue, "#7C5CFF"],
  resume: [C.cyan, C.blue],
  playlist: [C.blue, C.mint],
  transfer: [C.mint, C.cyan],
  close: [C.blue, C.mint],
};

function Backdrop({ clock, activeScene, reducedMotion }: FilmLayerProps<FilmScene>) {
  const [g1, g2] = SCENE_GLOW[activeScene.id];
  const drift = useTransform(clock, (t) => (reducedMotion ? 0 : Math.sin(t * 0.35) * 6));
  const driftB = useTransform(clock, (t) => (reducedMotion ? 0 : Math.cos(t * 0.28) * 7));
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(120% 70% at 50% 0%, ${C.navy} 0%, ${C.ink} 70%)` }}
      />
      <motion.div
        className="absolute rounded-full transition-[background] duration-700"
        style={{
          left: "-10cqw",
          top: "8cqw",
          width: "100cqw",
          height: "100cqw",
          x: useTransform(drift, (v) => `${v}cqw`),
          background: `radial-gradient(circle, ${g1}55 0%, ${g1}00 62%)`,
        }}
      />
      <motion.div
        className="absolute rounded-full transition-[background] duration-700"
        style={{
          right: "-10cqw",
          top: "80cqw",
          width: "100cqw",
          height: "100cqw",
          y: useTransform(driftB, (v) => `${v}cqw`),
          background: `radial-gradient(circle, ${g2}40 0%, ${g2}00 60%)`,
        }}
      />
    </div>
  );
}

/* ───────────────────────────── scenes ───────────────────────────── */

function HookScene({ scene, clock, reducedMotion }: SceneProps<"hook">) {
  const shell = useSceneShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const iconScale = useTransform(local, (t) =>
    reducedMotion ? 1 : 0.55 + 0.45 * settle.next(Math.max(0, t - 0.05) * 1000).value,
  );
  const iconOpacity = useProgress(local, 0, 0.35);
  const ringRotate = useTransform(local, (t) => (reducedMotion ? -14 : -20 + Math.min(t, 3) * 2));
  const ringOpacity = useProgress(local, 0.2, 0.9);
  const sparkle = useTransform(local, (t) => 0.55 + 0.45 * Math.abs(Math.sin(t * 2.4)));
  const k = useRise(local, 0.35, reducedMotion, 3);
  const a = useRise(local, 0.5, reducedMotion, 10);
  const b = useRise(local, 1.45, reducedMotion, 10);
  const underline = useProgress(local, 1.7, 2.4, easeInOut);
  return (
    <Section {...shell}>
      <div className="absolute left-1/2 top-[33cqw] h-[60cqw] w-[60cqw] -translate-x-1/2">
        <motion.div
          className="absolute inset-[-14cqw] rounded-full"
          style={{
            opacity: ringOpacity,
            background: `radial-gradient(circle, ${C.blue}66 0%, ${C.blue}00 60%)`,
          }}
        />
        <motion.div
          className="absolute left-1/2 top-1/2 h-[30cqw] w-[96cqw] rounded-[50%]"
          style={{
            x: "-50%",
            y: "-50%",
            rotate: ringRotate,
            opacity: ringOpacity,
            // one solid colour all the way round: the icon tile hides the middle of the ring
            border: `1.6cqw solid ${C.mint}`,
          }}
        />
        <motion.img
          src="/media/ns-icon-v1.png"
          alt="NovaStream"
          draggable={false}
          className="absolute inset-0 h-full w-full rounded-[13cqw]"
          style={{
            scale: iconScale,
            opacity: iconOpacity,
            boxShadow: `0 4cqw 12cqw rgba(0,0,0,0.6), 0 0 10cqw ${C.blue}55`,
          }}
        />
        <motion.span
          className="absolute right-[-6cqw] top-[-4cqw] text-[7cqw]"
          style={{ opacity: useTransform([ringOpacity, sparkle], ([o, s]: number[]) => o * s), color: C.cyan }}
        >
          ✦
        </motion.span>
      </div>

      <div className="absolute left-0 right-0 top-[102cqw] text-center">
        <motion.div className="text-[2.8cqw]" style={{ ...WIDE, color: C.mint, opacity: k.opacity, y: k.y }}>
          {scene.kicker}
        </motion.div>
        <motion.h1 className="mt-[3cqw]" style={{ ...DISPLAY, fontSize: "15.5cqw", opacity: a.opacity, y: a.y }}>
          {scene.line1}
        </motion.h1>
        <motion.h1
          className="inline-block pb-[1.4cqw]"
          style={{ ...DISPLAY, ...GRADIENT_TEXT, fontSize: "15.5cqw", opacity: b.opacity, y: b.y }}
        >
          {scene.line2}
        </motion.h1>
        <motion.div
          className="mx-auto mt-[1cqw] h-[0.9cqw] w-[40cqw] origin-left rounded-full"
          style={{ scaleX: underline, background: `linear-gradient(90deg, ${C.blue}, ${C.mint})` }}
        />
      </div>
    </Section>
  );
}

function LiveScene({ scene, clock, reducedMotion }: SceneProps<"live">) {
  const shell = useSceneShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const phone = useRise(local, 0.3, reducedMotion, 30);
  const chipA = useRise(local, 0.9, reducedMotion, 4);
  const chipB = useRise(local, 1.25, reducedMotion, 4);
  const chipC = useRise(local, 1.6, reducedMotion, 4);
  const count = useTransform(local, (t) =>
    Math.round(1284 * easeOut(Math.min(1, Math.max(0, (t - 1.0) / 1.4)))).toLocaleString("en-US"),
  );
  const pulse = useTransform(local, (t) => 0.4 + 0.6 * Math.abs(Math.sin(t * 3.2)));
  return (
    <Section {...shell}>
      <Headline local={local} reducedMotion={reducedMotion} kicker={scene.kicker} line1={scene.line1} line2={scene.line2} />
      <motion.div className="absolute left-[5cqw] top-[64cqw]" style={{ opacity: phone.opacity, y: phone.y }}>
        <Phone src="/media/ns-phone-2-v1.jpg" width={44} />
      </motion.div>
      {/* callouts sit in the column beside the phone, never over it */}
      <motion.div className="absolute left-[53cqw] top-[74cqw]" style={{ opacity: chipA.opacity, y: chipA.y }}>
        <Chip glow={C.coral}>
          <motion.span
            className="h-[2cqw] w-[2cqw] rounded-full"
            style={{ background: C.coral, opacity: pulse, boxShadow: `0 0 2cqw ${C.coral}` }}
          />
          <span style={{ ...WIDE, letterSpacing: "0.18em", fontSize: "2.6cqw" }}>Live now</span>
        </Chip>
      </motion.div>
      <motion.div
        className="absolute left-[53cqw] top-[90cqw] w-[38cqw] rounded-[4cqw] border p-[3.6cqw]"
        style={{
          ...BODY,
          opacity: chipB.opacity,
          y: chipB.y,
          background: "rgba(10,17,36,0.86)",
          borderColor: "rgba(52,224,161,0.3)",
          boxShadow: `0 3cqw 8cqw rgba(0,0,0,0.55), 0 0 6cqw ${C.mint}22`,
        }}
      >
        <motion.div style={{ ...DISPLAY, fontSize: "9cqw", color: C.mint }}>{count}</motion.div>
        <div className="mt-[1cqw] text-[2.9cqw]" style={{ color: C.muted }}>
          channels, one list
        </div>
      </motion.div>
      <motion.div className="absolute left-[53cqw] top-[119cqw]" style={{ opacity: chipC.opacity, y: chipC.y }}>
        <Chip glow={C.cyan}>
          <span style={{ color: C.cyan }}>▦</span>
          <span>Now · Next · Tonight</span>
        </Chip>
      </motion.div>
    </Section>
  );
}

function MoviesScene({ scene, clock, reducedMotion }: SceneProps<"movies">) {
  const shell = useSceneShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const phone = useRise(local, 0.25, reducedMotion, 24);
  const search = useTransform(local, (t) => {
    const word = "Neon Run";
    const n = Math.max(0, Math.min(word.length, Math.floor((t - 1.3) / 0.09)));
    return word.slice(0, n);
  });
  const caret = useTransform(local, (t) => (Math.floor(t * 2.6) % 2 === 0 ? 1 : 0));
  const searchRise = useRise(local, 1.1, reducedMotion, 4);
  return (
    <Section {...shell}>
      <Headline local={local} reducedMotion={reducedMotion} kicker={scene.kicker} line1={scene.line1} line2={scene.line2} kickerColor={C.cyan} />
      <motion.div className="absolute left-[27cqw] top-[64cqw]" style={{ opacity: phone.opacity, y: phone.y, zIndex: 5 }}>
        <Phone src="/media/ns-phone-3-v1.jpg" width={42} />
      </motion.div>
      <motion.div
        className="absolute left-[21cqw] top-[152cqw] z-10"
        style={{ opacity: searchRise.opacity, y: searchRise.y }}
      >
        <Chip glow={C.blue} style={{ fontSize: "3.4cqw", paddingInline: "4cqw", paddingBlock: "2.2cqw", minWidth: "58cqw" }}>
          <span style={{ color: C.cyan }}>⌕</span>
          <motion.span>{search}</motion.span>
          <motion.span className="-ml-[1cqw] inline-block h-[4cqw] w-[0.4cqw]" style={{ background: C.cyan, opacity: caret }} />
        </Chip>
      </motion.div>
    </Section>
  );
}

function ResumeScene({ scene, clock, reducedMotion }: SceneProps<"resume">) {
  const shell = useSceneShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const tv = useRise(local, 0.3, reducedMotion, 10);
  const phone = useRise(local, 0.8, reducedMotion, 20);
  const bar = useTransform(local, (t) => 0.42 + 0.3 * easeInOut(Math.min(1, Math.max(0, (t - 1.4) / 2.2))));
  const sync = useProgress(local, 1.6, 2.2);
  const syncScale = useTransform(sync, (v) => (reducedMotion ? 1 : 0.85 + 0.15 * v));
  return (
    <Section {...shell}>
      <Headline local={local} reducedMotion={reducedMotion} kicker={scene.kicker} line1={scene.line1} line2={scene.line2} />
      {/* TV */}
      <motion.div className="absolute left-[12cqw] top-[62cqw] w-[76cqw]" style={{ opacity: tv.opacity, y: tv.y }}>
        <div
          className="overflow-hidden rounded-[2cqw] border-[0.8cqw] border-[#141B2E]"
          style={{ boxShadow: `0 4cqw 10cqw rgba(0,0,0,0.6), 0 0 8cqw ${C.cyan}22` }}
        >
          <img src="/media/ns-tv-1-v1.jpg" alt="" draggable={false} className="block w-full" />
        </div>
        <div className="mx-auto h-[2cqw] w-[18cqw] rounded-b-[1cqw] bg-[#141B2E]" />
        <div className="mx-auto h-[0.8cqw] w-[34cqw] rounded-full bg-[#1B2440]" />
      </motion.div>
      {/* phone with Resume */}
      <motion.div className="absolute left-[56cqw] top-[113cqw]" style={{ opacity: phone.opacity, y: phone.y }}>
        <Phone src="/media/ns-phone-4-v1.jpg" width={30} />
      </motion.div>
      {/* continue-watching card */}
      <motion.div
        className="absolute left-[8cqw] top-[124cqw] w-[42cqw] rounded-[3.4cqw] border p-[3.2cqw]"
        style={{
          ...BODY,
          opacity: sync,
          scale: syncScale,
          background: "rgba(10,17,36,0.9)",
          borderColor: "rgba(56,213,245,0.3)",
          boxShadow: "0 3cqw 8cqw rgba(0,0,0,0.55)",
        }}
      >
        <div className="text-[2.4cqw]" style={{ ...WIDE, letterSpacing: "0.2em", color: C.cyan }}>
          Continue
        </div>
        <div className="mt-[1.4cqw] text-[3.6cqw] font-bold">Northern Waves</div>
        <div className="text-[2.8cqw]" style={{ color: C.muted }}>
          S2E4 · Collision Course
        </div>
        <div className="mt-[2.2cqw] h-[1cqw] w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full origin-left rounded-full"
            style={{ scaleX: bar, background: `linear-gradient(90deg, ${C.blue}, ${C.cyan})` }}
          />
        </div>
      </motion.div>
    </Section>
  );
}

function PlaylistScene({ scene, clock, reducedMotion }: SceneProps<"playlist">) {
  const shell = useSceneShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const phone = useRise(local, 0.3, reducedMotion, 24);
  const card = useRise(local, 0.75, reducedMotion, 8);
  const key = useTransform(local, (t) => {
    const full = "K7M 4QX";
    const n = Math.max(0, Math.min(full.length, Math.floor((t - 1.3) / 0.11)));
    return full.slice(0, n);
  });
  const press = useTransform(local, [2.3, 2.42, 2.6], [1, 0.94, 1]);
  const added = useProgress(local, 2.55, 2.95);
  const addedScale = useTransform(added, (v) => (reducedMotion ? 1 : 0.8 + 0.2 * v));
  const highlight = useProgress(local, 1.1, 1.5);
  return (
    <Section {...shell}>
      <Headline local={local} reducedMotion={reducedMotion} kicker={scene.kicker} line1={scene.line1} line2={scene.line2} />
      <motion.div className="absolute left-[4cqw] top-[64cqw]" style={{ opacity: phone.opacity, y: phone.y }}>
        <Phone src="/media/ns-phone-7-v1.jpg" width={40} />
        {/* glow on the in-app website key */}
        <motion.div
          className="absolute left-[22.4cqw] top-[33.1cqw] h-[6.4cqw] w-[14cqw] rounded-[1.8cqw] border-[0.45cqw]"
          style={{ opacity: highlight, borderColor: C.cyan, boxShadow: `0 0 4cqw ${C.cyan}` }}
        />
      </motion.div>
      {/* browser card */}
      <motion.div
        className="absolute left-[47cqw] top-[90cqw] w-[48cqw] overflow-hidden rounded-[3.4cqw] border"
        style={{
          ...BODY,
          opacity: card.opacity,
          y: card.y,
          background: "rgba(12,19,38,0.95)",
          borderColor: "rgba(160,190,255,0.22)",
          boxShadow: `0 4cqw 10cqw rgba(0,0,0,0.6), 0 0 8cqw ${C.blue}26`,
        }}
      >
        <div className="flex items-center gap-[1.2cqw] border-b border-white/10 px-[2.6cqw] py-[2cqw]">
          <span className="h-[1.4cqw] w-[1.4cqw] rounded-full bg-[#FF5F57]" />
          <span className="h-[1.4cqw] w-[1.4cqw] rounded-full bg-[#FEBC2E]" />
          <span className="h-[1.4cqw] w-[1.4cqw] rounded-full bg-[#28C840]" />
          <span className="ml-[1.4cqw] truncate rounded-full bg-white/8 px-[2cqw] py-[0.6cqw] text-[2.3cqw]" style={{ color: C.muted }}>
            novastreamapp.com/playlist
          </span>
        </div>
        <div className="px-[3.2cqw] pb-[3.4cqw] pt-[2.6cqw]">
          <div className="text-[2.3cqw]" style={{ color: C.muted }}>
            Device
          </div>
          <div className="mt-[0.8cqw] rounded-[1.6cqw] bg-white/6 px-[2cqw] py-[1.4cqw] text-[3cqw] font-semibold tracking-wide">
            02:1A:7F:C4:9B:E3
          </div>
          <div className="mt-[2cqw] text-[2.3cqw]" style={{ color: C.muted }}>
            Website key
          </div>
          <div
            className="mt-[0.8cqw] h-[6.4cqw] rounded-[1.6cqw] border px-[2cqw] py-[1.2cqw] text-[3.6cqw] font-bold tracking-[0.3em]"
            style={{ borderColor: `${C.cyan}66`, color: C.cyan, background: "rgba(56,213,245,0.07)" }}
          >
            <motion.span>{key}</motion.span>
          </div>
          <motion.div
            className="mt-[2.6cqw] flex h-[7cqw] items-center justify-center rounded-[1.8cqw] text-[3cqw] font-bold"
            style={{ scale: press, background: `linear-gradient(90deg, ${C.blue}, ${C.cyan})`, color: "#03101F" }}
          >
            + Add playlist
          </motion.div>
        </div>
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center gap-[1.6cqw]"
          style={{ opacity: added, background: "#08181A" }}
        >
          <motion.div
            className="flex h-[12cqw] w-[12cqw] items-center justify-center rounded-full text-[6.4cqw] font-black"
            style={{ scale: addedScale, background: C.mint, color: "#04140E", boxShadow: `0 0 6cqw ${C.mint}88` }}
          >
            ✓
          </motion.div>
          <div className="text-[3.4cqw] font-bold">Playlist added</div>
          <div className="text-[2.5cqw]" style={{ color: C.muted }}>
            No typing on the TV
          </div>
        </motion.div>
      </motion.div>
    </Section>
  );
}

function TransferScene({ scene, clock, reducedMotion }: SceneProps<"transfer">) {
  const shell = useSceneShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const devices = useRise(local, 0.35, reducedMotion, 10);
  // the licence travels on an arc from the old TV to the new one
  const travel = useProgress(local, 1.05, 2.1, easeInOut);
  const cardX = useTransform(travel, (v) => `${v * 44}cqw`);
  const cardY = useTransform(travel, (v) => `${(reducedMotion ? 0 : -Math.sin(v * Math.PI) * 16) - v * 9}cqw`);
  const cardRotate = useTransform(travel, (v) => (reducedMotion ? 0 : Math.sin(v * Math.PI) * -8));
  const cardIn = useProgress(local, 0.7, 1.0);
  const oldDim = useProgress(local, 1.6, 2.1);
  const oldScreen = useTransform(oldDim, (v) => 1 - v * 0.75);
  const newOn = useProgress(local, 2.05, 2.4);
  const check = useProgress(local, 2.25, 2.55, backOut);
  const checkScale = useTransform(check, (v) => (reducedMotion ? 1 : v));
  const trail = useTransform(travel, (v) => Math.sin(v * Math.PI) * 0.9);
  const url = useRise(local, 2.6, reducedMotion, 4);
  const pathLen = useProgress(local, 1.0, 2.1, easeInOut);
  return (
    <Section {...shell}>
      <Headline
        local={local}
        reducedMotion={reducedMotion}
        kicker={scene.kicker}
        line1={scene.line1}
        line2={scene.line2}
        kickerColor={C.mint}
        size={13}
      />

      <motion.div className="absolute left-0 right-0 top-[80cqw] h-[44cqw]" style={{ opacity: devices.opacity, y: devices.y }}>
        {/* dashed arc */}
        <svg className="absolute left-[18cqw] top-[-14cqw] h-[30cqw] w-[56cqw] overflow-visible" viewBox="0 0 560 300" fill="none">
          <motion.path
            d="M 20 260 Q 280 -40 540 260"
            stroke={C.mint}
            strokeWidth="5"
            strokeDasharray="2 18"
            strokeLinecap="round"
            style={{ pathLength: pathLen, opacity: trail }}
          />
        </svg>

        <TvGlyph label="Old TV" left={6} screenOpacity={oldScreen} dim={oldDim} accent="#5B6B8F" />
        <TvGlyph label="New TV" left={50} screenOpacity={newOn} accent={C.mint} glow={newOn}>
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            style={{ opacity: check, scale: checkScale }}
          >
            <div
              className="flex h-[11cqw] w-[11cqw] items-center justify-center rounded-full text-[6cqw] font-black"
              style={{ background: C.mint, color: "#04140E", boxShadow: `0 0 6cqw ${C.mint}` }}
            >
              ✓
            </div>
          </motion.div>
        </TvGlyph>

        {/* licence card */}
        <motion.div
          className="absolute left-[11cqw] top-[2cqw] w-[28cqw] rounded-[2.6cqw] border p-[2.4cqw]"
          style={{
            ...BODY,
            x: cardX,
            y: cardY,
            rotate: cardRotate,
            opacity: cardIn,
            zIndex: 4,
            background: "linear-gradient(140deg, rgba(47,123,255,0.95), rgba(56,213,245,0.9))",
            borderColor: "rgba(255,255,255,0.35)",
            boxShadow: `0 3cqw 8cqw rgba(0,0,0,0.5), 0 0 7cqw ${C.cyan}66`,
            color: "#03101F",
          }}
        >
          <div className="flex items-center justify-between">
            <img src="/media/ns-icon-v1.png" alt="" draggable={false} className="h-[6cqw] w-[6cqw] rounded-[1.4cqw]" />
            <span className="text-[1.9cqw]" style={{ ...WIDE, letterSpacing: "0.16em" }}>
              Licence
            </span>
          </div>
          <div className="mt-[1.8cqw] text-[3.3cqw]" style={{ ...DISPLAY, fontStretch: "90%", lineHeight: 1 }}>
            NovaStream
          </div>
          <div className="mt-[0.6cqw] text-[2.2cqw] font-semibold opacity-75">Active · same plan</div>
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute left-[7cqw] right-[12cqw] top-[130cqw] flex flex-col items-start gap-[2.4cqw]"
        style={{ opacity: url.opacity, y: url.y }}
      >
        <Chip glow={C.mint} style={{ fontSize: "3.3cqw" }}>
          <span style={{ color: C.mint }}>⇄</span>
          <span>{scene.url}</span>
        </Chip>
        <div className="flex gap-[1.6cqw]">
          {scene.facts.map((fact) => (
            <span
              key={fact}
              className="rounded-full border px-[2.4cqw] py-[1cqw] text-[2.6cqw] font-semibold"
              style={{ ...BODY, borderColor: `${C.mint}55`, color: C.mint, background: "rgba(52,224,161,0.08)" }}
            >
              {fact}
            </span>
          ))}
        </div>
      </motion.div>
    </Section>
  );
}

function TvGlyph({
  label,
  left,
  screenOpacity,
  dim,
  glow,
  accent,
  children,
}: {
  label: string;
  left: number;
  screenOpacity: MotionValue<number>;
  dim?: MotionValue<number>;
  glow?: MotionValue<number>;
  accent: string;
  children?: ReactNode;
}) {
  const shadow = useTransform(glow ?? screenOpacity, (v) =>
    glow ? `0 0 ${8 * v}cqw ${C.mint}${Math.round(v * 120).toString(16).padStart(2, "0")}` : "none",
  );
  const labelOpacity = useTransform(dim ?? screenOpacity, (v) => (dim ? 1 - v * 0.5 : 1));
  return (
    <div className="absolute top-[14cqw]" style={{ left: `${left}cqw`, width: "34cqw" }}>
      <motion.div
        className="relative h-[21cqw] overflow-hidden rounded-[1.8cqw] border-[0.7cqw] border-[#1A2340] bg-[#070B16]"
        style={{ boxShadow: shadow }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            opacity: screenOpacity,
            background: `radial-gradient(120% 100% at 30% 20%, ${C.blue}AA, ${C.navy} 70%)`,
          }}
        />
        {children}
      </motion.div>
      <div className="mx-auto h-[1.6cqw] w-[8cqw] bg-[#1A2340]" />
      <div className="mx-auto h-[0.7cqw] w-[16cqw] rounded-full bg-[#1A2340]" />
      <motion.div
        className="mt-[2cqw] text-center text-[2.4cqw]"
        style={{ ...WIDE, letterSpacing: "0.22em", color: accent, opacity: labelOpacity }}
      >
        {label}
      </motion.div>
    </div>
  );
}

function CloseScene({ scene, clock, reducedMotion }: SceneProps<"close">) {
  const shell = useSceneShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const iconScale = useTransform(local, (t) =>
    reducedMotion ? 1 : 0.6 + 0.4 * settle.next(Math.max(0, t - 0.05) * 1000).value,
  );
  const iconOpacity = useProgress(local, 0, 0.3);
  const halo = useTransform(local, (t) => 0.55 + 0.25 * Math.sin(t * 2));
  const name = useRise(local, 0.35, reducedMotion, 6);
  const line = useRise(local, 0.6, reducedMotion, 4);
  const cta = useRise(local, 1.0, reducedMotion, 5);
  const fine = useRise(local, 1.4, reducedMotion, 2);
  return (
    <Section {...shell}>
      <div className="absolute left-1/2 top-[36cqw] h-[44cqw] w-[44cqw] -translate-x-1/2">
        <motion.div
          className="absolute inset-[-16cqw] rounded-full"
          style={{ opacity: halo, background: `radial-gradient(circle, ${C.blue}66 0%, ${C.blue}00 62%)` }}
        />
        <motion.img
          src="/media/ns-icon-v1.png"
          alt="NovaStream"
          draggable={false}
          className="absolute inset-0 h-full w-full rounded-[10cqw]"
          style={{ scale: iconScale, opacity: iconOpacity, boxShadow: "0 4cqw 12cqw rgba(0,0,0,0.6)" }}
        />
      </div>
      <div className="absolute left-0 right-0 top-[90cqw] flex flex-col items-center text-center">
        <motion.h1 style={{ ...DISPLAY, fontSize: "14cqw", opacity: name.opacity, y: name.y }}>{scene.name}</motion.h1>
        <motion.p
          className="mt-[2cqw] text-[4.2cqw] font-semibold"
          style={{ ...BODY, color: C.muted, opacity: line.opacity, y: line.y }}
        >
          {scene.line}
        </motion.p>
        <motion.div
          className="relative mt-[6cqw] rounded-full px-[7cqw] py-[3.4cqw] text-[4.4cqw] font-bold"
          style={{
            ...BODY,
            opacity: cta.opacity,
            y: cta.y,
            background: `linear-gradient(90deg, ${C.blue}, ${C.cyan} 60%, ${C.mint})`,
            color: "#03101F",
            boxShadow: `0 2cqw 8cqw ${C.blue}66`,
          }}
        >
          <span className="flex items-center gap-[2cqw]">
            <span className="text-[3.6cqw]">▶</span>
            {scene.cta}
          </span>
        </motion.div>
        <motion.p
          className="mt-[5cqw] max-w-[74cqw] text-[2.6cqw]"
          style={{ ...BODY, color: "rgba(214,226,255,0.45)", opacity: fine.opacity, y: fine.y }}
        >
          {scene.fine}
        </motion.p>
      </div>
    </Section>
  );
}
