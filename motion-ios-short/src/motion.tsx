import { MotionPlayer, type FilmLayerProps, type SceneContent, type SceneRenderProps } from "./motion-player";
import { motion, useTransform, type MotionValue } from "motion/react";
import { Clapperboard, Film, Gift, MonitorPlay } from "lucide-react";
import {
  BODY,
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
 * "NovaStream just landed on iPhone" — vertical Short (1080 × 1920), English narration.
 * Safe area: key content between 15 % from the top (26.7cqw) and 20 % from the bottom (142cqw), left of 88cqw.
 * No prices: the call to action is the App Store and a free trial.
 */

type FilmScene = SceneContent & { id: "hook" | "iphone" | "ipad" | "cta" };

const content: FilmScene[] = [
  { id: "hook", chapter: "On iPhone", voiceover: "/rork-vo-hook-v1.mp3", minSeconds: 5.2, effects: [{ src: "/rork-sfx-logo-v1.mp3", at: 1.2, volume: 0.38 }] },
  { id: "iphone", chapter: "Your playlists", voiceover: "/rork-vo-iphone-v1.mp3", minSeconds: 7.2, effects: [{ src: "/rork-sfx-whoosh-v1.mp3", at: 0.2, volume: 0.25 }] },
  { id: "ipad", chapter: "iPad", voiceover: "/rork-vo-ipad-v1.mp3", minSeconds: 5.4, effects: [{ src: "/rork-sfx-whoosh-v1.mp3", at: 0.2, volume: 0.25 }] },
  { id: "cta", chapter: "Get it", voiceover: "/rork-vo-cta-v1.mp3", minSeconds: 6.4, effects: [{ src: "/rork-sfx-chime-v1.mp3", at: 1.1, volume: 0.3 }] },
];

const musicBed: string | null = "/rork-music-v1.mp3";
const TRANSITION_SECONDS = 0.45;
const ACCENT: Record<FilmScene["id"], string> = { hook: C.blue, iphone: C.cyan, ipad: C.mint, cta: C.cyan };

export default function MotionPresentation() {
  return (
    <MotionPlayer
      content={content}
      musicBed={musicBed}
      musicVolume={0.5}
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
  switch (props.scene.id) {
    case "hook":
      return <HookScene {...props} />;
    case "iphone":
      return <IphoneScene {...props} />;
    case "ipad":
      return <IpadScene {...props} />;
    case "cta":
      return <CtaScene {...props} />;
  }
}

type Props = SceneRenderProps<FilmScene>;
type L = MotionValue<number>;

function useShell(scene: { start: number; end: number }, clock: L, reducedMotion: boolean) {
  return useSceneShell(scene, clock, reducedMotion, TRANSITION_SECONDS);
}

function Backdrop({ clock, activeScene, reducedMotion }: FilmLayerProps<FilmScene>) {
  return <Pools clock={clock} accent={ACCENT[activeScene.id]} reducedMotion={reducedMotion} tall />;
}

function Title({ a, b, accent, local, at, reducedMotion, size = 11 }: { a: string; b: string; accent: string; local: L; at: number; reducedMotion: boolean; size?: number }) {
  return (
    <Rise local={local} at={at} reducedMotion={reducedMotion} distance={3}>
      <h1 className="whitespace-nowrap pb-[1cqw] text-center" style={{ ...DISPLAY, fontSize: `${size}cqw`, lineHeight: 0.95 }}>
        {a}
        <br />
        <span style={gradientTextFor(accent)}>{b}</span>
      </h1>
    </Rise>
  );
}

function gradientTextFor(accent: string) {
  return {
    backgroundImage: `linear-gradient(100deg, ${C.blue} 0%, ${accent === C.blue ? C.cyan : accent} 100%)`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  } as const;
}

const IPHONE_RATIO = 1206 / 2622;
const IPAD_RATIO = 1668 / 2420;

function Phone({ src, width, accent }: { src: string; width: number; accent: string }) {
  return (
    <DeviceFrame width={width} height={`${width / IPHONE_RATIO}cqw`} accent={accent} bezel={width * 0.035} radius={width * 0.14}>
      <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
    </DeviceFrame>
  );
}

/* ───────────────────────────── hook ───────────────────────────── */

function HookScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const stop = usePop(local, 0.05, reducedMotion, 0.5);
  const stopOut = useTransform(local, (t) => 1 - 0.65 * Math.min(1, Math.max(0, (t - 1.1) / 0.4)));
  const phone = useProgress(local, 1.3, 2.1);
  const phoneY = useTransform(phone, (v) => (reducedMotion ? "0cqw" : `${(1 - v) * 40}cqw`));
  const float = useTransform(local, (t) => (reducedMotion ? "0cqw" : `${Math.sin(t * 1.1) * 0.8}cqw`));
  return (
    <Section {...shell}>
      <motion.div className="absolute inset-x-0 top-[27cqw] flex justify-center" style={{ scale: stop, opacity: stopOut }}>
        <span className="whitespace-nowrap text-[11cqw] leading-none" style={{ ...DISPLAY, color: C.text }}>
          Stop scrolling.
        </span>
      </motion.div>
      <div className="absolute inset-x-0 top-[42cqw] flex flex-col items-center gap-[2cqw]">
        <Rise local={local} at={1.1} reducedMotion={reducedMotion}>
          <p className="whitespace-nowrap text-center text-[8.6cqw]" style={{ ...DISPLAY, lineHeight: 0.95 }}>
            NovaStream is
            <br />
            <span style={gradientTextFor(C.cyan)}>on iPhone.</span>
          </p>
        </Rise>
      </div>
      <motion.div className="absolute left-1/2 top-[66cqw]" style={{ x: "-50%", y: phoneY, opacity: phone }}>
        <motion.div style={{ y: float }}>
          <Phone src={`${M}/ios-iphone-01-home-v1.jpg`} width={32} accent={C.blue} />
        </motion.div>
      </motion.div>
    </Section>
  );
}

/* ───────────────────────────── iphone ───────────────────────────── */

const FAN = [
  { src: `${M}/ios-iphone-02-live-tv-v1.jpg`, at: 0.5, x: 25, rot: -7, y: 4 },
  { src: `${M}/ios-iphone-03-movies-v1.jpg`, at: 0.9, x: 50, rot: 0, y: 0 },
  { src: `${M}/ios-iphone-04-series-v1.jpg`, at: 1.3, x: 75, rot: 7, y: 4 },
];

function IphoneScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  return (
    <Section {...shell}>
      <div className="absolute inset-x-0 top-[27cqw] flex flex-col items-center">
        <Rise local={local} at={0.05} reducedMotion={reducedMotion}>
          <Kicker text="m3u · Xtream" color={C.cyan} size={2.6} />
        </Rise>
        <div className="mt-[2cqw]">
          <Title a="Your playlists." b="In your pocket." accent={C.cyan} local={local} at={0.15} reducedMotion={reducedMotion} size={10} />
        </div>
      </div>
      <div className="absolute inset-x-0 top-[62cqw]">
        {FAN.map((p, i) => (
          <FanPhone key={p.src} item={p} z={i === 1 ? 3 : 1} local={local} reducedMotion={reducedMotion} />
        ))}
      </div>
      <div className="absolute inset-x-0 top-[126cqw] flex justify-center gap-[2.2cqw]">
        <Pill icon={MonitorPlay} text="Live TV" local={local} at={2.2} accent={C.blue} reducedMotion={reducedMotion} />
        <Pill icon={Film} text="Movies" local={local} at={2.8} accent={C.cyan} reducedMotion={reducedMotion} />
        <Pill icon={Clapperboard} text="Series" local={local} at={3.4} accent={C.mint} reducedMotion={reducedMotion} />
      </div>
    </Section>
  );
}

function FanPhone({ item, z, local, reducedMotion }: { item: (typeof FAN)[number]; z: number; local: L; reducedMotion: boolean }) {
  const p = useProgress(local, item.at, item.at + 0.7);
  const y = useTransform(p, (v) => (reducedMotion ? `${item.y}cqw` : `${item.y + (1 - v) * 30}cqw`));
  const rotate = useTransform(local, (t) => (reducedMotion ? item.rot : item.rot + Math.sin(t * 0.8 + item.x) * 0.8));
  return (
    <motion.div className="absolute top-0" style={{ left: `${item.x}cqw`, x: "-50%", y, rotate, opacity: p, zIndex: z }}>
      <Phone src={item.src} width={item.x === 50 ? 27 : 23} accent={C.cyan} />
    </motion.div>
  );
}

function Pill({ icon: Glyph, text, local, at, accent, reducedMotion }: { icon: Icon; text: string; local: L; at: number; accent: string; reducedMotion: boolean }) {
  const scale = usePop(local, at, reducedMotion, 0.7);
  const opacity = useProgress(local, at, at + 0.25);
  return (
    <motion.div
      className="flex items-center gap-[1.4cqw] whitespace-nowrap rounded-full px-[3.4cqw] py-[1.8cqw] text-[4.2cqw] font-bold"
      style={{ ...BODY, scale, opacity, background: `${accent}1F`, boxShadow: `inset 0 0 0 0.25cqw ${accent}77` }}
    >
      <Glyph size="4.2cqw" color={accent} strokeWidth={2.2} />
      {text}
    </motion.div>
  );
}

/* ───────────────────────────── ipad ───────────────────────────── */

const IPAD_W = 50;
const IPAD_SHOTS: Shot[] = [
  { src: `${M}/ios-ipad-01-home-v1.jpg`, ratio: IPAD_RATIO, at: 0 },
  { src: `${M}/ios-ipad-03-movies-v1.jpg`, ratio: IPAD_RATIO, at: 2.4 },
];

function IpadScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const pad = useRise(local, 0.2, reducedMotion, 5);
  const height = useFrameHeight(local, IPAD_SHOTS, IPAD_W);
  return (
    <Section {...shell}>
      <div className="absolute inset-x-0 top-[27cqw] flex flex-col items-center">
        <Rise local={local} at={0.05} reducedMotion={reducedMotion}>
          <Kicker text="And on iPad" color={C.mint} size={2.6} />
        </Rise>
        <div className="mt-[2cqw]">
          <Title a="A TV, wherever" b="you are." accent={C.mint} local={local} at={0.6} reducedMotion={reducedMotion} size={10} />
        </div>
      </div>
      <motion.div className="absolute left-1/2 top-[62cqw]" style={{ x: "-50%", opacity: pad.opacity, y: pad.y }}>
        <DeviceFrame width={IPAD_W} height={height} accent={C.mint} bezel={1.6} radius={4}>
          <ShotStack shots={IPAD_SHOTS} local={local} width={IPAD_W} reducedMotion={reducedMotion} />
        </DeviceFrame>
      </motion.div>
    </Section>
  );
}

/* ───────────────────────────── cta ───────────────────────────── */

function CtaScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const badge = usePop(local, 1.0, reducedMotion, 0.7);
  const badgeO = useProgress(local, 1.0, 1.3);
  return (
    <Section {...shell}>
      <div className="absolute left-1/2 top-[34cqw] -translate-x-1/2">
        <LogoMark size={24} local={local} reducedMotion={reducedMotion} at={0.05} />
      </div>
      <div className="absolute inset-x-0 top-[68cqw] flex flex-col items-center">
        <Title a="Search" b="NovaStream." accent={C.cyan} local={local} at={0.35} reducedMotion={reducedMotion} size={11} />
        <motion.div className="mt-[5cqw]" style={{ scale: badge, opacity: badgeO }}>
          <img src={`${M}/badge-appstore-v1.svg`} alt="Download on the App Store" draggable={false} style={{ height: "13cqw" }} />
        </motion.div>
        <Rise local={local} at={1.9} reducedMotion={reducedMotion} className="mt-[4.4cqw]">
          <div
            className="flex items-center gap-[1.4cqw] whitespace-nowrap rounded-full px-[3.6cqw] py-[1.8cqw] text-[4cqw] font-bold"
            style={{ ...BODY, background: `${C.amber}1F`, boxShadow: `inset 0 0 0 0.25cqw ${C.amber}88` }}
          >
            <Gift size="4.2cqw" color={C.amber} strokeWidth={2.2} />
            Try it free · iPhone & iPad
          </div>
        </Rise>
        <Rise local={local} at={2.6} reducedMotion={reducedMotion} className="mt-[5cqw]">
          <p className="whitespace-nowrap text-[2.4cqw]" style={{ ...WIDE, letterSpacing: "0.14em", color: C.faint }}>
            Player only · no content included
          </p>
        </Rise>
      </div>
    </Section>
  );
}
