import "@fontsource-variable/archivo/wdth.css";

import type { CSSProperties, ComponentType, ReactNode } from "react";
import { easeInOut, easeOut, spring } from "motion";
import { motion, useTransform, type MotionValue } from "motion/react";
import { ShieldCheck } from "lucide-react";

/*
 * Shared visual kit for the NovaStream films (same file in every motion-* film app).
 * Night navy, electric blue → cyan → mint accents, condensed heavy Archivo headlines.
 * Rules: callouts sit beside screenshots, never on top; orbits are one solid colour; nothing touches the frame edges.
 */

export type Icon = ComponentType<{ size?: number | string; strokeWidth?: number; color?: string; style?: CSSProperties; fill?: string }>;

export const C = {
  ink: "#05080F",
  navy: "#0A1124",
  blue: "#2F7BFF",
  cyan: "#38D5F5",
  mint: "#34E0A1",
  amber: "#FFB547",
  coral: "#FF6B6B",
  text: "#EAF1FF",
  muted: "rgba(214,226,255,0.66)",
  faint: "rgba(214,226,255,0.42)",
  screen: "#0B0F1A",
  card: "#0E1528",
};

export const M = "/media";

export const DISPLAY: CSSProperties = {
  fontFamily: "'Archivo Variable', system-ui, sans-serif",
  fontStretch: "80%",
  fontWeight: 850,
  letterSpacing: "-0.02em",
  lineHeight: 0.98,
};
export const WIDE: CSSProperties = {
  fontFamily: "'Archivo Variable', system-ui, sans-serif",
  fontStretch: "120%",
  fontWeight: 640,
  letterSpacing: "0.26em",
  textTransform: "uppercase",
};
export const BODY: CSSProperties = {
  fontFamily: "'Archivo Variable', system-ui, sans-serif",
  fontStretch: "100%",
};
export const MONO: CSSProperties = {
  fontFamily: "ui-monospace, 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace",
};

export const gradientText = (accent: string): CSSProperties => ({
  backgroundImage: `linear-gradient(100deg, ${C.blue} 0%, ${accent === C.blue ? C.cyan : accent} 100%)`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
});

export const settle = spring({ keyframes: [0, 1], visualDuration: 0.7, bounce: 0.26 });
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* ───────────────────────── motion helpers ───────────────────────── */

export function useLocal(scene: { start: number }, clock: MotionValue<number>) {
  return useTransform(clock, (time) => time - scene.start);
}

export function useSceneShell(
  scene: { start: number; end: number },
  clock: MotionValue<number>,
  reducedMotion: boolean,
  transition: number,
) {
  const opacity = useTransform(clock, (time) => {
    const fadeIn = scene.start === 0 ? 1 : (time - scene.start) / transition;
    const fadeOut = (scene.end + transition - time) / transition;
    return Math.max(0, Math.min(1, fadeIn, fadeOut));
  });
  const scale = useTransform(clock, (time) => {
    if (reducedMotion) return 1;
    if (time > scene.end) return 1 - 0.025 * Math.min(1, (time - scene.end) / transition);
    if (scene.start === 0) return 1;
    const p = clamp01((time - scene.start) / 0.8);
    return 1.025 - 0.025 * easeOut(p);
  });
  return { opacity, scale };
}

export function useProgress(local: MotionValue<number>, from: number, to: number, ease = easeOut) {
  return useTransform(local, [from, to], [0, 1], { ease, clamp: true });
}

export function useRise(local: MotionValue<number>, at: number, reducedMotion: boolean, distance = 2) {
  const p = useProgress(local, at, at + 0.6);
  const y = useTransform(p, (v) => (reducedMotion ? "0cqw" : `${(1 - v) * distance}cqw`));
  return { opacity: p, y };
}

/** Springy pop-in scale (0.6 → 1) starting at `at`. */
export function usePop(local: MotionValue<number>, at: number, reducedMotion: boolean, from = 0.6) {
  return useTransform(local, (t) => (reducedMotion ? 1 : t < at ? from : from + (1 - from) * settle.next((t - at) * 1000).value));
}

export function Section({ opacity, scale, children }: { opacity: MotionValue<number>; scale: MotionValue<number>; children: ReactNode }) {
  return (
    <motion.section className="absolute inset-0 overflow-hidden" style={{ opacity, scale, color: C.text }}>
      {children}
    </motion.section>
  );
}

export function Rise({
  local,
  at,
  reducedMotion,
  distance = 1.2,
  className,
  style,
  children,
}: {
  local: MotionValue<number>;
  at: number;
  reducedMotion: boolean;
  distance?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const r = useRise(local, at, reducedMotion, distance);
  return (
    <motion.div className={className} style={{ ...style, opacity: r.opacity, y: r.y }}>
      {children}
    </motion.div>
  );
}

export function Kicker({ text, color, size = 0.95, style }: { text: string; color: string; size?: number; style?: CSSProperties }) {
  return (
    <div className="flex items-center whitespace-nowrap" style={{ ...WIDE, color, fontSize: `${size}cqw`, gap: `${size * 0.85}cqw`, ...style }}>
      <span className="inline-block shrink-0 rounded-full" style={{ background: color, width: `${size * 0.74}cqw`, height: `${size * 0.74}cqw` }} />
      {text}
    </div>
  );
}

/* ───────────────────────────── frames ───────────────────────────── */

/** One screenshot in a frame. `at` is scene-local; `ratio` is the image's own width/height. */
export type Shot = {
  src: string;
  ratio: number;
  at: number;
  /** Frame aspect while this shot shows; defaults to the image ratio. A taller image pans from top to bottom. */
  frame?: number;
  pan?: [number, number];
  /** Crops into the horizontal middle of the image. */
  zoom?: number;
  /** Horizontal centre of the crop (0..1) when zoomed; defaults to 0.5. */
  focusX?: number;
};

export const SHOT_FADE = 0.55;

function shotIndex(shots: Shot[], t: number) {
  let i = 0;
  for (let j = 0; j < shots.length; j += 1) if (t >= shots[j].at) i = j;
  return i;
}

/** Frame height (cqw) for a given inner width, following the shots and easing between them. */
export function useFrameHeight(local: MotionValue<number>, shots: Shot[], width: number) {
  return useTransform(local, (t) => {
    const i = shotIndex(shots, t);
    const h = (s: Shot) => width / (s.frame ?? s.ratio);
    if (i === 0) return `${h(shots[0])}cqw`;
    const p = easeInOut(clamp01((t - shots[i].at) / SHOT_FADE));
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
    const gone = next !== undefined && t >= next.at + SHOT_FADE;
    return gone ? 0 : fadeIn;
  });
  const zoom = shot.zoom ?? 1;
  const imageWidth = width * zoom;
  const imageHeight = imageWidth / shot.ratio;
  const frameHeight = width / (shot.frame ?? shot.ratio);
  const travel = Math.max(0, imageHeight - frameHeight);
  const fx = shot.focusX ?? 0.5;
  const left = Math.min(0, Math.max(width - imageWidth, width / 2 - imageWidth * fx));
  const y = useTransform(local, (t) => {
    if (!shot.pan || travel === 0) return "0cqw";
    const [a, b] = shot.pan;
    const p = easeInOut(clamp01((t - a) / (b - a)));
    return `${-travel * p}cqw`;
  });
  const scale = useTransform(local, (t) => {
    if (reducedMotion || shot.pan) return 1;
    const end = next ? next.at + SHOT_FADE : shot.at + 12;
    const p = clamp01((t - shot.at) / Math.max(1, end - shot.at));
    return 1 + 0.035 * p;
  });
  return (
    <motion.div className="absolute inset-0" style={{ opacity, zIndex: index }}>
      <motion.img
        src={shot.src}
        alt=""
        draggable={false}
        className="absolute top-0 block max-w-none"
        style={{ y, scale, transformOrigin: "50% 0%", width: `${imageWidth}cqw`, left: `${left}cqw`, height: `${imageHeight}cqw` }}
      />
    </motion.div>
  );
}

export function ShotStack({ shots, local, width, reducedMotion }: { shots: Shot[]; local: MotionValue<number>; width: number; reducedMotion: boolean }) {
  return (
    <>
      {shots.map((shot, i) => (
        <ShotLayer key={`${shot.src}-${shot.at}`} shot={shot} index={i} shots={shots} local={local} width={width} reducedMotion={reducedMotion} />
      ))}
    </>
  );
}

/** Device: a slim dark bezel around the real screenshots. `bezel` and `radius` scale with the device. */
export function DeviceFrame({
  width,
  height,
  accent,
  bezel = 0.75,
  radius = 2.2,
  children,
}: {
  width: number;
  height: MotionValue<string> | string;
  accent: string;
  bezel?: number;
  radius?: number;
  children: ReactNode;
}) {
  return (
    <div
      className="relative"
      style={{
        padding: `${bezel}cqw`,
        borderRadius: `${radius}cqw`,
        background: "linear-gradient(180deg, #1A2238 0%, #0E1424 100%)",
        boxShadow: `0 0 0 ${bezel * 0.11}cqw rgba(170,195,255,0.22), 0 ${radius * 1.1}cqw ${radius * 2.7}cqw rgba(0,0,0,0.6), 0 0 ${radius * 3.6}cqw ${accent}1F`,
      }}
    >
      <motion.div
        className="relative overflow-hidden"
        style={{ width: `${width}cqw`, height, background: C.screen, borderRadius: `${radius - bezel}cqw` }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/** Browser window around a website capture; the content area keeps `ratio` (width / height). */
export function BrowserFrame({
  width,
  ratio,
  url,
  accent,
  scale = 1,
  children,
}: {
  width: number;
  ratio: number;
  url: string;
  accent: string;
  /** Multiplies the chrome sizes (a vertical film needs a bigger bar). */
  scale?: number;
  children: ReactNode;
}) {
  const s = (v: number) => `${v * scale}cqw`;
  return (
    <div
      className="overflow-hidden"
      style={{
        width: `${width}cqw`,
        borderRadius: s(1.2),
        background: "#0D1322",
        boxShadow: `0 0 0 ${s(0.08)} rgba(170,195,255,0.22), 0 ${s(2.4)} ${s(6)} rgba(0,0,0,0.6), 0 0 ${s(8)} ${accent}1A`,
      }}
    >
      <div className="flex items-center" style={{ height: s(2.6), gap: s(0.55), padding: `0 ${s(1.1)}`, background: "#121A2D" }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <span key={c} className="shrink-0 rounded-full" style={{ width: s(0.7), height: s(0.7), background: c }} />
        ))}
        <div
          className="mx-auto flex items-center justify-center whitespace-nowrap rounded-full"
          style={{ ...BODY, height: s(1.6), width: "60%", gap: s(0.5), fontSize: s(0.85), background: "rgba(255,255,255,0.06)", color: C.muted }}
        >
          <ShieldCheck size={s(0.9)} color={C.mint} />
          {url}
        </div>
        <span style={{ width: s(2.6) }} />
      </div>
      <div className="relative overflow-hidden" style={{ height: `${width / ratio}cqw`, background: C.ink }}>
        {children}
      </div>
    </div>
  );
}

/** Illustration in a rounded window. Illustrations are drawings, never shown as photos. */
export function Picture({
  src,
  width,
  ratio,
  local,
  reducedMotion,
  radius = 1.6,
  drift = 0.05,
  position = "50% 50%",
}: {
  src: string;
  width: number;
  ratio: number;
  local: MotionValue<number>;
  reducedMotion: boolean;
  radius?: number;
  drift?: number;
  position?: string;
}) {
  const scale = useTransform(local, (t) => (reducedMotion ? 1 : 1 + drift * clamp01(t / 12)));
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: `${width}cqw`,
        height: `${width / ratio}cqw`,
        borderRadius: `${radius}cqw`,
        boxShadow: `0 0 0 ${radius * 0.05}cqw rgba(170,195,255,0.22), 0 ${radius * 1.4}cqw ${radius * 3.5}cqw rgba(0,0,0,0.55)`,
      }}
    >
      <motion.img
        src={src}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ scale, objectPosition: position }}
      />
    </div>
  );
}

/**
 * The app icon with one solid orbit behind it: a single colour at full strength along its whole length.
 * The tile hides the middle of the ring, as a planet hides its rings.
 */
export function LogoMark({ size, local, reducedMotion, at = 0 }: { size: number; local: MotionValue<number>; reducedMotion: boolean; at?: number }) {
  const iconScale = useTransform(local, (t) => (reducedMotion ? 1 : 0.6 + 0.4 * settle.next(Math.max(0, t - at - 0.05) * 1000).value));
  const iconOpacity = useProgress(local, at, at + 0.35);
  const ring = useProgress(local, at + 0.25, at + 1.1);
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

/** Soft, slowly drifting colour pools on the night navy. */
export function Pools({ clock, accent, reducedMotion, tall = false }: { clock: MotionValue<number>; accent: string; reducedMotion: boolean; tall?: boolean }) {
  const driftA = useTransform(clock, (t) => (reducedMotion ? "0cqw" : `${Math.sin(t * 0.22) * 3}cqw`));
  const driftB = useTransform(clock, (t) => (reducedMotion ? "0cqw" : `${Math.cos(t * 0.18) * 3}cqw`));
  const size = tall ? 110 : 60;
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{ background: `radial-gradient(90% 80% at 50% 30%, ${C.navy} 0%, ${C.ink} 75%)` }} />
      <motion.div
        className="absolute rounded-full transition-[background] duration-700"
        style={{
          left: tall ? "-30cqw" : "8cqw",
          top: tall ? "-20cqw" : "-14cqw",
          width: `${size}cqw`,
          height: `${size}cqw`,
          x: driftA,
          background: `radial-gradient(circle, ${C.blue}33 0%, ${C.blue}00 65%)`,
        }}
      />
      <motion.div
        className="absolute rounded-full transition-[background] duration-700"
        style={{
          right: tall ? "-30cqw" : "4cqw",
          top: tall ? "80cqw" : "12cqw",
          width: `${size}cqw`,
          height: `${size}cqw`,
          y: driftB,
          background: `radial-gradient(circle, ${accent}26 0%, ${accent}00 65%)`,
        }}
      />
    </div>
  );
}

/** Pill call to action (no prices, no checkout). */
export function CtaPill({ text, size, icon: Glyph }: { text: string; size: number; icon: Icon }) {
  return (
    <div
      className="flex items-center whitespace-nowrap rounded-full font-bold"
      style={{
        ...BODY,
        fontSize: `${size}cqw`,
        gap: `${size * 0.5}cqw`,
        padding: `${size * 0.7}cqw ${size * 1.5}cqw`,
        background: `linear-gradient(90deg, ${C.blue}, ${C.cyan})`,
        color: "#03101F",
        boxShadow: `0 ${size * 0.6}cqw ${size * 2.4}cqw ${C.blue}55`,
      }}
    >
      <Glyph size={`${size * 0.9}cqw`} strokeWidth={2.6} color="#03101F" fill="#03101F" />
      {text}
    </div>
  );
}
