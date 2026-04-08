import { getLatestTrendRadarData, type TrendTitle, type NewSource, type RssGroup, type StandalonePlatform } from "@/lib/trend-radar";
import { Suspense } from "react";
import DirectionalTransition from "@/components/DirectionalTransition";
import ScrollRestorer from "@/components/ScrollRestorer";
import ToolsCard from "@/components/ToolsCard";
import RecentPostsCard from "@/components/RecentPostsCard";
import ArchiveCard from "@/components/ArchiveCard";
import AuthorProfileCard from "@/components/AuthorProfileCard";
import TrendRadarStats from "@/components/TrendRadarStats";

export const revalidate = 3600; // 1 hour cache, reasonable for 3-times-daily crawls

async function TrendRadarContent() {
  const data = await getLatestTrendRadarData();

  if (!data) {
    return (
      <div className="py-24 flex flex-col items-center gap-2">
        <span className="font-mono text-xs text-zinc-300 dark:text-zinc-700">— 加载失败 —</span>
        <span className="text-xs text-muted-foreground">无法从 R2 获取趋势报告数据，请检查配置或稍后再试。</span>
      </div>
    );
  }

  const { stats, new_titles, rss_items, standalone_data, failed_ids, generated_at } = data;

  const formattedGenerateTime = generated_at
    ? new Date(generated_at).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "未知";

  // Flatten RSS groups → individual title entries for display
  const rssEntries = (rss_items || []).flatMap((group: RssGroup) =>
    (group.titles || []).map((t) => ({ ...t, word: group.word }))
  );

  // Merge standalone platforms + rss_feeds for the tabbed section
  const standalonePlatforms: StandalonePlatform[] = [
    ...(standalone_data?.platforms || []),
    ...(standalone_data?.rss_feeds || []),
  ];

  return (
    <div className="space-y-8">
      {/* ── Hot Keywords (Stats) ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
          <h2 className="text-sm font-semibold text-foreground">趋势看点</h2>
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            {(stats || []).length} 个焦点
          </span>
          <div className="ml-auto flex items-center gap-2">
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
             <span className="text-[10px] font-mono text-muted-foreground/60 uppercase">
               Last Check: {formattedGenerateTime}
             </span>
          </div>
        </div>

        <TrendRadarStats stats={stats || []} />
      </section>

      {/* ── New Topics (Sources) ── */}
      {new_titles && new_titles.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-semibold text-foreground">分榜新增</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {new_titles.map((source: NewSource, sIdx: number) => (
              <div
                key={sIdx}
                className="bg-card/50 rounded-xl p-4 border border-border/40 hover:border-border transition-colors"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-3 bg-primary/40 rounded-full"></div>
                  <h4 className="text-xs font-bold text-foreground">{source.source_name}</h4>
                </div>
                <ul className="space-y-2.5">
                  {source.titles?.slice(0, 5).map((t: TrendTitle, i: number) => (
                    <li key={i}>
                      <a
                        href={t.url || t.mobile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-muted-foreground hover:text-primary transition-colors line-clamp-1 leading-snug"
                        title={t.title}
                      >
                        {t.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── RSS Items (flattened from groups) ── */}
      {rssEntries.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-semibold text-foreground">RSS 订阅更新</h2>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              {rssEntries.length} 条
            </span>
          </div>
          <div className="space-y-2">
            {rssEntries.map((item, i) => (
              <a
                key={i}
                href={item.url || item.mobile_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 group p-3 rounded-xl border border-border/40 bg-card/50 hover:border-border hover:bg-card transition-all duration-200"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {item.source_name && (
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 rounded leading-relaxed shrink-0">
                        {item.source_name}
                      </span>
                    )}
                    {item.word && (
                      <span className="text-[10px] font-mono text-primary/60 bg-primary/5 px-1.5 rounded leading-relaxed shrink-0">
                        {item.word}
                      </span>
                    )}
                    {item.time_display && (
                      <span className="text-[10px] text-muted-foreground/50 ml-auto shrink-0">{item.time_display}</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/80 group-hover:text-primary transition-colors line-clamp-2 leading-relaxed">
                    {item.title}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── Standalone Section (独立展示区) ── */}
      {standalonePlatforms.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-semibold text-foreground">独立展示区</h2>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              {standalonePlatforms.reduce((acc, p) => acc + p.items.length, 0)} 条
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {standalonePlatforms.map((platform, pIdx) => (
              <div
                key={pIdx}
                className="bg-card/50 rounded-xl p-4 border border-border/40 hover:border-border transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3 bg-amber-400/70 rounded-full"></div>
                    <h4 className="text-xs font-bold text-foreground">{platform.name}</h4>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/50">{platform.items.length} 条</span>
                </div>
                <ol className="space-y-2">
                  {platform.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground/40 mt-[3px] w-4 shrink-0 text-right">
                        {i + 1}
                      </span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-muted-foreground hover:text-primary transition-colors line-clamp-2 leading-snug"
                        title={item.title}
                      >
                        {item.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Error Debug ── */}
      {failed_ids && failed_ids.length > 0 && (
        <div className="text-[10px] text-muted-foreground/40 font-mono pt-8">
          Failed probes: {failed_ids.join(", ")}
        </div>
      )}
    </div>
  );
}


export default function TrendRadarPage() {
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
                <TrendRadarContent />
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
