import { MotionPlayer, type FilmLayerProps, type SceneContent, type SceneRenderProps } from "./motion-player";
import { motion, useTransform, type MotionValue } from "motion/react";
import { easeInOut } from "motion";
import { Clapperboard, MonitorPlay, Play, Smartphone, TabletSmartphone, CalendarDays, Film } from "lucide-react";
import {
  BODY,
  C,
  CtaPill,
  DISPLAY,
  DeviceFrame,
  Kicker,
  LogoMark,
  M,
  Picture,
  Pools,
  Rise,
  Section,
  WIDE,
  clamp01,
  gradientText,
  useLocal,
  usePop,
  useProgress,
  useRise,
  useSceneShell,
  type Icon,
} from "./kit";

/*
 * "Turn your phone sideways" — vertical Short (1080 × 1920), English narration.
 * One gesture drives the film: the phone physically rotates, and from then on everything is landscape.
 * Safe area: key content between 15 % from the top (26.7cqw) and 20 % from the bottom (142cqw), left of 88cqw.
 */

type FilmScene = SceneContent & { id: "hook" | "new" | "wide" | "tablet" | "cta" };

const content: FilmScene[] = [
  {
    id: "hook",
    chapter: "Turn it",
    voiceover: "/rork-vo-hook-v1.mp3",
    minSeconds: 4.6,
    effects: [{ src: "/rork-sfx-rotate-v1.mp3", at: 2.35, volume: 0.32 }],
  },
  { id: "new", chapter: "Landscape", voiceover: "/rork-vo-new-v1.mp3", minSeconds: 6.2 },
  { id: "wide", chapter: "Full width", voiceover: "/rork-vo-wide-v1.mp3", minSeconds: 8.6 },
  { id: "tablet", chapter: "Tablets", voiceover: "/rork-vo-tablet-v1.mp3", minSeconds: 5.2 },
  {
    id: "cta",
    chapter: "Update",
    voiceover: "/rork-vo-cta-v1.mp3",
    minSeconds: 5.6,
    effects: [{ src: "/rork-sfx-hit-v1.mp3", at: 0.1, volume: 0.3 }],
  },
];

const musicBed: string | null = "/rork-music-v1.mp3";
const TRANSITION_SECONDS = 0.45;
const ACCENT: Record<FilmScene["id"], string> = { hook: C.blue, new: C.cyan, wide: C.blue, tablet: C.mint, cta: C.cyan };

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
    case "new":
      return <NewScene {...props} />;
    case "wide":
      return <WideScene {...props} />;
    case "tablet":
      return <TabletScene {...props} />;
    case "cta":
      return <CtaScene {...props} />;
  }
}

type Props = SceneRenderProps<FilmScene>;

function useShell(scene: { start: number; end: number }, clock: MotionValue<number>, reducedMotion: boolean) {
  return useSceneShell(scene, clock, reducedMotion, TRANSITION_SECONDS);
}

function Backdrop({ clock, activeScene, reducedMotion }: FilmLayerProps<FilmScene>) {
  return <Pools clock={clock} accent={ACCENT[activeScene.id]} reducedMotion={reducedMotion} tall />;
}

function Title({ a, b, accent, local, at, reducedMotion, size = 12 }: { a: string; b: string; accent: string; local: MotionValue<number>; at: number; reducedMotion: boolean; size?: number }) {
  return (
    <Rise local={local} at={at} reducedMotion={reducedMotion} distance={3}>
      <h1 className="whitespace-nowrap pb-[1cqw] text-center" style={{ ...DISPLAY, fontSize: `${size}cqw`, lineHeight: 0.95 }}>
        {a}
        <br />
        <span style={gradientText(accent)}>{b}</span>
      </h1>
    </Rise>
  );
}

/* ───────────────────────────── hook: the phone turns ───────────────────────────── */

const PHONE_W = 35;
const PHONE_H = PHONE_W / (680 / 1336);
const TURN_AT = 2.3;

function HookScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const stop = usePop(local, 0.05, reducedMotion, 0.5);
  const turn = useTransform(local, (t) => easeInOut(clamp01((t - TURN_AT) / 0.8)));
  const rotate = useTransform(turn, (v) => (reducedMotion ? (v > 0.5 ? -90 : 0) : -90 * v));
  const landscape = useTransform(local, (t) => clamp01((t - TURN_AT - 0.65) / 0.35));
  const phone = useRise(local, 0.3, reducedMotion, 4);
  return (
    <Section {...shell}>
      <motion.div className="absolute inset-x-0 top-[27cqw] flex justify-center" style={{ scale: stop }}>
        <span className="text-[19cqw] leading-none" style={{ ...DISPLAY, color: C.text }}>
          STOP.
        </span>
      </motion.div>
      <div className="absolute inset-x-0 top-[48cqw] flex justify-center">
        <Rise local={local} at={0.9} reducedMotion={reducedMotion}>
          <p className="whitespace-nowrap text-[6.6cqw] font-bold" style={BODY}>
            Turn your phone <span style={gradientText(C.cyan)}>sideways.</span>
          </p>
        </Rise>
      </div>
      <motion.div
        className="absolute left-1/2 top-[97cqw]"
        style={{ x: "-50%", y: "-50%", opacity: phone.opacity, rotate }}
      >
        <DeviceFrame width={PHONE_W} height={`${PHONE_H}cqw`} accent={C.blue} bezel={1.1} radius={4.4}>
          <img src={`${M}/ns-phone-1-v1.jpg`} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          <motion.div
            className="absolute left-1/2 top-1/2 overflow-hidden"
            style={{ width: `${PHONE_H}cqw`, height: `${PHONE_W}cqw`, x: "-50%", y: "-50%", rotate: 90, opacity: landscape }}
          >
            <img src={`${M}/app-live-list-v1.jpg`} alt="" draggable={false} className="h-full w-full object-cover object-left" />
          </motion.div>
        </DeviceFrame>
      </motion.div>
    </Section>
  );
}

/* ───────────────────────────── new: now in landscape ───────────────────────────── */

function NewScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const pic = useRise(local, 0.35, reducedMotion, 4);
  return (
    <Section {...shell}>
      <div className="absolute inset-x-0 top-[27cqw] flex flex-col items-center">
        <Rise local={local} at={0.05} reducedMotion={reducedMotion}>
          <Kicker text="New in NovaStream" color={C.cyan} size={2.6} />
        </Rise>
        <div className="mt-[2cqw]">
          <Title a="Now in" b="landscape." accent={C.cyan} local={local} at={0.15} reducedMotion={reducedMotion} />
        </div>
      </div>
      <motion.div className="absolute left-[9cqw] top-[57cqw]" style={{ opacity: pic.opacity, y: pic.y }}>
        <Picture src={`${M}/ill-phone-v1.jpg`} width={76} ratio={76 / 64} local={local} reducedMotion={reducedMotion} radius={4} position="50% 55%" />
      </motion.div>
      <div className="absolute inset-x-0 top-[127cqw] flex justify-center gap-[2.4cqw]">
        <Pill icon={Smartphone} text="Phones" local={local} at={2.6} accent={C.cyan} reducedMotion={reducedMotion} />
        <Pill icon={TabletSmartphone} text="Tablets" local={local} at={3.5} accent={C.mint} reducedMotion={reducedMotion} />
      </div>
    </Section>
  );
}

function Pill({ icon: Glyph, text, local, at, accent, reducedMotion }: { icon: Icon; text: string; local: MotionValue<number>; at: number; accent: string; reducedMotion: boolean }) {
  const scale = usePop(local, at, reducedMotion, 0.7);
  const opacity = useProgress(local, at, at + 0.25);
  return (
    <motion.div
      className="flex items-center gap-[1.6cqw] whitespace-nowrap rounded-full px-[4cqw] py-[2cqw] text-[4.6cqw] font-bold"
      style={{ ...BODY, scale, opacity, background: `${accent}1F`, boxShadow: `inset 0 0 0 0.25cqw ${accent}77` }}
    >
      <Glyph size="4.6cqw" color={accent} strokeWidth={2.2} />
      {text}
    </motion.div>
  );
}

/* ───────────────────────────── wide: cascade of real screens ───────────────────────────── */

const WIDE_SHOTS: { src: string; ratio: number; label: string; icon: Icon; at: number }[] = [
  { src: `${M}/app-live-list-v1.jpg`, ratio: 2.667, label: "Live TV", icon: MonitorPlay, at: 0.5 },
  { src: `${M}/app-guide-v1.jpg`, ratio: 2.906, label: "Guide", icon: CalendarDays, at: 1.4 },
  { src: `${M}/app-movies-v1.jpg`, ratio: 2.667, label: "Films", icon: Film, at: 2.2 },
  { src: `${M}/app-series-v1.jpg`, ratio: 2.667, label: "Series", icon: Clapperboard, at: 3.1 },
];
const WIDE_W = 66;
const WIDE_H = WIDE_W / 2.667;

function WideScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  return (
    <Section {...shell}>
      <div className="absolute inset-x-0 top-[27cqw] flex flex-col items-center">
        <Title a="Everything," b="full width." accent={C.blue} local={local} at={0.05} reducedMotion={reducedMotion} size={11} />
        <div className="mt-[2.4cqw] flex gap-[1.4cqw]">
          {WIDE_SHOTS.map((s) => (
            <Label key={s.label} item={s} local={local} reducedMotion={reducedMotion} />
          ))}
        </div>
      </div>
      {WIDE_SHOTS.map((s, i) => (
        <WideCard key={s.src} item={s} index={i} local={local} reducedMotion={reducedMotion} />
      ))}
    </Section>
  );
}

function Label({ item, local, reducedMotion }: { item: (typeof WIDE_SHOTS)[number]; local: MotionValue<number>; reducedMotion: boolean }) {
  const lit = useTransform(local, (t) => (t >= item.at ? 1 : 0.32));
  const scale = usePop(local, item.at, reducedMotion, 0.85);
  const Glyph = item.icon;
  return (
    <motion.span className="flex items-center gap-[1cqw] whitespace-nowrap text-[3.5cqw] font-bold" style={{ ...BODY, opacity: lit, scale }}>
      <Glyph size="3.4cqw" color={C.cyan} strokeWidth={2.2} />
      {item.label}
    </motion.span>
  );
}

function WideCard({ item, index, local, reducedMotion }: { item: (typeof WIDE_SHOTS)[number]; index: number; local: MotionValue<number>; reducedMotion: boolean }) {
  const p = useProgress(local, item.at, item.at + 0.55);
  const fromLeft = index % 2 === 0;
  const x = useTransform(p, (v) => (reducedMotion ? "0cqw" : `${(1 - v) * (fromLeft ? -40 : 40)}cqw`));
  const top = 57 + index * 19;
  const left = fromLeft ? 7 : 19;
  return (
    <motion.div className="absolute" style={{ left: `${left}cqw`, top: `${top}cqw`, x, opacity: p, zIndex: index }}>
      <DeviceFrame width={WIDE_W} height={`${WIDE_H}cqw`} accent={C.blue} bezel={0.9} radius={3}>
        <img src={item.src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover object-left-top" />
      </DeviceFrame>
    </motion.div>
  );
}

/* ───────────────────────────── tablet ───────────────────────────── */

function TabletScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const pic = useRise(local, 0.1, reducedMotion, 4);
  return (
    <Section {...shell}>
      <div className="absolute inset-x-0 top-[27cqw] flex flex-col items-center">
        <Rise local={local} at={0.05} reducedMotion={reducedMotion}>
          <Kicker text="On a tablet" color={C.mint} size={2.6} />
        </Rise>
        <div className="mt-[2cqw]">
          <Title a="A TV in" b="your hands." accent={C.mint} local={local} at={1.4} reducedMotion={reducedMotion} />
        </div>
      </div>
      <motion.div className="absolute left-[9cqw] top-[63cqw]" style={{ opacity: pic.opacity, y: pic.y }}>
        <Picture src={`${M}/ill-tablet-v1.jpg`} width={76} ratio={76 / 76} local={local} reducedMotion={reducedMotion} radius={4} position="50% 50%" />
      </motion.div>
    </Section>
  );
}

/* ───────────────────────────── cta ───────────────────────────── */

function CtaScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  return (
    <Section {...shell}>
      <div className="absolute left-1/2 top-[36cqw] -translate-x-1/2">
        <LogoMark size={26} local={local} reducedMotion={reducedMotion} at={0.05} />
      </div>
      <div className="absolute inset-x-0 top-[72cqw] flex flex-col items-center">
        <Title a="Update." b="Turn it sideways." accent={C.cyan} local={local} at={0.5} reducedMotion={reducedMotion} size={10.5} />
        <div className="mt-[6cqw]">
          <Rise local={local} at={1.2} reducedMotion={reducedMotion}>
            <CtaPill text="Update on Google Play" size={4.8} icon={Play} />
          </Rise>
        </div>
        <Rise local={local} at={2.0} reducedMotion={reducedMotion} className="mt-[5cqw]">
          <p className="whitespace-nowrap text-[2.4cqw]" style={{ ...WIDE, letterSpacing: "0.14em", color: C.faint }}>
            Player only · no content included
          </p>
        </Rise>
      </div>
    </Section>
  );
}
