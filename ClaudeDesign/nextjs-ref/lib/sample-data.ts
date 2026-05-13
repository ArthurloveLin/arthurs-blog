// lib/sample-data.ts
// ─────────────────────────────────────────────────────────────────────────────
// Static sample memos — used in page.tsx while real data fetching is wired up.
// Delete this file and replace `getMemos()` in page.tsx with a real query.

import type { Memo } from "./types";

export const SAMPLE_MEMOS: Memo[] = [
  {
    id: "m1",
    date: "2026-05-13T10:13:00",
    edited: "2026-05-13T10:13:00",
    pin: false,
    color: "rose",
    tags: [],
    content: [
      { type: "todo", done: false, text: "💡 在拓展 action 流程，增加自动化测试环节" },
    ],
    reactions: { heart: 0, down: 0 },
    authorId: "u1",
  },
  {
    id: "m2",
    date: "2026-05-12T21:48:00",
    edited: "2026-05-12T21:48:00",
    pin: false,
    color: "mint",
    tags: ["#school"],
    content: [
      { type: "tag",  text: "#school" },
      { type: "todo", done: false, text: "记得修改意见表导出来后改同步修改版本的 word" },
    ],
    reactions: { heart: 1, down: 0 },
    authorId: "u1",
  },
  {
    id: "m3",
    date: "2026-05-12T20:33:00",
    edited: "2026-05-12T20:33:00",
    pin: false,
    color: "butter",
    tags: [],
    content: [
      { type: "h", text: "memo 进阶扩展与集成" },
      { type: "b", lead: "高级渲染：", text: "Mermaid 流程图与 LaTeX 公式支持。" },
      { type: "b", lead: "内容联动：", text: "便签间互相 @ 引用。" },
      { type: "b", lead: "外部集成：", text: "Webhook 触发与标准 API 接口开发。" },
    ],
    reactions: { heart: 0, down: 0 },
    authorId: "u1",
  },
  {
    id: "m4",
    date: "2026-05-12T20:33:00",
    edited: "2026-05-12T20:33:00",
    pin: true,
    color: "lilac",
    tags: [],
    content: [
      { type: "h", text: "memo 深度使用体验优化" },
      { type: "todo", done: false, lead: "置顶功能 (Pin)：", text: "支持将特定便签固定在信息流最顶部。" },
      { type: "todo", done: false, lead: "日期导航：",       text: "增加时间线跳转模式及活动热力图视图。" },
    ],
    reactions: { heart: 0, down: 0 },
    authorId: "u1",
  },
];
