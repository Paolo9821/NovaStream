import { MotionPlayer, type FilmLayerProps, type SceneContent, type SceneRenderProps } from "./motion-player";
import { motion, useTransform, type MotionValue } from "motion/react";
import { ArrowDown, Check, Lock, Tv, UserPlus } from "lucide-react";
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
  useLocal,
  usePop,
  useProgress,
  useRise,
  useSceneShell,
  type Shot,
} from "./kit";

/*
 * "Stop typing playlist links with your remote" — vertical Short (1080 × 1920), English narration.
 * Story: the pain (a drawn TV keyboard, a 60-character link, one typo) → the trick (the website on a phone,
 * the key from the TV) → the payoff (the playlist lands on the TV).
 * Safe area: key content between 26.7cqw and 142cqw from the top, left of 88cqw.
 */

type FilmScene = SceneContent & { id: "pov" | "pain" | "fix" | "key" | "done" | "cta" };

const content: FilmScene[] = [
  {
    id: "pov",
    chapter: "POV",
    voiceover: "/rork-vo-pov-v1.mp3",
    effects: [
      { src: "/rork-sfx-click-v1.mp3", at: 1.6, volume: 0.22 },
      { src: "/rork-sfx-click-v1.mp3", at: 2.9, volume: 0.22 },
      { src: "/rork-sfx-click-v1.mp3", at: 4.3, volume: 0.22 },
    ],
  },
  { id: "pain", voiceover: "/rork-vo-pain-v1.mp3", effects: [{ src: "/rork-sfx-click-v1.mp3", at: 0.9, volume: 0.26 }] },
  { id: "fix", chapter: "The trick", voiceover: "/rork-vo-fix-v1.mp3" },
  { id: "key", voiceover: "/rork-vo-key-v1.mp3" },
  { id: "done", chapter: "Done", voiceover: "/rork-vo-done-v1.mp3", effects: [{ src: "/rork-sfx-ding-v1.mp3", at: 3.7, volume: 0.32 }] },
  { id: "cta", chapter: "Follow", voiceover: "/rork-vo-cta-v1.mp3" },
];

const musicBed: string | null = "/rork-music-v1.mp3";
const TRANSITION_SECONDS = 0.45;
const ACCENT: Record<FilmScene["id"], string> = { pov: C.amber, pain: C.coral, fix: C.mint, key: C.cyan, done: C.mint, cta: C.blue };

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
    case "pov":
      return <PovScene {...props} />;
    case "pain":
      return <PainScene {...props} />;
    case "fix":
      return <FixScene {...props} />;
    case "key":
      return <KeyScene {...props} />;
    case "done":
      return <DoneScene {...props} />;
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

function Title({ a, b, accent, local, at, reducedMotion, size = 10.5 }: { a: string; b: string; accent: string; local: MotionValue<number>; at: number; reducedMotion: boolean; size?: number }) {
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

/* ───────────────────────────── the TV text field and keyboard (drawn) ───────────────────────────── */

const LINK = "http://provider.example.tv:8080/get.php?username=alex&pass=";
const LINK_TOTAL = 60;
const KEYS = ["1234567890", "qwertyuiop", "asdfghjkl:", "zxcvbnm./?"];
const KEY = 6.6;
const KEY_GAP = 0.9;

function TvField({ text, count, wrong, local, shake }: { text: MotionValue<string>; count: MotionValue<string>; wrong?: MotionValue<number>; local: MotionValue<number>; shake?: MotionValue<number> }) {
  const caret = useTransform(local, (t) => (Math.floor(t * 2.2) % 2 === 0 ? 1 : 0));
  const x = useTransform(shake ?? local, (v) => (shake ? `${Math.sin(v * Math.PI * 8) * 1.6 * (1 - v) * (v > 0 && v < 1 ? 1 : 0)}cqw` : "0cqw"));
  return (
    <motion.div className="w-[82cqw]" style={{ x }}>
      <div className="mb-[1.2cqw] flex items-center justify-between text-[2.6cqw]" style={{ ...WIDE, letterSpacing: "0.16em", color: C.faint }}>
        <span>m3u playlist URL</span>
        <motion.span style={{ ...MONO, letterSpacing: 0, fontSize: "3.4cqw", color: C.amber }}>{count}</motion.span>
      </div>
      <div className="flex h-[10cqw] items-center overflow-hidden rounded-[2cqw] px-[3cqw]" style={{ background: "#0E1528", boxShadow: `inset 0 0 0 0.3cqw ${C.blue}` }}>
        <div className="flex min-w-0 flex-1 items-center justify-end overflow-hidden whitespace-nowrap text-[4.2cqw]" style={{ ...MONO, color: C.text }}>
          <motion.span className="shrink-0">{text}</motion.span>
          {wrong && (
            <motion.span className="shrink-0 rounded-[0.6cqw] px-[0.3cqw]" style={{ opacity: wrong, color: "#fff", background: C.coral }}>
              k
            </motion.span>
          )}
          <motion.span className="ml-[0.3cqw] h-[5.4cqw] w-[0.5cqw] shrink-0 rounded-full" style={{ opacity: caret, background: C.cyan }} />
        </div>
      </div>
    </motion.div>
  );
}

function Keyboard({ focus }: { focus: MotionValue<string> }) {
  return (
    <div className="flex flex-col" style={{ gap: `${KEY_GAP}cqw` }}>
      {KEYS.map((row) => (
        <div key={row} className="flex" style={{ gap: `${KEY_GAP}cqw` }}>
          {row.split("").map((k) => (
            <KeyCap key={k} k={k} focus={focus} />
          ))}
        </div>
      ))}
    </div>
  );
}

function KeyCap({ k, focus }: { k: string; focus: MotionValue<string> }) {
  const bg = useTransform(focus, (f) => (f === k ? C.amber : "rgba(214,226,255,0.07)"));
  const color = useTransform(focus, (f) => (f === k ? "#1A1206" : C.muted));
  const scale = useTransform(focus, (f) => (f === k ? 1.08 : 1));
  return (
    <motion.span
      className="flex items-center justify-center rounded-[1.2cqw] text-[3.4cqw] font-bold"
      style={{ ...BODY, width: `${KEY}cqw`, height: `${KEY}cqw`, background: bg, color, scale }}
    >
      {k}
    </motion.span>
  );
}

/* ───────────────────────────── pov ───────────────────────────── */

function PovScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const typed = useTransform(local, (t) => Math.max(0, Math.min(LINK.length, Math.floor((t - 1.0) * 3.6))));
  const text = useTransform(typed, (n) => LINK.slice(0, n));
  const count = useTransform(typed, (n) => `${n}/${LINK_TOTAL}`);
  const focus = useTransform(typed, (n) => {
    const ch = LINK[n] ?? "";
    return KEYS.some((r) => r.includes(ch)) ? ch : "p";
  });
  const pic = useRise(local, 0.2, reducedMotion, 3);
  return (
    <Section {...shell}>
      <div className="absolute inset-x-0 top-[27cqw] flex flex-col items-center text-center">
        <Rise local={local} at={0.05} reducedMotion={reducedMotion}>
          <span className="text-[12cqw] leading-none" style={{ ...DISPLAY, ...gradientText(C.amber) }}>
            POV:
          </span>
        </Rise>
        <Rise local={local} at={0.6} reducedMotion={reducedMotion}>
          <p className="mt-[1.4cqw] whitespace-nowrap text-[5cqw] font-bold leading-[1.15]" style={BODY}>
            typing a 60-character link
            <br />
            with your TV remote
          </p>
        </Rise>
      </div>
      <motion.div className="absolute left-[9cqw] top-[56cqw]" style={{ opacity: pic.opacity, y: pic.y }}>
        <Picture src={`${M}/ill-remote-v1.jpg`} width={76} ratio={76 / 34} local={local} reducedMotion={reducedMotion} radius={3.4} position="50% 57%" />
      </motion.div>
      <Rise local={local} at={0.8} reducedMotion={reducedMotion} className="absolute left-[9cqw] top-[93cqw]">
        <TvField text={text} count={count} local={local} />
      </Rise>
      <Rise local={local} at={1.0} reducedMotion={reducedMotion} className="absolute left-[9cqw] top-[113cqw]">
        <Keyboard focus={focus} />
      </Rise>
    </Section>
  );
}

/* ───────────────────────────── pain ───────────────────────────── */

const PAIN_TYPED = 23;

function PainScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const cleared = useTransform(local, (t) => t >= 2.5);
  const text = useTransform(cleared, (c) => (c ? "" : LINK.slice(0, PAIN_TYPED)));
  const wrong = useTransform(local, (t) => (t >= 0.9 && t < 2.5 ? 1 : 0));
  const count = useTransform(local, (t) => (t >= 2.5 ? `0/${LINK_TOTAL}` : t >= 0.9 ? `${PAIN_TYPED + 1}/${LINK_TOTAL}` : `${PAIN_TYPED}/${LINK_TOTAL}`));
  const shake = useTransform(local, (t) => (reducedMotion ? 0 : clamp01((t - 1.2) / 0.6)));
  const focus = useTransform(local, (t) => (t >= 0.9 && t < 2.5 ? "k" : t >= 2.5 ? "1" : "l"));
  const big = usePop(local, 2.5, reducedMotion, 0.6);
  const bigOpacity = useProgress(local, 2.5, 2.75);
  return (
    <Section {...shell}>
      <div className="absolute inset-x-0 top-[27cqw] flex flex-col items-center">
        <Title a="One typo." b="Start over." accent={C.coral} local={local} at={0.6} reducedMotion={reducedMotion} size={12} />
      </div>
      <motion.div className="absolute inset-x-0 top-[57cqw] flex justify-center" style={{ scale: big, opacity: bigOpacity }}>
        <span className="text-[17cqw] leading-none" style={{ ...MONO, fontWeight: 700, color: C.coral }}>
          0/60
        </span>
      </motion.div>
      <div className="absolute left-[9cqw] top-[93cqw]">
        <TvField text={text} count={count} wrong={wrong} local={local} shake={shake} />
      </div>
      <div className="absolute left-[9cqw] top-[113cqw]">
        <Keyboard focus={focus} />
      </div>
    </Section>
  );
}

/* ───────────────────────────── phone with the website ───────────────────────────── */

const PH_W = 48;
const PH_H = 84;
const BAR = 6;
const SITE_ZOOM = 1.72;
const SITE_FRAME = PH_W / (PH_H - BAR);

function SitePhone({ shots, url, local, accent, reducedMotion }: { shots: Shot[]; url: MotionValue<string>; local: MotionValue<number>; accent: string; reducedMotion: boolean }) {
  return (
    <DeviceFrame width={PH_W} height={`${PH_H}cqw`} accent={accent} bezel={1.3} radius={6}>
      <div className="absolute inset-0" style={{ background: "#06090E" }} />
      <div className="absolute inset-x-0 top-0 flex items-center justify-center px-[2cqw]" style={{ height: `${BAR}cqw`, background: "#111827" }}>
        <div className="flex h-[3.8cqw] w-full items-center gap-[1cqw] rounded-full px-[1.8cqw]" style={{ background: "rgba(255,255,255,0.07)" }}>
          <Lock size="2cqw" color={C.mint} strokeWidth={2.4} />
          <motion.span className="min-w-0 overflow-hidden whitespace-nowrap text-[2.4cqw]" style={{ ...BODY, color: C.text }}>
            {url}
          </motion.span>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ top: `${BAR}cqw` }}>
        <ShotStack shots={shots} local={local} width={PH_W} reducedMotion={reducedMotion} />
      </div>
    </DeviceFrame>
  );
}

const SITE_URL = "novastreamapp.com/playlist";

/* ───────────────────────────── fix ───────────────────────────── */

function FixScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const url = useTransform(local, (t) => SITE_URL.slice(0, Math.max(0, Math.min(SITE_URL.length, Math.floor((t - 2.6) * 11)))));
  const phone = useRise(local, 1.4, reducedMotion, 8);
  const shots: Shot[] = [{ src: `${M}/site-pl-open-v1.jpg`, ratio: 1.6, frame: SITE_FRAME, at: 0, zoom: SITE_ZOOM }];
  return (
    <Section {...shell}>
      <div className="absolute inset-x-0 top-[27cqw] flex flex-col items-center">
        <Rise local={local} at={0.05} reducedMotion={reducedMotion}>
          <Kicker text="Here's the trick" color={C.mint} size={2.6} />
        </Rise>
        <div className="mt-[2cqw]">
          <Title a="Use your" b="phone instead." accent={C.mint} local={local} at={0.2} reducedMotion={reducedMotion} />
        </div>
      </div>
      <motion.div className="absolute left-1/2 top-[55cqw]" style={{ x: "-50%", opacity: phone.opacity, y: phone.y }}>
        <SitePhone shots={shots} url={url} local={local} accent={C.mint} reducedMotion={reducedMotion} />
      </motion.div>
    </Section>
  );
}

/* ───────────────────────────── key ───────────────────────────── */

const TV_W = 80;

function KeyScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const tv = useRise(local, 0.2, reducedMotion, 4);
  const device = "1E:68:F3:15:4A:C3";
  const key = "J4V V9D";
  const deviceTyped = useTransform(local, (t) => device.slice(0, Math.max(0, Math.min(device.length, Math.floor((t - 1.0) * 14)))));
  const keyTyped = useTransform(local, (t) => key.slice(0, Math.max(0, Math.min(key.length, Math.floor((t - 2.4) * 7)))));
  return (
    <Section {...shell}>
      <div className="absolute inset-x-0 top-[27cqw] flex flex-col items-center">
        <Title a="Copy the key" b="from your TV." accent={C.cyan} local={local} at={0.05} reducedMotion={reducedMotion} />
      </div>
      <motion.div className="absolute left-1/2 top-[52cqw] flex flex-col items-center" style={{ x: "-50%", opacity: tv.opacity, y: tv.y }}>
        <DeviceFrame width={TV_W} height={`${TV_W / 2.693}cqw`} accent={C.cyan} bezel={1} radius={2}>
          <img src={`${M}/app-webkey-v1.jpg`} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        </DeviceFrame>
        <div className="h-[1.6cqw] w-[18cqw] rounded-b-[1cqw]" style={{ background: "#1A2238" }} />
      </motion.div>
      <Rise local={local} at={0.9} reducedMotion={reducedMotion} className="absolute inset-x-0 top-[89cqw] flex justify-center">
        <ArrowDown size="6cqw" color={C.cyan} strokeWidth={2.4} />
      </Rise>
      <div className="absolute left-[9cqw] top-[98cqw] flex w-[76cqw] flex-col gap-[2.4cqw]">
        <Rise local={local} at={1.0} reducedMotion={reducedMotion}>
          <Field label="Device" value={deviceTyped} size={5} accent={C.cyan} />
        </Rise>
        <Rise local={local} at={2.3} reducedMotion={reducedMotion}>
          <Field label="Key · 6 characters" value={keyTyped} size={9} accent={C.cyan} />
        </Rise>
      </div>
    </Section>
  );
}

function Field({ label, value, size, accent }: { label: string; value: MotionValue<string>; size: number; accent: string }) {
  return (
    <div className="rounded-[2.4cqw] px-[3.4cqw] py-[2.4cqw]" style={{ background: "#0E1528", boxShadow: `inset 0 0 0 0.25cqw ${accent}66` }}>
      <div className="text-[2.4cqw]" style={{ ...WIDE, letterSpacing: "0.16em", color: C.faint }}>
        {label}
      </div>
      <motion.div className="mt-[1cqw] whitespace-nowrap" style={{ ...MONO, fontWeight: 700, fontSize: `${size}cqw`, height: `${size * 1.2}cqw`, lineHeight: `${size * 1.2}cqw`, color: C.text }}>
        {value}
      </motion.div>
    </div>
  );
}

/* ───────────────────────────── done ───────────────────────────── */

function DoneScene({ scene, clock, reducedMotion }: Props) {
  const shell = useShell(scene, clock, reducedMotion);
  const local = useLocal(scene, clock);
  const url = useTransform(local, () => SITE_URL);
  const shots: Shot[] = [{ src: `${M}/site-pl-list-v1.jpg`, ratio: 1920 / 2280, frame: SITE_FRAME, at: 0, zoom: SITE_ZOOM, pan: [0.4, 2.6] }];
  const phoneOpacity = useTransform(local, (t) => 1 - clamp01((t - 3.0) / 0.45));
  const phoneScale = useTransform(local, (t) => (reducedMotion ? 1 : 1 - 0.08 * clamp01((t - 3.0) / 0.45)));
  const tv = useRise(local, 3.3, reducedMotion, 4);
  const badge = usePop(local, 3.7, reducedMotion, 0.5);
  const badgeOpacity = useProgress(local, 3.7, 3.95);
  return (
    <Section {...shell}>
      <div className="absolute inset-x-0 top-[27cqw] flex flex-col items-center">
        <Title a="Paste. Send." b="It's on your TV." accent={C.mint} local={local} at={0.05} reducedMotion={reducedMotion} />
      </div>
      <motion.div className="absolute left-1/2 top-[55cqw]" style={{ x: "-50%", opacity: phoneOpacity, scale: phoneScale }}>
        <SitePhone shots={shots} url={url} local={local} accent={C.mint} reducedMotion={reducedMotion} />
      </motion.div>
      <motion.div className="absolute left-1/2 top-[58cqw] flex flex-col items-center" style={{ x: "-50%", opacity: tv.opacity, y: tv.y }}>
        <DeviceFrame width={TV_W} height={`${TV_W / 2.906}cqw`} accent={C.mint} bezel={1} radius={2}>
          <img src={`${M}/app-accounts-v1.jpg`} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        </DeviceFrame>
        <div className="h-[1.6cqw] w-[18cqw] rounded-b-[1cqw]" style={{ background: "#1A2238" }} />
        <motion.div
          className="mt-[3.4cqw] flex items-center gap-[1.6cqw] rounded-full px-[4cqw] py-[1.8cqw] text-[4.2cqw] font-bold"
          style={{ ...BODY, scale: badge, opacity: badgeOpacity, background: `${C.mint}22`, boxShadow: `inset 0 0 0 0.25cqw ${C.mint}88` }}
        >
          <span className="flex h-[5cqw] w-[5cqw] items-center justify-center rounded-full" style={{ background: C.mint }}>
            <Check size="3.2cqw" color="#03140D" strokeWidth={3.4} />
          </span>
          <Tv size="4.2cqw" color={C.mint} />
          My TV · Active
        </motion.div>
      </motion.div>
      <div className="absolute inset-x-0 top-[112cqw] flex flex-col items-center text-center">
        <Rise local={local} at={4.9} reducedMotion={reducedMotion}>
          <p className="whitespace-nowrap text-[8cqw]" style={DISPLAY}>
            No remote typing.
          </p>
        </Rise>
        <Rise local={local} at={6.2} reducedMotion={reducedMotion}>
          <p className="mt-[0.6cqw] whitespace-nowrap pb-[1cqw] text-[8cqw]" style={{ ...DISPLAY, ...gradientText(C.mint) }}>
            Ever again.
          </p>
        </Rise>
      </div>
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
        <Title a="Follow for more" b="TV tricks." accent={C.cyan} local={local} at={0.6} reducedMotion={reducedMotion} />
        <div className="mt-[6cqw]">
          <Rise local={local} at={1.4} reducedMotion={reducedMotion}>
            <CtaPill text="Follow" size={4.8} icon={UserPlus} />
          </Rise>
        </div>
        <Rise local={local} at={2.0} reducedMotion={reducedMotion} className="mt-[5cqw]">
          <p className="whitespace-nowrap text-[2.4cqw]" style={{ ...WIDE, letterSpacing: "0.14em", color: C.faint }}>
            NovaStream · player only · no content included
          </p>
        </Rise>
      </div>
    </Section>
  );
}
