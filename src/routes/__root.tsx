import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="tech-shell flex min-h-screen items-center justify-center px-4 text-slate-100">
      <div className="tech-panel max-w-md p-8 text-center">
        <img src="./branch-emblem.svg" alt="شعار فرع اتصالات ريف دمشق" className="mx-auto mb-5 h-16 w-20 object-contain" />
        <div className="text-5xl font-black text-white">404</div>
        <h2 className="mt-4 text-lg font-black">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">الرابط الذي فتحته غير متوفر في النسخة الحالية.</p>
        <Link to="/" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-cyan-300 px-5 text-sm font-black text-slate-950">العودة إلى مركز المشاريع والمهام</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="tech-shell flex min-h-screen items-center justify-center px-4 text-slate-100">
      <div className="tech-panel max-w-md p-8 text-center">
        <img src="./branch-emblem.svg" alt="شعار فرع اتصالات ريف دمشق" className="mx-auto mb-5 h-16 w-20 object-contain" />
        <h1 className="text-xl font-black">تعذر تحميل الصفحة</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">حدث خطأ غير متوقع. يمكنك إعادة المحاولة دون فقدان البيانات التجريبية المحفوظة على هذا الجهاز.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="h-11 rounded-xl bg-cyan-300 px-5 text-sm font-black text-slate-950">إعادة المحاولة</button>
          <a href="./" className="inline-flex h-11 items-center rounded-xl border border-white/10 px-5 text-sm font-bold text-slate-300">الرئيسية</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "متابعة فرع اتصالات ريف دمشق" },
      { name: "description", content: "منظومة متابعة المشاريع والمهام والهيكل التشغيلي لفرع اتصالات ريف دمشق." },
      { property: "og:title", content: "متابعة فرع اتصالات ريف دمشق" },
      { property: "og:description", content: "متابعة المشاريع والمهام والفرق والحالة التشغيلية ضمن فرع اتصالات ريف دمشق." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "./branch-emblem.svg", type: "image/svg+xml" },
      { rel: "shortcut icon", href: "./branch-emblem.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "./branch-emblem.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return <html lang="ar" dir="rtl"><head><HeadContent /></head><body>{children}<Scripts /></body></html>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return <QueryClientProvider client={queryClient}><Outlet /><Toaster richColors position="top-center" dir="rtl" /></QueryClientProvider>;
}