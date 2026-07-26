import { cn } from "@/lib/utils";

/**
 * Institutional logo. Drop the transparent PNG asset at
 * `src/assets/logo.svg` (or edit LOGO_SRC below) — this component
 * gracefully falls back to a badge if the asset is missing.
 */
export const LOGO_SRC = "/logo.svg"; // placed in /public — replace with the gold eagle PNG

export function Logo({ size = 40, className, showFallbackLetters = true }: {
  size?: number; className?: string; showFallbackLetters?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative grid place-items-center rounded-lg bg-primary/10 text-primary-foreground overflow-hidden ring-1 ring-primary/20",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label="شعار وزارة الداخلية — قيادة الأمن الداخلي"
    >
      <img
        src={LOGO_SRC}
        alt=""
        className="absolute inset-0 h-full w-full object-contain"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
      {showFallbackLetters && (
        <span className="pointer-events-none text-[10px] font-black text-primary/70">و.د</span>
      )}
    </div>
  );
}

export function BrandBlock({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Logo size={compact ? 36 : 44} />
      <div className="flex flex-col leading-tight">
        <span className="text-[11px] text-muted-foreground">وزارة الداخلية · قيادة الأمن الداخلي</span>
        <span className="text-sm font-bold text-foreground">فرع اتصالات ريف دمشق</span>
      </div>
    </div>
  );
}
