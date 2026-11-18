import type { CSSProperties, ReactNode } from "react";
import { MotionPlayer, type FilmLayerProps, type SceneContent, type SceneRenderProps } from "./motion-player";
import { motion, useTransform, type MotionValue } from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  Ban,
  Bell,
  Check,
  Clapperboard,
  Clock3,
  FileText,
  Gauge,
  Globe,
  Image as ImageIcon,
  Info,
  KeyRound,
  Layers,
  Link2,
  ListVideo,
  Lock,
  MonitorPlay,
  MousePointerClick,
  Play,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  TabletSmartphone,
  Tv,
  TvMinimal,
  User,
  Users,
  Film,
  CalendarClock,
  Router,
} from "lucide-react";
import {
  BODY,
  BrowserFrame,
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
 * "M3U, Xtream codes & EPG explained" — horizontal tutorial (1920 × 1080), English narration.
 * Language of this film: an editorial glossary. Each term gets a dictionary entry on the left (huge term, part of
 * speech, plain-English definition) and a drawn or real example on the right. Troubleshooting uses a checklist
 * that ticks itself beside the real settings screen.
 */

type Point = { at: number; text: string; icon: Icon };
type Title = [string, string];
type TermVisual = "m3u" | "xtream" | "epg";

type FilmScene = SceneContent &
  (
    | { id: "hook"; layout: "hook" }
    | { id: string; layout: "player"; accent: string; steps: Point[]; flowAt: number }
    | { id: string; layout: "term"; accent: string; term: string; kind: string; definition: string; points: Point[]; visual: TermVisual }
    | { id: string; layout: "which"; accent: string; xtreamAt: number; m3uAt: number }
    | { id: string; layout: "devices"; accent: string; chips: Point[]; adaptAt: number }
    | { id: string; layout: "steps"; accent: string; kicker: string; title: Title; steps: Point[]; numbered: boolean; device: "app" | "web"; shots: Shot[]; url?: string }
    | { id: string; layout: "fix"; accent: string; n: number; title: Title; checks: (Point & { info?: boolean })[]; shots: Shot[] }
    | { id: "outro"; layout: "outro" }
  );

const SET = 2.693;
const APP = 2.667;
const WEB = 1.6;
const Z = 1.4;

const content: FilmScene[] = [
  {
    id: "hook",
    layout: "hook",
    chapter: "Intro",
    voiceover: "/rork-vo-hook-v1.mp3",
    effects: [
      { src: "/rork-sfx-pop-v1.mp3", at: 0.55, volume: 0.22 },
      { src: "/rork-sfx-pop-v1.mp3", at: 1.55, volume: 0.22 },
      { src: "/rork-sfx-pop-v1.mp3", at: 2.65, volume: 0.22 },
    ],
  },
  {
    id: "player",
    layout: "player",
    chapter: "The basics",
    accent: C.mint,
    steps: [
      { at: 4.2, text: "No channels included", icon: Ban },
      { at: 7.0, text: "Your playlist comes from your provider", icon: Link2 },
      { at: 10.8, text: "Only use playlists you're allowed to watch", icon: ShieldCheck },
    ],
    flowAt: 6.6,
    voiceover: "/rork-vo-player-v1.mp3",
  },
  {
    id: "m3u",
    layout: "term",
    chapter: "M3U",
    accent: C.cyan,
    term: "M3U",
    kind: "noun · playlist format",
    definition: "A plain text file, or a link to one, that lists channels and where to stream them.",
    points: [],
    visual: "m3u",
    voiceover: "/rork-vo-m3u-v1.mp3",
    effects: [{ src: "/rork-sfx-whoosh-v1.mp3", at: 0.1, volume: 0.18 }],
  },
  {
    id: "xtream",
    layout: "term",
    chapter: "Xtream codes",
    accent: C.blue,
    term: "XTREAM",
    kind: "noun · sign-in method",
    definition: "Three details from your provider instead of one long link: server, username and password.",
    points: [],
    visual: "xtream",
    voiceover: "/rork-vo-xtream-v1.mp3",
    effects: [{ src: "/rork-sfx-whoosh-v1.mp3", at: 0.1, volume: 0.18 }],
  },
  {
    id: "which",
    layout: "which",
    chapter: "Which one?",
    accent: C.amber,
    xtreamAt: 2.2,
    m3uAt: 7.6,
    voiceover: "/rork-vo-which-v1.mp3",
  },
  {
    id: "epg",
    layout: "term",
    chapter: "EPG",
    accent: C.mint,
    term: "EPG",
    kind: "noun · electronic programme guide",
    definition: "The TV guide: what's on now and what's next, usually shipped as an XMLTV file.",
    points: [
      { at: 5.6, text: "What's on now", icon: Clock3 },
      { at: 7.2, text: "What's next", icon: CalendarClock },
      { at: 9.4, text: "Comes as an XMLTV file", icon: FileText },
    ],
    visual: "epg",
    voiceover: "/rork-vo-epg-v1.mp3",
    effects: [{ src: "/rork-sfx-whoosh-v1.mp3", at: 0.1, volume: 0.18 }],
  },
  {
    id: "devices",
    layout: "devices",
    chapter: "Where to watch",
    accent: C.cyan,
    chips: [
      { at: 2.2, text: "Android TV", icon: Tv },
      { at: 3.4, text: "TV boxes & sticks", icon: Router },
      { at: 5.2, text: "Android phones", icon: Smartphone },
      { at: 6.0, text: "Tablets", icon: TabletSmartphone },
    ],
    adaptAt: 7.4,
    voiceover: "/rork-vo-devices-v1.mp3",
    minSeconds: 12,
  },
  {
    id: "setup",
    layout: "steps",
    chapter: "Set it up",
    accent: C.blue,
    kicker: "Set up · About a minute",
    title: ["Add your ", "playlist."],
    numbered: true,
    steps: [
      { at: 2.4, text: "Open Accounts", icon: Users },
      { at: 3.8, text: "Pick M3U, Xtream or private host", icon: ListVideo },
      { at: 7.0, text: "Fill in the fields and import", icon: MousePointerClick },
      { at: 9.4, text: "Encrypted, stays on the device", icon: Lock },
    ],
    device: "app",
    shots: [
      { src: `${M}/app-accounts-v1.jpg`, ratio: 2.906, at: 0 },
      { src: `${M}/app-m3uform-v1.jpg`, ratio: APP, at: 3.8 },
      { src: `${M}/app-privatehost-v1.jpg`, ratio: 2.906, at: 5.8 },
      { src: `${M}/app-accounts-v1.jpg`, ratio: 2.906, at: 9.4 },
    ],
    voiceover: "/rork-vo-setup-v1.mp3",
  },
  {
    id: "phone",
    layout: "steps",
    chapter: "From your phone",
    accent: C.mint,
    kicker: "Shortcut · No remote typing",
    title: ["Send it from ", "your phone."],
    numbered: true,
    steps: [
      { at: 2.6, text: "Open novastreamapp.com/playlist", icon: Globe },
      { at: 6.8, text: "Enter the device and its key", icon: KeyRound },
      { at: 9.6, text: "Send the playlist to the TV", icon: Send },
    ],
    device: "web",
    url: "novastreamapp.com/playlist",
    shots: [
      { src: `${M}/site-pl-open-v1.jpg`, ratio: 1.6, frame: WEB, at: 0, zoom: Z, pan: [3.4, 6.6] },
      { src: `${M}/site-pl-list-v1.jpg`, ratio: 1920 / 2280, frame: WEB, at: 9.2, zoom: Z, pan: [9.8, 11.8] },
    ],
    voiceover: "/rork-vo-phone-v1.mp3",
    minSeconds: 13,
  },
  {
    id: "fix1",
    layout: "fix",
    chapter: "Troubleshooting",
    accent: C.coral,
    n: 1,
    title: ["Playlist ", "won't load?"],
    checks: [
      { at: 4.2, text: "Open the link in a browser", icon: Globe },
      { at: 7.2, text: "Check your subscription is active", icon: RefreshCw },
    ],
    shots: [
      { src: `${M}/app-m3uform-v1.jpg`, ratio: APP, at: 0 },
      { src: `${M}/app-accounts-v1.jpg`, ratio: 2.906, at: 7.0 },
    ],
    voiceover: "/rork-vo-fix1-v1.mp3",
    minSeconds: 13,
    effects: [{ src: "/rork-sfx-whoosh-v1.mp3", at: 0.1, volume: 0.2 }],
  },
  {
    id: "fix2",
    layout: "fix",
    accent: C.amber,
    n: 2,
    title: ["Empty ", "TV guide?"],
    checks: [
      { at: 2.0, text: "Add a guide link (XMLTV)", icon: Link2 },
      { at: 3.8, text: "Settings › TV guide › Update", icon: RefreshCw },
      { at: 6.8, text: "Some providers list only a few days", icon: Info, info: true },
    ],
    shots: [{ src: `${M}/app-set-mid-v1.jpg`, ratio: SET, at: 0 }],
    voiceover: "/rork-vo-fix2-v1.mp3",
    minSeconds: 13,
  },
  {
    id: "fix3",
    layout: "fix",
    accent: C.cyan,
    n: 3,
    title: ["Constant ", "buffering?"],
    checks: [
      { at: 1.6, text: "Run the speed test", icon: Gauge },
      { at: 3.2, text: "Give the player a longer buffer", icon: SlidersHorizontal },
      { at: 5.2, text: "Slow server? Try a custom DNS", icon: ShieldCheck },
    ],
    shots: [
      { src: `${M}/app-set-low-v1.jpg`, ratio: SET, at: 0 },
      { src: `${M}/app-set-player-v1.jpg`, ratio: SET, at: 3.2 },
      { src: `${M}/app-set-low-v1.jpg`, ratio: SET, at: 5.2 },
    ],
    voiceover: "/rork-vo-fix3-v1.mp3",
    minSeconds: 11,
  },
  {
    id: "outro",
    layout: "outro",
    chapter: "Get the app",
    voiceover: "/rork-vo-outro-v1.mp3",
    minSeconds: 11,
    effects: [{ src: "/rork-sfx-pop-v1.mp3", at: 0.2, volume: 0.24 }],
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
      Overlay={BrandMark}
      transitionSeconds={TRANSITION_SECONDS}
    />
  );
}

function FilmSceneView(props: SceneRenderProps<FilmScene>) {
  const { scene } = props;
  switch (scene.layout) {
    case "hook":
      return <HookScene {...props} scene={scene} />;
    case "player":
      return <PlayerScene {...props} scene={scene} />;
    case "term":
      return <TermScene {...props} scene={scene} />;
    case "which":
      return <WhichScene {...props} scene={scene} />;
    case "devices":
      return <DevicesScene {...props} scene={scene} />;
    case "steps":
      return <StepsScene {...props} scene={scene} />;
    case "fix":
      return <FixScene {...props} scene={scene} />;
    case "outro":
      return <OutroScene {...props} scene={scene} />;
  }
}

type Props<L extends FilmScene["layout"]> = SceneRenderProps<Extract<FilmScene, { layout: L }>>;

function useShell(scene: { start: number; end: number }, clock: MotionValue<number>, reducedMotion: boolean) {
  return useSceneShell(scene, clock, reducedMotion, TRANSITION_SECONDS);
}

function Backdrop({ clock, activeScene, reducedMotion }: FilmLayerProps<FilmScene>) {
  const accent = "accent" in activeScene ? activeScene.accent : C.blue;
  return <Pools clock={clock} accent={accent} reducedMotion={reducedMotion} />;
}

function BrandMark({ clock, scenes }: FilmLayerProps<FilmScene>) {
  const first = scenes[0];
  const last = scenes[scenes.length - 1];
  const opacity = useTransform(clock, (t) => Math.max(0, Math.min(1, (t - first.end) / TRANSITION_SECONDS, (last.start - t) / TRANSITION_SECONDS)));
  return (
    <motion.div className="absolute right-[6cqw] top-[3cqw] flex items-center gap-[0.8cqw]" style={{ opacity }}>
      <img src={`${M}/ns-icon-v1.png`} alt="" draggable={false} className="h-[2.4cqw] w-[2.4cqw] rounded-[0.55cqw]" />
      <div className="text-[1.1cqw] font-bold leading-none" style={{ ...BODY, color: C.text }}>
        NovaStream
      </div>
    </motion.div>
  );
}

/* ───────────────────────────── small parts ───────────────────────────── */

function Step({ step, index, numbered, local, accent, reducedMotion }: { step: Point; index: number; numbered: boolean; local: MotionValue<number>; accent: string; reducedMotion: boolean }) {
  const Glyph = step.icon;
  return (
    <Rise local={local} at={step.at} reducedMotion={reducedMotion} className="flex items-center gap-[1cqw]">
      <span
        className="flex h-[3cqw] w-[3cqw] shrink-0 items-center justify-center rounded-[0.85cqw] text-[1.4cqw]"
        style={{ ...DISPLAY, background: `${accent}1F`, boxShadow: `inset 0 0 0 0.08cqw ${accent}66`, color: accent }}
      >
        {numbered ? index + 1 : <Glyph size="1.45cqw" strokeWidth={2.2} color={accent} />}
      </span>
      <span className="whitespace-nowrap text-[1.42cqw] font-semibold" style={{ ...BODY, color: C.text }}>
        {step.text}
      </span>
    </Rise>
  );
}

function Chip({ point, local, accent, reducedMotion, size = 1.3 }: { point: Point; local: MotionValue<number>; accent: string; reducedMotion: boolean; size?: number }) {
  const Glyph = point.icon;
  return (
    <Rise
      local={local}
      at={point.at}
      reducedMotion={reducedMotion}
      className="flex items-center whitespace-nowrap rounded-full font-semibold"
      style={{ ...BODY, fontSize: `${size}cqw`, gap: `${size * 0.5}cqw`, padding: `${size * 0.5}cqw ${size}cqw`, background: `${accent}17`, boxShadow: `inset 0 0 0 0.08cqw ${accent}55` }}
    >
      <Glyph size={`${size}cqw`} strokeWidth={2.2} color={accent} />
      {point.text}
    </Rise>
  );
}

function AppDevice({ shots, width, local, accent, reducedMotion }: { shots: Shot[]; width: number; local: MotionValue<number>; accent: string; reducedMotion: boolean }) {
  const height = useFrameHeight(local, shots, width);
  return (
    <DeviceFrame width={width} height={height} accent={accent} bezel={0.6} radius={1.8}>
      <ShotStack shots={shots} local={local} width={width} reducedMotion={reducedMotion} />
    </DeviceFrame>
  );
}

function Panel({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={`rounded-[1.4cqw] ${className ?? ""}`}
      style={{ background: "linear-gradient(180deg, #111A31 0%, #0C1326 100%)", boxShadow: "0 0 0 0.07cqw rgba(170,195,255,0.18), 0 1.6cqw 4cqw rgba(0,0,0,0.45)", ...style }}
    >
      {children}
    </div>
  );
}

/* ───────────────────────────── hook ───────────────────────────── */

const HOOK_WORDS: { text: string; at: number; color: string }[] = [
  { text: "M3U", at: 0.5, color: C.cyan },
  { text: "XTREAM", at: 1.5, color: C.blue },
  { text: "EPG", at: 2.6, color: C.mint },
];

function HookScene({ scene, clock, reducedMotion }: Props<"hook">) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  return (
    <Section {...shell}>
      <div className="absolute inset-x-0 top-[12cqw] flex items-end justify-center gap-[3.4cqw]">
        {HOOK_WORDS.map((w) => (
          <HookWord key={w.text} word={w} local={local} reducedMotion={reducedMotion} />
        ))}
      </div>
      <div className="absolute inset-x-0 top-[30cqw] flex flex-col items-center text-center">
        <Rise local={local} at={4.0} reducedMotion={reducedMotion}>
          <p className="text-[2.2cqw] font-semibold" style={{ ...BODY, color: C.muted }}>
            Sounds like a foreign language?
          </p>
        </Rise>
        <Rise local={local} at={6.4} reducedMotion={reducedMotion} distance={1.6}>
          <h1 className="mt-[1.2cqw] text-[4.6cqw]" style={DISPLAY}>
            Explained in <span style={gradientText(C.mint)}>3 minutes.</span>
          </h1>
        </Rise>
        <Rise local={local} at={9.0} reducedMotion={reducedMotion} className="mt-[2.2cqw] flex gap-[1cqw]">
          {[
            { icon: Tv, text: "TV" },
            { icon: Router, text: "TV box" },
            { icon: Smartphone, text: "Phone" },
            { icon: TabletSmartphone, text: "Tablet" },
          ].map((d) => (
            <span key={d.text} className="flex items-center gap-[0.5cqw] rounded-full px-[1.1cqw] py-[0.55cqw] text-[1.2cqw] font-semibold" style={{ ...BODY, background: "rgba(214,226,255,0.07)" }}>
              <d.icon size="1.2cqw" color={C.cyan} />
              {d.text}
            </span>
          ))}
        </Rise>
      </div>
    </Section>
  );
}

function HookWord({ word, local, reducedMotion }: { word: { text: string; at: number; color: string }; local: MotionValue<number>; reducedMotion: boolean }) {
  const scale = usePop(local, word.at, reducedMotion, 0.5);
  const opacity = useProgress(local, word.at, word.at + 0.25);
  const line = useProgress(local, word.at + 0.25, word.at + 0.8);
  return (
    <motion.div className="flex flex-col items-center" style={{ scale, opacity }}>
      <span className="text-[11cqw] leading-[0.85]" style={{ ...DISPLAY, color: C.text }}>
        {word.text}
      </span>
      <motion.span className="mt-[1cqw] h-[0.5cqw] w-full rounded-full" style={{ background: word.color, scaleX: line, transformOrigin: "0% 50%" }} />
    </motion.div>
  );
}

/* ───────────────────────────── player ───────────────────────────── */

const FLOW: { icon: Icon; text: string; sub: string }[] = [
  { icon: Server, text: "Your provider", sub: "sells the service" },
  { icon: Link2, text: "Your playlist", sub: "link or login" },
  { icon: Play, text: "NovaStream", sub: "plays it" },
  { icon: Tv, text: "Your screen", sub: "TV, phone, tablet" },
];

function PlayerScene({ scene, clock, reducedMotion }: Props<"player">) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const pic = useRise(local, 0.4, reducedMotion, 3);
  return (
    <Section {...shell}>
      <div className="absolute left-[6cqw] top-[9cqw] w-[36cqw]">
        <Rise local={local} at={0.1} reducedMotion={reducedMotion}>
          <Kicker text="Rule number one" color={scene.accent} />
        </Rise>
        <Rise local={local} at={0.25} reducedMotion={reducedMotion} distance={1.6}>
          <h2 className="mt-[1cqw] whitespace-nowrap pb-[0.3cqw] text-[4.2cqw]" style={DISPLAY}>
            A player,
            <br />
            <span style={gradientText(scene.accent)}>not a provider.</span>
          </h2>
        </Rise>
        <div className="mt-[3cqw] flex flex-col gap-[1.4cqw]">
          {scene.steps.map((s, i) => (
            <Step key={s.text} step={s} index={i} numbered={false} local={local} accent={scene.accent} reducedMotion={reducedMotion} />
          ))}
        </div>
      </div>
      <motion.div className="absolute left-[46cqw] top-[7.6cqw]" style={{ opacity: pic.opacity, y: pic.y }}>
        <Picture src={`${M}/ill-livingroom-v1.jpg`} width={48} ratio={48 / 24} local={local} reducedMotion={reducedMotion} position="50% 45%" />
      </motion.div>
      <div className="absolute left-[46cqw] top-[35cqw] flex w-[48cqw] items-start justify-between">
        {FLOW.map((f, i) => (
          <FlowNode key={f.text} item={f} at={scene.flowAt + i * 0.9} last={i === FLOW.length - 1} local={local} accent={i === 2 ? C.blue : scene.accent} reducedMotion={reducedMotion} />
        ))}
      </div>
    </Section>
  );
}

function FlowNode({ item, at, last, local, accent, reducedMotion }: { item: { icon: Icon; text: string; sub: string }; at: number; last: boolean; local: MotionValue<number>; accent: string; reducedMotion: boolean }) {
  const Glyph = item.icon;
  return (
    <div className="relative flex w-[10.5cqw] flex-col items-center text-center">
      <Rise local={local} at={at} reducedMotion={reducedMotion} className="flex flex-col items-center">
        <span className="flex h-[5cqw] w-[5cqw] items-center justify-center rounded-[1.3cqw]" style={{ background: `${accent}1F`, boxShadow: `inset 0 0 0 0.08cqw ${accent}77` }}>
          <Glyph size="2.3cqw" color={accent} strokeWidth={2} />
        </span>
        <span className="mt-[0.8cqw] whitespace-nowrap text-[1.25cqw] font-bold" style={BODY}>
          {item.text}
        </span>
        <span className="mt-[0.2cqw] whitespace-nowrap text-[0.95cqw]" style={{ ...BODY, color: C.muted }}>
          {item.sub}
        </span>
      </Rise>
      {!last && (
        <Rise local={local} at={at + 0.45} reducedMotion={reducedMotion} distance={0} className="absolute left-[calc(100%+0.2cqw)] top-[1.6cqw] -translate-x-1/2">
          <ArrowRight size="1.8cqw" color={C.faint} />
        </Rise>
      )}
    </div>
  );
}

/* ───────────────────────────── glossary term ───────────────────────────── */

function TermScene({ scene, clock, reducedMotion }: Props<"term">) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  return (
    <Section {...shell}>
      <div className="absolute left-[6cqw] top-[8.4cqw] w-[33cqw]">
        <Rise local={local} at={0.1} reducedMotion={reducedMotion}>
          <Kicker text="Glossary" color={scene.accent} />
        </Rise>
        <Rise local={local} at={0.25} reducedMotion={reducedMotion} distance={2}>
          <h2 className="mt-[1cqw] whitespace-nowrap text-[8.6cqw] leading-[0.9]" style={{ ...DISPLAY, ...gradientText(scene.accent) }}>
            {scene.term}
          </h2>
        </Rise>
        <Rise local={local} at={0.6} reducedMotion={reducedMotion}>
          <p className="mt-[1cqw] whitespace-nowrap text-[1.3cqw] italic" style={{ ...BODY, color: C.faint }}>
            {scene.kind}
          </p>
        </Rise>
        <Rise local={local} at={1.0} reducedMotion={reducedMotion}>
          <p className="mt-[1.8cqw] border-l-[0.3cqw] pl-[1.4cqw] text-[1.75cqw] font-semibold leading-[1.3]" style={{ ...BODY, borderColor: scene.accent }}>
            {scene.definition}
          </p>
        </Rise>
        <div className="mt-[2.4cqw] flex flex-col gap-[1.1cqw]">
          {scene.points.map((p, i) => (
            <Step key={p.text} step={p} index={i} numbered={false} local={local} accent={scene.accent} reducedMotion={reducedMotion} />
          ))}
        </div>
      </div>
      {scene.visual === "m3u" && <M3uVisual local={local} accent={scene.accent} reducedMotion={reducedMotion} />}
      {scene.visual === "xtream" && <XtreamVisual local={local} accent={scene.accent} reducedMotion={reducedMotion} />}
      {scene.visual === "epg" && <EpgVisual local={local} accent={scene.accent} reducedMotion={reducedMotion} />}
    </Section>
  );
}

type V = { local: MotionValue<number>; accent: string; reducedMotion: boolean };

/** Real lines from the demo playlist, shortened; each part is labelled outside the card. */
const M3U_LINES: { tokens: { text: string; color?: string; tag?: string }[] }[] = [
  { tokens: [{ text: "#EXTM3U", color: C.faint }] },
  { tokens: [{ text: "#EXTINF:-1", color: C.faint }] },
  { tokens: [{ text: "  tvg-logo=", color: C.muted }, { text: '"logos/world-news.png"', color: C.cyan, tag: "logo" }] },
  { tokens: [{ text: "  group-title=", color: C.muted }, { text: '"News"', color: C.amber, tag: "group" }, { text: ",", color: C.muted }, { text: "World News 24", color: C.mint, tag: "name" }] },
  { tokens: [{ text: "http://provider.example/live/100.ts", color: "#7FA8FF", tag: "stream" }] },
];
const M3U_LABELS: { tag: string; text: string; color: string; at: number; line: number; shift: number }[] = [
  { tag: "logo", text: "Logo", color: C.cyan, at: 8.0, line: 2, shift: 0 },
  { tag: "group", text: "Group", color: C.amber, at: 8.9, line: 3, shift: -0.8 },
  { tag: "name", text: "Channel name", color: C.mint, at: 6.8, line: 3, shift: 0.8 },
  { tag: "stream", text: "Stream address", color: "#7FA8FF", at: 10.0, line: 4, shift: 0.6 },
];
const LINE_H = 3;
/** Panel top padding (1.8) + file header (1.2 + 1 margin) + half a line − half a label. */
const LABEL_TOP = 1.8 + 2.2 + LINE_H / 2 - 0.75;

function M3uVisual({ local, accent, reducedMotion }: V) {
  const card = useRise(local, 2.6, reducedMotion, 2);
  return (
    <>
      <motion.div className="absolute left-[43cqw] top-[9cqw]" style={{ opacity: card.opacity, y: card.y }}>
        <Panel className="w-[34cqw] px-[2cqw] py-[1.8cqw]">
          <div className="mb-[1cqw] flex items-center gap-[0.6cqw]">
            <FileText size="1.2cqw" color={accent} />
            <span className="text-[1cqw] font-bold" style={{ ...BODY, color: C.muted }}>
              my-playlist.m3u
            </span>
          </div>
          {M3U_LINES.map((l, i) => (
            <div key={i} className="flex items-center whitespace-pre text-[1.2cqw]" style={{ ...MONO, height: `${LINE_H}cqw` }}>
              {l.tokens.map((tk, j) => (
                <Token key={j} token={tk} local={local} />
              ))}
            </div>
          ))}
        </Panel>
      </motion.div>
      <div className="absolute left-[79cqw] top-[9cqw] w-[15cqw]">
        {M3U_LABELS.map((lb) => (
          <Rise
            key={lb.tag}
            local={local}
            at={lb.at}
            reducedMotion={reducedMotion}
            className="absolute flex items-center gap-[0.6cqw] whitespace-nowrap text-[1.2cqw] font-bold"
            style={{ ...BODY, top: `${LABEL_TOP + lb.line * LINE_H + lb.shift}cqw`, left: 0, color: lb.color }}
          >
            <span className="h-[0.8cqw] w-[0.8cqw] rounded-full" style={{ background: lb.color }} />
            {lb.text}
          </Rise>
        ))}
      </div>
      <Rise local={local} at={12.4} reducedMotion={reducedMotion} className="absolute left-[43cqw] top-[33.6cqw] flex items-center gap-[1.4cqw]">
        <ArrowDown size="2cqw" color={accent} />
        <span className="whitespace-nowrap text-[1.4cqw] font-semibold" style={{ ...BODY, color: C.muted }}>
          NovaStream turns it into a TV menu
        </span>
      </Rise>
      <Rise local={local} at={13.2} reducedMotion={reducedMotion} distance={2} className="absolute left-[43cqw] top-[37.4cqw]">
        <Panel className="flex w-[51cqw] items-center gap-[1.4cqw] px-[1.6cqw] py-[1.2cqw]">
          <span className="rounded-[0.6cqw] px-[1cqw] py-[0.5cqw] text-[1.15cqw] font-bold" style={{ ...BODY, background: `${C.amber}22`, color: C.amber }}>
            News
          </span>
          <img src="https://motion-youtube.rork.app/demo/logos/world-news-24.png" alt="" draggable={false} className="h-[3.4cqw] w-[3.4cqw] rounded-[0.6cqw] object-cover" />
          <div className="flex-1">
            <div className="text-[1.45cqw] font-bold" style={BODY}>
              World News 24
            </div>
            <div className="mt-[0.2cqw] text-[1cqw]" style={{ ...BODY, color: C.muted }}>
              Live · tap to play
            </div>
          </div>
          <span className="flex h-[3cqw] w-[3cqw] items-center justify-center rounded-full" style={{ background: `${C.mint}22` }}>
            <Play size="1.3cqw" color={C.mint} fill={C.mint} />
          </span>
        </Panel>
      </Rise>
    </>
  );
}

function Token({ token, local }: { token: { text: string; color?: string; tag?: string }; local: MotionValue<number> }) {
  const label = M3U_LABELS.find((l) => l.tag === token.tag);
  const glow = useTransform(local, (t) => (label && t >= label.at ? `${label.color}26` : "rgba(0,0,0,0)"));
  return (
    <motion.span className="rounded-[0.3cqw]" style={{ color: token.color ?? C.text, background: glow }}>
      {token.text}
    </motion.span>
  );
}

const XT_FIELDS: { label: string; value: string; icon: Icon; at: number }[] = [
  { label: "Server", value: "http://panel.example.tv:8080", icon: Server, at: 6.6 },
  { label: "Username", value: "alex", icon: User, at: 7.9 },
  { label: "Password", value: "••••••••••", icon: KeyRound, at: 8.9 },
];
const XT_OUT: { text: string; icon: Icon; at: number }[] = [
  { text: "Live TV", icon: MonitorPlay, at: 11.4 },
  { text: "Movies", icon: Film, at: 12.2 },
  { text: "Series", icon: Clapperboard, at: 13.0 },
];

function XtreamVisual({ local, accent, reducedMotion }: V) {
  return (
    <>
      <div className="absolute left-[43cqw] top-[8.6cqw] flex w-[51cqw] flex-col gap-[1cqw]">
        <Rise local={local} at={3.2} reducedMotion={reducedMotion} className="mb-[0.4cqw] flex items-center gap-[1cqw]">
          <span className="whitespace-nowrap rounded-[0.6cqw] px-[1cqw] py-[0.5cqw] text-[1.05cqw] line-through" style={{ ...MONO, background: "rgba(214,226,255,0.06)", color: C.faint }}>
            http://provider.example/get.php?username=…&type=m3u_plus
          </span>
        </Rise>
        {XT_FIELDS.map((f) => (
          <XtField key={f.label} field={f} local={local} accent={accent} reducedMotion={reducedMotion} />
        ))}
      </div>
      <Rise local={local} at={10.6} reducedMotion={reducedMotion} className="absolute left-[43cqw] top-[29.4cqw] flex w-[51cqw] justify-center">
        <ArrowDown size="2.2cqw" color={accent} />
      </Rise>
      <div className="absolute left-[43cqw] top-[33cqw] grid w-[51cqw] grid-cols-3 gap-[1.2cqw]">
        {XT_OUT.map((o) => (
          <XtOut key={o.text} item={o} local={local} accent={accent} reducedMotion={reducedMotion} />
        ))}
      </div>
      <div className="absolute left-[43cqw] top-[44.6cqw] flex w-[51cqw] justify-center gap-[1cqw]">
        {[
          { at: 14.6, text: "Posters", icon: ImageIcon },
          { at: 15.3, text: "Plots", icon: FileText },
          { at: 16.0, text: "Seasons", icon: Layers },
        ].map((p) => (
          <Chip key={p.text} point={p} local={local} accent={C.mint} reducedMotion={reducedMotion} size={1.15} />
        ))}
      </div>
    </>
  );
}

function XtField({ field, local, accent, reducedMotion }: { field: { label: string; value: string; icon: Icon; at: number }; local: MotionValue<number>; accent: string; reducedMotion: boolean }) {
  const typed = useTransform(local, (t) => field.value.slice(0, Math.max(0, Math.min(field.value.length, Math.floor((t - field.at - 0.2) * 30)))));
  const Glyph = field.icon;
  return (
    <Rise local={local} at={field.at} reducedMotion={reducedMotion}>
      <Panel className="flex items-center gap-[1.2cqw] px-[1.4cqw] py-[1cqw]">
        <span className="flex h-[2.8cqw] w-[2.8cqw] items-center justify-center rounded-[0.8cqw]" style={{ background: `${accent}22` }}>
          <Glyph size="1.4cqw" color={accent} />
        </span>
        <div>
          <div className="text-[0.85cqw]" style={{ ...WIDE, letterSpacing: "0.18em", color: C.faint }}>
            {field.label}
          </div>
          <motion.div className="mt-[0.2cqw] h-[1.8cqw] whitespace-nowrap text-[1.4cqw]" style={{ ...MONO, color: C.text }}>
            {typed}
          </motion.div>
        </div>
      </Panel>
    </Rise>
  );
}

function XtOut({ item, local, accent, reducedMotion }: { item: { text: string; icon: Icon; at: number }; local: MotionValue<number>; accent: string; reducedMotion: boolean }) {
  const scale = usePop(local, item.at, reducedMotion, 0.8);
  const opacity = useProgress(local, item.at, item.at + 0.3);
  const Glyph = item.icon;
  return (
    <motion.div style={{ scale, opacity }}>
      <Panel className="flex flex-col items-center gap-[0.7cqw] py-[1.4cqw]" style={{ boxShadow: `0 0 0 0.08cqw ${accent}66, 0 1.6cqw 4cqw rgba(0,0,0,0.45)` }}>
        <Glyph size="2.2cqw" color={accent} strokeWidth={2} />
        <span className="text-[1.4cqw] font-bold" style={BODY}>
          {item.text}
        </span>
      </Panel>
    </motion.div>
  );
}

function EpgVisual({ local, accent, reducedMotion }: V) {
  const device = useRise(local, 0.5, reducedMotion, 3);
  const shots: Shot[] = [
    { src: `${M}/app-guide-v1.jpg`, ratio: 2.906, at: 0 },
    { src: `${M}/app-m3uform-v1.jpg`, ratio: APP, at: 14.2 },
  ];
  return (
    <>
      <motion.div className="absolute left-[44cqw] top-[9cqw]" style={{ opacity: device.opacity, y: device.y }}>
        <AppDevice shots={shots} width={49} local={local} accent={accent} reducedMotion={reducedMotion} />
      </motion.div>
      <div className="absolute left-[44cqw] top-[31.6cqw] flex w-[50.2cqw] flex-col gap-[1.1cqw]">
        <Route at={11.2} label="Xtream codes" text="Found automatically" icon={Sparkles} local={local} accent={accent} reducedMotion={reducedMotion} />
        <Route at={14.4} label="M3U" text="Paste the guide link in its own field" icon={Link2} local={local} accent={C.cyan} reducedMotion={reducedMotion} />
      </div>
    </>
  );
}

function Route({ at, label, text, icon: Glyph, local, accent, reducedMotion }: { at: number; label: string; text: string; icon: Icon; local: MotionValue<number>; accent: string; reducedMotion: boolean }) {
  return (
    <Rise local={local} at={at} reducedMotion={reducedMotion}>
      <Panel className="flex items-center gap-[1.2cqw] px-[1.4cqw] py-[1cqw]">
        <span className="w-[11cqw] shrink-0 whitespace-nowrap text-[1.05cqw]" style={{ ...WIDE, letterSpacing: "0.14em", color: accent }}>
          {label}
        </span>
        <ArrowRight size="1.4cqw" color={C.faint} />
        <Glyph size="1.4cqw" color={accent} />
        <span className="whitespace-nowrap text-[1.4cqw] font-semibold" style={BODY}>
          {text}
        </span>
      </Panel>
    </Rise>
  );
}

/* ───────────────────────────── which one ───────────────────────────── */

function WhichScene({ scene, clock, reducedMotion }: Props<"which">) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  return (
    <Section {...shell}>
      <div className="absolute inset-x-0 top-[6.4cqw] flex flex-col items-center">
        <Rise local={local} at={0.1} reducedMotion={reducedMotion}>
          <Kicker text="M3U or Xtream?" color={scene.accent} />
        </Rise>
        <Rise local={local} at={0.25} reducedMotion={reducedMotion} distance={1.6}>
          <h2 className="mt-[1cqw] text-[4.4cqw]" style={DISPLAY}>
            Which one <span style={gradientText(scene.accent)}>should you pick?</span>
          </h2>
        </Rise>
      </div>
      <div className="absolute left-1/2 top-[19cqw] flex -translate-x-1/2 gap-[2.4cqw]">
        <Option
          at={scene.xtreamAt}
          title="Xtream codes"
          badge="Got it? Use it"
          accent={C.blue}
          rows={[
            { text: "Live TV, movies and series apart", at: scene.xtreamAt + 2.4 },
            { text: "Posters, plots and seasons", at: scene.xtreamAt + 3.2 },
            { text: "TV guide found automatically", at: scene.xtreamAt + 4.0 },
          ]}
          local={local}
          reducedMotion={reducedMotion}
        />
        <Option
          at={scene.m3uAt}
          title="M3U link"
          badge="Works perfectly too"
          accent={C.cyan}
          rows={[
            { text: "One link, nothing else", at: scene.m3uAt + 0.8 },
            { text: "Groups from the playlist", at: scene.m3uAt + 1.5 },
            { text: "Add the guide link yourself", at: scene.m3uAt + 2.2 },
          ]}
          local={local}
          reducedMotion={reducedMotion}
        />
      </div>
    </Section>
  );
}

function Option({
  at,
  title,
  badge,
  accent,
  rows,
  local,
  reducedMotion,
}: {
  at: number;
  title: string;
  badge: string;
  accent: string;
  rows: { text: string; at: number }[];
  local: MotionValue<number>;
  reducedMotion: boolean;
}) {
  const r = useRise(local, at, reducedMotion, 3);
  return (
    <motion.div style={{ opacity: r.opacity, y: r.y }}>
      <Panel className="w-[38cqw] p-[2.4cqw]" style={{ boxShadow: `0 0 0 0.1cqw ${accent}77, 0 1.6cqw 4cqw rgba(0,0,0,0.45)` }}>
        <div className="flex items-center justify-between">
          <span className="text-[3cqw]" style={{ ...DISPLAY, ...gradientText(accent) }}>
            {title}
          </span>
          <span className="whitespace-nowrap rounded-full px-[1cqw] py-[0.45cqw] text-[1cqw] font-bold" style={{ ...BODY, background: `${accent}26`, color: accent }}>
            {badge}
          </span>
        </div>
        <div className="mt-[2cqw] flex flex-col gap-[1.2cqw]">
          {rows.map((row) => (
            <Rise key={row.text} local={local} at={row.at} reducedMotion={reducedMotion} className="flex items-center gap-[0.9cqw]">
              <span className="flex h-[2.2cqw] w-[2.2cqw] items-center justify-center rounded-full" style={{ background: `${accent}22` }}>
                <Check size="1.2cqw" color={accent} strokeWidth={3} />
              </span>
              <span className="whitespace-nowrap text-[1.45cqw] font-semibold" style={BODY}>
                {row.text}
              </span>
            </Rise>
          ))}
        </div>
      </Panel>
    </motion.div>
  );
}

/* ───────────────────────────── devices ───────────────────────────── */

function DevicesScene({ scene, clock, reducedMotion }: Props<"devices">) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const pic = useRise(local, 0.3, reducedMotion, 3);
  return (
    <Section {...shell}>
      <motion.div className="absolute left-[6cqw] top-[9.4cqw]" style={{ opacity: pic.opacity, y: pic.y }}>
        <Picture src={`${M}/ill-devices-v1.jpg`} width={50} ratio={1.5} local={local} reducedMotion={reducedMotion} />
      </motion.div>
      <div className="absolute left-[61cqw] top-[11cqw] w-[33cqw]">
        <Rise local={local} at={0.1} reducedMotion={reducedMotion}>
          <Kicker text="Where to watch" color={scene.accent} />
        </Rise>
        <Rise local={local} at={0.25} reducedMotion={reducedMotion} distance={1.6}>
          <h2 className="mt-[1cqw] whitespace-nowrap text-[4.2cqw]" style={DISPLAY}>
            One app,
            <br />
            <span style={gradientText(scene.accent)}>every screen.</span>
          </h2>
        </Rise>
        <div className="mt-[2.6cqw] flex flex-col items-start gap-[1cqw]">
          {scene.chips.map((c) => (
            <Chip key={c.text} point={c} local={local} accent={scene.accent} reducedMotion={reducedMotion} size={1.4} />
          ))}
        </div>
        <Rise local={local} at={scene.adaptAt} reducedMotion={reducedMotion} className="mt-[2.2cqw] flex items-center gap-[0.8cqw]">
          <TvMinimal size="1.6cqw" color={C.mint} />
          <span className="whitespace-nowrap text-[1.45cqw] font-semibold" style={{ ...BODY, color: C.muted }}>
            The layout adapts to every screen
          </span>
        </Rise>
      </div>
    </Section>
  );
}

/* ───────────────────────────── steps (app or website) ───────────────────────────── */

const STEP_APP_W = 50;
const STEP_WEB_W = 50;

function StepsScene({ scene, clock, reducedMotion }: Props<"steps">) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const right = useRise(local, 0.35, reducedMotion, 3);
  return (
    <Section {...shell}>
      <div className="absolute left-[6cqw] top-[11cqw] w-[34cqw]">
        <Rise local={local} at={0.1} reducedMotion={reducedMotion}>
          <Kicker text={scene.kicker} color={scene.accent} />
        </Rise>
        <Rise local={local} at={0.25} reducedMotion={reducedMotion} distance={1.6}>
          <h2 className="mt-[1cqw] whitespace-nowrap pb-[0.3cqw] text-[4.2cqw]" style={DISPLAY}>
            {scene.title[0]}
            <br />
            <span style={gradientText(scene.accent)}>{scene.title[1]}</span>
          </h2>
        </Rise>
        <div className="mt-[3cqw] flex flex-col gap-[1.4cqw]">
          {scene.steps.map((s, i) => (
            <Step key={s.text} step={s} index={i} numbered={scene.numbered && i < 3} local={local} accent={scene.accent} reducedMotion={reducedMotion} />
          ))}
        </div>
      </div>
      <motion.div className="absolute right-[6cqw] top-[0cqw] flex h-[56.25cqw] items-center" style={{ opacity: right.opacity, y: right.y }}>
        {scene.device === "app" ? (
          <AppDevice shots={scene.shots} width={STEP_APP_W} local={local} accent={scene.accent} reducedMotion={reducedMotion} />
        ) : (
          <BrowserFrame width={STEP_WEB_W} ratio={WEB} url={scene.url ?? ""} accent={scene.accent}>
            <ShotStack shots={scene.shots} local={local} width={STEP_WEB_W} reducedMotion={reducedMotion} />
          </BrowserFrame>
        )}
      </motion.div>
    </Section>
  );
}

/* ───────────────────────────── troubleshooting ───────────────────────────── */

function FixScene({ scene, clock, reducedMotion }: Props<"fix">) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const right = useRise(local, 0.35, reducedMotion, 3);
  return (
    <Section {...shell}>
      <div className="absolute left-[6cqw] top-[9cqw] w-[36cqw]">
        <Rise local={local} at={0.1} reducedMotion={reducedMotion} className="flex items-center gap-[1cqw]">
          <Kicker text="Quick fix" color={scene.accent} />
          <div className="flex gap-[0.4cqw]">
            {[1, 2, 3].map((n) => (
              <span key={n} className="h-[0.5cqw] w-[2.2cqw] rounded-full" style={{ background: n <= scene.n ? scene.accent : "rgba(214,226,255,0.16)" }} />
            ))}
          </div>
        </Rise>
        <Rise local={local} at={0.25} reducedMotion={reducedMotion} distance={1.6}>
          <h2 className="mt-[1.2cqw] whitespace-nowrap pb-[0.3cqw] text-[4.6cqw]" style={DISPLAY}>
            {scene.title[0]}
            <br />
            <span style={gradientText(scene.accent)}>{scene.title[1]}</span>
          </h2>
        </Rise>
        <div className="mt-[3cqw] flex flex-col gap-[1.3cqw]">
          {scene.checks.map((c) => (
            <CheckRow key={c.text} item={c} local={local} accent={scene.accent} reducedMotion={reducedMotion} />
          ))}
        </div>
      </div>
      <motion.div className="absolute right-[6cqw] top-0 flex h-[56.25cqw] items-center" style={{ opacity: right.opacity, y: right.y }}>
        <AppDevice shots={scene.shots} width={47} local={local} accent={scene.accent} reducedMotion={reducedMotion} />
      </motion.div>
    </Section>
  );
}

function CheckRow({ item, local, accent, reducedMotion }: { item: Point & { info?: boolean }; local: MotionValue<number>; accent: string; reducedMotion: boolean }) {
  const tick = useProgress(local, item.at + 0.7, item.at + 1.0);
  const bg = useTransform(tick, (v) => (v > 0.5 ? (item.info ? "rgba(214,226,255,0.14)" : C.mint) : "rgba(0,0,0,0)"));
  const Glyph = item.icon;
  return (
    <Rise local={local} at={item.at} reducedMotion={reducedMotion} className="flex items-center gap-[1cqw]">
      <motion.span
        className="flex h-[2.6cqw] w-[2.6cqw] shrink-0 items-center justify-center rounded-[0.7cqw]"
        style={{ background: bg, boxShadow: `inset 0 0 0 0.12cqw ${item.info ? "rgba(214,226,255,0.35)" : C.mint}` }}
      >
        <motion.span style={{ opacity: tick, display: "flex" }}>
          {item.info ? <Info size="1.4cqw" color={C.text} strokeWidth={2.6} /> : <Check size="1.5cqw" color="#03140D" strokeWidth={3.4} />}
        </motion.span>
      </motion.span>
      <Glyph size="1.5cqw" color={accent} strokeWidth={2.2} />
      <span className="whitespace-nowrap text-[1.5cqw] font-semibold" style={{ ...BODY, color: item.info ? C.muted : C.text }}>
        {item.text}
      </span>
    </Rise>
  );
}

/* ───────────────────────────── outro ───────────────────────────── */

function OutroScene({ scene, clock, reducedMotion }: Props<"outro">) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  return (
    <Section {...shell}>
      <div className="absolute inset-x-0 top-[6cqw] flex justify-center gap-[1.2cqw]">
        {HOOK_WORDS.map((w, i) => (
          <Rise key={w.text} local={local} at={0.3 + i * 0.25} reducedMotion={reducedMotion} className="flex items-center gap-[0.6cqw] rounded-full px-[1.3cqw] py-[0.6cqw]" style={{ background: `${w.color}1C` }}>
            <Check size="1.2cqw" color={w.color} strokeWidth={3} />
            <span className="text-[1.5cqw]" style={{ ...DISPLAY, color: C.text }}>
              {w.text}
            </span>
          </Rise>
        ))}
      </div>
      <div className="absolute left-1/2 top-[12cqw] -translate-x-1/2">
        <LogoMark size={10} local={local} reducedMotion={reducedMotion} at={0.6} />
      </div>
      <div className="absolute inset-x-0 top-[26cqw] flex flex-col items-center text-center">
        <Rise local={local} at={0.9} reducedMotion={reducedMotion} distance={2}>
          <h1 className="text-[4.8cqw]" style={DISPLAY}>
            You now speak <span style={gradientText(C.mint)}>fluent playlist.</span>
          </h1>
        </Rise>
        <div className="mt-[2.6cqw] flex items-center gap-[1.6cqw]">
          <Rise local={local} at={3.0} reducedMotion={reducedMotion}>
            <CtaPill text="Get NovaStream on Google Play" size={1.6} icon={Play} />
          </Rise>
          <Rise local={local} at={5.0} reducedMotion={reducedMotion}>
            <div className="flex items-center gap-[0.7cqw] rounded-full px-[2cqw] py-[1.1cqw] text-[1.6cqw] font-bold" style={{ ...BODY, background: "rgba(214,226,255,0.08)", boxShadow: "inset 0 0 0 0.08cqw rgba(214,226,255,0.25)" }}>
              <Bell size="1.5cqw" color={C.amber} strokeWidth={2.4} />
              Subscribe for more guides
            </div>
          </Rise>
        </div>
        <Rise local={local} at={5.8} reducedMotion={reducedMotion} className="mt-[2.6cqw] flex items-center gap-[2cqw] text-[1.05cqw]" style={{ ...BODY, color: C.faint }}>
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
