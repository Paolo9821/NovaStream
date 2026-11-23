import logo from "@/assets/novastream-logo.png";
import { cn } from "@/lib/utils";

/** The official NovaStream app icon, used as the site's logo in every header. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={logo}
      alt=""
      aria-hidden
      width={36}
      height={36}
      draggable={false}
      className={cn("h-9 w-9 shrink-0 select-none rounded-xl shadow-[0_0_18px_rgba(37,99,235,0.35)]", className)}
    />
  );
}
