import { getTrendRadarData, listTrendRadarReports } from "@/lib/trend-radar";
import { formatStableDate } from "@/lib/date-format";
import { Suspense } from "react";
import DirectionalTransition from "@/components/DirectionalTransition";
import ScrollRestorer from "@/components/ScrollRestorer";
import TrendRadarDisplay from "@/components/TrendRadarDisplay";
import PageHero from "@/components/PageHero";
import { getSiteConfig } from "@/lib/blog";

export const revalidate = 3600;

async function TrendRadarContent({
  searchParams,
}: {
  searchParams: Promise<{ report?: string }>;
}) {
  const { report } = await searchParams;
  const reportKey = report || "reports/latest.json";
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
    ? formatStableDate(generated_at, {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "未知";

  return (
    <>
      <TrendRadarDisplay
        data={data}
        formattedTime={formattedGenerateTime}
        history={history}
        currentReportKey={reportKey}
      />
      {failed_ids && failed_ids.length > 0 && (
        <div className="text-[10px] text-muted-foreground/40 font-mono pt-8">
          Failed probes: {failed_ids.join(", ")}
        </div>
      )}
    </>
  );
}

export default async function TrendRadarPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string }>;
}) {
  const siteConfig = await getSiteConfig();

  const titleNode =
    siteConfig.news_hero_title_highlight || siteConfig.news_hero_title_rest ? (
      <>
        {siteConfig.news_hero_title_highlight && (
          <span className="block text-gradient-primary">
            {siteConfig.news_hero_title_highlight}
          </span>
        )}
        {siteConfig.news_hero_title_highlight_2 && (
          <span className="block text-gradient-primary">
            {siteConfig.news_hero_title_highlight_2}
          </span>
        )}
        {siteConfig.news_hero_title_rest}
      </>
    ) : (
      <>
        <span className="block text-gradient-primary">趋势雷达</span>
        全网热点实时追踪
      </>
    );

  return (
    <DirectionalTransition>
      <ScrollRestorer />
      <main className="min-h-screen bg-background">
        <PageHero
          title={titleNode}
          subtitle={siteConfig.news_hero_subtitle || "News / Trend Radar"}
          description={
            siteConfig.news_hero_description ||
            "多平台热榜聚合分析，挖掘隐藏在信息流中的焦点与变化。"
          }
          slogan={{
            text1: siteConfig.news_slogan_1 || "Caught in the wake",
            text2: siteConfig.news_slogan_2 || "Freshly delivered",
          }}
          blobColors={["bg-red-400/10", "bg-blue-400/10"]}
          containerClass="site-shell-triad"
        />

        <div className="site-shell-triad py-8">
          <Suspense
            fallback={
              <div className="py-24 flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                <span className="text-xs text-muted-foreground font-mono">加载中...</span>
              </div>
            }
          >
            <TrendRadarContent searchParams={searchParams} />
          </Suspense>
        </div>

        <footer className="border-t border-border mt-6">
          <div className="site-shell-triad py-7">
            <p className="font-mono text-[11px] text-muted-foreground text-center sm:text-left">
              © {new Date().getFullYear()} Arthur & Grace · TrendRadar Module
            </p>
          </div>
        </footer>
      </main>
    </DirectionalTransition>
  );
}
