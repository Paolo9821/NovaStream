import type { CSSProperties, ReactNode } from "react";
import { MotionPlayer, type FilmLayerProps, type SceneContent, type SceneRenderProps } from "./motion-player";
import { easeInOut } from "motion";
import { motion, useTransform, type MotionValue } from "motion/react";
import {
  ArrowLeftRight,
  Bell,
  Check,
  Clapperboard,
  Clock3,
  Gauge,
  Globe,
  KeyRound,
  Languages,
  LifeBuoy,
  ListChecks,
  Lock,
  Play,
  RefreshCw,
  Rewind,
  FastForward,
  Server,
  ShieldCheck,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  SunMoon,
  Subtitles,
  Timer,
  ToggleRight,
  Tv,
  WifiOff,
  AudioLines,
  Maximize,
  CalendarSync,
} from "lucide-react";
import {
  BODY,
  C,
  CtaPill,
  DISPLAY,
  DeviceFrame,
  Kicker,
  LogoMark,
  M,
  MONO,
  Picture,
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
 * "7 hidden NovaStream features" — horizontal tutorial (1920 × 1080), English narration.
 * Language of this film: a numbered tip sheet. Left, a giant tip number, the title, the settings path and the steps;
 * right, the real settings screen in a device frame, with a drawn diagram of the feature beneath it (never on top).
 * A seven-step tracker along the bottom shows where we are.
 */

type Point = { at: number; text: string; icon: Icon };
type Title = [string, string];
type Graphic = "upnext" | "reconnect" | "tracks" | "pin" | "dns" | "speed" | "auto" | "bonus";
type Top =
  | { kind: "shots"; shots: Shot[] }
  | { kind: "phone"; src: string }
  | { kind: "picture"; src: string; position: string };

type FilmScene = SceneContent &
  (
    | { id: "hook"; layout: "hook"; badgeAt: number }
    | {
        id: string;
        layout: "tip";
        n: string;
        kicker: string;
        title: Title;
        accent: string;
        path: string[];
        steps: Point[];
        top: Top;
        graphic: Graphic;
        graphicAt: number;
      }
    | { id: "recap"; layout: "recap"; tiles: { at: number; text: string; icon: Icon }[] }
    | { id: "outro"; layout: "outro"; subscribeAt: number }
  );

const SET = 2.693;
const TICK = { src: "/rork-sfx-tick-v1.mp3", at: 0.25, volume: 0.22 };

const TRACKER = ["Autoplay", "Reconnect", "Audio & subs", "Parental lock", "Custom DNS", "Speed test", "Auto update"];

const content: FilmScene[] = [
  {
    id: "hook",
    layout: "hook",
    chapter: "Intro",
    badgeAt: 4.0,
    voiceover: "/rork-vo-hook-v1.mp3",
    minSeconds: 11,
    effects: [{ src: "/rork-sfx-whoosh-v1.mp3", at: 0.1, volume: 0.22 }],
  },
  {
    id: "autoplay",
    layout: "tip",
    chapter: "1 · Autoplay",
    n: "01",
    kicker: "Player",
    title: ["Binge without ", "the remote."],
    accent: C.mint,
    path: ["Settings", "Player", "Autoplay"],
    steps: [
      { at: 3.6, text: "Turn on autoplay next episode", icon: ToggleRight },
      { at: 7.4, text: "It jumps in during the credits", icon: SkipForward },
      { at: 11.0, text: "You pick how many seconds", icon: Timer },
    ],
    top: { kind: "shots", shots: [{ src: `${M}/app-set-player-v1.jpg`, ratio: SET, at: 0 }] },
    graphic: "upnext",
    graphicAt: 6.6,
    voiceover: "/rork-vo-autoplay-v1.mp3",
    minSeconds: 20,
    effects: [TICK],
  },
  {
    id: "reconnect",
    layout: "tip",
    chapter: "2 · Auto reconnect",
    n: "02",
    kicker: "Live TV",
    title: ["Dropped stream? ", "Just wait."],
    accent: C.cyan,
    path: ["Player", "Automatic"],
    steps: [
      { at: 2.0, text: "The stream drops: do nothing", icon: WifiOff },
      { at: 4.6, text: "It reconnects by itself", icon: RefreshCw },
      { at: 8.0, text: "Hop channels or skip 10 s", icon: ArrowLeftRight },
    ],
    top: { kind: "shots", shots: [{ src: `${M}/app-live-sport-v1.jpg`, ratio: 2.667, at: 0 }] },
    graphic: "reconnect",
    graphicAt: 1.2,
    voiceover: "/rork-vo-reconnect-v1.mp3",
    minSeconds: 17,
    effects: [TICK],
  },
  {
    id: "tracks",
    layout: "tip",
    chapter: "3 · Audio & subtitles",
    n: "03",
    kicker: "Movies & series",
    title: ["Your language, ", "your picture."],
    accent: C.blue,
    path: ["Player", "Picture menu"],
    steps: [
      { at: 4.4, text: "Switch the audio language", icon: AudioLines },
      { at: 6.4, text: "Subtitles on or off", icon: Subtitles },
      { at: 8.4, text: "Fit the picture to your screen", icon: Maximize },
    ],
    top: { kind: "phone", src: `${M}/ns-phone-5-v1.jpg` },
    graphic: "tracks",
    graphicAt: 1.6,
    voiceover: "/rork-vo-tracks-v1.mp3",
    minSeconds: 15,
    effects: [TICK],
  },
  {
    id: "parental",
    layout: "tip",
    chapter: "4 · Parental lock",
    n: "04",
    kicker: "Family",
    title: ["Lock what kids ", "shouldn't see."],
    accent: C.amber,
    path: ["Settings", "Parental lock"],
    steps: [
      { at: 3.0, text: "Pick the categories to protect", icon: ListChecks },
      { at: 5.4, text: "Set a PIN", icon: KeyRound },
      { at: 7.6, text: "Locked until the PIN is typed", icon: Lock },
    ],
    top: { kind: "picture", src: `${M}/ill-family-v1.jpg`, position: "50% 38%" },
    graphic: "pin",
    graphicAt: 2.4,
    voiceover: "/rork-vo-parental-v1.mp3",
    minSeconds: 16,
    effects: [TICK],
  },
  {
    id: "dns",
    layout: "tip",
    chapter: "5 · Custom DNS",
    n: "05",
    kicker: "Network",
    title: ["The playlist ", "rescuer."],
    accent: C.mint,
    path: ["Settings", "DNS"],
    steps: [
      { at: 3.0, text: "Slow or no playlist? Blame DNS", icon: Clock3 },
      { at: 9.6, text: "Your own server or DNS over HTTPS", icon: ShieldCheck },
      { at: 14.8, text: "Test it right there", icon: Check },
    ],
    top: { kind: "shots", shots: [{ src: `${M}/app-set-low-v1.jpg`, ratio: SET, at: 0 }] },
    graphic: "dns",
    graphicAt: 2.4,
    voiceover: "/rork-vo-dns-v1.mp3",
    minSeconds: 22,
    effects: [TICK],
  },
  {
    id: "speed",
    layout: "tip",
    chapter: "6 · Speed test",
    n: "06",
    kicker: "Network",
    title: ["Know your ", "real speed."],
    accent: C.cyan,
    path: ["Settings", "Speed test"],
    steps: [
      { at: 2.6, text: "Measure your bandwidth", icon: Gauge },
      { at: 6.2, text: "See which quality it can handle", icon: Tv },
      { at: 10.4, text: "Then tune the buffer", icon: SlidersHorizontal },
    ],
    top: {
      kind: "shots",
      shots: [
        { src: `${M}/app-set-low-v1.jpg`, ratio: SET, at: 0 },
        { src: `${M}/app-set-player-v1.jpg`, ratio: SET, at: 9.8 },
      ],
    },
    graphic: "speed",
    graphicAt: 2.4,
    voiceover: "/rork-vo-speed-v1.mp3",
    minSeconds: 20,
    effects: [TICK],
  },
  {
    id: "auto",
    layout: "tip",
    chapter: "7 · Auto update",
    n: "07",
    kicker: "Playlist",
    title: ["A list that ", "updates itself."],
    accent: C.mint,
    path: ["Settings", "Automatic list update"],
    steps: [
      { at: 3.2, text: "Once a day or once a week", icon: CalendarSync },
      { at: 8.0, text: "TV guide refreshed too", icon: Clapperboard },
      { at: 10.6, text: "Always fresh, zero effort", icon: RefreshCw },
    ],
    top: { kind: "shots", shots: [{ src: `${M}/app-set-mid-v1.jpg`, ratio: SET, at: 0 }] },
    graphic: "auto",
    graphicAt: 2.2,
    voiceover: "/rork-vo-auto-v1.mp3",
    minSeconds: 19,
    effects: [TICK],
  },
  {
    id: "bonus",
    layout: "tip",
    chapter: "Bonus · Make it yours",
    n: "+1",
    kicker: "Bonus",
    title: ["Make it ", "yours."],
    accent: C.amber,
    path: ["Settings", "Appearance"],
    steps: [
      { at: 2.4, text: "Light, dark or automatic", icon: SunMoon },
      { at: 5.8, text: "8 interface languages", icon: Languages },
    ],
    top: { kind: "shots", shots: [{ src: `${M}/app-set-theme-v1.jpg`, ratio: SET, at: 0 }] },
    graphic: "bonus",
    graphicAt: 1.4,
    voiceover: "/rork-vo-bonus-v1.mp3",
    minSeconds: 13,
    effects: [{ src: "/rork-sfx-whoosh-v1.mp3", at: 0.1, volume: 0.2 }],
  },
  {
    id: "recap",
    layout: "recap",
    chapter: "Recap",
    tiles: [
      { at: 1.6, text: "Autoplay", icon: SkipForward },
      { at: 2.5, text: "Auto reconnect", icon: RefreshCw },
      { at: 3.6, text: "Audio & subtitles", icon: Subtitles },
      { at: 4.9, text: "Parental lock", icon: Lock },
      { at: 6.1, text: "Custom DNS", icon: ShieldCheck },
      { at: 7.2, text: "Speed test", icon: Gauge },
      { at: 8.4, text: "Auto update", icon: CalendarSync },
    ],
    voiceover: "/rork-vo-recap-v1.mp3",
    minSeconds: 15,
  },
  {
    id: "outro",
    layout: "outro",
    chapter: "Get the app",
    subscribeAt: 5.0,
    voiceover: "/rork-vo-outro-v1.mp3",
    minSeconds: 11,
    effects: [{ src: "/rork-sfx-logo-v1.mp3", at: 0.05, volume: 0.26 }],
  },
];

const musicBed: string | null = "/rork-music-v1.mp3";
const TRANSITION_SECONDS = 0.5;

export default function MotionPresentation() {
  return (
    <MotionPlayer
      content={content}
      musicBed={musicBed}
      musicVolume={0.5}
      width={1920}
      height={1080}
      surfaceClassName="bg-[#05080F]"
      Scene={FilmSceneView}
      Backdrop={Backdrop}
      Overlay={Overlay}
      transitionSeconds={TRANSITION_SECONDS}
    />
  );
}

function FilmSceneView(props: SceneRenderProps<FilmScene>) {
  const { scene } = props;
  switch (scene.layout) {
    case "hook":
      return <HookScene {...props} scene={scene} />;
    case "tip":
      return <TipScene {...props} scene={scene} />;
    case "recap":
      return <RecapScene {...props} scene={scene} />;
    case "outro":
      return <OutroScene {...props} scene={scene} />;
  }
}

type Props<L extends FilmScene["layout"]> = SceneRenderProps<Extract<FilmScene, { layout: L }>>;
type G = { local: MotionValue<number>; at: number; reducedMotion: boolean; accent: string };

function useShell(scene: { start: number; end: number }, clock: MotionValue<number>, reducedMotion: boolean) {
  return useSceneShell(scene, clock, reducedMotion, TRANSITION_SECONDS);
}

/* ───────────────────────────── backdrop & overlay ───────────────────────────── */

function Backdrop({ clock, activeScene, reducedMotion }: FilmLayerProps<FilmScene>) {
  const accent = "accent" in activeScene ? activeScene.accent : C.blue;
  return <Pools clock={clock} accent={accent} reducedMotion={reducedMotion} />;
}

function Overlay(props: FilmLayerProps<FilmScene>) {
  return (
    <>
      <BrandMark {...props} />
      <Tracker {...props} />
    </>
  );
}

function BrandMark({ clock, scenes }: FilmLayerProps<FilmScene>) {
  const first = scenes[0];
  const last = scenes[scenes.length - 1];
  const opacity = useTransform(clock, (t) => Math.max(0, Math.min(1, (t - first.end) / TRANSITION_SECONDS, (last.start - t) / TRANSITION_SECONDS)));
  return (
    <motion.div className="absolute right-[6cqw] top-[2.6cqw] flex items-center gap-[0.8cqw]" style={{ opacity }}>
      <img src={`${M}/ns-icon-v1.png`} alt="" draggable={false} className="h-[2.4cqw] w-[2.4cqw] rounded-[0.55cqw]" />
      <div className="text-[1.1cqw] font-bold leading-none" style={{ ...BODY, color: C.text }}>
        NovaStream
      </div>
    </motion.div>
  );
}

/** Seven segments along the bottom: done in mint, current in blue, upcoming faint. */
function Tracker({ clock, scenes, reducedMotion }: FilmLayerProps<FilmScene>) {
  const tips = scenes.filter((s) => s.layout === "tip");
  const from = tips[0].start;
  const to = tips[tips.length - 1].end;
  const opacity = useTransform(clock, (t) => Math.max(0, Math.min(1, (t - from) / TRANSITION_SECONDS, (to + TRANSITION_SECONDS - t) / TRANSITION_SECONDS)));
  return (
    <motion.div className="absolute left-[6cqw] right-[6cqw] top-[50.6cqw] flex gap-[0.8cqw]" style={{ opacity }}>
      {TRACKER.map((label, i) => (
        <TrackerSegment key={label} label={label} scene={tips[i]} clock={clock} reducedMotion={reducedMotion} />
      ))}
    </motion.div>
  );
}

function TrackerSegment({ label, scene, clock }: { label: string; scene: { start: number; end: number }; clock: MotionValue<number>; reducedMotion: boolean }) {
  const fill = useTransform(clock, (t) => `${clamp01((t - scene.start) / (scene.end - scene.start)) * 100}%`);
  const color = useTransform(clock, (t) => (t >= scene.end ? C.mint : t >= scene.start ? C.text : C.faint));
  const barColor = useTransform(clock, (t) => (t >= scene.end ? C.mint : C.blue));
  return (
    <div className="flex-1">
      <div className="relative h-[0.32cqw] overflow-hidden rounded-full" style={{ background: "rgba(214,226,255,0.12)" }}>
        <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ width: fill, background: barColor }} />
      </div>
      <motion.div className="mt-[0.7cqw] whitespace-nowrap text-[0.95cqw] font-semibold" style={{ ...BODY, color }}>
        {label}
      </motion.div>
    </div>
  );
}

/* ───────────────────────────── hook ───────────────────────────── */

function HookScene({ scene, clock, reducedMotion }: Props<"hook">) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const seven = usePop(local, 0.15, reducedMotion, 0.4);
  const sevenOpacity = useProgress(local, 0.1, 0.4);
  const pic = useRise(local, 0.5, reducedMotion, 3);
  return (
    <Section {...shell}>
      <div className="absolute left-[6cqw] top-[7cqw] w-[38cqw]">
        <motion.div
          className="text-[26cqw] leading-[0.8]"
          style={{ ...DISPLAY, ...gradientText(C.mint), scale: seven, opacity: sevenOpacity, transformOrigin: "20% 80%", width: "fit-content" }}
        >
          7
        </motion.div>
        <Rise local={local} at={0.6} reducedMotion={reducedMotion} distance={1.6}>
          <h1 className="mt-[1.6cqw] text-[4.6cqw]" style={DISPLAY}>
            hidden NovaStream
            <br />
            <span style={gradientText(C.mint)}>features</span>
          </h1>
        </Rise>
        <Rise local={local} at={1.6} reducedMotion={reducedMotion}>
          <p className="mt-[1.4cqw] text-[1.8cqw] font-semibold" style={{ ...BODY, color: C.muted }}>
            Most people never find them.
          </p>
        </Rise>
      </div>
      <motion.div className="absolute left-[48cqw] top-[8cqw]" style={{ opacity: pic.opacity, y: pic.y }}>
        <Picture src={`${M}/ill-livingroom-v1.jpg`} width={46} ratio={1.5} local={local} reducedMotion={reducedMotion} />
      </motion.div>
      <Rise local={local} at={scene.badgeAt} reducedMotion={reducedMotion} className="absolute left-[48cqw] top-[42.2cqw] flex items-center gap-[1cqw]">
        <span className="flex h-[3.4cqw] w-[3.4cqw] items-center justify-center rounded-full" style={{ background: `${C.amber}22`, boxShadow: `inset 0 0 0 0.08cqw ${C.amber}77` }}>
          <LifeBuoy size="1.7cqw" color={C.amber} strokeWidth={2.2} />
        </span>
        <div style={BODY}>
          <div className="text-[0.9cqw]" style={{ ...WIDE, color: C.amber }}>
            Stay for tip 5
          </div>
          <div className="mt-[0.3cqw] whitespace-nowrap text-[1.55cqw] font-semibold">It rescues a playlist that won't load</div>
        </div>
      </Rise>
    </Section>
  );
}

/* ───────────────────────────── tip ───────────────────────────── */

const RIGHT_X = 45;
const DEVICE_W = 47;
const BEZEL = 0.6;
const CARD_W = DEVICE_W + BEZEL * 2;
const DEVICE_H = DEVICE_W / SET + BEZEL * 2;

function TipScene({ scene, clock, reducedMotion }: Props<"tip">) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const num = usePop(local, 0.15, reducedMotion, 0.7);
  const numOpacity = useProgress(local, 0.1, 0.4);
  const top = useRise(local, 0.35, reducedMotion, 3);
  const graphic = useRise(local, scene.graphicAt, reducedMotion, 2);
  const g: G = { local, at: scene.graphicAt, reducedMotion, accent: scene.accent };
  const phone = scene.top.kind === "phone";
  return (
    <Section {...shell}>
      <div className="absolute left-[6cqw] top-[5.6cqw] w-[35cqw]">
        <motion.div className="flex items-end gap-[0.8cqw]" style={{ scale: num, opacity: numOpacity, transformOrigin: "0% 100%" }}>
          <span className="text-[10cqw] leading-[0.82]" style={{ ...DISPLAY, ...gradientText(scene.accent) }}>
            {scene.n}
          </span>
          <span className="pb-[0.5cqw] text-[2.2cqw]" style={{ ...DISPLAY, color: C.faint }}>
            / 07
          </span>
        </motion.div>
        <Rise local={local} at={0.3} reducedMotion={reducedMotion} className="mt-[2cqw]">
          <Kicker text={scene.kicker} color={scene.accent} />
        </Rise>
        <Rise local={local} at={0.42} reducedMotion={reducedMotion} distance={1.6}>
          <h2 className="mt-[0.9cqw] whitespace-nowrap pb-[0.3cqw] text-[3.5cqw]" style={DISPLAY}>
            {scene.title[0]}
            <br />
            <span style={gradientText(scene.accent)}>{scene.title[1]}</span>
          </h2>
        </Rise>
        <Rise local={local} at={1.0} reducedMotion={reducedMotion} className="mt-[1.4cqw] flex items-center gap-[0.5cqw]">
          {scene.path.map((p, i) => (
            <span key={p} className="flex items-center gap-[0.5cqw] whitespace-nowrap text-[1.05cqw] font-semibold" style={{ ...BODY, color: i === scene.path.length - 1 ? C.text : C.muted }}>
              {i > 0 && <span style={{ color: C.faint }}>›</span>}
              <span className="rounded-[0.5cqw] px-[0.7cqw] py-[0.35cqw]" style={{ background: i === scene.path.length - 1 ? `${scene.accent}22` : "rgba(214,226,255,0.07)" }}>
                {p}
              </span>
            </span>
          ))}
        </Rise>
        <div className="mt-[2.2cqw] flex flex-col gap-[1.2cqw]">
          {scene.steps.map((s) => (
            <Step key={s.text} step={s} local={local} accent={scene.accent} reducedMotion={reducedMotion} />
          ))}
        </div>
      </div>

      {phone ? (
        <>
          <motion.div className="absolute top-[6.6cqw]" style={{ left: `${RIGHT_X + 1}cqw`, opacity: top.opacity, y: top.y }}>
            <DeviceFrame width={19.4} height={`${19.4 / (680 / 1336)}cqw`} accent={scene.accent} bezel={0.55} radius={2.4}>
              <img src={scene.top.kind === "phone" ? scene.top.src : ""} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
            </DeviceFrame>
          </motion.div>
          <motion.div className="absolute top-[11cqw]" style={{ left: `${RIGHT_X + 23.5}cqw`, opacity: graphic.opacity, y: graphic.y }}>
            <Card width={25.6} height={30}>
              <GraphicView kind={scene.graphic} g={g} />
            </Card>
          </motion.div>
        </>
      ) : (
        <>
          <motion.div className="absolute top-[7cqw]" style={{ left: `${RIGHT_X}cqw`, opacity: top.opacity, y: top.y }}>
            {scene.top.kind === "shots" && <ShotDevice shots={scene.top.shots} local={local} accent={scene.accent} reducedMotion={reducedMotion} />}
            {scene.top.kind === "picture" && (
              <Picture src={scene.top.src} width={CARD_W} ratio={CARD_W / DEVICE_H} local={local} reducedMotion={reducedMotion} radius={1.8} position={scene.top.position} />
            )}
          </motion.div>
          <motion.div className="absolute" style={{ left: `${RIGHT_X}cqw`, top: `${7 + DEVICE_H + 1.6}cqw`, opacity: graphic.opacity, y: graphic.y }}>
            <Card width={CARD_W} height={48.4 - 7 - DEVICE_H - 1.6}>
              <GraphicView kind={scene.graphic} g={g} />
            </Card>
          </motion.div>
        </>
      )}
    </Section>
  );
}

function ShotDevice({ shots, local, accent, reducedMotion }: { shots: Shot[]; local: MotionValue<number>; accent: string; reducedMotion: boolean }) {
  const height = useFrameHeight(local, shots, DEVICE_W);
  return (
    <DeviceFrame width={DEVICE_W} height={height} accent={accent} bezel={BEZEL} radius={1.8}>
      <ShotStack shots={shots} local={local} width={DEVICE_W} reducedMotion={reducedMotion} />
    </DeviceFrame>
  );
}

function Step({ step, local, accent, reducedMotion }: { step: Point; local: MotionValue<number>; accent: string; reducedMotion: boolean }) {
  const Glyph = step.icon;
  return (
    <Rise local={local} at={step.at} reducedMotion={reducedMotion} className="flex items-center gap-[1cqw]">
      <span className="flex h-[2.9cqw] w-[2.9cqw] shrink-0 items-center justify-center rounded-[0.8cqw]" style={{ background: `${accent}1F`, boxShadow: `inset 0 0 0 0.08cqw ${accent}66` }}>
        <Glyph size="1.4cqw" strokeWidth={2.2} color={accent} />
      </span>
      <span className="whitespace-nowrap text-[1.4cqw] font-semibold" style={{ ...BODY, color: C.text }}>
        {step.text}
      </span>
    </Rise>
  );
}

function Card({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-[1.4cqw]"
      style={{
        width: `${width}cqw`,
        height: `${height}cqw`,
        background: "linear-gradient(180deg, #111A31 0%, #0C1326 100%)",
        boxShadow: "0 0 0 0.07cqw rgba(170,195,255,0.18), 0 1.6cqw 4cqw rgba(0,0,0,0.45)",
      }}
    >
      {children}
    </div>
  );
}

function GraphicView({ kind, g }: { kind: Graphic; g: G }) {
  switch (kind) {
    case "upnext":
      return <UpNext {...g} />;
    case "reconnect":
      return <Reconnect {...g} />;
    case "tracks":
      return <Tracks {...g} />;
    case "pin":
      return <Pin {...g} />;
    case "dns":
      return <Dns {...g} />;
    case "speed":
      return <Speed {...g} />;
    case "auto":
      return <Auto {...g} />;
    case "bonus":
      return <Bonus {...g} />;
  }
}

/* ───────────────────────────── graphic parts ───────────────────────────── */

function Label({ children, color = C.faint, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return (
    <div className="whitespace-nowrap text-[0.78cqw]" style={{ ...WIDE, letterSpacing: "0.2em", color, ...style }}>
      {children}
    </div>
  );
}

/** Equal-width segmented control; the highlight slides to the picked option at each time. */
function Seg({
  options,
  picks,
  local,
  accent,
  size = 1.05,
}: {
  options: string[];
  picks: [number, number][];
  local: MotionValue<number>;
  accent: string;
  size?: number;
}) {
  const pos = useTransform(local, (t) => {
    let p = picks[0][1];
    for (let i = 1; i < picks.length; i += 1) {
      const [at, idx] = picks[i];
      if (t >= at) p = picks[i - 1][1] + (idx - picks[i - 1][1]) * easeInOut(clamp01((t - at) / 0.35));
    }
    return p;
  });
  const x = useTransform(pos, (p) => `${p * 100}%`);
  return (
    <div className="relative grid rounded-full p-[0.3cqw]" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)`, background: "rgba(214,226,255,0.07)" }}>
      <div className="pointer-events-none absolute inset-[0.3cqw]">
        <motion.div className="h-full rounded-full" style={{ width: `${100 / options.length}%`, x, background: accent }} />
      </div>
      {options.map((o, i) => (
        <SegLabel key={o} text={o} index={i} pos={pos} size={size} />
      ))}
    </div>
  );
}

function SegLabel({ text, index, pos, size }: { text: string; index: number; pos: MotionValue<number>; size: number }) {
  const color = useTransform(pos, (p) => (Math.abs(p - index) < 0.5 ? "#03101F" : C.muted));
  return (
    <motion.div className="relative whitespace-nowrap py-[0.5cqw] text-center font-bold" style={{ ...BODY, fontSize: `${size}cqw`, color }}>
      {text}
    </motion.div>
  );
}

function Toggle({ local, at, accent }: { local: MotionValue<number>; at: number; accent: string }) {
  const p = useProgress(local, at, at + 0.3);
  const x = useTransform(p, (v) => `${v * 1.6}cqw`);
  const bg = useTransform(p, (v) => (v > 0.5 ? accent : "rgba(214,226,255,0.18)"));
  return (
    <motion.div className="relative h-[1.9cqw] w-[3.6cqw] shrink-0 rounded-full" style={{ background: bg }}>
      <motion.div className="absolute left-[0.25cqw] top-[0.25cqw] h-[1.4cqw] w-[1.4cqw] rounded-full bg-white" style={{ x }} />
    </motion.div>
  );
}

function Fade({ local, from, to, className, style, children }: { local: MotionValue<number>; from: number; to?: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  const opacity = useTransform(local, (t) => Math.min(clamp01((t - from) / 0.3), to === undefined ? 1 : clamp01((to - t) / 0.3)));
  return (
    <motion.div className={className} style={{ ...style, opacity }}>
      {children}
    </motion.div>
  );
}

function Ring({ size, progress, color, track = "rgba(214,226,255,0.12)", stroke = 7 }: { size: number; progress: MotionValue<number>; color: string; track?: string; stroke?: number }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: `${size}cqw`, height: `${size}cqw`, transform: "rotate(-90deg)" }}>
      <circle cx="50" cy="50" r="42" fill="none" stroke={track} strokeWidth={stroke} />
      <motion.circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" style={{ pathLength: progress }} />
    </svg>
  );
}

/* 1 · Up next countdown */
function UpNext({ local, at, accent }: G) {
  const start = at + 1.2;
  const left = useTransform(local, (t) => clamp01(1 - (t - start) / 10));
  const count = useTransform(local, (t) => `${Math.min(10, Math.max(0, Math.ceil(10 - (t - start))))}`);
  const credits = useTransform(local, (t) => `${60 + 40 * clamp01((t - at) / 11.2)}%`);
  return (
    <div className="absolute inset-0 flex items-center gap-[2cqw] px-[2.2cqw]">
      <div className="flex-1">
        <Label color={accent}>Up next</Label>
        <div className="mt-[0.6cqw] text-[2cqw]" style={DISPLAY}>
          Season 2 · Episode 5
        </div>
        <div className="mt-[0.4cqw] text-[1.05cqw]" style={{ ...BODY, color: C.muted }}>
          Starts automatically during the credits
        </div>
        <div className="mt-[1.2cqw] h-[0.4cqw] overflow-hidden rounded-full" style={{ background: "rgba(214,226,255,0.12)" }}>
          <motion.div className="h-full rounded-full" style={{ width: credits, background: accent }} />
        </div>
        <div className="mt-[0.6cqw] flex justify-between text-[0.9cqw]" style={{ ...BODY, color: C.faint }}>
          <span>Episode 4 · credits</span>
          <span>Switch 10 s before the end</span>
        </div>
      </div>
      <div className="relative shrink-0">
        <Ring size={9.5} progress={left} color={accent} />
        <Fade local={local} from={0} to={start + 10.2} className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span className="text-[3.4cqw]" style={DISPLAY}>
            {count}
          </motion.span>
          <span className="text-[0.75cqw]" style={{ ...WIDE, color: C.faint }}>
            sec
          </span>
        </Fade>
        <Fade local={local} from={start + 10.2} className="absolute inset-0 flex flex-col items-center justify-center">
          <Play size="2.6cqw" color={accent} fill={accent} />
          <span className="mt-[0.3cqw] text-[0.75cqw]" style={{ ...WIDE, color: accent }}>
            Playing
          </span>
        </Fade>
      </div>
    </div>
  );
}

/* 2 · Signal drop and reconnection, plus the quick-jump keys */
function Reconnect({ local, at, accent }: G) {
  const lostFrom = at + 1.2;
  const backAt = at + 4.0;
  const amp = useTransform(local, (t) => {
    if (t < lostFrom) return 1;
    if (t < lostFrom + 0.3) return 1 - (t - lostFrom) / 0.3;
    if (t < backAt) return 0;
    return clamp01((t - backAt) / 0.5);
  });
  const d = useTransform(local, (t) => {
    const a = amp.get();
    let path = "";
    for (let x = 0; x <= 200; x += 4) {
      const y = 30 + a * (Math.sin(x * 0.11 - t * 5) * 14 + Math.sin(x * 0.27 - t * 9) * 5);
      path += `${x === 0 ? "M" : "L"}${x},${y.toFixed(1)} `;
    }
    return path;
  });
  const lost = useTransform(amp, (a) => 1 - a);
  const spin = useTransform(local, (t) => t * 300);
  const keys: { at: number; text: string; icon: Icon }[] = [
    { at: 7.6, text: "Previous channel", icon: SkipBack },
    { at: 8.4, text: "Next channel", icon: SkipForward },
    { at: 10.6, text: "Back 10 s", icon: Rewind },
    { at: 11.3, text: "Forward 10 s", icon: FastForward },
  ];
  return (
    <div className="absolute inset-0 flex gap-[2cqw] p-[1.8cqw]">
      <div className="relative w-[21cqw] shrink-0">
        <div className="relative h-[3cqw]">
          <Fade local={local} from={0} to={lostFrom} className="absolute inset-0 flex items-center gap-[0.6cqw]">
            <span className="h-[0.8cqw] w-[0.8cqw] rounded-full" style={{ background: C.mint }} />
            <Label color={C.mint}>Live</Label>
          </Fade>
          <Fade local={local} from={lostFrom} to={backAt} className="absolute inset-0 flex items-center gap-[0.6cqw]">
            <motion.span style={{ rotate: spin, display: "flex" }}>
              <RefreshCw size="1.1cqw" color={C.amber} strokeWidth={2.4} />
            </motion.span>
            <Label color={C.amber}>Signal lost · reconnecting</Label>
          </Fade>
          <Fade local={local} from={backAt} className="absolute inset-0 flex items-center gap-[0.6cqw]">
            <Check size="1.1cqw" color={C.mint} strokeWidth={3} />
            <Label color={C.mint}>Back live, by itself</Label>
          </Fade>
        </div>
        <svg viewBox="0 0 200 60" className="mt-[0.6cqw] w-full" style={{ height: "9.5cqw" }} preserveAspectRatio="none">
          <motion.path d={d} fill="none" stroke={accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <motion.line x1="0" y1="30" x2="200" y2="30" stroke={C.amber} strokeWidth={3} strokeDasharray="6 8" style={{ opacity: lost }} />
        </svg>
      </div>
      <div className="grid flex-1 grid-cols-2 content-center gap-[0.9cqw]">
        {keys.map((k) => (
          <KeyChip key={k.text} item={k} local={local} accent={accent} />
        ))}
      </div>
    </div>
  );
}

function KeyChip({ item, local, accent }: { item: { at: number; text: string; icon: Icon }; local: MotionValue<number>; accent: string }) {
  const p = useProgress(local, item.at, item.at + 0.4);
  const scale = useTransform(p, (v) => 0.85 + 0.15 * v);
  const Glyph = item.icon;
  return (
    <motion.div className="flex flex-col items-center gap-[0.6cqw] rounded-[1cqw] py-[1.1cqw]" style={{ opacity: p, scale, background: `${accent}14`, boxShadow: `inset 0 0 0 0.07cqw ${accent}55` }}>
      <Glyph size="1.7cqw" color={accent} strokeWidth={2.2} />
      <span className="whitespace-nowrap text-[1cqw] font-semibold" style={BODY}>
        {item.text}
      </span>
    </motion.div>
  );
}

/* 3 · Audio, subtitles and picture menu (tall card next to the phone) */
function Tracks({ local, accent }: G) {
  const rows: { label: string; icon: Icon; options: string[]; picks: [number, number][]; at: number }[] = [
    { label: "Audio", icon: AudioLines, options: ["English", "Italiano", "Español"], picks: [[0, 0], [5.0, 1], [5.9, 0]], at: 4.4 },
    { label: "Subtitles", icon: Subtitles, options: ["Off", "English", "Français"], picks: [[0, 0], [6.9, 1]], at: 6.4 },
    { label: "Picture", icon: Maximize, options: ["Fit", "Fill", "Zoom"], picks: [[0, 0], [8.9, 1], [9.8, 0]], at: 8.4 },
  ];
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-[2.2cqw] px-[1.8cqw]">
      <Label color={accent}>Picture menu</Label>
      {rows.map((r) => (
        <TrackRow key={r.label} row={r} local={local} accent={accent} />
      ))}
    </div>
  );
}

function TrackRow({ row, local, accent }: { row: { label: string; icon: Icon; options: string[]; picks: [number, number][]; at: number }; local: MotionValue<number>; accent: string }) {
  const focus = useTransform(local, (t) => (t >= row.at ? 1 : 0.45));
  const Glyph = row.icon;
  return (
    <motion.div style={{ opacity: focus }}>
      <div className="mb-[0.7cqw] flex items-center gap-[0.5cqw] text-[1.15cqw] font-bold" style={BODY}>
        <Glyph size="1.2cqw" color={accent} strokeWidth={2.2} />
        {row.label}
      </div>
      <Seg options={row.options} picks={row.picks} local={local} accent={accent} size={0.95} />
    </motion.div>
  );
}

/* 4 · Categories, PIN keypad, lock */
function Pin({ local, at, accent }: G) {
  const cats = [
    { text: "Late-night films", at: at + 0.6 },
    { text: "Horror", at: at + 1.2 },
    { text: "Adults only", at: at + 1.8 },
  ];
  const presses = [5.6, 6.1, 6.6, 7.1];
  const digits = ["2", "5", "8", "0"];
  const lockAt = 7.7;
  return (
    <div className="absolute inset-0 flex gap-[2.4cqw] p-[1.8cqw]">
      <div className="flex flex-1 flex-col justify-center gap-[0.9cqw]">
        <Label color={accent}>Protected categories</Label>
        {cats.map((c) => (
          <CatRow key={c.text} text={c.text} at={c.at} lockAt={lockAt} local={local} accent={accent} />
        ))}
      </div>
      <div className="flex w-[17cqw] shrink-0 flex-col items-center justify-center">
        <div className="flex gap-[0.9cqw]">
          {presses.map((p) => (
            <PinDot key={p} at={p} local={local} accent={accent} />
          ))}
        </div>
        <div className="mt-[1.1cqw] grid grid-cols-3 gap-[0.5cqw]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", ""].map((k, i) => (
            <PadKey key={i} label={k} at={digits.indexOf(k) >= 0 ? presses[digits.indexOf(k)] : -1} local={local} accent={accent} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CatRow({ text, at, lockAt, local, accent }: { text: string; at: number; lockAt: number; local: MotionValue<number>; accent: string }) {
  const p = useProgress(local, at, at + 0.4);
  const locked = useProgress(local, lockAt, lockAt + 0.3);
  const unlocked = useTransform(locked, (v) => 1 - v);
  return (
    <motion.div className="flex items-center justify-between rounded-[0.8cqw] px-[1cqw] py-[0.65cqw]" style={{ opacity: p, background: "rgba(214,226,255,0.06)" }}>
      <span className="whitespace-nowrap text-[1.15cqw] font-semibold" style={BODY}>
        {text}
      </span>
      <span className="relative h-[1.3cqw] w-[1.3cqw]">
        <motion.span className="absolute inset-0 flex" style={{ opacity: unlocked }}>
          <Check size="1.3cqw" color={C.muted} strokeWidth={3} />
        </motion.span>
        <motion.span className="absolute inset-0 flex" style={{ opacity: locked }}>
          <Lock size="1.3cqw" color={accent} strokeWidth={2.4} />
        </motion.span>
      </span>
    </motion.div>
  );
}

function PinDot({ at, local, accent }: { at: number; local: MotionValue<number>; accent: string }) {
  const p = useProgress(local, at, at + 0.15);
  const bg = useTransform(p, (v) => (v > 0.5 ? accent : "rgba(214,226,255,0.16)"));
  return <motion.span className="h-[1.1cqw] w-[1.1cqw] rounded-full" style={{ background: bg }} />;
}

function PadKey({ label, at, local, accent }: { label: string; at: number; local: MotionValue<number>; accent: string }) {
  const hit = useTransform(local, (t) => (at >= 0 && t >= at && t < at + 0.35 ? 1 : 0));
  const bg = useTransform(hit, (v) => (v ? accent : "rgba(214,226,255,0.07)"));
  const color = useTransform(hit, (v) => (v ? "#1A1200" : C.text));
  if (!label) return <span className="h-[2.1cqw] w-[4.4cqw]" />;
  return (
    <motion.span className="flex h-[2.1cqw] w-[4.4cqw] items-center justify-center rounded-[0.6cqw] text-[1.1cqw] font-bold" style={{ ...BODY, background: bg, color }}>
      {label}
    </motion.span>
  );
}

/* 5 · TV → DNS → server, slow then fast, then the test */
function Dns({ local, at, accent }: G) {
  const fixAt = 10.4;
  const fixed = useProgress(local, fixAt, fixAt + 0.5);
  const slow = useTransform(fixed, (v) => 1 - v);
  return (
    <div className="absolute inset-0 flex flex-col justify-center px-[2.2cqw]">
      <div className="flex items-center">
        <Node icon={Tv} label="Your TV" color={C.text} />
        <Wire local={local} slow={slow} fixed={fixed} accent={accent} />
        <div className="relative flex w-[11cqw] shrink-0 flex-col items-center">
          <div className="relative h-[4.4cqw] w-[4.4cqw]">
            <motion.div className="absolute inset-0 flex items-center justify-center rounded-[1.1cqw]" style={{ opacity: slow, background: `${C.amber}1F`, boxShadow: `inset 0 0 0 0.08cqw ${C.amber}88` }}>
              <Clock3 size="2cqw" color={C.amber} />
            </motion.div>
            <motion.div className="absolute inset-0 flex items-center justify-center rounded-[1.1cqw]" style={{ opacity: fixed, background: `${accent}1F`, boxShadow: `inset 0 0 0 0.08cqw ${accent}88` }}>
              <ShieldCheck size="2cqw" color={accent} />
            </motion.div>
          </div>
          <div className="relative mt-[0.6cqw] h-[1.4cqw] w-full">
            <motion.div className="absolute inset-0 text-center text-[1cqw] font-bold" style={{ ...BODY, opacity: slow, color: C.amber }}>
              Network DNS
            </motion.div>
            <motion.div className="absolute inset-0 whitespace-nowrap text-center text-[1cqw] font-bold" style={{ ...BODY, opacity: fixed, color: accent }}>
              DNS over HTTPS
            </motion.div>
          </div>
        </div>
        <Wire local={local} slow={slow} fixed={fixed} accent={accent} />
        <Node icon={Server} label="Provider" color={C.text} />
      </div>
      <div className="mt-[1.4cqw] flex items-center justify-between">
        <Fade local={local} from={at + 0.6} className="text-[1.05cqw]" style={{ ...MONO, color: C.muted }}>
          <motion.span style={{ opacity: slow }}>Playlist: loading… 0 %</motion.span>
        </Fade>
        <Fade local={local} from={14.8} className="flex items-center gap-[0.5cqw] rounded-full px-[1cqw] py-[0.45cqw]" style={{ background: `${accent}22` }}>
          <Check size="1.1cqw" color={accent} strokeWidth={3} />
          <span className="whitespace-nowrap text-[1cqw] font-bold" style={{ ...BODY, color: accent }}>
            DNS test passed
          </span>
        </Fade>
      </div>
    </div>
  );
}

function Node({ icon: Glyph, label, color }: { icon: Icon; label: string; color: string }) {
  return (
    <div className="flex w-[7cqw] shrink-0 flex-col items-center">
      <div className="flex h-[4.4cqw] w-[4.4cqw] items-center justify-center rounded-[1.1cqw]" style={{ background: "rgba(214,226,255,0.07)" }}>
        <Glyph size="2cqw" color={color} />
      </div>
      <div className="mt-[0.6cqw] h-[1.4cqw] whitespace-nowrap text-[1cqw] font-bold" style={{ ...BODY, color: C.muted }}>
        {label}
      </div>
    </div>
  );
}

function Wire({ local, slow, fixed, accent }: { local: MotionValue<number>; slow: MotionValue<number>; fixed: MotionValue<number>; accent: string }) {
  const slowX = useTransform(local, (t) => `${((t * 0.18) % 1) * 100}%`);
  const fastX = useTransform(local, (t) => `${((t * 0.9) % 1) * 100}%`);
  const fastX2 = useTransform(local, (t) => `${((t * 0.9 + 0.5) % 1) * 100}%`);
  return (
    <div className="relative mb-[2cqw] h-[0.3cqw] flex-1 rounded-full" style={{ background: "rgba(214,226,255,0.14)" }}>
      <motion.span className="absolute top-1/2 h-[0.9cqw] w-[0.9cqw] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: slowX, opacity: slow, background: C.amber }} />
      <motion.span className="absolute top-1/2 h-[0.9cqw] w-[0.9cqw] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: fastX, opacity: fixed, background: accent }} />
      <motion.span className="absolute top-1/2 h-[0.9cqw] w-[0.9cqw] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: fastX2, opacity: fixed, background: accent }} />
    </div>
  );
}

/* 6 · Speed gauge, then the buffer slider */
function Speed({ local, at, accent }: G) {
  const sweep = useTransform(local, [at + 0.6, at + 3.4], [0, 0.78], { clamp: true, ease: easeInOut });
  const mbps = useTransform(sweep, (v) => `${Math.round((v / 0.78) * 86)}`);
  const knob = useTransform(local, (t) => {
    const keys: [number, number][] = [
      [0, 0.4],
      [11.6, 0.9],
      [13.8, 0.1],
      [15.6, 0.4],
    ];
    let v = keys[0][1];
    for (let i = 1; i < keys.length; i += 1) if (t >= keys[i][0]) v = keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * easeInOut(clamp01((t - keys[i][0]) / 0.7));
    return v;
  });
  const knobX = useTransform(knob, (v) => `${v * 100}%`);
  const seconds = useTransform(knob, (v) => `${Math.round((10 + v * 50) / 5) * 5} s`);
  return (
    <div className="absolute inset-0 flex items-center gap-[2.6cqw] px-[2.2cqw]">
      <div className="relative w-[15cqw] shrink-0">
        <svg viewBox="0 0 100 60" className="w-full">
          <path d="M10 55 A40 40 0 0 1 90 55" fill="none" stroke="rgba(214,226,255,0.12)" strokeWidth={8} strokeLinecap="round" />
          <motion.path d="M10 55 A40 40 0 0 1 90 55" fill="none" stroke={accent} strokeWidth={8} strokeLinecap="round" style={{ pathLength: useTransform(sweep, (v) => v / 0.78 * 0.999) }} />
        </svg>
        <div className="absolute inset-x-0 bottom-[0.2cqw] flex flex-col items-center">
          <motion.span className="text-[3cqw] leading-none" style={DISPLAY}>
            {mbps}
          </motion.span>
          <span className="text-[0.75cqw]" style={{ ...WIDE, color: C.faint }}>
            Mbps
          </span>
        </div>
      </div>
      <div className="flex-1">
        <Fade local={local} from={at + 3.8}>
          <div className="flex items-center gap-[0.6cqw] text-[1.1cqw] font-semibold" style={BODY}>
            <Check size="1.1cqw" color={accent} strokeWidth={3} />
            Plenty for HD streaming
          </div>
        </Fade>
        <Fade local={local} from={10.4} className="mt-[1.6cqw]">
          <div className="flex items-baseline justify-between">
            <Label color={accent}>Buffer</Label>
            <motion.span className="text-[1.6cqw]" style={DISPLAY}>
              {seconds}
            </motion.span>
          </div>
          <div className="relative mt-[0.8cqw] h-[0.4cqw] rounded-full" style={{ background: "rgba(214,226,255,0.14)" }}>
            <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ width: knobX, background: accent }} />
            <motion.span className="absolute top-1/2 h-[1.5cqw] w-[1.5cqw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ left: knobX }} />
          </div>
          <div className="mt-[0.8cqw] flex justify-between text-[0.95cqw]" style={{ ...BODY, color: C.muted }}>
            <span>Shorter: faster start</span>
            <span>Longer: steadier</span>
          </div>
        </Fade>
      </div>
    </div>
  );
}

/* 7 · Update schedule, guide toggle, fresh lists */
function Auto({ local, at, accent }: G) {
  const items = [
    { text: "Channels", at: 10.6 },
    { text: "Films & series", at: 11.2 },
    { text: "TV guide", at: 11.8 },
  ];
  const spin = useTransform(local, (t) => (t > 10.4 ? (t - 10.4) * 220 : 0));
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-[1.3cqw] px-[2.2cqw]">
      <div className="flex items-center justify-between">
        <Label color={accent}>Automatic list update</Label>
        <motion.span style={{ rotate: spin, display: "flex" }}>
          <RefreshCw size="1.3cqw" color={accent} strokeWidth={2.4} />
        </motion.span>
      </div>
      <Seg options={["Manual", "Once a day", "Once a week"]} picks={[[0, 0], [at + 2.6, 1], [at + 4.2, 2], [at + 5.4, 1]]} local={local} accent={accent} />
      <div className="flex items-center justify-between">
        <span className="text-[1.15cqw] font-semibold" style={BODY}>
          Update the TV guide too
        </span>
        <Toggle local={local} at={8.4} accent={accent} />
      </div>
      <div className="flex gap-[0.8cqw]">
        {items.map((i) => (
          <Fade key={i.text} local={local} from={i.at} className="flex items-center gap-[0.4cqw] rounded-full px-[0.9cqw] py-[0.4cqw]" style={{ background: `${accent}1C` }}>
            <Check size="1cqw" color={accent} strokeWidth={3} />
            <span className="whitespace-nowrap text-[0.95cqw] font-semibold" style={BODY}>
              {i.text}
            </span>
          </Fade>
        ))}
      </div>
    </div>
  );
}

/* Bonus · theme and languages */
const HELLO = ["Hello", "Ciao", "Hola", "Bonjour", "Hallo", "Olá", "Salut", "Merhaba"];
const LANGS = ["EN", "IT", "ES", "FR", "DE", "PT", "RO", "TR"];

function Bonus({ local, accent }: G) {
  const langStart = 6.0;
  const idx = useTransform(local, (t) => (t < langStart ? 0 : Math.floor((t - langStart) / 0.55) % LANGS.length));
  return (
    <div className="absolute inset-0 flex items-center gap-[2.4cqw] px-[2.2cqw]">
      <div className="w-[19cqw] shrink-0">
        <Label color={accent}>Theme</Label>
        <div className="mt-[0.8cqw]">
          <Seg options={["Auto", "Light", "Dark"]} picks={[[0, 0], [2.6, 1], [3.6, 2], [4.8, 0]]} local={local} accent={accent} size={0.95} />
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-baseline justify-between">
          <Label color={accent}>8 languages</Label>
          <div className="relative h-[2.2cqw] w-[11cqw]">
            {HELLO.map((h, i) => (
              <HelloWord key={h} word={h} index={i} idx={idx} />
            ))}
          </div>
        </div>
        <div className="mt-[0.8cqw] grid grid-cols-8 gap-[0.4cqw]">
          {LANGS.map((l, i) => (
            <LangChip key={l} code={l} index={i} idx={idx} local={local} start={langStart} accent={accent} />
          ))}
        </div>
      </div>
    </div>
  );
}

function HelloWord({ word, index, idx }: { word: string; index: number; idx: MotionValue<number> }) {
  const opacity = useTransform(idx, (v) => (v === index ? 1 : 0));
  return (
    <motion.span className="absolute right-0 top-0 whitespace-nowrap text-[2cqw]" style={{ ...DISPLAY, opacity }}>
      {word}
    </motion.span>
  );
}

function LangChip({ code, index, idx, local, start, accent }: { code: string; index: number; idx: MotionValue<number>; local: MotionValue<number>; start: number; accent: string }) {
  const on = useTransform(local, (t) => (t >= start && idx.get() === index ? 1 : 0));
  const bg = useTransform(on, (v) => (v ? accent : "rgba(214,226,255,0.07)"));
  const color = useTransform(on, (v) => (v ? "#1A1200" : C.muted));
  return (
    <motion.span className="flex h-[2.2cqw] items-center justify-center rounded-[0.5cqw] text-[0.9cqw] font-bold" style={{ ...BODY, background: bg, color }}>
      {code}
    </motion.span>
  );
}

/* ───────────────────────────── recap & outro ───────────────────────────── */

function RecapScene({ scene, clock, reducedMotion }: Props<"recap">) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  return (
    <Section {...shell}>
      <div className="absolute inset-x-0 top-[6.5cqw] flex flex-col items-center">
        <Rise local={local} at={0.1} reducedMotion={reducedMotion}>
          <Kicker text="Recap" color={C.mint} />
        </Rise>
        <Rise local={local} at={0.25} reducedMotion={reducedMotion} distance={1.6}>
          <h2 className="mt-[1cqw] text-[4.4cqw]" style={DISPLAY}>
            7 features, <span style={gradientText(C.mint)}>all yours.</span>
          </h2>
        </Rise>
      </div>
      <div className="absolute left-1/2 top-[19cqw] flex w-[84cqw] -translate-x-1/2 flex-wrap justify-center gap-[1.6cqw]">
        {scene.tiles.map((tile, i) => (
          <RecapTile key={tile.text} tile={tile} n={i + 1} local={local} reducedMotion={reducedMotion} />
        ))}
      </div>
    </Section>
  );
}

function RecapTile({ tile, n, local, reducedMotion }: { tile: { at: number; text: string; icon: Icon }; n: number; local: MotionValue<number>; reducedMotion: boolean }) {
  const scale = usePop(local, tile.at, reducedMotion, 0.8);
  const opacity = useProgress(local, tile.at, tile.at + 0.3);
  const Glyph = tile.icon;
  const accent = [C.mint, C.cyan, C.blue, C.amber, C.mint, C.cyan, C.mint][n - 1];
  return (
    <motion.div
      className="flex h-[13cqw] w-[19.4cqw] flex-col justify-between rounded-[1.4cqw] p-[1.6cqw]"
      style={{ scale, opacity, background: "linear-gradient(180deg, #111A31 0%, #0C1326 100%)", boxShadow: `0 0 0 0.07cqw ${accent}55, 0 1.4cqw 3.4cqw rgba(0,0,0,0.4)` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[2.6cqw]" style={{ ...DISPLAY, ...gradientText(accent) }}>
          {`0${n}`}
        </span>
        <Glyph size="2.2cqw" color={accent} strokeWidth={2} />
      </div>
      <span className="whitespace-nowrap text-[1.7cqw] font-bold" style={BODY}>
        {tile.text}
      </span>
    </motion.div>
  );
}

function OutroScene({ scene, clock, reducedMotion }: Props<"outro">) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  return (
    <Section {...shell}>
      <div className="absolute left-1/2 top-[6.5cqw] -translate-x-1/2">
        <LogoMark size={12} local={local} reducedMotion={reducedMotion} />
      </div>
      <div className="absolute inset-x-0 top-[22.5cqw] flex flex-col items-center text-center">
        <Rise local={local} at={0.4} reducedMotion={reducedMotion} distance={2}>
          <h1 className="text-[6.2cqw]" style={DISPLAY}>
            NovaStream
          </h1>
        </Rise>
        <Rise local={local} at={2.3} reducedMotion={reducedMotion}>
          <p className="mt-[1cqw] text-[1.9cqw] font-semibold" style={{ ...BODY, color: C.muted }}>
            Add your own playlist. Try these tonight.
          </p>
        </Rise>
        <div className="mt-[2.4cqw] flex items-center gap-[1.6cqw]">
          <Rise local={local} at={0.9} reducedMotion={reducedMotion}>
            <CtaPill text="Get it on Google Play" size={1.6} icon={Play} />
          </Rise>
          <Rise local={local} at={scene.subscribeAt} reducedMotion={reducedMotion}>
            <div className="flex items-center gap-[0.7cqw] rounded-full px-[2cqw] py-[1.1cqw] text-[1.6cqw] font-bold" style={{ ...BODY, background: "rgba(214,226,255,0.08)", boxShadow: "inset 0 0 0 0.08cqw rgba(214,226,255,0.25)" }}>
              <Bell size="1.5cqw" color={C.amber} strokeWidth={2.4} />
              Subscribe for the next tip
            </div>
          </Rise>
        </div>
        <Rise local={local} at={3.2} reducedMotion={reducedMotion} className="mt-[2.6cqw] flex items-center gap-[2cqw] text-[1.05cqw]" style={{ ...BODY, color: C.faint }}>
          <span className="flex items-center gap-[0.5cqw]">
            <Globe size="1cqw" color={C.mint} />
            novastreamapp.com
          </span>
          <span>NovaStream is a player: no channels or content included.</span>
        </Rise>
      </div>
    </Section>
  );
}

