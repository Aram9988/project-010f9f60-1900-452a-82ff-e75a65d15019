import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-4">
      <div className="max-w-md rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="text-5xl font-black text-slate-950">404</div>
        <h2 className="mt-4 text-lg font-black">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">الرابط الذي فتحته غير متوفر في النسخة الحالية.</p>
        <Link to="/" className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-indigo-600 px-5 text-sm font-bold text-white">العودة إلى مركز التكليفات</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-4">
      <div className="max-w-md rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-black">تعذر تحميل الصفحة</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">حدث خطأ غير متوقع. يمكنك إعادة المحاولة دون فقدان البيانات التجريبية المحفوظة على هذا الجهاز.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="h-11 rounded-2xl bg-indigo-600 px-5 text-sm font-bold text-white">إعادة المحاولة</button>
          <a href="./" className="inline-flex h-11 items-center rounded-2xl border border-slate-200 px-5 text-sm font-bold text-slate-600">الرئيسية</a>
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
      { title: "مركز التكليفات | Command Center" },
      { name: "description", content: "تطبيق عربي مبسط لإصدار التكليفات ومتابعة التنفيذ والاعتماد." },
      { property: "og:title", content: "مركز التكليفات" },
      { property: "og:description", content: "إصدار، متابعة، تحديث واعتماد التكليفات في واجهة تنفيذية واحدة." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "./favicon.ico", type: "image/x-icon" },
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
