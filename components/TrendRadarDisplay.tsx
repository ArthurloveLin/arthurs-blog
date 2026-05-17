"use client";

import { useState, useMemo } from "react";
import type { TrendRadarData, HotKeyword, StandalonePlatform } from "@/lib/trend-radar";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type Category = "trend" | "rss" | "hot";

interface Props {
  data: TrendRadarData;
  formattedTime: string;
  history: { key: string; date: string; time: string; rawTime: string }[];
  currentReportKey: string;
}

export default function TrendRadarDisplay({
  data,
  formattedTime,
  history,
  currentReportKey,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<Category>("trend");
  const [activeTag, setActiveTag] = useState<string>("全部");

  const { stats, rss_items, standalone_data, new_titles } = data;

  // 1. Group RSS by source
  const rssBySource = useMemo(() => {
    const sources: Record<
      string,
      {
        title: string;
        url?: string;
        mobile_url?: string;
        source_name?: string;
        word?: string;
        time_display?: string;
      }[]
    > = {};
    (rss_items || []).forEach((group) => {
      group.titles?.forEach((t) => {
        const sourceName = t.source_name || "未知来源";
        if (!sources[sourceName]) sources[sourceName] = [];
        sources[sourceName].push({ ...t, word: group.word });
      });
    });
    return Object.entries(sources)
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [rss_items]);

  // 2. Prepare standalone platforms
  const standalonePlatforms: StandalonePlatform[] = useMemo(() => {
    return [
      ...(standalone_data?.platforms || []),
      ...(standalone_data?.rss_feeds || []),
    ];
  }, [standalone_data]);

  // 3. Filtered Stats for Trend tab
  const tags = useMemo(() => ["全部", ...stats.map((s) => s.word)], [stats]);
  const filteredStats = useMemo(
    () =>
      activeTag === "全部" ? stats : stats.filter((s) => s.word === activeTag),
    [activeTag, stats],
  );

  // Max count for heat bar normalization
  const maxCount = useMemo(
    () => Math.max(...stats.map((s) => s.count ?? 0), 1),
    [stats],
  );

  // Aggregate counts
  const totalTrendArticles = useMemo(
    () => stats.reduce((a, s) => a + (s.titles?.length ?? 0), 0),
    [stats],
  );
  const totalRssArticles = useMemo(
    () => rssBySource.reduce((a, s) => a + s.items.length, 0),
    [rssBySource],
  );
  const totalHotArticles = useMemo(
    () => standalonePlatforms.reduce((a, p) => a + p.items.length, 0),
    [standalonePlatforms],
  );

  const counts = {
    trend: stats.length,
    rss: rssBySource.length,
    hot: standalonePlatforms.length,
  };

  const tabs: { id: Category; label: string; sub: string }[] = [
    { id: "trend", label: "趋势看点", sub: `${totalTrendArticles} 条相关` },
    { id: "rss", label: "RSS 订阅", sub: `${totalRssArticles} 篇文章` },
    { id: "hot", label: "平台热点", sub: `${totalHotArticles} 条热榜` },
  ];

  const totalAll = totalTrendArticles + totalRssArticles + totalHotArticles;

  return (
    <div>
      {/* ── Stats Ticker ── */}
      <div className="mb-6 pb-5 border-b border-border/50 space-y-3">
        {/* Row 1: live dot + time (always) + stat pills (sm+) */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              更新于{" "}
              <span className="text-foreground font-semibold">{formattedTime}</span>
            </span>
          </div>
          {/* Mobile: show just total count */}
          <span className="sm:hidden text-[11px] font-mono text-muted-foreground">
            共 <span className="text-foreground font-semibold tabular-nums">{totalAll}</span> 条
          </span>
          {/* sm+: full stat pills */}
          <div className="hidden sm:flex items-center gap-5 flex-wrap">
            <StatPill value={stats.length} label="趋势词" color="purple" />
            <StatPill value={rssBySource.length} label="RSS 来源" color="emerald" />
            <StatPill value={standalonePlatforms.length} label="热榜平台" color="amber" />
            <StatPill value={totalAll} label="条目合计" color="default" />
          </div>
        </div>

        {/* Row 2: mobile history chips (lg: hidden — sidebar handles it) */}
        {history.length > 0 && (
          <div className="lg:hidden flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {history.map((item) => {
              const isActive = currentReportKey === item.key;
              return (
                <a
                  key={item.key}
                  href={`/trend-radar?report=${item.key}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-[11px] font-mono transition-all border",
                    isActive
                      ? "bg-primary/10 text-primary border-primary/20 font-semibold"
                      : "bg-muted/40 text-muted-foreground border-transparent",
                  )}
                >
                  <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {item.date} {item.time}
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Main Layout: Sidebar + Content ── */}
      <div className="flex gap-8">
        {/* ── Left Sidebar (lg+) ── */}
        <aside className="hidden lg:flex flex-col w-44 shrink-0">
          <div className="sticky top-24 space-y-7 max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-none pb-12">

            {/* Keyword filter (trend only) */}
            {activeCategory === "trend" && (
              <SideSection title="关键词">
                <div className="space-y-0.5">
                  {tags.map((tag) => {
                    const isActive = tag === activeTag;
                    const item = stats.find((s) => s.word === tag);
                    const count =
                      tag === "全部"
                        ? stats.reduce((a, s) => a + (s.titles?.length ?? 0), 0)
                        : (item?.titles?.length ?? 0);
                    return (
                      <button
                        key={tag}
                        onClick={() => setActiveTag(tag)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[12px] transition-all text-left",
                          isActive
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <span className="truncate">{tag}</span>
                        <span className="text-[10px] font-mono opacity-50 shrink-0 ml-2 tabular-nums">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </SideSection>
            )}

            {/* Source list (RSS only) */}
            {activeCategory === "rss" && (
              <SideSection title="订阅源">
                <div className="space-y-0.5">
                  {rssBySource.slice(0, 12).map((source, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground"
                    >
                      <span className="truncate">{source.name}</span>
                      <span className="font-mono text-[10px] opacity-50 shrink-0 ml-2 tabular-nums">
                        {source.items.length}
                      </span>
                    </div>
                  ))}
                </div>
              </SideSection>
            )}

            {/* Platform list (hot only) */}
            {activeCategory === "hot" && (
              <SideSection title="平台">
                <div className="space-y-0.5">
                  {standalonePlatforms.slice(0, 12).map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="font-mono text-[10px] opacity-50 shrink-0 ml-2 tabular-nums">
                        {p.items.length}
                      </span>
                    </div>
                  ))}
                </div>
              </SideSection>
            )}

            {/* History snapshots */}
            <SideSection title="历史快照">
              {history.length === 0 ? (
                <p className="px-3 text-[11px] text-muted-foreground/40">无记录</p>
              ) : (
                <div className="space-y-1">
                  {history.map((item) => {
                    const isActive = currentReportKey === item.key;
                    return (
                      <a
                        key={item.key}
                        href={`/trend-radar?report=${item.key}`}
                        className={cn(
                          "flex items-start gap-2 px-3 py-2 rounded-lg transition-all",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <svg
                          className="w-3 h-3 mt-0.5 shrink-0 opacity-60"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <div className="min-w-0">
                          <div className="text-[11px] font-mono font-medium">{item.date}</div>
                          <div className="text-[10px] font-mono opacity-60">{item.time}</div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </SideSection>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="min-w-0 flex-1">
          {/* Tab Navigation */}
          <div className="flex border-b border-border/50 mb-6">
            {tabs.map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveCategory(tab.id);
                    setActiveTag("全部");
                  }}
                  className={cn(
                    "relative flex flex-col items-start px-3 py-3 sm:px-5 sm:py-3.5 text-left transition-colors duration-200",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{tab.label}</span>
                    <span
                      className={cn(
                        "text-[10px] font-mono px-1.5 py-0.5 rounded-full transition-colors",
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground/60",
                      )}
                    >
                      {counts[tab.id]}
                    </span>
                  </div>
                  <span className="hidden sm:block text-[10px] font-mono text-muted-foreground/40 mt-0.5">
                    {tab.sub}
                  </span>
                  <div
                    className={cn(
                      "absolute bottom-0 left-3 right-3 sm:left-5 sm:right-5 h-0.5 rounded-full transition-all duration-300",
                      isActive ? "bg-primary" : "opacity-0",
                    )}
                  />
                </button>
              );
            })}
          </div>

          {/* Mobile keyword filter */}
          {activeCategory === "trend" && (
            <div className="lg:hidden flex gap-2 flex-wrap mb-5">
              {tags.map((tag) => {
                const isActive = tag === activeTag;
                const item = stats.find((s) => s.word === tag);
                const count =
                  tag === "全部"
                    ? stats.reduce((a, s) => a + (s.titles?.length ?? 0), 0)
                    : (item?.titles?.length ?? 0);
                return (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all border",
                      isActive
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-muted/30 text-muted-foreground border-transparent hover:border-border/50 hover:bg-muted/60",
                    )}
                  >
                    {tag}
                    <span className="opacity-50 font-mono">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── 1. Trend ── */}
          {activeCategory === "trend" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredStats.map((item) => (
                  <TrendKeywordCard
                    key={item.word}
                    item={item}
                    rank={stats.indexOf(item) + 1}
                    maxCount={maxCount}
                  />
                ))}
              </div>

              {/* New source section */}
              {new_titles && new_titles.length > 0 && activeTag === "全部" && (
                <div className="pt-4 space-y-4 border-t border-border/40">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                    最新来源聚合
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {new_titles.map((source, sIdx) => (
                      <div
                        key={sIdx}
                        className="bg-card/50 rounded-xl p-4 border border-border/40 hover:border-border/80 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-1 h-3 bg-primary/40 rounded-full" />
                          <h4 className="text-xs font-bold text-foreground truncate">
                            {source.source_name}
                          </h4>
                        </div>
                        <ul className="space-y-2">
                          {source.titles?.slice(0, 5).map((t, i) => (
                            <li key={i}>
                              <a
                                href={t.url || t.mobile_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[12px] text-muted-foreground hover:text-primary transition-colors line-clamp-1 leading-snug"
                              >
                                {t.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 2. RSS ── */}
          {activeCategory === "rss" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {rssBySource.map((source, idx) => (
                <RssSourceCard key={idx} source={source} />
              ))}
            </div>
          )}

          {/* ── 3. Hot Platforms ── */}
          {activeCategory === "hot" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {standalonePlatforms.map((platform, idx) => (
                <HotPlatformCard key={idx} platform={platform} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function SideSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 px-3 mb-2">
        {title}
      </h4>
      {children}
    </div>
  );
}

function StatPill({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: "purple" | "emerald" | "amber" | "default";
}) {
  const dotColor =
    color === "purple"
      ? "bg-primary"
      : color === "emerald"
        ? "bg-emerald-500"
        : color === "amber"
          ? "bg-amber-500"
          : "bg-muted-foreground/40";

  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
      <span className="text-[12px] font-mono font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function TrendKeywordCard({
  item,
  rank,
  maxCount,
}: {
  item: HotKeyword;
  rank: number;
  maxCount: number;
}) {
  const heatPct = ((item.count ?? 0) / maxCount) * 100;
  const isTop3 = rank <= 3;

  const rankStyle =
    rank === 1
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : rank === 2
        ? "bg-zinc-400/15 text-zinc-500 dark:text-zinc-300"
        : rank === 3
          ? "bg-orange-400/15 text-orange-500 dark:text-orange-400"
          : "bg-muted text-muted-foreground";

  return (
    <div
      className={cn(
        "group bg-card text-card-foreground rounded-2xl p-5 border transition-all duration-300 hover:shadow-md",
        isTop3
          ? "border-primary/15 hover:border-primary/30 hover:shadow-primary/5"
          : "border-border/50 hover:border-border",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-bold font-mono shrink-0",
              rankStyle,
            )}
          >
            {rank}
          </span>
          <h3 className="text-[15px] font-bold text-foreground group-hover:text-primary transition-colors truncate">
            {item.word}
          </h3>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0 ml-3 tabular-nums">
          {item.count ?? 0}
        </span>
      </div>

      {/* Heat bar */}
      <div className="mb-4 h-[3px] bg-muted/50 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            isTop3 ? "bg-primary/70" : "bg-muted-foreground/25",
          )}
          style={{ width: `${heatPct}%` }}
        />
      </div>

      {/* Articles */}
      <div className="space-y-3">
        {item.titles?.map((title, tIdx) => (
          <a
            key={tIdx}
            href={title.url || title.mobile_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group/item"
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded leading-none shrink-0 max-w-[6rem] truncate">
                {title.source_name}
              </span>
              {title.is_new && (
                <span className="text-[9px] font-bold text-red-500 uppercase tracking-tighter shrink-0">
                  NEW
                </span>
              )}
              <span className="text-[10px] text-muted-foreground/40 ml-auto shrink-0 font-mono tabular-nums flex items-center gap-1">
                {title.time_display && <span>{title.time_display}</span>}
                {title.count !== undefined && title.count > 1 && (
                  <span className="bg-muted/40 px-1 rounded">×{title.count}</span>
                )}
              </span>
            </div>
            <p className="text-[13px] text-foreground/75 group-hover/item:text-primary transition-colors line-clamp-2 leading-relaxed">
              {title.title}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}

function RssSourceCard({
  source,
}: {
  source: {
    name: string;
    items: {
      title: string;
      url?: string;
      mobile_url?: string;
      word?: string;
      time_display?: string;
    }[];
  };
}) {
  return (
    <div className="bg-card/50 rounded-2xl p-5 border border-border/40 hover:border-emerald-500/20 transition-all duration-300 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-emerald-500/70 shrink-0" />
          <h4 className="text-[13px] font-bold text-foreground truncate">{source.name}</h4>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0 ml-2 tabular-nums">
          {source.items.length}
        </span>
      </div>
      <div className="space-y-3">
        {source.items.map((item, i) => (
          <a
            key={i}
            href={item.url || item.mobile_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group/rss"
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              {item.word && (
                <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 px-1.5 py-0.5 rounded leading-none">
                  {item.word}
                </span>
              )}
              {item.time_display && (
                <span className="text-[9px] font-mono text-muted-foreground/35 ml-auto">
                  {item.time_display}
                </span>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground group-hover/rss:text-emerald-600 dark:group-hover/rss:text-emerald-400 transition-colors line-clamp-2 leading-relaxed">
              {item.title}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}

function HotPlatformCard({ platform }: { platform: StandalonePlatform }) {
  return (
    <div className="bg-card/60 rounded-2xl p-5 border border-border/40 hover:border-amber-500/20 transition-all duration-300 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-1 h-4 bg-amber-400/80 rounded-full shrink-0" />
          <h4 className="text-[13px] font-bold text-foreground truncate">{platform.name}</h4>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0 ml-2 tabular-nums">
          {platform.items.length}
        </span>
      </div>
      <ol className="space-y-2.5">
        {platform.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className={cn(
                "text-[10px] font-mono mt-0.5 w-5 shrink-0 text-right tabular-nums font-bold",
                i === 0
                  ? "text-amber-500"
                  : i === 1
                    ? "text-amber-400/80"
                    : i === 2
                      ? "text-amber-400/60"
                      : "text-muted-foreground/25",
              )}
            >
              {(i + 1).toString().padStart(2, "0")}
            </span>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors line-clamp-2 leading-snug"
            >
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
