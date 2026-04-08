"use client";

import { useState } from "react";
import type { HotKeyword, TrendTitle } from "@/lib/trend-radar";

interface Props {
  stats: HotKeyword[];
}

export default function TrendRadarStats({ stats }: Props) {
  const [activeTag, setActiveTag] = useState<string>("全部");

  const tags = ["全部", ...stats.map((s) => s.word)];
  const filtered = activeTag === "全部" ? stats : stats.filter((s) => s.word === activeTag);

  return (
    <>
      {/* ── Tag filter bar ── */}
      <div className="flex flex-wrap gap-2 mb-5">
        {tags.map((tag) => {
          const isActive = tag === activeTag;
          const item = stats.find((s) => s.word === tag);
          const count = tag === "全部" ? stats.reduce((a, s) => a + (s.titles?.length ?? 0), 0) : (item?.titles?.length ?? 0);
          return (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 border ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground hover:border-border"
              }`}
            >
              {tag}
              <span
                className={`text-[10px] px-1.5 py-0 rounded-full font-mono ${
                  isActive ? "bg-white/20 text-primary-foreground" : "bg-background/60 text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Keyword cards ── */}
      <div className="grid grid-cols-1 gap-4">
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border/50">
            当前无热点聚焦数据
          </div>
        )}
        {filtered.map((item: HotKeyword, idx: number) => {
          const globalIdx = stats.indexOf(item);
          return (
            <div
              key={item.word}
              className="group bg-card text-card-foreground rounded-2xl p-5 border border-border/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10 text-primary text-[11px] font-bold font-mono">
                    {globalIdx + 1}
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
                {item.titles?.map((title: TrendTitle, tIdx: number) => (
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
        })}
      </div>
    </>
  );
}
