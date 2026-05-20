# Session 模块

多模板评分会话系统。用于衣评、美食、景点等场景的分维度评分记录。

## 路由

| 路径 | 说明 |
|---|---|
| `/session/new` | 创建新会话（选模板、自定义维度） |
| `/session/[token]` | 会话主视图（物品列表、Realtime 同步） |
| `/session/[token]/item/[id]` | 单个物品详情 |

## File Map

```
app/session/new/page.tsx              — 创建表单：模板选择 + 自定义维度配置
app/session/[token]/page.tsx          — 会话主页：服务端拉取 + RealtimeSync
app/session/[token]/loading.tsx       — loading skeleton
app/session/[token]/item/[id]/page.tsx — 物品详情页
lib/templates.ts                      — 模板定义（TEMPLATES 对象 + 维度结构）
```

## 模板系统

`lib/templates.ts` 定义 4 个内置模板：`wardrobe`（衣评）、`food`（美食）、`attraction`（景点）、`custom`（通用）。每个模板包含：
- `dimensions`：评分维度数组，每个维度有 `key`（存入数据库的字段名）、`label`（显示名）、`color`（雷达图颜色）
- `itemLabel`、`descLabels`（买/跳过/待定的文案）、placeholder 文案

### custom 模板的特殊逻辑

当 `templateId === 'custom'` 时，`new/page.tsx` 维护本地 `customConfig` 状态。约束：
- 维度数量：**最少 3 个，最多 6 个**（`addCustomDim` 检查 `>=6` 拒绝，`removeCustomDim` 检查 `<=3` 拒绝）
- 颜色取自固定调色盘 `['#f472b6', '#60a5fa', '#34d399', '#f59e0b', '#8b5cf6', '#06b6d4']`，按维度索引分配

提交时，`template_config` 字段只在 `template_id === 'custom'` 时传入，其余模板传 `null`。服务端用 `template_config` 覆盖默认维度定义。

## 硬约束

- 不要把 `TEMPLATES` 中的 `key` 字段改名——它们是数据库字段名（如 `appearance_score`），改名需要迁移已有数据。
- `dimensions` 的 `key` 在 custom 模板中动态生成为 `custom_${Date.now()}`，每次创建唯一，不可复用。
- Realtime 同步由 `RealtimeSync.tsx` 提供，物品列表实时更新——不要在 `[token]/page.tsx` 加 `revalidate` 缓存，该页已是 `force-dynamic`。
