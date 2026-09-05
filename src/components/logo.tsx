import { cn } from "@/lib/utils";

/** Public-demo branding. Real organization identity belongs only in private deployment config. */
export const LOGO_SRC = "/logo.svg";

export function Logo({ size = 40, className, showFallbackLetters = true }: {
  size?: number; className?: string; showFallbackLetters?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative grid place-items-center rounded-lg bg-primary/10 overflow-hidden ring-1 ring-primary/20",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label="شعار النسخة التجريبية"
    >
      <img
        src={LOGO_SRC}
        alt=""
        className="absolute inset-0 h-full w-full object-contain"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
      {showFallbackLetters && (
        <span className="pointer-events-none text-[10px] font-black text-primary/70">م.ت</span>
      )}
    </div>
  );
}

export function BrandBlock({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Logo size={compact ? 36 : 44} />
      <div className="flex flex-col leading-tight">
        <span className="text-[11px] text-muted-foreground">نسخة عرض عامة</span>
        <span className="text-sm font-bold text-foreground">منظومة إدارة التكليفات</span>
      </div>
    </div>
  );
}
