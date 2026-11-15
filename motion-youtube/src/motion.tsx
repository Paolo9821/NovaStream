import "@fontsource-variable/archivo/wdth.css";

import type { CSSProperties, ComponentType, ReactNode } from "react";
import { MotionPlayer, type FilmLayerProps, type SceneContent, type SceneRenderProps } from "./motion-player";
import { easeInOut, easeOut, spring } from "motion";
import { motion, useTransform, type MotionValue } from "motion/react";
import {
  ArrowDownWideNarrow,
  ArrowRightLeft,
  BadgeCheck,
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  Clapperboard,
  Clock3,
  CopyX,
  Gift,
  Globe,
  Hash,
  Heart,
  KeyRound,
  Layers2,
  Link2,
  ListOrdered,
  Mail,
  MonitorPlay,
  PanelLeft,
  Play,
  RefreshCw,
  Search,
  Send,
  Server,
  ShieldCheck,
  Smartphone,
  TabletSmartphone,
  Tv,
  TvMinimalPlay,
} from "lucide-react";

/*
 * NovaStream 1.3.5 — horizontal YouTube walkthrough (1920 × 1080), English narration.
 * Visual system: the icon's night navy, electric blue → cyan → mint accents, condensed heavy headlines.
 * Real emulator screenshots sit in a clean landscape device frame; real website captures sit in a browser frame.
 * Rule of the film: callouts live beside or below the screenshots, never on top of them, and nothing decorative
 * touches the frame edges (no stripes, no edge lines, no fading orbits).
 */

type Icon = ComponentType<{ size?: number | string; strokeWidth?: number; color?: string; style?: CSSProperties }>;

/** One screenshot in a frame. `at` is scene-local; `ratio` is the image's own width/height. */
type Shot = {
  src: string;
  ratio: number;
  at: number;
  /** Frame aspect while this shot shows; defaults to the image ratio. A taller image pans from top to bottom. */
  frame?: number;
  pan?: [number, number];
  /** Crops into the horizontal middle of the image (website captures have wide empty margins). */
  zoom?: number;
};
type Point = { at: number; text: string; icon: Icon };
type Title = [string, string];

type FilmScene = SceneContent &
  (
    | { id: "intro"; layout: "intro"; kicker: string; name: string; tagline: string; pills: Point[]; agendaAt: number; agenda: string[] }
    | { id: string; layout: "app"; kicker: string; title: Title; accent: string; shots: Shot[]; points: Point[] }
    | { id: string; layout: "rotate"; kicker: string; title: Title; accent: string; src: string; ratio: number; points: Point[] }
    | { id: string; layout: "web"; kicker: string; title: Title; accent: string; url: string; shots: Shot[]; steps: Point[]; numbered: boolean }
    | { id: "outro"; layout: "outro"; name: string; line: string; cta: string; site: string; fine: string }
  );

const C = {
  ink: "#05080F",
  navy: "#0A1124",
  blue: "#2F7BFF",
  cyan: "#38D5F5",
  mint: "#34E0A1",
  amber: "#FFB547",
  text: "#EAF1FF",
  muted: "rgba(214,226,255,0.66)",
  faint: "rgba(214,226,255,0.42)",
  screen: "#0B0F1A",
};

const APP = 2.667;
const WEB = 1.6;
/** Website captures: crop into the centred page column. */
const Z = 1.4;
const M = "/media";

const content: FilmScene[] = [
  {
    id: "intro",
    layout: "intro",
    chapter: "Welcome",
    kicker: "Version 1.3.5 · Full walkthrough",
    name: "NovaStream",
    tagline: "Your own m3u and Xtream playlists, on every screen.",
    pills: [
      { at: 4.7, text: "Phones", icon: Smartphone },
      { at: 5.3, text: "Tablets", icon: TabletSmartphone },
      { at: 5.9, text: "Android TV", icon: Tv },
    ],
    agendaAt: 8.6,
    agenda: ["The app", "Your licence", "The website", "Licence transfer", "Help"],
    voiceover: "/rork-vo-intro-v1.mp3",
    effects: [{ src: "/rork-sfx-logo-v1.mp3", at: 0.05, volume: 0.32 }],
  },
  {
    id: "setup",
    layout: "app",
    chapter: "Getting started",
    kicker: "Getting started",
    title: ["Start free. ", "Add your playlist."],
    accent: C.mint,
    shots: [
      { src: `${M}/app-home-top-v1.jpg`, ratio: 3.395, at: 0 },
      { src: `${M}/app-m3uform-v1.jpg`, ratio: APP, at: 5.2 },
      { src: `${M}/app-privatehost-v1.jpg`, ratio: 2.906, at: 9.8 },
    ],
    points: [
      { at: 1.2, text: "7-day free trial, starts by itself", icon: Gift },
      { at: 5.6, text: "m3u link or Xtream login", icon: Link2 },
      { at: 10.2, text: "Private host: number, username, password", icon: Server },
    ],
    voiceover: "/rork-vo-setup-v1.mp3",
  },
  {
    id: "home",
    layout: "app",
    kicker: "Home",
    title: ["Everything, ", "one tap away."],
    accent: C.blue,
    shots: [{ src: `${M}/app-home-full-v1.jpg`, ratio: 1616 / 956, frame: APP, at: 0, pan: [2.2, 6.4] }],
    points: [
      { at: 0.9, text: "Your playlist at a glance", icon: ListOrdered },
      { at: 2.6, text: "Live TV, movies and series", icon: MonitorPlay },
      { at: 5.0, text: "Back to what you were watching", icon: Play },
    ],
    voiceover: "/rork-vo-home-v1.mp3",
  },
  {
    id: "live",
    layout: "app",
    chapter: "Live TV",
    kicker: "Live TV · New in 1.3.5",
    title: ["A brand-new ", "channel browser."],
    accent: C.mint,
    shots: [
      { src: `${M}/app-live-list-v1.jpg`, ratio: APP, at: 0 },
      { src: `${M}/app-live-sport-v1.jpg`, ratio: APP, at: 6.2 },
    ],
    points: [
      { at: 3.4, text: "Categories stay open on the left", icon: PanelLeft },
      { at: 5.6, text: "Search and channel counts", icon: Search },
      { at: 7.6, text: "Channels fill the right side", icon: TvMinimalPlay },
    ],
    voiceover: "/rork-vo-live-v1.mp3",
  },
  {
    id: "sort",
    layout: "app",
    kicker: "Live TV · Sort and filter",
    title: ["Sort it ", "your way."],
    accent: C.cyan,
    shots: [
      { src: `${M}/app-sort-movies-v1.jpg`, ratio: 2.711, at: 0 },
      { src: `${M}/app-sort-year-v1.jpg`, ratio: 2.711, at: 3.4 },
    ],
    points: [
      { at: 0.9, text: "By name or what's new", icon: ArrowDownWideNarrow },
      { at: 3.4, text: "Filter by year", icon: CalendarRange },
      { at: 4.6, text: "Favourites only", icon: Heart },
    ],
    voiceover: "/rork-vo-sort-v1.mp3",
  },
  {
    id: "guide",
    layout: "app",
    kicker: "Live TV · TV guide",
    title: ["The guide ", "finds itself."],
    accent: C.mint,
    shots: [{ src: `${M}/app-guide-v1.jpg`, ratio: 2.906, at: 0 }],
    points: [
      { at: 1.6, text: "From your link, panel or playlist", icon: Link2 },
      { at: 5.6, text: "What's on now", icon: Clock3 },
      { at: 7.0, text: "And what's next", icon: CalendarClock },
    ],
    voiceover: "/rork-vo-guide-v1.mp3",
  },
  {
    id: "movies",
    layout: "app",
    chapter: "Movies & series",
    kicker: "Movies & series",
    title: ["Movies and series, ", "sorted out."],
    accent: C.blue,
    shots: [
      { src: `${M}/app-movies-v1.jpg`, ratio: APP, at: 0 },
      { src: `${M}/app-series-v1.jpg`, ratio: APP, at: 3.0 },
    ],
    points: [
      { at: 3.0, text: "Episodes grouped into series", icon: Layers2 },
      { at: 5.4, text: "Duplicates gone", icon: CopyX },
      { at: 6.8, text: "Every count is right", icon: Hash },
    ],
    voiceover: "/rork-vo-movies-v1.mp3",
  },
  {
    id: "detail",
    layout: "app",
    kicker: "Movies & series · Series",
    title: ["Seasons and episodes, ", "in order."],
    accent: C.cyan,
    shots: [
      { src: `${M}/app-detail-hero-v1.jpg`, ratio: 2.855, at: 0 },
      { src: `${M}/app-detail-seasons-v1.jpg`, ratio: APP, at: 2.0 },
      { src: `${M}/app-episodes-v1.jpg`, ratio: APP, at: 4.0 },
    ],
    points: [
      { at: 1.2, text: "Every season", icon: Clapperboard },
      { at: 3.2, text: "Episodes in order", icon: ListOrdered },
      { at: 5.0, text: "Pick up where you stopped", icon: Play },
    ],
    voiceover: "/rork-vo-detail-v1.mp3",
  },
  {
    id: "landscape",
    layout: "rotate",
    kicker: "Phones and tablets · New in 1.3.5",
    title: ["Now in ", "landscape."],
    accent: C.mint,
    src: `${M}/app-live-sport-v1.jpg`,
    ratio: APP,
    points: [
      { at: 2.2, text: "Phones and tablets", icon: TabletSmartphone },
      { at: 4.0, text: "Just like the big screen", icon: Tv },
    ],
    voiceover: "/rork-vo-landscape-v1.mp3",
    effects: [{ src: "/rork-sfx-whoosh-v1.mp3", at: 0.55, volume: 0.22 }],
  },
  {
    id: "licence",
    layout: "app",
    chapter: "Your licence",
    kicker: "Your licence",
    title: ["Your licence, ", "on the device."],
    accent: C.amber,
    shots: [
      { src: `${M}/app-licence-v1.jpg`, ratio: 3.395, at: 0 },
      { src: `${M}/app-webkey-v1.jpg`, ratio: 2.693, at: 5.6 },
    ],
    points: [
      { at: 1.4, text: "Settings: status, plan and device ID", icon: BadgeCheck },
      { at: 6.0, text: "Accounts: a 6-character key", icon: KeyRound },
      { at: 10.2, text: "A new key every 5 minutes", icon: RefreshCw },
    ],
    voiceover: "/rork-vo-licence-v1.mp3",
  },
  {
    id: "webpl",
    layout: "web",
    chapter: "Website",
    kicker: "Website · Playlists",
    title: ["Playlists from ", "any browser."],
    accent: C.blue,
    url: "novastreamapp.com/playlist",
    shots: [
      { src: `${M}/site-pl-open-v1.jpg`, ratio: 1.6, frame: WEB, at: 0, zoom: Z, pan: [1.4, 4.2] },
      { src: `${M}/site-pl-list-v1.jpg`, ratio: 1920 / 2280, frame: WEB, at: 4.4, zoom: Z, pan: [5.4, 10.4] },
    ],
    steps: [
      { at: 1.0, text: "Enter the device ID and its key", icon: KeyRound },
      { at: 4.6, text: "Add, edit or remove playlists", icon: ListOrdered },
      { at: 8.6, text: "The app picks up the changes", icon: RefreshCw },
    ],
    numbered: true,
    voiceover: "/rork-vo-webpl-v1.mp3",
  },
  {
    id: "webdev",
    layout: "web",
    kicker: "Website · Your device",
    title: ["Check any ", "licence."],
    accent: C.mint,
    url: "novastreamapp.com/device",
    shots: [{ src: `${M}/site-device-v1.jpg`, ratio: 1.6, frame: WEB, at: 0, zoom: Z, pan: [2.2, 6.4] }],
    steps: [
      { at: 3.0, text: "Its plan", icon: BadgeCheck },
      { at: 3.8, text: "Its status", icon: ShieldCheck },
      { at: 4.8, text: "When it expires", icon: CalendarCheck },
    ],
    numbered: false,
    voiceover: "/rork-vo-webdev-v1.mp3",
  },
  {
    id: "transfer",
    layout: "web",
    chapter: "Licence transfer",
    kicker: "Licence transfer",
    title: ["New device? ", "Move your licence."],
    accent: C.mint,
    url: "novastreamapp.com/transfer",
    shots: [{ src: `${M}/site-tr-form-v1.jpg`, ratio: 1920 / 2280, frame: WEB, at: 0, zoom: Z, pan: [2.6, 10.6] }],
    steps: [
      { at: 2.4, text: "Old device: ID, then its key", icon: KeyRound },
      { at: 5.4, text: "Lost it? Use your purchase email", icon: Mail },
      { at: 7.6, text: "New device: the key on its screen", icon: Smartphone },
    ],
    numbered: true,
    voiceover: "/rork-vo-transfer-v1.mp3",
  },
  {
    id: "done",
    layout: "web",
    kicker: "Licence transfer",
    title: ["Moved ", "in seconds."],
    accent: C.mint,
    url: "novastreamapp.com/transfer",
    shots: [{ src: `${M}/site-tr-done-v1.jpg`, ratio: 1.6, frame: WEB, at: 0, zoom: Z, pan: [1.6, 4.8] }],
    steps: [
      { at: 1.8, text: "Same plan", icon: BadgeCheck },
      { at: 2.7, text: "Same expiry date", icon: CalendarCheck },
      { at: 4.6, text: "No extra cost", icon: Gift },
    ],
    numbered: false,
    voiceover: "/rork-vo-done-v1.mp3",
    effects: [{ src: "/rork-sfx-chime-v1.mp3", at: 0.55, volume: 0.26 }],
  },
  {
    id: "help",
    layout: "web",
    chapter: "Help",
    kicker: "Support",
    title: ["Need a ", "hand?"],
    accent: C.cyan,
    url: "novastreamapp.com/support",
    shots: [{ src: `${M}/site-support-v1.jpg`, ratio: 1920 / 1680, frame: WEB, at: 0, zoom: Z, pan: [1.8, 6.4] }],
    steps: [
      { at: 1.4, text: "Send a request from the support page", icon: Send },
      { at: 3.8, text: "support@novastreamapp.com", icon: Mail },
    ],
    numbered: false,
    voiceover: "/rork-vo-help-v1.mp3",
  },
  {
    id: "outro",
    layout: "outro",
    chapter: "Get the app",
    name: "NovaStream",
    line: "Bring your own playlist. Watch it everywhere.",
    cta: "Get it on Google Play",
    site: "novastreamapp.com",
    fine: "NovaStream is a player: no channels or content included.",
    voiceover: "/rork-vo-outro-v1.mp3",
    minSeconds: 8,
    effects: [{ src: "/rork-sfx-logo-v1.mp3", at: 0.05, volume: 0.26 }],
  },
];

const musicBed: string | null = "/rork-music-v2.mp3";

const TRANSITION_SECONDS = 0.5;
const SHOT_FADE = 0.55;

const DISPLAY: CSSProperties = {
  fontFamily: "'Archivo Variable', system-ui, sans-serif",
  fontStretch: "80%",
  fontWeight: 850,
  letterSpacing: "-0.02em",
  lineHeight: 0.98,
};
const WIDE: CSSProperties = {
  fontFamily: "'Archivo Variable', system-ui, sans-serif",
  fontStretch: "120%",
  fontWeight: 640,
  letterSpacing: "0.26em",
  textTransform: "uppercase",
};
const BODY: CSSProperties = {
  fontFamily: "'Archivo Variable', system-ui, sans-serif",
  fontStretch: "100%",
};
const gradientText = (accent: string): CSSProperties => ({
  backgroundImage: `linear-gradient(100deg, ${C.blue} 0%, ${accent === C.blue ? C.cyan : accent} 100%)`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
});

const settle = spring({ keyframes: [0, 1], visualDuration: 0.7, bounce: 0.26 });

export default function MotionPresentation() {
  return (
    <MotionPlayer
      content={content}
      musicBed={musicBed}
      musicVolume={0.55}
      width={1920}
      height={1080}
      surfaceClassName="bg-[#05080F]"
      Scene={FilmSceneView}
      Backdrop={Backdrop}
      Overlay={BrandMark}
      transitionSeconds={TRANSITION_SECONDS}
    />
  );
}

function FilmSceneView(props: SceneRenderProps<FilmScene>) {
  const { scene } = props;
  switch (scene.layout) {
    case "intro":
      return <IntroScene {...props} scene={scene} />;
    case "app":
      return <AppScene {...props} scene={scene} />;
    case "rotate":
      return <RotateScene {...props} scene={scene} />;
    case "web":
      return <WebScene {...props} scene={scene} />;
    case "outro":
      return <OutroScene {...props} scene={scene} />;
  }
}

type Props<L extends FilmScene["layout"]> = SceneRenderProps<Extract<FilmScene, { layout: L }>>;

/* ───────────────────────── shared motion helpers ───────────────────────── */

function useLocal(scene: { start: number }, clock: MotionValue<number>) {
  return useTransform(clock, (time) => time - scene.start);
}

function useSceneShell(scene: { start: number; end: number }, clock: MotionValue<number>, reducedMotion: boolean) {
  const opacity = useTransform(clock, (time) => {
    const fadeIn = scene.start === 0 ? 1 : (time - scene.start) / TRANSITION_SECONDS;
    const fadeOut = (scene.end + TRANSITION_SECONDS - time) / TRANSITION_SECONDS;
    return Math.max(0, Math.min(1, fadeIn, fadeOut));
  });
  const scale = useTransform(clock, (time) => {
    if (reducedMotion) return 1;
    if (time > scene.end) return 1 - 0.025 * Math.min(1, (time - scene.end) / TRANSITION_SECONDS);
    if (scene.start === 0) return 1;
    const p = Math.min(1, Math.max(0, (time - scene.start) / 0.8));
    return 1.025 - 0.025 * easeOut(p);
  });
  return { opacity, scale };
}

function useProgress(local: MotionValue<number>, from: number, to: number, ease = easeOut) {
  return useTransform(local, [from, to], [0, 1], { ease, clamp: true });
}

function useRise(local: MotionValue<number>, at: number, reducedMotion: boolean, distance = 2) {
  const p = useProgress(local, at, at + 0.6);
  const y = useTransform(p, (v) => (reducedMotion ? "0cqw" : `${(1 - v) * distance}cqw`));
  return { opacity: p, y };
}

function Section({ opacity, scale, children }: { opacity: MotionValue<number>; scale: MotionValue<number>; children: ReactNode }) {
  return (
    <motion.section className="absolute inset-0 overflow-hidden" style={{ opacity, scale, color: C.text }}>
      {children}
    </motion.section>
  );
}

function Kicker({ text, color, style }: { text: string; color: string; style?: CSSProperties }) {
  return (
    <div className="flex items-center gap-[0.8cqw] text-[0.95cqw]" style={{ ...WIDE, color, ...style }}>
      <span className="inline-block h-[0.7cqw] w-[0.7cqw] rounded-full" style={{ background: color }} />
      {text}
    </div>
  );
}

/** Kicker and one-line title, top left. */
function Header({
  local,
  reducedMotion,
  kicker,
  title,
  accent,
}: {
  local: MotionValue<number>;
  reducedMotion: boolean;
  kicker: string;
  title: Title;
  accent: string;
}) {
  const k = useRise(local, 0.1, reducedMotion, 1);
  const t = useRise(local, 0.22, reducedMotion, 1.6);
  return (
    <div className="absolute left-[6cqw] right-[24cqw] top-[3.9cqw]">
      <motion.div style={{ opacity: k.opacity, y: k.y }}>
        <Kicker text={kicker} color={accent} />
      </motion.div>
      <motion.h2 className="mt-[1cqw] whitespace-nowrap pb-[0.3cqw] text-[3.7cqw]" style={{ ...DISPLAY, opacity: t.opacity, y: t.y }}>
        {title[0]}
        <span style={gradientText(accent)}>{title[1]}</span>
      </motion.h2>
    </div>
  );
}

/* ───────────────────────────── frames ───────────────────────────── */

function shotIndex(shots: Shot[], t: number) {
  let i = 0;
  for (let j = 0; j < shots.length; j += 1) if (t >= shots[j].at) i = j;
  return i;
}

/** Frame height (cqw) for a given inner width, following the shots and easing between them. */
function useFrameHeight(local: MotionValue<number>, shots: Shot[], width: number) {
  return useTransform(local, (t) => {
    const i = shotIndex(shots, t);
    const h = (s: Shot) => width / (s.frame ?? s.ratio);
    if (i === 0) return `${h(shots[0])}cqw`;
    const p = easeInOut(Math.min(1, Math.max(0, (t - shots[i].at) / SHOT_FADE)));
    return `${h(shots[i - 1]) + (h(shots[i]) - h(shots[i - 1])) * p}cqw`;
  });
}

function ShotLayer({
  shot,
  index,
  shots,
  local,
  width,
  reducedMotion,
}: {
  shot: Shot;
  index: number;
  shots: Shot[];
  local: MotionValue<number>;
  width: number;
  reducedMotion: boolean;
}) {
  const next = shots[index + 1];
  const opacity = useTransform(local, (t) => {
    if (index > 0 && t < shot.at) return 0;
    const fadeIn = index === 0 ? 1 : Math.min(1, (t - shot.at) / SHOT_FADE);
    // The shot below stays fully shown until the one above has finished fading in.
    const gone = next !== undefined && t >= next.at + SHOT_FADE;
    return gone ? 0 : fadeIn;
  });
  const zoom = shot.zoom ?? 1;
  const imageHeight = (width * zoom) / shot.ratio;
  const frameHeight = width / (shot.frame ?? shot.ratio);
  const travel = Math.max(0, imageHeight - frameHeight);
  const y = useTransform(local, (t) => {
    if (!shot.pan || travel === 0) return "0cqw";
    const [a, b] = shot.pan;
    const p = easeInOut(Math.min(1, Math.max(0, (t - a) / (b - a))));
    return `${-travel * p}cqw`;
  });
  // A slow push-in on still shots; panned shots move enough already.
  const scale = useTransform(local, (t) => {
    if (reducedMotion || shot.pan) return 1;
    const end = next ? next.at + SHOT_FADE : shot.at + 12;
    const p = Math.min(1, Math.max(0, (t - shot.at) / Math.max(1, end - shot.at)));
    return 1 + 0.035 * p;
  });
  return (
    <motion.div className="absolute inset-0" style={{ opacity, zIndex: index }}>
      <motion.img
        src={shot.src}
        alt=""
        draggable={false}
        className="absolute top-0 block max-w-none"
        style={{
          y,
          scale,
          transformOrigin: "50% 0%",
          width: `${width * zoom}cqw`,
          left: `${(-(zoom - 1) * width) / 2}cqw`,
          height: `${imageHeight}cqw`,
        }}
      />
    </motion.div>
  );
}

function ShotStack({ shots, local, width, reducedMotion }: { shots: Shot[]; local: MotionValue<number>; width: number; reducedMotion: boolean }) {
  return (
    <>
      {shots.map((shot, i) => (
        <ShotLayer key={shot.src} shot={shot} index={i} shots={shots} local={local} width={width} reducedMotion={reducedMotion} />
      ))}
    </>
  );
}

/** Landscape device: a slim dark bezel around the real screenshots. */
function DeviceFrame({ width, height, accent, children }: { width: number; height: MotionValue<string> | string; accent: string; children: ReactNode }) {
  return (
    <div
      className="relative rounded-[2.2cqw] p-[0.75cqw]"
      style={{
        background: "linear-gradient(180deg, #1A2238 0%, #0E1424 100%)",
        boxShadow: `0 0 0 0.08cqw rgba(170,195,255,0.22), 0 2.4cqw 6cqw rgba(0,0,0,0.6), 0 0 8cqw ${accent}1F`,
      }}
    >
      <motion.div
        className="relative overflow-hidden rounded-[1.5cqw]"
        style={{ width: `${width}cqw`, height, background: C.screen }}
      >
        {children}
      </motion.div>
    </div>
  );
}

function BrowserFrame({ width, url, accent, children }: { width: number; url: string; accent: string; children: ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-[1.2cqw]"
      style={{
        width: `${width}cqw`,
        background: "#0D1322",
        boxShadow: `0 0 0 0.08cqw rgba(170,195,255,0.22), 0 2.4cqw 6cqw rgba(0,0,0,0.6), 0 0 8cqw ${accent}1A`,
      }}
    >
      <div className="flex h-[2.6cqw] items-center gap-[0.55cqw] px-[1.1cqw]" style={{ background: "#121A2D" }}>
        <span className="h-[0.7cqw] w-[0.7cqw] rounded-full bg-[#FF5F57]" />
        <span className="h-[0.7cqw] w-[0.7cqw] rounded-full bg-[#FEBC2E]" />
        <span className="h-[0.7cqw] w-[0.7cqw] rounded-full bg-[#28C840]" />
        <div
          className="mx-auto flex h-[1.6cqw] w-[56%] items-center justify-center gap-[0.5cqw] rounded-full text-[0.85cqw]"
          style={{ ...BODY, background: "rgba(255,255,255,0.06)", color: C.muted }}
        >
          <ShieldCheck size="0.9cqw" color={C.mint} />
          {url}
        </div>
        <span className="w-[2.6cqw]" />
      </div>
      <div className="relative overflow-hidden" style={{ height: `${width / WEB}cqw`, background: "#05080F" }}>
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────────── callouts ───────────────────────────── */

function PointChip({ point, local, accent, reducedMotion }: { point: Point; local: MotionValue<number>; accent: string; reducedMotion: boolean }) {
  const r = useRise(local, point.at, reducedMotion, 1);
  const Glyph = point.icon;
  return (
    <motion.div className="flex items-center gap-[0.8cqw]" style={{ opacity: r.opacity, y: r.y }}>
      <span
        className="flex h-[2.5cqw] w-[2.5cqw] shrink-0 items-center justify-center rounded-full"
        style={{ background: `${accent}1F`, boxShadow: `inset 0 0 0 0.08cqw ${accent}66` }}
      >
        <Glyph size="1.25cqw" strokeWidth={2.2} color={accent} />
      </span>
      <span className="whitespace-nowrap text-[1.3cqw] font-semibold" style={{ ...BODY, color: C.text }}>
        {point.text}
      </span>
    </motion.div>
  );
}

/** Callouts in a row under the device, never over it. */
function PointsRow({ points, local, accent, reducedMotion }: { points: Point[]; local: MotionValue<number>; accent: string; reducedMotion: boolean }) {
  return (
    <div className="absolute inset-x-[6cqw] top-[49.4cqw] flex items-center justify-center gap-[3.2cqw]">
      {points.map((p) => (
        <PointChip key={p.text} point={p} local={local} accent={accent} reducedMotion={reducedMotion} />
      ))}
    </div>
  );
}

function StepItem({
  step,
  index,
  numbered,
  local,
  accent,
  reducedMotion,
}: {
  step: Point;
  index: number;
  numbered: boolean;
  local: MotionValue<number>;
  accent: string;
  reducedMotion: boolean;
}) {
  const r = useRise(local, step.at, reducedMotion, 1.2);
  const Glyph = step.icon;
  return (
    <motion.div className="flex items-center gap-[1.1cqw]" style={{ opacity: r.opacity, y: r.y }}>
      <span
        className="flex h-[3.2cqw] w-[3.2cqw] shrink-0 items-center justify-center rounded-[0.9cqw] text-[1.4cqw]"
        style={{ ...DISPLAY, background: `${accent}1F`, boxShadow: `inset 0 0 0 0.08cqw ${accent}66`, color: accent }}
      >
        {numbered ? index + 1 : <Glyph size="1.5cqw" strokeWidth={2.2} color={accent} />}
      </span>
      <span className="text-[1.45cqw] font-semibold leading-[1.25]" style={{ ...BODY, color: C.text }}>
        {step.text}
      </span>
    </motion.div>
  );
}

/* ───────────────────────────── backdrop & overlay ───────────────────────────── */

function accentOf(scene: FilmScene) {
  return "accent" in scene ? scene.accent : C.blue;
}

function Backdrop({ clock, activeScene, reducedMotion }: FilmLayerProps<FilmScene>) {
  const accent = accentOf(activeScene);
  const driftA = useTransform(clock, (t) => (reducedMotion ? "0cqw" : `${Math.sin(t * 0.22) * 3}cqw`));
  const driftB = useTransform(clock, (t) => (reducedMotion ? "0cqw" : `${Math.cos(t * 0.18) * 3}cqw`));
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{ background: `radial-gradient(90% 80% at 50% 30%, ${C.navy} 0%, ${C.ink} 75%)` }} />
      <motion.div
        className="absolute rounded-full transition-[background] duration-700"
        style={{
          left: "8cqw",
          top: "-14cqw",
          width: "60cqw",
          height: "60cqw",
          x: driftA,
          background: `radial-gradient(circle, ${C.blue}33 0%, ${C.blue}00 65%)`,
        }}
      />
      <motion.div
        className="absolute rounded-full transition-[background] duration-700"
        style={{
          right: "4cqw",
          top: "12cqw",
          width: "56cqw",
          height: "56cqw",
          y: driftB,
          background: `radial-gradient(circle, ${accent}26 0%, ${accent}00 65%)`,
        }}
      />
    </div>
  );
}

/** Small brand mark top right, on every scene between the intro and the outro. */
function BrandMark({ clock, scenes }: FilmLayerProps<FilmScene>) {
  const first = scenes[0];
  const last = scenes[scenes.length - 1];
  const opacity = useTransform(clock, (t) => {
    const fadeIn = (t - first.end) / TRANSITION_SECONDS;
    const fadeOut = (last.start - t) / TRANSITION_SECONDS;
    return Math.max(0, Math.min(1, fadeIn, fadeOut));
  });
  return (
    <motion.div className="absolute right-[6cqw] top-[4.1cqw] flex items-center gap-[0.8cqw]" style={{ opacity }}>
      <img src={`${M}/ns-icon-v1.png`} alt="" draggable={false} className="h-[2.6cqw] w-[2.6cqw] rounded-[0.6cqw]" />
      <div style={BODY}>
        <div className="text-[1.15cqw] font-bold leading-none" style={{ color: C.text }}>
          NovaStream
        </div>
        <div className="mt-[0.3cqw] text-[0.8cqw] leading-none" style={{ ...WIDE, letterSpacing: "0.18em", color: C.faint }}>
          Version 1.3.5
        </div>
      </div>
    </motion.div>
  );
}

/* ───────────────────────────── logo ───────────────────────────── */

/**
 * The app icon with one solid orbit behind it: a single colour at full strength along its whole length,
 * so it never fades to black. The tile hides the middle of the ring, as a planet hides its rings.
 */
function LogoMark({ size, local, reducedMotion }: { size: number; local: MotionValue<number>; reducedMotion: boolean }) {
  const iconScale = useTransform(local, (t) => (reducedMotion ? 1 : 0.6 + 0.4 * settle.next(Math.max(0, t - 0.05) * 1000).value));
  const iconOpacity = useProgress(local, 0, 0.35);
  const ring = useProgress(local, 0.25, 1.1);
  const ringScale = useTransform(ring, (v) => (reducedMotion ? 1 : 0.8 + 0.2 * v));
  const tilt = useTransform(local, (t) => (reducedMotion ? -14 : -14 + Math.sin(t * 0.6) * 2));
  return (
    <div className="relative" style={{ width: `${size}cqw`, height: `${size}cqw` }}>
      <motion.div
        className="absolute left-1/2 top-1/2 rounded-[50%]"
        style={{
          width: `${size * 1.75}cqw`,
          height: `${size * 0.5}cqw`,
          x: "-50%",
          y: "-50%",
          rotate: tilt,
          scale: ringScale,
          opacity: ring,
          border: `${size * 0.035}cqw solid ${C.mint}`,
        }}
      />
      <motion.img
        src={`${M}/ns-icon-v1.png`}
        alt="NovaStream"
        draggable={false}
        className="absolute inset-0 h-full w-full"
        style={{
          borderRadius: `${size * 0.22}cqw`,
          scale: iconScale,
          opacity: iconOpacity,
          boxShadow: `0 ${size * 0.08}cqw ${size * 0.25}cqw rgba(0,0,0,0.55), 0 0 ${size * 0.5}cqw ${C.blue}40`,
        }}
      />
    </div>
  );
}

/* ───────────────────────────── scenes ───────────────────────────── */

function IntroScene({ scene, clock, reducedMotion }: Props<"intro">) {
  const shell = useSceneShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const k = useRise(local, 0.5, reducedMotion, 1);
  const name = useRise(local, 0.65, reducedMotion, 2.4);
  const tag = useRise(local, 1.5, reducedMotion, 1.4);
  const agenda = useRise(local, scene.agendaAt, reducedMotion, 1.2);
  return (
    <Section {...shell}>
      <div className="absolute left-1/2 top-[6.5cqw] -translate-x-1/2">
        <LogoMark size={14} local={local} reducedMotion={reducedMotion} />
      </div>
      <div className="absolute inset-x-0 top-[24.5cqw] flex flex-col items-center text-center">
        <motion.div style={{ opacity: k.opacity, y: k.y }}>
          <Kicker text={scene.kicker} color={C.mint} />
        </motion.div>
        <motion.h1 className="mt-[1cqw] text-[7.4cqw]" style={{ ...DISPLAY, opacity: name.opacity, y: name.y }}>
          {scene.name}
        </motion.h1>
        <motion.p className="mt-[1cqw] text-[1.8cqw]" style={{ ...BODY, color: C.muted, opacity: tag.opacity, y: tag.y }}>
          {scene.tagline}
        </motion.p>
        <div className="mt-[2cqw] flex gap-[1cqw]">
          {scene.pills.map((p) => (
            <Pill key={p.text} point={p} local={local} reducedMotion={reducedMotion} />
          ))}
        </div>
      </div>
      <motion.div
        className="absolute inset-x-0 top-[48.6cqw] flex items-center justify-center gap-[1.4cqw]"
        style={{ opacity: agenda.opacity, y: agenda.y }}
      >
        <span className="text-[0.95cqw]" style={{ ...WIDE, color: C.faint }}>
          In this video
        </span>
        {scene.agenda.map((item) => (
          <span key={item} className="flex items-center gap-[1.4cqw] text-[1.25cqw] font-semibold" style={{ ...BODY, color: C.text }}>
            <span style={{ color: C.faint }}>·</span>
            {item}
          </span>
        ))}
      </motion.div>
    </Section>
  );
}

function Pill({ point, local, reducedMotion }: { point: Point; local: MotionValue<number>; reducedMotion: boolean }) {
  const r = useRise(local, point.at, reducedMotion, 1);
  const Glyph = point.icon;
  return (
    <motion.div
      className="flex items-center gap-[0.6cqw] rounded-full px-[1.3cqw] py-[0.65cqw] text-[1.25cqw] font-semibold"
      style={{ ...BODY, opacity: r.opacity, y: r.y, background: "rgba(52,224,161,0.10)", boxShadow: `inset 0 0 0 0.08cqw ${C.mint}55` }}
    >
      <Glyph size="1.2cqw" strokeWidth={2.2} color={C.mint} />
      {point.text}
    </motion.div>
  );
}

const APP_WIDTH = 74;

function AppScene({ scene, clock, reducedMotion }: Props<"app">) {
  const shell = useSceneShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const device = useRise(local, 0.3, reducedMotion, 3);
  const height = useFrameHeight(local, scene.shots, APP_WIDTH);
  return (
    <Section {...shell}>
      <Header local={local} reducedMotion={reducedMotion} kicker={scene.kicker} title={scene.title} accent={scene.accent} />
      <motion.div
        className="absolute inset-x-0 top-[13.6cqw] flex h-[34.4cqw] items-center justify-center"
        style={{ opacity: device.opacity, y: device.y }}
      >
        <DeviceFrame width={APP_WIDTH} height={height} accent={scene.accent}>
          <ShotStack shots={scene.shots} local={local} width={APP_WIDTH} reducedMotion={reducedMotion} />
        </DeviceFrame>
      </motion.div>
      <PointsRow points={scene.points} local={local} accent={scene.accent} reducedMotion={reducedMotion} />
    </Section>
  );
}

function RotateScene({ scene, clock, reducedMotion }: Props<"rotate">) {
  const shell = useSceneShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const width = 66;
  const appear = useProgress(local, 0.1, 0.5);
  const turn = useProgress(local, 0.55, 1.5, easeInOut);
  const rotate = useTransform(turn, (v) => (reducedMotion ? 0 : -90 * (1 - v)));
  const scale = useTransform(turn, (v) => (reducedMotion ? 1 : 0.5 + 0.5 * v));
  const screenOn = useProgress(local, 1.35, 1.9);
  const idle = useTransform(screenOn, (v) => 1 - v);
  return (
    <Section {...shell}>
      <Header local={local} reducedMotion={reducedMotion} kicker={scene.kicker} title={scene.title} accent={scene.accent} />
      <div className="absolute inset-x-0 top-[13.6cqw] flex h-[34.4cqw] items-center justify-center">
        <motion.div style={{ rotate, scale, opacity: appear }}>
          <DeviceFrame width={width} height={`${width / scene.ratio}cqw`} accent={scene.accent}>
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              style={{ opacity: idle, background: `radial-gradient(80% 120% at 50% 50%, #142046 0%, ${C.screen} 70%)` }}
            >
              <img src={`${M}/ns-icon-v1.png`} alt="" draggable={false} className="h-[9cqw] w-[9cqw] rounded-[2cqw]" style={{ rotate: "90deg" }} />
            </motion.div>
            <motion.img src={scene.src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover object-top" style={{ opacity: screenOn }} />
          </DeviceFrame>
        </motion.div>
      </div>
      <PointsRow points={scene.points} local={local} accent={scene.accent} reducedMotion={reducedMotion} />
    </Section>
  );
}

const WEB_WIDTH = 55;

function WebScene({ scene, clock, reducedMotion }: Props<"web">) {
  const shell = useSceneShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const k = useRise(local, 0.1, reducedMotion, 1);
  const t = useRise(local, 0.22, reducedMotion, 1.6);
  const browser = useRise(local, 0.3, reducedMotion, 3);
  return (
    <Section {...shell}>
      <div className="absolute left-[6cqw] top-[12.2cqw] w-[30cqw]">
        <motion.div style={{ opacity: k.opacity, y: k.y }}>
          <Kicker text={scene.kicker} color={scene.accent} />
        </motion.div>
        <motion.h2 className="mt-[1.2cqw] pb-[0.3cqw] text-[3.9cqw]" style={{ ...DISPLAY, opacity: t.opacity, y: t.y }}>
          {scene.title[0]}
          <br />
          <span style={gradientText(scene.accent)}>{scene.title[1]}</span>
        </motion.h2>
        <div className="mt-[3.2cqw] flex flex-col gap-[1.6cqw]">
          {scene.steps.map((step, i) => (
            <StepItem
              key={step.text}
              step={step}
              index={i}
              numbered={scene.numbered}
              local={local}
              accent={scene.accent}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>
      </div>
      <motion.div className="absolute left-[39cqw] top-[10.4cqw]" style={{ opacity: browser.opacity, y: browser.y }}>
        <BrowserFrame width={WEB_WIDTH} url={scene.url} accent={scene.accent}>
          <ShotStack shots={scene.shots} local={local} width={WEB_WIDTH} reducedMotion={reducedMotion} />
        </BrowserFrame>
      </motion.div>
    </Section>
  );
}

function OutroScene({ scene, clock, reducedMotion }: Props<"outro">) {
  const shell = useSceneShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const name = useRise(local, 0.4, reducedMotion, 2);
  const line = useRise(local, 0.7, reducedMotion, 1.4);
  const cta = useRise(local, 2.4, reducedMotion, 1.4);
  const site = useRise(local, 3.0, reducedMotion, 1);
  const fine = useRise(local, 3.4, reducedMotion, 1);
  return (
    <Section {...shell}>
      <div className="absolute left-1/2 top-[7cqw] -translate-x-1/2">
        <LogoMark size={12.5} local={local} reducedMotion={reducedMotion} />
      </div>
      <div className="absolute inset-x-0 top-[23.5cqw] flex flex-col items-center text-center">
        <motion.h1 className="text-[6.6cqw]" style={{ ...DISPLAY, opacity: name.opacity, y: name.y }}>
          {scene.name}
        </motion.h1>
        <motion.p className="mt-[1cqw] text-[1.9cqw] font-semibold" style={{ ...BODY, color: C.muted, opacity: line.opacity, y: line.y }}>
          {scene.line}
        </motion.p>
        <motion.div
          className="mt-[2.6cqw] flex items-center gap-[0.9cqw] rounded-full px-[2.6cqw] py-[1.2cqw] text-[1.7cqw] font-bold"
          style={{
            ...BODY,
            opacity: cta.opacity,
            y: cta.y,
            background: `linear-gradient(90deg, ${C.blue}, ${C.cyan})`,
            color: "#03101F",
            boxShadow: `0 1cqw 4cqw ${C.blue}55`,
          }}
        >
          <Play size="1.5cqw" strokeWidth={2.6} color="#03101F" style={{ fill: "#03101F" }} />
          {scene.cta}
        </motion.div>
        <motion.div
          className="mt-[1.8cqw] flex items-center gap-[0.6cqw] text-[1.35cqw] font-semibold"
          style={{ ...BODY, color: C.text, opacity: site.opacity, y: site.y }}
        >
          <Globe size="1.3cqw" color={C.mint} />
          {scene.site}
        </motion.div>
        <motion.p className="mt-[2.4cqw] text-[1.05cqw]" style={{ ...BODY, color: C.faint, opacity: fine.opacity, y: fine.y }}>
          {scene.fine}
        </motion.p>
      </div>
    </Section>
  );
}

