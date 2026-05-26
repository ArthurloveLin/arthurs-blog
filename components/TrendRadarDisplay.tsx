"use client";

import { useState, useMemo } from "react";
import type {
  TrendRadarData,
  HotKeyword,
  StandalonePlatform,
  TrendRadarAISection,
  TrendRadarAICitation,
} from "@/lib/trend-radar";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type Category = "ai" | "trend" | "rss" | "hot";

interface Props {
  data: TrendRadarData;
  formattedTime: string;
  history: { key: string; date: string; time: string; rawTime: string }[];
  currentReportKey: string;
}

interface InsightCitation {
  citation_id?: string;
  citation_no?: number;
  anchor_id?: string;
  title: string;
  source: string;
  channel: "趋势看点" | "RSS订阅" | "平台热点";
  url?: string;
  time_display?: string;
}

interface InsightParagraph {
  paragraph_id: string;
  anchor_id: string;
  text: string;
  citation_nos: number[];
  citation_ids: string[];
}

interface AIInsight {
  id: string;
  section_id: string;
  headline: string;
  summary: string;
  confidence: "高" | "中";
  tags: string[];
  paragraphs: InsightParagraph[];
  citations: InsightCitation[];
}

interface NormalizedAISection {
  section_id: string;
  title: string;
  content: string;
  paragraphs: InsightParagraph[];
  citations: InsightCitation[];
}

function toSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]/g, "");
  return normalized || "section";
}

function splitParagraphs(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }
  const blocks = normalized
    .split("\n\n")
    .map((part) => part.trim())
    .filter(Boolean);
  if (blocks.length > 0) {
    return blocks;
  }
  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildFallbackCitations(sectionId: string, citations: InsightCitation[]): InsightCitation[] {
  return citations.slice(0, 4).map((citation, index) => {
    const citationNo = index + 1;
    const refCode = citationNo.toString().padStart(3, "0");
    return {
      ...citation,
      citation_no: citationNo,
      citation_id: `${sectionId}__ref_${refCode}`,
      anchor_id: `${sectionId}-ref-${refCode}`,
    };
  });
}

function buildFallbackParagraphs(sectionId: string, content: string, citations: InsightCitation[]): InsightParagraph[] {
  return splitParagraphs(content).map((text, index) => {
    const start = citations.length > 0 ? ((index * 2) % citations.length) : 0;
    const picked = citations.length > 0
      ? Array.from({ length: Math.min(2, citations.length) }, (_, offset) => citations[(start + offset) % citations.length])
      : [];

    const citationNos = Array.from(
      new Set(
        picked
          .map((item) => item.citation_no)
          .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      ),
    );
    const citationIds = Array.from(
      new Set(
        picked
          .map((item) => item.citation_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    return {
      paragraph_id: `${sectionId}__p${(index + 1).toString().padStart(2, "0")}`,
      anchor_id: `${sectionId}-p-${(index + 1).toString().padStart(2, "0")}`,
      text,
      citation_nos: citationNos,
      citation_ids: citationIds,
    };
  });
}

function normalizeSection(
  sectionRaw: string | TrendRadarAISection | undefined,
  sectionId: string,
  title: string,
): NormalizedAISection {
  if (!sectionRaw) {
    return {
      section_id: sectionId,
      title,
      content: "",
      paragraphs: [],
      citations: [],
    };
  }

  if (typeof sectionRaw === "string") {
    const content = sectionRaw.trim();
    return {
      section_id: sectionId,
      title,
      content,
      paragraphs: buildFallbackParagraphs(sectionId, content, []),
      citations: [],
    };
  }

  const normalizedSectionId = sectionRaw.section_id || sectionId;
  const content = (sectionRaw.content || "").trim();

  const citations: InsightCitation[] = (sectionRaw.citations || []).map((citation: TrendRadarAICitation, index) => {
    const citationNo = typeof citation.citation_no === "number" ? citation.citation_no : index + 1;
    const refCode = citationNo.toString().padStart(3, "0");
    return {
      citation_id: citation.citation_id || `${normalizedSectionId}__ref_${refCode}`,
      citation_no: citationNo,
      anchor_id: citation.anchor_id || `${normalizedSectionId}-ref-${refCode}`,
      title: citation.title || "未命名引用",
      source: citation.source || "未知来源",
      channel: (citation.channel as InsightCitation["channel"]) || "趋势看点",
      url: citation.url || undefined,
      time_display: citation.time_display || undefined,
    };
  });

  const paragraphs: InsightParagraph[] = (sectionRaw.paragraphs || []).map((paragraph, index) => ({
    paragraph_id: paragraph.paragraph_id || `${normalizedSectionId}__p${(index + 1).toString().padStart(2, "0")}`,
    anchor_id: paragraph.anchor_id || `${normalizedSectionId}-p-${(index + 1).toString().padStart(2, "0")}`,
    text: (paragraph.text || "").trim(),
    citation_nos: (paragraph.citation_nos || []).filter((value): value is number => typeof value === "number"),
    citation_ids: (paragraph.citation_ids || []).filter((value): value is string => Boolean(value)),
  })).filter((paragraph) => paragraph.text);

  return {
    section_id: normalizedSectionId,
    title: sectionRaw.title || title,
    content,
    paragraphs: paragraphs.length > 0 ? paragraphs : buildFallbackParagraphs(normalizedSectionId, content, citations),
    citations,
  };
}

export default function TrendRadarDisplay({
  data,
  formattedTime,
  history,
  currentReportKey,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<Category>("ai");
  const [activeTag, setActiveTag] = useState<string>("全部");

  const { stats, rss_items, standalone_data, new_titles, ai_report } = data;

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

  const trendCitations = useMemo<InsightCitation[]>(() => {
    return stats
      .slice(0, 3)
      .flatMap((item) =>
        (item.titles || []).slice(0, 2).map((title) => ({
          title: title.title,
          source: title.source_name || "未知来源",
          channel: "趋势看点" as const,
          url: title.url || title.mobile_url,
          time_display: title.time_display,
        })),
      );
  }, [stats]);

  const rssCitations = useMemo<InsightCitation[]>(() => {
    return rssBySource
      .slice(0, 3)
      .flatMap((source) =>
        source.items.slice(0, 2).map((item) => ({
          title: item.title,
          source: source.name,
          channel: "RSS订阅" as const,
          url: item.url || item.mobile_url,
          time_display: item.time_display,
        })),
      );
  }, [rssBySource]);

  const hotCitations = useMemo<InsightCitation[]>(() => {
    return standalonePlatforms
      .slice(0, 3)
      .flatMap((platform) =>
        platform.items.slice(0, 2).map((item) => ({
          title: item.title,
          source: platform.name,
          channel: "平台热点" as const,
          url: item.url,
          time_display: item.time_display || item.published_at,
        })),
      );
  }, [standalonePlatforms]);

  // 3. Build AI digest cards (prefer agy report from R2, fallback to derived digest)
  const aiInsights = useMemo<AIInsight[]>(() => {
    const sectionMap = {
      core_trends: normalizeSection(ai_report?.sections?.core_trends, "core_trends", "核心热点态势"),
      sentiment_controversy: normalizeSection(ai_report?.sections?.sentiment_controversy, "sentiment_controversy", "舆论风向争议"),
      signals: normalizeSection(ai_report?.sections?.signals, "signals", "异动与弱信号"),
      rss_insights: normalizeSection(ai_report?.sections?.rss_insights, "rss_insights", "RSS 深度洞察"),
      outlook_strategy: normalizeSection(ai_report?.sections?.outlook_strategy, "outlook_strategy", "研判策略建议"),
    };

    const standaloneSummaries = ai_report?.standalone_summaries || {};
    const hasAgyContent = Boolean(
      Object.values(sectionMap).some((section) => Boolean(section.content.trim())) ||
      Object.values(standaloneSummaries).some((text) => Boolean(text?.trim())),
    );

    if (hasAgyContent) {
      const insights: AIInsight[] = [];
      const defaultConfidence: "高" | "中" = ai_report?.success ? "高" : "中";

      const pushSectionInsight = (
        section: NormalizedAISection,
        tags: string[],
        fallbackCitations: InsightCitation[],
      ) => {
        if (!section.content.trim()) {
          return;
        }

        const citations = section.citations.length > 0
          ? section.citations
          : buildFallbackCitations(section.section_id, fallbackCitations);

        const paragraphs = section.paragraphs.length > 0
          ? section.paragraphs
          : buildFallbackParagraphs(section.section_id, section.content, citations);

        insights.push({
          id: `agy-${section.section_id}`,
          section_id: section.section_id,
          headline: section.title,
          summary: section.content,
          confidence: defaultConfidence,
          tags,
          paragraphs,
          citations,
        });
      };

      pushSectionInsight(sectionMap.core_trends, ["agy报告", "主线判断"], trendCitations);
      pushSectionInsight(sectionMap.sentiment_controversy, ["舆论分歧", "风险偏好"], trendCitations);
      pushSectionInsight(sectionMap.signals, ["弱信号", "先行指标"], [...trendCitations.slice(0, 2), ...hotCitations.slice(0, 2)]);
      pushSectionInsight(sectionMap.rss_insights, ["RSS订阅", "专业视角"], rssCitations);
      pushSectionInsight(sectionMap.outlook_strategy, ["策略建议", "行动方案"], [...trendCitations.slice(0, 2), ...rssCitations.slice(0, 2)]);

      Object.entries(standaloneSummaries)
        .slice(0, 2)
        .forEach(([source, summary], idx) => {
          if (!summary?.trim()) {
            return;
          }
          const sectionId = `standalone_${toSlug(source)}`;
          const matchedCitations = hotCitations.filter((citation) => citation.source === source);
          const citations = buildFallbackCitations(sectionId, matchedCitations.length > 0 ? matchedCitations : hotCitations);
          insights.push({
            id: `agy-standalone-${idx}`,
            section_id: sectionId,
            headline: `${source} 速览`,
            summary: summary.trim(),
            confidence: defaultConfidence,
            tags: ["独立源点", source],
            paragraphs: buildFallbackParagraphs(sectionId, summary.trim(), citations),
            citations,
          });
        });

      if (insights.length > 0) {
        return insights;
      }
    }

    const insights: AIInsight[] = [];

    const topTrend = [...stats]
      .filter((item) => (item.titles?.length ?? 0) > 0)
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 3);

    topTrend.forEach((item, idx) => {
      const sectionId = `trend_${toSlug(item.word)}_${idx + 1}`;
      const citations = buildFallbackCitations(
        sectionId,
        (item.titles || []).slice(0, 3).map((title) => ({
          title: title.title,
          source: title.source_name || "未知来源",
          channel: "趋势看点",
          url: title.url || title.mobile_url,
          time_display: title.time_display,
        })),
      );

      const sourceCount = new Set(citations.map((citation) => citation.source)).size;
      const summary = `当前窗口提及 ${item.count ?? 0} 次，覆盖 ${sourceCount} 个来源，出现跨站扩散迹象。`;
      insights.push({
        id: `trend-${item.word}-${idx}`,
        section_id: sectionId,
        headline: `${item.word} 进入集中讨论区`,
        summary,
        confidence: (item.count ?? 0) >= 10 ? "高" : "中",
        tags: [item.word, "趋势聚焦"],
        paragraphs: buildFallbackParagraphs(sectionId, summary, citations),
        citations,
      });
    });

    const topRssSources = rssBySource.slice(0, 2);
    if (topRssSources.length > 0) {
      const sectionId = "rss_pulse";
      const citations = buildFallbackCitations(
        sectionId,
        topRssSources
          .flatMap((source) =>
            source.items.slice(0, 2).map((item) => ({
              title: item.title,
              source: source.name,
              channel: "RSS订阅" as const,
              url: item.url || item.mobile_url,
              time_display: item.time_display,
            })),
          )
          .slice(0, 4),
      );

      const sourceNames = topRssSources.map((source) => source.name).join("、");
      const summary = `重点来源 ${sourceNames} 在当前周期持续刷新，适合跟进深度文章线索。`;
      insights.push({
        id: "rss-pulse",
        section_id: sectionId,
        headline: "RSS 订阅源出现密集更新",
        summary,
        confidence: citations.length >= 3 ? "高" : "中",
        tags: ["RSS订阅", "持续更新"],
        paragraphs: buildFallbackParagraphs(sectionId, summary, citations),
        citations,
      });
    }

    const topPlatform = [...standalonePlatforms]
      .filter((platform) => platform.items.length > 0)
      .sort((a, b) => b.items.length - a.items.length)[0];

    if (topPlatform) {
      const sectionId = `platform_${toSlug(topPlatform.name)}`;
      const citations = buildFallbackCitations(
        sectionId,
        topPlatform.items.slice(0, 4).map((item) => ({
          title: item.title,
          source: topPlatform.name,
          channel: "平台热点",
          url: item.url,
          time_display: item.time_display || item.published_at,
        })),
      );

      const summary = `该平台当前可见 ${topPlatform.items.length} 条热点，头部议题更新速度较快。`;
      insights.push({
        id: `platform-${topPlatform.id}`,
        section_id: sectionId,
        headline: `${topPlatform.name} 热榜活跃度走高`,
        summary,
        confidence: topPlatform.items.length >= 5 ? "高" : "中",
        tags: [topPlatform.name, "平台热点"],
        paragraphs: buildFallbackParagraphs(sectionId, summary, citations),
        citations,
      });
    }

    return insights.slice(0, 4);
  }, [ai_report, hotCitations, rssBySource, rssCitations, standalonePlatforms, stats, trendCitations]);

  const totalAiCitations = useMemo(
    () => aiInsights.reduce((sum, insight) => sum + insight.citations.length, 0),
    [aiInsights],
  );

  const aiSourceBreakdown = useMemo(() => {
    const sourceCounter: Record<string, number> = {};
    aiInsights.forEach((insight) => {
      insight.citations.forEach((citation) => {
        sourceCounter[citation.source] = (sourceCounter[citation.source] || 0) + 1;
      });
    });

    return Object.entries(sourceCounter)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [aiInsights]);

  // 4. Filtered Stats for Trend tab
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
    ai: aiInsights.length,
    trend: stats.length,
    rss: rssBySource.length,
    hot: standalonePlatforms.length,
  };

  const tabs: { id: Category; label: string; sub: string }[] = [
    { id: "ai", label: "知微见著", sub: `${totalAiCitations} 条引用` },
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
            <span className="text-[11px] lg:text-[13px] font-mono text-muted-foreground">
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
            <StatPill value={aiInsights.length} label="知微见著" color="sky" />
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

            {/* Source mapping (AI only) */}
            {activeCategory === "ai" && (
              <SideSection title="引用来源">
                {aiSourceBreakdown.length === 0 ? (
                  <p className="px-3 text-[11px] text-muted-foreground/40">暂无可用引用</p>
                ) : (
                  <div className="space-y-0.5">
                    {aiSourceBreakdown.slice(0, 12).map((source) => (
                      <div
                        key={source.name}
                        className="flex items-center justify-between px-3 py-1.5 text-[11px] lg:text-[13px] text-muted-foreground"
                      >
                        <span className="truncate">{source.name}</span>
                        <span className="font-mono text-[10px] lg:text-[12px] opacity-50 shrink-0 ml-2 tabular-nums">
                          {source.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SideSection>
            )}

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
                          "w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[12px] lg:text-[14px] transition-all text-left",
                          isActive
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <span className="truncate">{tag}</span>
                        <span className="text-[10px] lg:text-[12px] font-mono opacity-50 shrink-0 ml-2 tabular-nums">
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
                      className="flex items-center justify-between px-3 py-1.5 text-[11px] lg:text-[13px] text-muted-foreground"
                    >
                      <span className="truncate">{source.name}</span>
                      <span className="font-mono text-[10px] lg:text-[12px] opacity-50 shrink-0 ml-2 tabular-nums">
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
                      className="flex items-center justify-between px-3 py-1.5 text-[11px] lg:text-[13px] text-muted-foreground"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="font-mono text-[10px] lg:text-[12px] opacity-50 shrink-0 ml-2 tabular-nums">
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
                          <div className="text-[11px] lg:text-[13px] font-mono font-medium">{item.date}</div>
                          <div className="text-[10px] lg:text-[12px] font-mono opacity-60">{item.time}</div>
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
                    <span className="text-sm lg:text-base font-semibold">{tab.label}</span>
                    <span
                      className={cn(
                        "text-[10px] lg:text-[13px] font-mono px-1.5 py-0.5 rounded-full transition-colors",
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground/60",
                      )}
                    >
                      {counts[tab.id]}
                    </span>
                  </div>
                  <span className="hidden sm:block text-[10px] lg:text-[12px] font-mono text-muted-foreground/40 mt-0.5">
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

          {/* ── 0. AI Digest ── */}
          {activeCategory === "ai" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-[12px] lg:text-[14px] text-muted-foreground leading-relaxed">
                {ai_report?.has_content
                  ? "知微见著内容由 workflow 中的 agy 分析直接生成，并通过 reports JSON 同步写入 R2。每条洞察下方都附带可追溯新闻引用与来源。"
                  : "知微见著当前基于趋势词、RSS 更新与平台热点自动生成。每条洞察下方都附带可追溯新闻引用，并标注对应来源。"}
              </div>

              {ai_report?.error && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-[11px] lg:text-[13px] text-amber-700 dark:text-amber-300">
                  agy 报告状态：{ai_report.error}
                </div>
              )}

              {aiInsights.length === 0 ? (
                <div className="rounded-2xl border border-border/50 bg-card/40 p-6 text-[13px] lg:text-[15px] text-muted-foreground">
                  暂无可生成的 AI 报告数据，请稍后刷新或切换其他历史快照。
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {aiInsights.map((insight) => (
                    <AiInsightCard key={insight.id} insight={insight} />
                  ))}
                </div>
              )}
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
                  <h3 className="text-[10px] lg:text-[12px] font-bold uppercase tracking-widest text-muted-foreground/50">
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
                          <h4 className="text-xs sm:text-[14px] lg:text-[15px] font-bold text-foreground truncate">
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
                                className="text-[12px] sm:text-[14px] lg:text-[15px] text-muted-foreground hover:text-primary transition-colors line-clamp-1 leading-snug"
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
      <h4 className="text-[9px] lg:text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 px-3 mb-2">
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
  color: "purple" | "emerald" | "amber" | "sky" | "default";
}) {
  const dotColor =
    color === "purple"
      ? "bg-primary"
      : color === "emerald"
        ? "bg-emerald-500"
        : color === "amber"
          ? "bg-amber-500"
          : color === "sky"
            ? "bg-sky-500"
          : "bg-muted-foreground/40";

  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
      <span className="text-[12px] lg:text-[15px] font-mono font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] lg:text-[13px] text-muted-foreground">{label}</span>
    </div>
  );
}

function AiInsightCard({ insight }: { insight: AIInsight }) {
  const citations = insight.citations.map((citation, index) => {
    const citationNo = typeof citation.citation_no === "number" ? citation.citation_no : index + 1;
    const refCode = citationNo.toString().padStart(3, "0");
    return {
      ...citation,
      citation_id: citation.citation_id || `${insight.section_id}__ref_${refCode}`,
      citation_no: citationNo,
      anchor_id: citation.anchor_id || `${insight.section_id}-ref-${refCode}`,
      source: citation.source || "未知来源",
      title: citation.title || "未命名引用",
      channel: citation.channel || "趋势看点",
    };
  });

  const citationByNo = new Map<number, (typeof citations)[number]>();
  const citationById = new Map<string, (typeof citations)[number]>();
  citations.forEach((citation) => {
    citationByNo.set(citation.citation_no, citation);
    citationById.set(citation.citation_id, citation);
  });

  const paragraphs = insight.paragraphs.length > 0
    ? insight.paragraphs
    : buildFallbackParagraphs(insight.section_id, insight.summary, citations);

  return (
    <article className="bg-card text-card-foreground rounded-2xl p-5 border border-border/50 hover:border-primary/30 transition-colors duration-300 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[15px] sm:text-[17px] lg:text-[19px] font-bold text-foreground leading-snug">
            {insight.headline}
          </h3>
          <p className="text-[9px] lg:text-[11px] font-mono text-muted-foreground/55 mt-1">
            {insight.section_id}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 px-2 py-1 rounded-full text-[10px] lg:text-[12px] font-mono",
            insight.confidence === "高"
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
          )}
        >
          置信度 {insight.confidence}
        </span>
      </div>

      <div className="space-y-3 mb-4">
        {paragraphs.map((paragraph) => {
          const paragraphCitations: (typeof citations)[number][] = [];
          const seen = new Set<string>();

          (paragraph.citation_nos || []).forEach((citationNo) => {
            const citation = citationByNo.get(citationNo);
            if (citation && !seen.has(citation.citation_id)) {
              seen.add(citation.citation_id);
              paragraphCitations.push(citation);
            }
          });

          (paragraph.citation_ids || []).forEach((citationId) => {
            const citation = citationById.get(citationId);
            if (citation && !seen.has(citation.citation_id)) {
              seen.add(citation.citation_id);
              paragraphCitations.push(citation);
            }
          });

          return (
            <p
              key={paragraph.paragraph_id}
              id={paragraph.anchor_id}
              className="text-[13px] sm:text-[15px] text-muted-foreground leading-relaxed"
            >
              {paragraph.text}
              {paragraphCitations.length > 0 && (
                <span className="ml-1 inline-flex items-center gap-1 align-baseline flex-wrap">
                  {paragraphCitations.map((citation) => (
                    <a
                      key={`${paragraph.paragraph_id}-${citation.citation_id}`}
                      href={`#${citation.anchor_id}`}
                      className="text-[10px] lg:text-[12px] font-mono text-primary hover:text-primary/80 transition-colors"
                      title={`${citation.source} · ${citation.title}`}
                    >
                      [{citation.citation_no}]
                    </a>
                  ))}
                </span>
              )}
            </p>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {insight.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center px-2 py-1 rounded-full text-[10px] lg:text-[12px] font-mono bg-primary/10 text-primary"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="space-y-2.5">
        {citations.map((citation, idx) => {
          const citationNode = (
            <>
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span className="text-[9px] lg:text-[11px] font-mono text-foreground/75 bg-muted px-1.5 py-0.5 rounded leading-none">
                  [{citation.citation_no}]
                </span>
                <span className="text-[9px] lg:text-[11px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded leading-none">
                  {citation.channel}
                </span>
                <span className="text-[9px] lg:text-[11px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded leading-none">
                  {citation.source}
                </span>
                {citation.time_display && (
                  <span className="text-[9px] lg:text-[11px] font-mono text-muted-foreground/45 ml-auto">
                    {citation.time_display}
                  </span>
                )}
              </div>
              <p className="text-[12px] sm:text-[14px] text-foreground/80 leading-relaxed line-clamp-2">
                {citation.title}
              </p>
            </>
          );

          if (!citation.url) {
            return (
              <div
                key={citation.citation_id || `${citation.source}-${idx}`}
                id={citation.anchor_id}
                className="block rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
              >
                {citationNode}
              </div>
            );
          }

          return (
            <a
              key={citation.citation_id || `${citation.source}-${idx}`}
              id={citation.anchor_id}
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-border/50 bg-muted/20 px-3 py-2 hover:border-primary/25 hover:bg-primary/5 transition-colors"
            >
              {citationNode}
            </a>
          );
        })}
      </div>
    </article>
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
              "flex items-center justify-center w-7 h-7 lg:w-8 lg:h-8 rounded-lg text-[11px] lg:text-[13px] font-bold font-mono shrink-0",
              rankStyle,
            )}
          >
            {rank}
          </span>
          <h3 className="text-base lg:text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate">
            {item.word}
          </h3>
        </div>
        <span className="text-[10px] lg:text-[13px] font-mono text-muted-foreground/50 shrink-0 ml-3 tabular-nums">
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
              <span className="text-[10px] lg:text-[12px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded leading-none shrink-0 max-w-[6rem] truncate">
                {title.source_name}
              </span>
              {title.is_new && (
                <span className="text-[9px] lg:text-[11px] font-bold text-red-500 uppercase tracking-tighter shrink-0">
                  NEW
                </span>
              )}
              <span className="text-[10px] lg:text-[12px] text-muted-foreground/40 ml-auto shrink-0 font-mono tabular-nums flex items-center gap-1">
                {title.time_display && <span>{title.time_display}</span>}
                {title.count !== undefined && title.count > 1 && (
                  <span className="bg-muted/40 px-1 rounded">×{title.count}</span>
                )}
              </span>
            </div>
            <p className="text-[13px] sm:text-[15px] lg:text-base text-foreground/75 group-hover/item:text-primary transition-colors line-clamp-2 leading-relaxed">
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
          <h4 className="text-[13px] sm:text-[15px] lg:text-base font-bold text-foreground truncate">{source.name}</h4>
        </div>
        <span className="text-[10px] lg:text-[12px] font-mono text-muted-foreground/50 shrink-0 ml-2 tabular-nums">
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
                <span className="text-[9px] lg:text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 px-1.5 py-0.5 rounded leading-none">
                  {item.word}
                </span>
              )}
              {item.time_display && (
                <span className="text-[9px] lg:text-[11px] font-mono text-muted-foreground/35 ml-auto">
                  {item.time_display}
                </span>
              )}
            </div>
            <p className="text-[13px] sm:text-[15px] lg:text-base text-muted-foreground group-hover/rss:text-emerald-600 dark:group-hover/rss:text-emerald-400 transition-colors line-clamp-2 leading-relaxed">
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
          <h4 className="text-[13px] sm:text-[15px] lg:text-base font-bold text-foreground truncate">{platform.name}</h4>
        </div>
        <span className="text-[10px] lg:text-[12px] font-mono text-muted-foreground/50 shrink-0 ml-2 tabular-nums">
          {platform.items.length}
        </span>
      </div>
      <ol className="space-y-2.5">
        {platform.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className={cn(
                "text-[10px] lg:text-[13px] font-mono mt-0.5 w-5 lg:w-6 shrink-0 text-right tabular-nums font-bold",
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
              className="text-[13px] sm:text-[15px] lg:text-base text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors line-clamp-2 leading-snug"
            >
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
