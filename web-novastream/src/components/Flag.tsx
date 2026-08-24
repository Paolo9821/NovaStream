import { memo, type ReactElement } from "react";

import { cn } from "@/lib/utils";

export type FlagCode = "it" | "gb" | "es" | "fr" | "de" | "pt" | "ro" | "tr";

/**
 * Builds the point list of a five-pointed star.
 * @param cx horizontal centre
 * @param cy vertical centre
 * @param outer radius of the tips
 * @param inner radius of the inner corners
 * @param rotation degrees, 0 puts a tip straight up
 */
function starPoints(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  rotation: number,
): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = ((i * 36 + rotation - 90) * Math.PI) / 180;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return points.join(" ");
}

const FLAGS: Record<FlagCode, ReactElement> = {
  it: (
    <>
      <rect width="20" height="40" fill="#008C45" />
      <rect x="20" width="20" height="40" fill="#F4F5F0" />
      <rect x="40" width="20" height="40" fill="#CD212A" />
    </>
  ),
  gb: (
    <>
      <clipPath id="flag-gb-clip">
        <path d="M30,20 h30 v20 z v20 h-30 z h-30 v-20 z v-20 h30 z" />
      </clipPath>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#FFF" strokeWidth="8" />
      <path
        d="M0,0 L60,40 M60,0 L0,40"
        clipPath="url(#flag-gb-clip)"
        stroke="#C8102E"
        strokeWidth="5"
      />
      <path d="M30,0 V40 M0,20 H60" stroke="#FFF" strokeWidth="13" />
      <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="8" />
    </>
  ),
  es: (
    <>
      <rect width="60" height="40" fill="#AA151B" />
      <rect y="10" width="60" height="20" fill="#F1BF00" />
      <rect x="14" y="15" width="7" height="10" rx="1" fill="#AA151B" opacity="0.85" />
    </>
  ),
  fr: (
    <>
      <rect width="20" height="40" fill="#002395" />
      <rect x="20" width="20" height="40" fill="#F4F5F0" />
      <rect x="40" width="20" height="40" fill="#ED2939" />
    </>
  ),
  de: (
    <>
      <rect width="60" height="40" fill="#000000" />
      <rect y="13.33" width="60" height="13.34" fill="#DD0000" />
      <rect y="26.67" width="60" height="13.33" fill="#FFCE00" />
    </>
  ),
  pt: (
    <>
      <rect width="60" height="40" fill="#DA291C" />
      <rect width="24" height="40" fill="#046A38" />
      <circle cx="24" cy="20" r="8.5" fill="#FFE900" />
      <circle cx="24" cy="20" r="6" fill="#046A38" />
      <ellipse cx="24" cy="20" rx="3" ry="4.2" fill="#F4F5F0" />
      <circle cx="24" cy="20" r="1.6" fill="#DA291C" />
    </>
  ),
  ro: (
    <>
      <rect width="20" height="40" fill="#002B7F" />
      <rect x="20" width="20" height="40" fill="#FCD116" />
      <rect x="40" width="20" height="40" fill="#CE1126" />
    </>
  ),
  tr: (
    <>
      <rect width="60" height="40" fill="#E30A17" />
      <circle cx="22" cy="20" r="9.5" fill="#F4F5F0" />
      <circle cx="25.6" cy="20" r="7.6" fill="#E30A17" />
      <polygon points={starPoints(35.5, 20, 4.8, 2, 180)} fill="#F4F5F0" />
    </>
  ),
};

/** Rounded 3:2 flag drawn inline, so it renders identically on every device. */
export const Flag = memo(function Flag({
  code,
  label,
  className,
}: {
  code: FlagCode;
  label: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 60 40"
      role="img"
      aria-label={label}
      className={cn(
        "h-5 w-[30px] shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.16)]",
        className,
      )}
    >
      {FLAGS[code]}
    </svg>
  );
});
