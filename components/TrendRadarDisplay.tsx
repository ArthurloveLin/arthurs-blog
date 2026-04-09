"use client";

import { useState, useMemo } from "react";
import type { TrendRadarData, HotKeyword, TrendTitle, NewSource, StandalonePlatform } from "@/lib/trend-radar";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type Category = "trend" | "rss" | "hot";

interface Props {
  data: TrendRadarData;
  formattedTime: string;
}

export default function TrendRadarDisplay({ data, formattedTime }: Props) {
  const [activeCategory, setActiveCategory] = useState<Category>("trend");
  const [activeTag, setActiveTag] = useState<string>("全部");

  const { stats, rss_items, standalone_data, new_titles } = data;

  // 1. Group RSS by source
  const rssBySource = useMemo(() => {
    const sources: Record<string, { title: string; url?: string; mobile_url?: string; source_name?: string; word?: string; time_display?: string }[]> = {};
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
  const tags = ["全部", ...stats.map((s) => s.word)];
  const filteredStats = activeTag === "全部" ? stats : stats.filter((s) => s.word === activeTag);

  // Counts for tabs
  const counts = {
    trend: stats.length,
    rss: rssBySource.length,
    hot: standalonePlatforms.length,
  };

  return (
    <div className="space-y-6">
      {/* ── Unified Filter Card ── */}
      <div className="bg-card border border-border/50 rounded-2xl p-1 shadow-sm overflow-hidden">
        {/* Main Categories */}
        <div className="flex p-1">
          {(["trend", "rss", "hot"] as const).map((cat) => {
            const label = cat === "trend" ? "趋势看点" : cat === "rss" ? "RSS 订阅" : "平台热点";
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <span>{label}</span>
                <span className={cn(
                  "text-[10px] font-mono px-1.5 py-0.5 rounded-full",
                  isActive ? "bg-white/20 text-primary-foreground" : "bg-muted text-muted-foreground/60"
                )}>
                  {counts[cat]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Optional: Keyword Tags (only for trend) */}
        {activeCategory === "trend" && (
          <div className="border-t border-border/40 p-3 pt-4">
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isActive = tag === activeTag;
                const item = stats.find((s) => s.word === tag);
                const count = tag === "全部" ? stats.reduce((a, s) => a + (s.titles?.length ?? 0), 0) : (item?.titles?.length ?? 0);
                return (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all border",
                      isActive
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-muted/30 text-muted-foreground border-transparent hover:border-border/50 hover:bg-muted/60"
                    )}
                  >
                    {tag}
                    <span className="opacity-50 font-mono scale-[0.85]">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Content Area ── */}
      <div className="min-h-[400px]">
        {/* 1. Trend Section */}
        {activeCategory === "trend" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-1 h-3 bg-red-500 rounded-full"></div>
                <h3 className="text-sm font-bold opacity-80 uppercase tracking-tight">热点聚焦</h3>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/50">
                Found {filteredStats.length} topics
              </span>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {filteredStats.map((item, idx) => (
                <KeywordCard key={item.word} item={item} rank={stats.indexOf(item) + 1} />
              ))}
            </div>

            {/* New Source Section inside Trend */}
            {new_titles && new_titles.length > 0 && activeTag === "全部" && (
              <div className="pt-8 space-y-4">
                 <div className="flex items-center gap-2 px-1">
                  <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                  <h3 className="text-sm font-bold opacity-80 uppercase tracking-tight">分榜新增</h3>
                </div>
                <div className="columns-1 sm:columns-2 gap-4 space-y-4">
                  {new_titles.map((source, sIdx) => (
                    <div
                      key={sIdx}
                      className="break-inside-avoid bg-card/50 rounded-xl p-4 border border-border/40 hover:border-border transition-colors mb-4"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-3 bg-primary/40 rounded-full"></div>
                        <h4 className="text-xs font-bold text-foreground">{source.source_name}</h4>
                      </div>
                      <ul className="space-y-2.5">
                        {source.titles?.slice(0, 5).map((t, i) => (
                          <li key={i}>
                            <a
                              href={t.url || t.mobile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[13px] text-muted-foreground hover:text-primary transition-colors line-clamp-1 leading-snug"
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

        {/* 2. RSS Section (Masonry Grid) */}
        {activeCategory === "rss" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>
                <h3 className="text-sm font-bold opacity-80 uppercase tracking-tight">按来源分类</h3>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/50">
                Last Check: {formattedTime}
              </span>
            </div>

            <div className="columns-1 sm:columns-2 gap-4 space-y-4">
              {rssBySource.map((source, idx) => (
                <div
                  key={idx}
                  className="break-inside-avoid bg-card/50 rounded-2xl p-5 border border-border/40 hover:border-primary/20 transition-all duration-300 shadow-sm mb-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary/60"></div>
                      <h4 className="text-[13px] font-bold text-foreground">{source.name}</h4>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground/60">{source.items.length} 条</span>
                  </div>
                  <div className="space-y-3">
                    {source.items.map((item, i) => (
                      <a
                        key={i}
                        href={item.url || item.mobile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group/rss-item"
                      >
                         <div className="flex items-center gap-1.5 mb-0.5">
                          {item.word && (
                            <span className="text-[9px] font-mono text-primary/70 bg-primary/5 px-1 rounded">
                              {item.word}
                            </span>
                          )}
                          {item.time_display && (
                            <span className="text-[9px] text-muted-foreground/40 ml-auto">
                              {item.time_display}
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-muted-foreground group-hover/rss-item:text-primary transition-colors line-clamp-2 leading-relaxed">
                          {item.title}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Hot Section (Independent Platforms) */}
        {activeCategory === "hot" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-1 h-3 bg-amber-500 rounded-full"></div>
                <h3 className="text-sm font-bold opacity-80 uppercase tracking-tight">独立平台热榜</h3>
              </div>
            </div>

            <div className="columns-1 sm:columns-2 gap-4 space-y-4">
              {standalonePlatforms.map((platform, idx) => (
                <div
                  key={idx}
                  className="break-inside-avoid bg-card/60 rounded-2xl p-5 border border-border/40 hover:border-primary/20 transition-all duration-300 shadow-sm mb-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-3 bg-amber-400/80 rounded-full"></div>
                      <h4 className="text-[13px] font-bold text-foreground">{platform.name}</h4>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground/60">{platform.items.length} 条</span>
                  </div>
                  <ol className="space-y-3">
                    {platform.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="text-[10px] font-mono text-muted-foreground/30 mt-1 w-4 shrink-0 text-right">
                          {(i + 1).toString().padStart(2, '0')}
                        </span>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[13px] text-muted-foreground hover:text-primary transition-colors line-clamp-2 leading-snug"
                        >
                          {item.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KeywordCard({ item, rank }: { item: HotKeyword; rank: number }) {
  return (
    <div className="break-inside-avoid group bg-card text-card-foreground rounded-2xl p-5 border border-border/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10 text-primary text-[11px] font-bold font-mono">
            {rank}
          </span>
          <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
            {item.word}
          </h3>
        </div>
        <div className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          热度: {item.count ?? 0}
        </div>
      </div>

      <div className="space-y-3 pl-9">
        {item.titles?.map((title, tIdx) => (
          <a
            key={tIdx}
            href={title.url || title.mobile_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group/item"
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 rounded leading-relaxed">
                {title.source_name}
              </span>
              {title.is_new && (
                <span className="text-[9px] font-bold text-red-500 uppercase tracking-tighter">NEW</span>
              )}
              {(title.time_display || title.count !== undefined) && (
                <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 ml-auto">
                  {title.time_display && <span>{title.time_display}</span>}
                  {title.count !== undefined && title.count > 1 && (
                    <span className="bg-muted/30 px-1 rounded">x{title.count}</span>
                  )}
                </span>
              )}
            </div>
            <p className="text-sm text-foreground/80 group-hover/item:text-primary transition-colors line-clamp-2 leading-relaxed">
              {title.title}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
