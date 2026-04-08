# Umami Inline Analytics

## Overview

Tools 卡片中的 Analytics 已从外链改为站内展开式看板。

- 桌面端：在 Tools 卡片内点击 Analytics 展开
- 移动端：在现有 Tools Drawer 内点击 Analytics 展开

## API

新增聚合接口：

- `GET /api/analytics/overview?range=7d|30d&timezone=Asia/Shanghai`

返回数据结构：

- `summary.pageviews`
- `summary.visitors`
- `summary.visits`
- `summary.realtime`
- `trend` (按天趋势)
- `countries` (国家/地区分布)

## Environment Variables

以下变量仅服务端读取：

- `UMAMI_ENDPOINT` (例如 `https://analytics.example.com`)
- `UMAMI_WEBSITE_ID`
- `UMAMI_API_TOKEN` (推荐)

兼容方案（当未配置 `UMAMI_API_TOKEN` 时）：

- `UMAMI_USERNAME`
- `UMAMI_PASSWORD`

## Notes

- 前端不会直接访问 Umami，不会暴露服务端凭据。
- 事件埋点包含：`analytics_open`、`analytics_refresh`、`analytics_range_change`。
