import type { CSSProperties } from "react";
import { MotionPlayer, type FilmLayerProps, type SceneContent, type SceneRenderProps } from "./motion-player";
import { motion, useTransform, type MotionValue } from "motion/react";
import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clapperboard,
  Film,
  Gift,
  ListVideo,
  MonitorPlay,
  Play,
  RotateCcw,
  Smartphone,
  Tablet,
  Tv,
} from "lucide-react";
import {
  BODY,
  BrowserFrame,
  C,
  DISPLAY,
  DeviceFrame,
  Kicker,
  LogoMark,
  M,
  Pools,
  Rise,
  Section,
  ShotStack,
  WIDE,
  clamp01,
  gradientText,
  useFrameHeight,
  useLocal,
  usePop,
  useProgress,
  useRise,
  useSceneShell,
  type Icon,
  type Shot,
} from "./kit";

/*
 * "NovaStream is on the App Store" — 16:9 YouTube film (1920 × 1080), English narration.
 * Part one launches the iOS app (iPhone, iPad, free trial + yearly subscription in the app).
 * Part two lists what is new in Android 1.3.6. No prices anywhere.
 */

type SceneId = "intro" | "iphone" | "ipad" | "trial" | "android" | "zap" | "list" | "remote" | "transfer" | "outro";
type FilmScene = SceneContent & { id: SceneId };

const content: FilmScene[] = [
  {
    id: "intro",
    chapter: "On the App Store",
    voiceover: "/rork-vo-intro-v1.mp3",
    minSeconds: 7,
    effects: [{ src: "/rork-sfx-logo-v1.mp3", at: 0.15, volume: 0.4 }],
  },
  { id: "iphone", chapter: "iPhone", voiceover: "/rork-vo-iphone-v1.mp3", effects: [{ src: "/rork-sfx-whoosh-v1.mp3", at: 0.2, volume: 0.25 }] },
  { id: "ipad", chapter: "iPad", voiceover: "/rork-vo-ipad-v1.mp3", effects: [{ src: "/rork-sfx-whoosh-v1.mp3", at: 0.2, volume: 0.25 }] },
  { id: "trial", chapter: "Free trial", voiceover: "/rork-vo-trial-v1.mp3", effects: [{ src: "/rork-sfx-chime-v1.mp3", at: 0.9, volume: 0.3 }] },
  {
    id: "android",
    chapter: "Android 1.3.6",
    voiceover: "/rork-vo-android-v1.mp3",
    minSeconds: 7.6,
    effects: [{ src: "/rork-sfx-whoosh-v1.mp3", at: 0.2, volume: 0.3 }],
  },
  { id: "zap", voiceover: "/rork-vo-zap-v1.mp3" },
  { id: "list", voiceover: "/rork-vo-list-v1.mp3" },
  { id: "remote", voiceover: "/rork-vo-remote-v1.mp3" },
  { id: "transfer", chapter: "Licence transfer", voiceover: "/rork-vo-transfer-v1.mp3", minSeconds: 6.4 },
  {
    id: "outro",
    chapter: "Get it",
    voiceover: "/rork-vo-outro-v1.mp3",
    minSeconds: 8,
    effects: [{ src: "/rork-sfx-logo-v1.mp3", at: 0.1, volume: 0.4 }],
  },
];

const musicBed: string | null = "/rork-music-v1.mp3";
const TRANSITION_SECONDS = 0.5;
const ACCENT: Record<SceneId, string> = {
  intro: C.blue,
  iphone: C.cyan,
  ipad: C.mint,
  trial: C.amber,
  android: C.mint,
  zap: C.cyan,
  list: C.blue,
  remote: C.mint,
  transfer: C.cyan,
  outro: C.blue,
};

export default function MotionPresentation() {
  return (
    <MotionPlayer
      content={content}
      musicBed={musicBed}
      musicVolume={0.45}
      width={1920}
      height={1080}
      surfaceClassName="bg-[#05080F]"
      Scene={FilmSceneView}
      Backdrop={Backdrop}
      transitionSeconds={TRANSITION_SECONDS}
    />
  );
}

function FilmSceneView(props: SceneRenderProps<FilmScene>) {
  switch (props.scene.id) {
    case "intro":
      return <IntroScene {...props} />;
    case "iphone":
      return <IphoneScene {...props} />;
    case "ipad":
      return <IpadScene {...props} />;
    case "trial":
      return <TrialScene {...props} />;
    case "android":
      return <AndroidScene {...props} />;
    case "zap":
      return <ZapScene {...props} />;
    case "list":
      return <ListScene {...props} />;
    case "remote":
      return <RemoteScene {...props} />;
    case "transfer":
      return <TransferScene {...props} />;
    case "outro":
      return <OutroScene {...props} />;
  }
}

type Props = SceneRenderProps<FilmScene>;
type L = MotionValue<number>;

function useShell(scene: { start: number; end: number }, clock: L, reducedMotion: boolean) {
  return useSceneShell(scene, clock, reducedMotion, TRANSITION_SECONDS);
}

function Backdrop({ clock, activeScene, reducedMotion }: FilmLayerProps<FilmScene>) {
  return <Pools clock={clock} accent={ACCENT[activeScene.id]} reducedMotion={reducedMotion} />;
}

/* ───────────────────────────── shared pieces ───────────────────────────── */

function Headline({ a, b, accent, local, at, reducedMotion, size = 6.2 }: { a: string; b: string; accent: string; local: L; at: number; reducedMotion: boolean; size?: number }) {
  return (
    <Rise local={local} at={at} reducedMotion={reducedMotion} distance={2}>
      <h1 className="whitespace-nowrap pb-[0.6cqw]" style={{ ...DISPLAY, fontSize: `${size}cqw`, lineHeight: 0.95 }}>
        {a}
        <br />
        <span style={gradientText(accent)}>{b}</span>
      </h1>
    </Rise>
  );
}

function Point({ icon: Glyph, text, local, at, accent, reducedMotion }: { icon: Icon; text: string; local: L; at: number; accent: string; reducedMotion: boolean }) {
  const r = useRise(local, at, reducedMotion, 1.2);
  return (
    <motion.div className="flex items-center gap-[1.1cqw] whitespace-nowrap text-[1.7cqw] font-semibold" style={{ ...BODY, opacity: r.opacity, y: r.y }}>
      <span
        className="flex h-[3cqw] w-[3cqw] shrink-0 items-center justify-center rounded-[0.8cqw]"
        style={{ background: `${accent}1F`, boxShadow: `inset 0 0 0 0.1cqw ${accent}66` }}
      >
        <Glyph size="1.6cqw" color={accent} strokeWidth={2.2} />
      </span>
      {text}
    </motion.div>
  );
}

function Chip({ icon: Glyph, text, local, at, accent, reducedMotion }: { icon: Icon; text: string; local: L; at: number; accent: string; reducedMotion: boolean }) {
  const scale = usePop(local, at, reducedMotion, 0.7);
  const opacity = useProgress(local, at, at + 0.25);
  return (
    <motion.div
      className="flex items-center gap-[0.7cqw] whitespace-nowrap rounded-full px-[1.4cqw] py-[0.7cqw] text-[1.45cqw] font-bold"
      style={{ ...BODY, scale, opacity, background: `${accent}1A`, boxShadow: `inset 0 0 0 0.1cqw ${accent}70` }}
    >
      <Glyph size="1.5cqw" color={accent} strokeWidth={2.2} />
      {text}
    </motion.div>
  );
}

function AppStoreBadge({ height }: { height: number }) {
  return <img src={`${M}/badge-appstore-v1.svg`} alt="Download on the App Store" draggable={false} style={{ height: `${height}cqw` }} />;
}

/** The Google Play PNG carries its own transparent margin, so it is drawn a little taller to match. */
function PlayBadge({ height }: { height: number }) {
  return <img src={`${M}/badge-gplay-v1.png`} alt="Get it on Google Play" draggable={false} style={{ height: `${height * 1.5}cqw`, margin: `-${height * 0.25}cqw 0` }} />;
}

const IPHONE_RATIO = 1206 / 2622;
const IPAD_RATIO = 1668 / 2420;
const WIDE_RATIO = 1616 / 606;

function Phone({ src, width, accent }: { src: string; width: number; accent: string }) {
  return (
    <DeviceFrame width={width} height={`${width / IPHONE_RATIO}cqw`} accent={accent} bezel={width * 0.035} radius={width * 0.14}>
      <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
    </DeviceFrame>
  );
}

/* ───────────────────────────── intro ───────────────────────────── */

function IntroScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const phone = useProgress(local, 1.1, 2.0);
  const phoneY = useTransform(phone, (v) => (reducedMotion ? "0cqw" : `${(1 - v) * 18}cqw`));
  const pad = useProgress(local, 1.6, 2.6);
  const padX = useTransform(pad, (v) => (reducedMotion ? "0cqw" : `${(1 - v) * 14}cqw`));
  const float = useTransform(local, (t) => (reducedMotion ? "0cqw" : `${Math.sin(t * 0.9) * 0.5}cqw`));
  return (
    <Section {...shell}>
      <div className="absolute left-[7cqw] top-[9cqw]">
        <LogoMark size={8.5} local={local} reducedMotion={reducedMotion} at={0.1} />
      </div>
      <div className="absolute left-[7cqw] top-[21cqw] flex flex-col gap-[1.6cqw]">
        <Rise local={local} at={0.45} reducedMotion={reducedMotion}>
          <Kicker text="Big news · iPhone & iPad" color={C.cyan} size={1.15} />
        </Rise>
        <Headline a="NovaStream is on" b="the App Store." accent={C.cyan} local={local} at={0.7} reducedMotion={reducedMotion} size={5.6} />
        <Rise local={local} at={2.2} reducedMotion={reducedMotion} className="mt-[1cqw] flex items-center gap-[1.6cqw]">
          <AppStoreBadge height={4.2} />
          <span className="text-[1.5cqw]" style={{ ...BODY, color: C.muted }}>
            Native app · iOS & iPadOS
          </span>
        </Rise>
      </div>
      <motion.div className="absolute left-[66cqw] top-[6cqw]" style={{ opacity: pad, x: padX }}>
        <motion.div style={{ y: float }}>
          <DeviceFrame width={27} height={`${27 / IPAD_RATIO}cqw`} accent={C.mint} bezel={0.9} radius={2.2}>
            <img src={`${M}/ios-ipad-01-home-v1.jpg`} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          </DeviceFrame>
        </motion.div>
      </motion.div>
      <motion.div className="absolute left-[56cqw] top-[13cqw]" style={{ opacity: phone, y: phoneY, zIndex: 2 }}>
        <Phone src={`${M}/ios-iphone-01-home-v1.jpg`} width={17} accent={C.blue} />
      </motion.div>
    </Section>
  );
}

/* ───────────────────────────── iphone ───────────────────────────── */

const PHONES = [
  { src: `${M}/ios-iphone-02-live-tv-v1.jpg`, at: 0.4, x: 59, rot: -6, y: 10 },
  { src: `${M}/ios-iphone-03-movies-v1.jpg`, at: 0.8, x: 74, rot: 0, y: 7 },
  { src: `${M}/ios-iphone-04-series-v1.jpg`, at: 1.2, x: 89, rot: 6, y: 10 },
];

function IphoneScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  return (
    <Section {...shell}>
      <div className="absolute left-[7cqw] top-[11cqw] flex flex-col gap-[1.5cqw]">
        <Rise local={local} at={0.05} reducedMotion={reducedMotion}>
          <Kicker text="On iPhone" color={C.cyan} size={1.15} />
        </Rise>
        <Headline a="Your playlists." b="In your pocket." accent={C.cyan} local={local} at={0.2} reducedMotion={reducedMotion} size={5.2} />
        <div className="mt-[1.4cqw] flex flex-col gap-[1.2cqw]">
          <Point icon={ListVideo} text="Add your own m3u or Xtream playlist" local={local} at={1.4} accent={C.cyan} reducedMotion={reducedMotion} />
          <Point icon={Tv} text="Live TV with the programme now on air" local={local} at={3.4} accent={C.blue} reducedMotion={reducedMotion} />
          <Point icon={Film} text="Movies and series, neatly organised" local={local} at={5.0} accent={C.mint} reducedMotion={reducedMotion} />
        </div>
      </div>
      {PHONES.map((p) => (
        <FanPhone key={p.src} item={p} local={local} reducedMotion={reducedMotion} />
      ))}
    </Section>
  );
}

function FanPhone({ item, local, reducedMotion }: { item: (typeof PHONES)[number]; local: L; reducedMotion: boolean }) {
  const p = useProgress(local, item.at, item.at + 0.7);
  const y = useTransform(p, (v) => (reducedMotion ? `${item.y}cqw` : `${item.y + (1 - v) * 16}cqw`));
  const bob = useTransform(local, (t) => (reducedMotion ? item.rot : item.rot + Math.sin(t * 0.7 + item.x) * 0.6));
  return (
    <motion.div className="absolute" style={{ left: `${item.x}cqw`, top: 0, x: "-50%", y, rotate: bob, opacity: p }}>
      <Phone src={item.src} width={14} accent={C.cyan} />
    </motion.div>
  );
}

/* ───────────────────────────── ipad ───────────────────────────── */

const IPAD_W = 30;
const IPAD_SHOTS: Shot[] = [
  { src: `${M}/ios-ipad-01-home-v1.jpg`, ratio: IPAD_RATIO, at: 0 },
  { src: `${M}/ios-ipad-03-movies-v1.jpg`, ratio: IPAD_RATIO, at: 2.6 },
  { src: `${M}/ios-ipad-02-live-tv-v1.jpg`, ratio: IPAD_RATIO, at: 5.2 },
];

function IpadScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const pad = useRise(local, 0.15, reducedMotion, 4);
  const height = useFrameHeight(local, IPAD_SHOTS, IPAD_W);
  return (
    <Section {...shell}>
      <motion.div className="absolute left-[9cqw] top-[3.5cqw]" style={{ opacity: pad.opacity, y: pad.y }}>
        <DeviceFrame width={IPAD_W} height={height} accent={C.mint} bezel={1} radius={2.4}>
          <ShotStack shots={IPAD_SHOTS} local={local} width={IPAD_W} reducedMotion={reducedMotion} />
        </DeviceFrame>
      </motion.div>
      <div className="absolute left-[50cqw] top-[12cqw] flex flex-col gap-[1.5cqw]">
        <Rise local={local} at={0.05} reducedMotion={reducedMotion}>
          <Kicker text="On iPad" color={C.mint} size={1.15} />
        </Rise>
        <Headline a="A big screen," b="made for iPad." accent={C.mint} local={local} at={0.2} reducedMotion={reducedMotion} />
        <div className="mt-[1.4cqw] flex flex-wrap gap-[1cqw]" style={{ width: "40cqw" }}>
          <Chip icon={Tablet} text="Top bar navigation" local={local} at={1.6} accent={C.mint} reducedMotion={reducedMotion} />
          <Chip icon={Clapperboard} text="Big posters" local={local} at={2.8} accent={C.cyan} reducedMotion={reducedMotion} />
          <Chip icon={CalendarDays} text="TV guide at a glance" local={local} at={5.2} accent={C.blue} reducedMotion={reducedMotion} />
        </div>
      </div>
    </Section>
  );
}

/* ───────────────────────────── trial ───────────────────────────── */

function TrialScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  return (
    <Section {...shell}>
      <div className="absolute inset-x-0 top-[8cqw] flex flex-col items-center gap-[1.5cqw]">
        <Rise local={local} at={0.05} reducedMotion={reducedMotion}>
          <Kicker text="How it works on iOS" color={C.amber} size={1.15} />
        </Rise>
        <div className="text-center">
          <Headline a="Try it free." b="Keep it all year." accent={C.amber} local={local} at={0.2} reducedMotion={reducedMotion} />
        </div>
      </div>
      <div className="absolute inset-x-0 top-[31cqw] flex justify-center gap-[3cqw]">
        <PlanCard icon={Gift} title="Free trial" line="Every feature, from day one" accent={C.amber} local={local} at={0.9} reducedMotion={reducedMotion} />
        <PlanCard icon={CalendarCheck} title="Yearly subscription" line="Right inside the app" accent={C.cyan} local={local} at={2.7} reducedMotion={reducedMotion} />
        <PlanCard icon={RotateCcw} title="Restore anytime" line="Same Apple ID, any device" accent={C.mint} local={local} at={4.2} reducedMotion={reducedMotion} />
      </div>
    </Section>
  );
}

function PlanCard({ icon: Glyph, title, line, accent, local, at, reducedMotion }: { icon: Icon; title: string; line: string; accent: string; local: L; at: number; reducedMotion: boolean }) {
  const r = useRise(local, at, reducedMotion, 3);
  const glow = useProgress(local, at + 0.2, at + 0.9);
  const shadow = useTransform(glow, (v) => `inset 0 0 0 0.1cqw ${accent}${Math.round(40 + v * 80).toString(16)}, 0 2cqw 5cqw rgba(0,0,0,0.45)`);
  return (
    <motion.div
      className="flex w-[25cqw] flex-col gap-[1cqw] rounded-[1.8cqw] p-[2.2cqw]"
      style={{ opacity: r.opacity, y: r.y, background: `linear-gradient(160deg, ${accent}1C 0%, ${C.card} 70%)`, boxShadow: shadow }}
    >
      <span className="flex h-[4.4cqw] w-[4.4cqw] items-center justify-center rounded-[1.2cqw]" style={{ background: `${accent}26` }}>
        <Glyph size="2.4cqw" color={accent} strokeWidth={2.1} />
      </span>
      <p className="whitespace-nowrap text-[2.3cqw]" style={{ ...DISPLAY, fontWeight: 760 }}>
        {title}
      </p>
      <p className="whitespace-nowrap text-[1.4cqw]" style={{ ...BODY, color: C.muted }}>
        {line}
      </p>
    </motion.div>
  );
}

/* ───────────────────────────── android 1.3.6 ───────────────────────────── */

function AndroidScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const num = usePop(local, 0.4, reducedMotion, 0.5);
  const numO = useProgress(local, 0.4, 0.7);
  const shot = useRise(local, 2.4, reducedMotion, 4);
  return (
    <Section {...shell}>
      <div className="absolute left-[7cqw] top-[9cqw] flex flex-col gap-[1.2cqw]">
        <Rise local={local} at={0.05} reducedMotion={reducedMotion}>
          <Kicker text="Meanwhile on Android" color={C.mint} size={1.15} />
        </Rise>
        <motion.p className="origin-left whitespace-nowrap text-[15cqw]" style={{ ...DISPLAY, lineHeight: 0.9, scale: num, opacity: numO }}>
          <span style={gradientText(C.mint)}>1.3.6</span>
        </motion.p>
        <Rise local={local} at={1.4} reducedMotion={reducedMotion} className="flex items-center gap-[1.6cqw]">
          <PlayBadge height={4.2} />
          <span className="text-[1.6cqw]" style={{ ...BODY, color: C.muted }}>
            Rolling out now
          </span>
        </Rise>
        <Rise local={local} at={4.2} reducedMotion={reducedMotion} className="mt-[1.2cqw]">
          <p className="whitespace-nowrap text-[2.6cqw]" style={{ ...DISPLAY, fontWeight: 760 }}>
            Here's what's new <span style={{ color: C.mint }}>↓</span>
          </p>
        </Rise>
      </div>
      <motion.div className="absolute left-[47cqw] top-[16cqw]" style={{ opacity: shot.opacity, y: shot.y }}>
        <DeviceFrame width={46} height={`${46 / WIDE_RATIO}cqw`} accent={C.mint} bezel={0.8} radius={2.4}>
          <img src={`${M}/app-live-list-v1.jpg`} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover object-left-top" />
        </DeviceFrame>
      </motion.div>
    </Section>
  );
}

/* ───────────────────────────── zap: left / right changes channel ───────────────────────────── */

const ZAP = [
  { tile: "SA", name: "Sport Arena FHD", show: "16:00  Sports Center", progress: 0.42, hue: C.blue },
  { tile: "GT", name: "Goal TV", show: "16:00  Pre-Match Show", progress: 0.22, hue: C.mint },
  { tile: "NN", name: "Nova News 24", show: "15:30  Afternoon Report", progress: 0.6, hue: C.cyan },
];
const ZAP_AT = [0, 3.0, 5.2];

function zapIndex(t: number) {
  let i = 0;
  for (let j = 0; j < ZAP_AT.length; j += 1) if (t >= ZAP_AT[j]) i = j;
  return i;
}

function ZapScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const screen = useRise(local, 0.2, reducedMotion, 3);
  return (
    <Section {...shell}>
      <div className="absolute left-[7cqw] top-[11cqw] flex flex-col gap-[1.5cqw]">
        <Rise local={local} at={0.05} reducedMotion={reducedMotion}>
          <Kicker text="New · Channel zapping" color={C.cyan} size={1.15} />
        </Rise>
        <Headline a="Left, right." b="Next channel." accent={C.cyan} local={local} at={0.2} reducedMotion={reducedMotion} />
        <Rise local={local} at={1.2} reducedMotion={reducedMotion} className="mt-[1cqw] max-w-[34cqw]">
          <p className="text-[1.7cqw] leading-[1.35]" style={{ ...BODY, color: C.muted }}>
            Switch channels right in the player. The channel name and what's on appear at the top.
          </p>
        </Rise>
        <div className="mt-[2cqw] flex gap-[1cqw]">
          <KeyCap icon={ChevronLeft} local={local} hits={[5.2]} reducedMotion={reducedMotion} />
          <KeyCap icon={ChevronRight} local={local} hits={[3.0]} reducedMotion={reducedMotion} />
        </div>
      </div>
      <motion.div className="absolute left-[47cqw] top-[9cqw]" style={{ opacity: screen.opacity, y: screen.y }}>
        <DeviceFrame width={46} height="25.875cqw" accent={C.cyan} bezel={0.8} radius={2.2}>
          {ZAP.map((ch, i) => (
            <ZapPicture key={ch.name} index={i} local={local} />
          ))}
          <ZapBanner local={local} reducedMotion={reducedMotion} />
        </DeviceFrame>
      </motion.div>
    </Section>
  );
}

function ZapPicture({ index, local }: { index: number; local: L }) {
  const ch = ZAP[index];
  const opacity = useTransform(local, (t) => {
    const at = ZAP_AT[index];
    const next = ZAP_AT[index + 1];
    if (index > 0 && t < at) return 0;
    const fadeIn = index === 0 ? 1 : clamp01((t - at) / 0.25);
    return next !== undefined && t >= next + 0.25 ? 0 : fadeIn;
  });
  const drift = useTransform(local, (t) => `${Math.sin(t * 0.5 + index) * 4}%`);
  return (
    <motion.div className="absolute inset-0" style={{ opacity, zIndex: index }}>
      <div className="absolute inset-0" style={{ background: `radial-gradient(120% 90% at 30% 80%, ${ch.hue}55 0%, #070B16 70%)` }} />
      <motion.div
        className="absolute rounded-full"
        style={{ left: "45%", top: "20%", width: "60%", height: "90%", x: drift, background: `radial-gradient(circle, ${ch.hue}40 0%, transparent 65%)` }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[30%]" style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.6), transparent)" }} />
      <span
        className="absolute bottom-[1.6cqw] right-[1.8cqw] text-[5cqw] opacity-25"
        style={{ ...DISPLAY, color: C.text }}
      >
        {ch.tile}
      </span>
    </motion.div>
  );
}

function ZapBanner({ local, reducedMotion }: { local: L; reducedMotion: boolean }) {
  const i = useTransform(local, (t) => zapIndex(t));
  const y = useTransform(local, (t) => {
    if (reducedMotion) return "0cqw";
    const at = ZAP_AT[zapIndex(t)];
    const p = clamp01((t - Math.max(at, 0.8)) / 0.35);
    return `${(1 - p) * -6}cqw`;
  });
  const opacity = useTransform(local, (t) => clamp01((t - Math.max(ZAP_AT[zapIndex(t)], 0.8)) / 0.25));
  return (
    <motion.div
      className="absolute left-[1.4cqw] right-[1.4cqw] top-[1.4cqw] flex items-center gap-[1.2cqw] rounded-[1.1cqw] px-[1.2cqw] py-[1cqw]"
      style={{ y, opacity, zIndex: 10, background: "rgba(8,12,24,0.82)", boxShadow: "inset 0 0 0 0.08cqw rgba(170,195,255,0.25)" }}
    >
      {ZAP.map((ch, k) => (
        <BannerContent key={ch.name} index={k} current={i} />
      ))}
    </motion.div>
  );
}

function BannerContent({ index, current }: { index: number; current: MotionValue<number> }) {
  const ch = ZAP[index];
  const display = useTransform(current, (c) => (c === index ? "flex" : "none"));
  return (
    <motion.div className="w-full items-center gap-[1.2cqw]" style={{ display }}>
      <span
        className="flex h-[3.6cqw] w-[3.6cqw] shrink-0 items-center justify-center rounded-[0.8cqw] text-[1.5cqw]"
        style={{ ...DISPLAY, background: `linear-gradient(140deg, ${C.mint}, #0E7A5A)` }}
      >
        {ch.tile}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[0.35cqw]">
        <div className="flex items-center gap-[0.8cqw]">
          <span className="whitespace-nowrap text-[1.5cqw] font-bold" style={BODY}>
            {ch.name}
          </span>
          <span className="rounded-[0.3cqw] px-[0.5cqw] py-[0.1cqw] text-[0.75cqw] font-bold" style={{ ...WIDE, letterSpacing: "0.12em", background: C.coral, color: "#fff" }}>
            Live
          </span>
        </div>
        <span className="whitespace-nowrap text-[1.15cqw]" style={{ ...BODY, color: C.muted }}>
          {ch.show}
        </span>
        <div className="h-[0.3cqw] w-full rounded-full" style={{ background: "rgba(255,255,255,0.12)" }}>
          <div className="h-full rounded-full" style={{ width: `${ch.progress * 100}%`, background: C.mint }} />
        </div>
      </div>
    </motion.div>
  );
}

function KeyCap({ icon: Glyph, local, hits, reducedMotion }: { icon: Icon; local: L; hits: number[]; reducedMotion: boolean }) {
  const lit = useTransform(local, (t) => {
    let v = 0;
    for (const h of hits) if (t >= h - 0.1 && t < h + 0.5) v = 1 - clamp01((t - h) / 0.5);
    return v;
  });
  const scale = useTransform(lit, (v) => (reducedMotion ? 1 : 1 - 0.08 * v));
  const background = useTransform(lit, (v) => `rgba(56,213,245,${0.08 + v * 0.5})`);
  return (
    <motion.span
      className="flex h-[5cqw] w-[5cqw] items-center justify-center rounded-[1.2cqw]"
      style={{ scale, background, boxShadow: "inset 0 0 0 0.1cqw rgba(56,213,245,0.5)" }}
    >
      <Glyph size="2.6cqw" color={C.text} strokeWidth={2.4} />
    </motion.span>
  );
}

/* ───────────────────────────── list: you come back where you were ───────────────────────────── */

const LIST_W = 46;
const LIST_H = LIST_W / WIDE_RATIO;
const PLAY_AT = 2.4;
const BACK_AT = 4.4;

function ListScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const screen = useRise(local, 0.2, reducedMotion, 3);
  const ring = useProgress(local, 1.2, 1.6);
  const ringScale = useTransform(local, (t) => (reducedMotion ? 1 : t < BACK_AT ? 1 : 1 + 0.03 * Math.sin(clamp01((t - BACK_AT - 0.3) / 0.6) * Math.PI)));
  const player = useTransform(local, (t) => clamp01((t - PLAY_AT) / 0.3) * (1 - clamp01((t - BACK_AT) / 0.3)));
  const badge = usePop(local, BACK_AT + 0.4, reducedMotion, 0.6);
  const badgeO = useProgress(local, BACK_AT + 0.4, BACK_AT + 0.7);
  return (
    <Section {...shell}>
      <div className="absolute left-[7cqw] top-[11cqw] flex flex-col gap-[1.5cqw]">
        <Rise local={local} at={0.05} reducedMotion={reducedMotion}>
          <Kicker text="Fixed · Lists" color={C.blue} size={1.15} />
        </Rise>
        <Headline a="Back exactly" b="where you were." accent={C.blue} local={local} at={0.2} reducedMotion={reducedMotion} size={5} />
        <Rise local={local} at={1.2} reducedMotion={reducedMotion} className="mt-[1cqw] max-w-[32cqw]">
          <p className="text-[1.7cqw] leading-[1.35]" style={{ ...BODY, color: C.muted }}>
            Close the player and the list stays on the channel or title you opened.
          </p>
        </Rise>
        <div className="mt-[1.6cqw] flex gap-[1cqw]">
          <Chip icon={MonitorPlay} text="Live" local={local} at={5.0} accent={C.blue} reducedMotion={reducedMotion} />
          <Chip icon={Film} text="Movies" local={local} at={5.4} accent={C.cyan} reducedMotion={reducedMotion} />
          <Chip icon={Clapperboard} text="Series" local={local} at={5.8} accent={C.mint} reducedMotion={reducedMotion} />
        </div>
      </div>
      <motion.div className="absolute left-[48cqw] top-[15cqw]" style={{ opacity: screen.opacity, y: screen.y }}>
        <DeviceFrame width={LIST_W} height={`${LIST_H}cqw`} accent={C.blue} bezel={0.8} radius={2.2}>
          <img src={`${M}/app-live-sport-v1.jpg`} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          {/* Goal TV card sits at x 433–1588, y 400–606 of the 1616 × 606 capture. */}
          <motion.div
            className="absolute rounded-[1.2cqw]"
            style={{
              left: `${(428 / 1616) * 100}%`,
              top: `${(396 / 606) * 100}%`,
              width: `${(1164 / 1616) * 100}%`,
              height: `${(230 / 606) * 100}%`,
              opacity: ring,
              scale: ringScale,
              boxShadow: `0 0 0 0.3cqw ${C.cyan}, 0 0 2.4cqw ${C.cyan}88`,
            }}
          />
          <motion.div className="absolute inset-0 flex items-center justify-center gap-[1.2cqw]" style={{ opacity: player, background: "radial-gradient(90% 90% at 50% 60%, #12385A 0%, #04070E 80%)" }}>
            <Play size="3cqw" color={C.text} fill={C.text} />
            <span className="whitespace-nowrap text-[2cqw] font-bold" style={BODY}>
              Watching Goal TV
            </span>
          </motion.div>
        </DeviceFrame>
        <motion.div
          className="absolute -bottom-[4.6cqw] right-0 flex items-center gap-[0.8cqw] whitespace-nowrap rounded-full px-[1.4cqw] py-[0.7cqw] text-[1.5cqw] font-bold"
          style={{ ...BODY, scale: badge, opacity: badgeO, background: `${C.mint}22`, boxShadow: `inset 0 0 0 0.1cqw ${C.mint}88` }}
        >
          <CheckCircle2 size="1.6cqw" color={C.mint} strokeWidth={2.4} />
          Same row, same focus
        </motion.div>
      </motion.div>
    </Section>
  );
}

/* ───────────────────────────── remote: D-pad and guide ───────────────────────────── */

const REMOTE_W = 46;
const GUIDE_AT = 4.4;
const REMOTE_SHOTS: Shot[] = [
  { src: `${M}/app-live-sport-v1.jpg`, ratio: WIDE_RATIO, at: 0 },
  { src: `${M}/app-guide-v1.jpg`, ratio: 1616 / 556, at: GUIDE_AT },
];

function RemoteScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const screen = useRise(local, 0.2, reducedMotion, 3);
  const height = useFrameHeight(local, REMOTE_SHOTS, REMOTE_W);
  const focusTop = useTransform(local, (t) => {
    const down = clamp01((t - 2.0) / 0.3);
    const up = clamp01((t - 3.2) / 0.3);
    return `${(150 + (down - up) * 256) / 6.06}%`;
  });
  const focusO = useTransform(local, (t) => clamp01((t - 1.0) / 0.3) * (1 - clamp01((t - GUIDE_AT) / 0.3)));
  return (
    <Section {...shell}>
      <div className="absolute left-[7cqw] top-[9cqw] flex flex-col gap-[1.5cqw]">
        <Rise local={local} at={0.05} reducedMotion={reducedMotion}>
          <Kicker text="Better on TV remotes" color={C.mint} size={1.15} />
        </Rise>
        <Headline a="Your remote," b="one step faster." accent={C.mint} local={local} at={0.2} reducedMotion={reducedMotion} size={5.8} />
        <div className="mt-[1.4cqw] flex items-center gap-[3cqw]">
          <DPad local={local} reducedMotion={reducedMotion} />
          <div className="flex flex-col gap-[1.1cqw]">
            <Point icon={ChevronDown} text="Up / down between channels" local={local} at={1.6} accent={C.mint} reducedMotion={reducedMotion} />
            <Point icon={ChevronRight} text="Right opens the TV guide" local={local} at={GUIDE_AT - 0.4} accent={C.cyan} reducedMotion={reducedMotion} />
            <Point icon={Tv} text="Clearer buttons on TV" local={local} at={6.2} accent={C.blue} reducedMotion={reducedMotion} />
          </div>
        </div>
      </div>
      <motion.div className="absolute left-[48cqw] top-[33cqw]" style={{ opacity: screen.opacity, y: screen.y }}>
        <motion.div style={{ y: "-50%" }}>
          <DeviceFrame width={REMOTE_W} height={height} accent={C.mint} bezel={0.8} radius={2.2}>
            <ShotStack shots={REMOTE_SHOTS} local={local} width={REMOTE_W} reducedMotion={reducedMotion} />
            <motion.div
              className="absolute rounded-[1.1cqw]"
              style={{
                left: `${(428 / 1616) * 100}%`,
                width: `${(1164 / 1616) * 100}%`,
                height: `${(240 / 606) * 100}%`,
                top: focusTop,
                opacity: focusO,
                zIndex: 5,
                boxShadow: `0 0 0 0.25cqw ${C.mint}, 0 0 2cqw ${C.mint}77`,
              }}
            />
          </DeviceFrame>
        </motion.div>
      </motion.div>
    </Section>
  );
}

function DPad({ local, reducedMotion }: { local: L; reducedMotion: boolean }) {
  const r = useRise(local, 1.0, reducedMotion, 2);
  const s = 3.6;
  return (
    <motion.div
      className="relative shrink-0 rounded-full"
      style={{ width: `${s * 3}cqw`, height: `${s * 3}cqw`, opacity: r.opacity, y: r.y, background: "#111A2E", boxShadow: "inset 0 0 0 0.1cqw rgba(170,195,255,0.2), 0 1.4cqw 3cqw rgba(0,0,0,0.5)" }}
    >
      <PadKey icon={ChevronUp} local={local} hits={[3.2]} style={{ left: `${s}cqw`, top: 0 }} size={s} />
      <PadKey icon={ChevronDown} local={local} hits={[2.0]} style={{ left: `${s}cqw`, top: `${s * 2}cqw` }} size={s} />
      <PadKey icon={ChevronLeft} local={local} hits={[]} style={{ left: 0, top: `${s}cqw` }} size={s} />
      <PadKey icon={ChevronRight} local={local} hits={[GUIDE_AT]} style={{ left: `${s * 2}cqw`, top: `${s}cqw` }} size={s} />
      <span className="absolute rounded-full" style={{ left: `${s * 1.15}cqw`, top: `${s * 1.15}cqw`, width: `${s * 0.7}cqw`, height: `${s * 0.7}cqw`, background: "#1B2742" }} />
    </motion.div>
  );
}

function PadKey({ icon: Glyph, local, hits, style, size }: { icon: Icon; local: L; hits: number[]; style: CSSProperties; size: number }) {
  const color = useTransform(local, (t) => {
    for (const h of hits) if (t >= h - 0.05 && t < h + 0.5) return C.mint;
    return C.faint;
  });
  return (
    <motion.span className="absolute flex items-center justify-center" style={{ ...style, width: `${size}cqw`, height: `${size}cqw`, color }}>
      <Glyph size={`${size * 0.6}cqw`} strokeWidth={2.6} />
    </motion.span>
  );
}

/* ───────────────────────────── transfer ───────────────────────────── */

const WEB_W = 42;
const WEB_RATIO = 1.6;
const WEB_SHOTS: Shot[] = [
  { src: `${M}/site-tr-form-v1.jpg`, ratio: 1920 / 2280, frame: WEB_RATIO, at: 0, pan: [0.6, 3.0] },
  { src: `${M}/site-tr-done-v1.jpg`, ratio: 1.6, at: 3.4 },
];

function TransferScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const web = useRise(local, 0.25, reducedMotion, 3);
  return (
    <Section {...shell}>
      <div className="absolute left-[7cqw] top-[12cqw] flex flex-col gap-[1.5cqw]">
        <Rise local={local} at={0.05} reducedMotion={reducedMotion}>
          <Kicker text="Changing device?" color={C.cyan} size={1.15} />
        </Rise>
        <Headline a="Move your licence" b="in a minute." accent={C.cyan} local={local} at={0.2} reducedMotion={reducedMotion} size={5.6} />
        <div className="mt-[1.4cqw] flex flex-col gap-[1.1cqw]">
          <Point icon={Smartphone} text="From the NovaStream website" local={local} at={1.4} accent={C.cyan} reducedMotion={reducedMotion} />
          <Point icon={CheckCircle2} text="Old device out, new device in" local={local} at={3.4} accent={C.mint} reducedMotion={reducedMotion} />
        </div>
      </div>
      <motion.div className="absolute left-[50cqw] top-[8cqw]" style={{ opacity: web.opacity, y: web.y }}>
        <BrowserFrame width={WEB_W} ratio={WEB_RATIO} url="novastreamapp.com/transfer" accent={C.cyan}>
          <ShotStack shots={WEB_SHOTS} local={local} width={WEB_W} reducedMotion={reducedMotion} />
        </BrowserFrame>
      </motion.div>
    </Section>
  );
}

/* ───────────────────────────── outro ───────────────────────────── */

function OutroScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  return (
    <Section {...shell}>
      <div className="absolute left-1/2 top-[7cqw] -translate-x-1/2">
        <LogoMark size={10} local={local} reducedMotion={reducedMotion} at={0.05} />
      </div>
      <div className="absolute inset-x-0 top-[21cqw] flex flex-col items-center">
        <div className="text-center">
          <Headline a="NovaStream." b="Bring your own playlist." accent={C.cyan} local={local} at={0.5} reducedMotion={reducedMotion} size={5.6} />
        </div>
        <Rise local={local} at={1.6} reducedMotion={reducedMotion} className="mt-[3cqw] flex items-center gap-[2.4cqw]">
          <AppStoreBadge height={4.4} />
          <PlayBadge height={4.4} />
        </Rise>
        <Rise local={local} at={2.6} reducedMotion={reducedMotion} className="mt-[3.2cqw] flex items-center gap-[2cqw]">
          <span className="flex items-center gap-[0.6cqw] text-[1.3cqw]" style={{ ...BODY, color: C.muted }}>
            <Smartphone size="1.4cqw" color={C.cyan} /> iPhone
          </span>
          <span className="flex items-center gap-[0.6cqw] text-[1.3cqw]" style={{ ...BODY, color: C.muted }}>
            <Tablet size="1.4cqw" color={C.mint} /> iPad
          </span>
          <span className="flex items-center gap-[0.6cqw] text-[1.3cqw]" style={{ ...BODY, color: C.muted }}>
            <Tv size="1.4cqw" color={C.blue} /> Android phones, tablets & TV
          </span>
        </Rise>
        <Rise local={local} at={3.2} reducedMotion={reducedMotion} className="mt-[2.4cqw]">
          <p className="whitespace-nowrap text-[1cqw]" style={{ ...WIDE, letterSpacing: "0.16em", color: C.faint }}>
            Player only · no content included
          </p>
        </Rise>
      </div>
    </Section>
  );
}
