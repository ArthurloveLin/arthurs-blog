import { getTrendRadarData, listTrendRadarReports } from "@/lib/trend-radar";
import { Suspense } from "react";
import DirectionalTransition from "@/components/DirectionalTransition";
import ScrollRestorer from "@/components/ScrollRestorer";
import ToolsCard from "@/components/ToolsCard";
import RecentPostsCard from "@/components/RecentPostsCard";
import ArchiveCard from "@/components/ArchiveCard";
import AuthorProfileCard from "@/components/AuthorProfileCard";
import TrendRadarDisplay from "@/components/TrendRadarDisplay";

export const revalidate = 3600; // 1 hour cache, reasonable for 3-times-daily crawls

async function TrendRadarContent({
  searchParams,
}: {
  searchParams: { report?: string };
}) {
  const reportKey = searchParams.report || "reports/latest.json";
  const [data, history] = await Promise.all([
    getTrendRadarData(reportKey),
    listTrendRadarReports(),
  ]);

  if (!data) {
    return (
      <div className="py-24 flex flex-col items-center gap-2">
        <span className="font-mono text-xs text-zinc-300 dark:text-zinc-700">— 加载失败 —</span>
        <span className="text-xs text-muted-foreground">无法从 R2 获取趋势报告数据 ({reportKey})。</span>
      </div>
    );
  }

  const { failed_ids, generated_at } = data;

  const formattedGenerateTime = generated_at
    ? new Date(generated_at).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "未知";

  return (
    <div className="space-y-8">
      <TrendRadarDisplay
        data={data}
        formattedTime={formattedGenerateTime}
        history={history}
        currentReportKey={reportKey}
      />

      {/* ── Error Debug ── */}
      {failed_ids && failed_ids.length > 0 && (
        <div className="text-[10px] text-muted-foreground/40 font-mono pt-8">
          Failed probes: {failed_ids.join(", ")}
        </div>
      )}
    </div>
  );
}


export default function TrendRadarPage({
  searchParams,
}: {
  searchParams: { report?: string };
}) {
  return (
    <DirectionalTransition>
      <ScrollRestorer />
      <main className="min-h-screen bg-background">
        {/* ── Hero ── */}
        <div className="relative border-b border-border bg-background overflow-hidden">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-red-400/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob pointer-events-none"></div>
          <div className="absolute -top-10 right-1/4 w-72 h-72 bg-blue-400/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000 pointer-events-none"></div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-12 lg:pt-20 lg:pb-16 z-10">
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase mb-5">
              News / Trend Radar
            </p>
            <h1 className="text-[2rem] lg:text-[2.5rem] font-semibold tracking-tight leading-[1.2] text-foreground max-w-lg">
              <span className="block text-gradient-primary">趋势雷达</span>
              全网热点实时追踪
            </h1>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-sm">
              多平台热榜聚合分析，挖掘隐藏在信息流中的焦点与变化。所有数据通过 S3 (Cloudflare R2) 自动同步。
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left */}
            <aside className="hidden md:block md:col-span-4 lg:col-span-3">
              <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-none space-y-4 pb-12">
                <AuthorProfileCard id="trend-radar-author" compact={true} />
                <ToolsCard />
              </div>
            </aside>

            {/* Main */}
            <section className="md:col-span-8 lg:col-span-6 min-h-[500px]">
              <Suspense
                fallback={
                  <div className="py-24 flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <span className="text-xs text-muted-foreground font-mono">加载中...</span>
                  </div>
                }
              >
                <TrendRadarContent searchParams={searchParams} />
              </Suspense>
            </section>

            {/* Right */}
            <aside className="hidden lg:block lg:col-span-3">
              <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-none space-y-4 pb-12">
                <RecentPostsCard />
                <ArchiveCard />
              </div>
            </aside>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-border mt-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
            <p className="font-mono text-[11px] text-muted-foreground text-center sm:text-left">
              © {new Date().getFullYear()} Arthur & Grace · TrendRadar Module
            </p>
          </div>
        </footer>
      </main>
    </DirectionalTransition>
  );
}
