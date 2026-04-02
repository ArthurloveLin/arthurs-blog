
# 项目架构重构规划

> 规划日期：2026-04-02  
> 目标：将单一 wardrobe-picks webapp 扩展为多子模块平台，新增 trendradar（新闻汇总）模块  
> 架构路线：Next.js (Vercel) + 静态 HTML (GitHub Pages) + 子域名路由 (Cloudflare)

---

## 一、现状与约束分析

### 当前目录结构

```text
/project/wardrobe_picks/
├── wardrobe-picks/          # Next.js 15 应用（唯一 app）
│   ├── app/
│   │   ├── page.tsx         # 已有 Hub 首页（两张模块卡片）
│   │   ├── wardrobe/        # 选衣模块（已完成）
│   │   ├── session/[token]/ # 会话模块（已完成）
│   │   └── api/             # Supabase 相关 API routes
│   ├── next.config.ts
│   └── package.json
└── README_trendradar.md     # TrendRadar 开源项目文档
```

### 关键约束与解法

| 维度 | 现状 | 解决方案 |
|---|---|---|
| wardrobe-picks | Next.js 15 + React 19 + Supabase | 维持部署在 Vercel 不变 |
| trendradar | Python + GitHub Actions + 静态 HTML | 异构项目，脱离 Vercel，**独立部署到 GitHub Pages** |
| 域名路由 | 需整合在同一个入口下供用户使用 | **依托 Cloudflare 免费配置子域名（子域名方案）**，实现跨模块跳转 |

---

## 二、核心架构方案：子域名直连 (Subdomain)

由于 Vercel 是 Serverless 平台不支持运行 Python/Docker 服务，TrendRadar 将作为独立站点运行。我们将通过 **Cloudflare 子域名 + 跨域跳转** 的方式将两个模块拼合在一起。

### 访问链路图

```text
用户访问主域名 (yourdomain.com) 
  └── 解析至 Vercel (运行 Next.js 的 wardrobe-picks)

用户点击首页 "新闻汇总" 卡片 (trendradar.yourdomain.com)
  └── Cloudflare 拦截 CNAME 记录
       └── 转发至 GitHub Pages 获取静态 HTML
```

**优势**：
1. **零成本**：Vercel、GitHub Pages、Cloudflare 均可白嫖。
2. **实现最简单**：主应用 Next.js 零配置，不增加 Vercel 带宽消耗，规避了静态资源子路径 404 的历史难题。

---

## 三、目标目录结构

两个子模块在物理上分属两个目录，独立构建，互不干扰。

```text
/project/arthur_grace_tools/           #由wardrobe_picks更名而来
├── wardrobe-picks/                # Next.js app（现有，保持原状）
│   ├── app/
│   │   └── page.tsx               # Hub 首页（仅更新卡片的 href 跳转链接）
│   └── ...
└── trendradar/                    # TrendRadar 项目（新增，独立维护）
    ├── .github/workflows/         # GitHub Actions 自动化脚本
    ├── config.yaml                # TrendRadar 抓取配置
    └── ...                        # Python 项目文件
```

> **引入建议**：通过 `git submodule add https://github.com/sansan0/TrendRadar trendradar` 引入源码，方便后续跟随上游项目更新。

---

## 四、路由表与代码改动

### 全局路由表

| URL | 服务提供方 | 模块说明 |
|---|---|---|
| `yourdomain.com/` | Vercel (Next.js) | Hub 首页 |
| `yourdomain.com/wardrobe` | Vercel (Next.js) | 选衣子模块 |
| `yourdomain.com/session/[token]` | Vercel (Next.js) | 会话子模块 |
| `yourdomain.com/api/**` | Vercel (Next.js) | Supabase API |
| `trendradar.yourdomain.com/` | GitHub Pages | 新闻汇总子模块 (TrendRadar) |

### Hub 首页（app/page.tsx）改动点

需要更新 `wardrobe-picks` 首页里关于 TrendRadar 的模块卡片属性：

| 字段 | 改前 | 改后 |
|---|---|---|
| `href` | `'#'` | `'https://trendradar.yourdomain.com'` |
| `active` | `false` | `true` |
| `badgeText` | `'即将上线'` | `'使用中'` |

*注：因为是跨子域名跳转，建议给 `<Link>` 组件加上 `target="_blank" rel="noopener noreferrer"`，以便在新标签页中打开新闻模块，保持主 Hub 开启状态。*

---

## 五、实施步骤

### 阶段 1：部署 TrendRadar 到 GitHub Pages
- [x] 在本地克隆/引入 TrendRadar 代码。
- [ ] 配置 `config.yaml`（新闻数据源等）。
- [ ] 启用仓库的 GitHub Actions，确保自动化抓取脚本能正常运行，并将产物推送到 `gh-pages` 分支。
- [ ] 验证默认的 GitHub Pages 地址能否正常访问（如 `https://<你的用户名>.github.io/TrendRadar`）。

### 阶段 2：配置子域名（Cloudflare & GitHub）
- [ ]  **Cloudflare 侧**：
   - 登录 Cloudflare 管理 `yourdomain.com`。
   - 在 DNS 记录中添加：类型 `CNAME`，名称 `trendradar`，目标 `<你的用户名>.github.io`。
   - **开启橙色小黄云 (Proxied)** 以加速国内访问并处理 HTTPS。
- [ ]  **GitHub 侧**：
   - 进入 TrendRadar 仓库的 `Settings -> Pages`。
   - 在 **Custom domain** 栏目填入 `trendradar.yourdomain.com` 并保存。
   - 等待 DNS 检查通过后，勾选底部的 **Enforce HTTPS**（如果可用）。

### 阶段 3：主项目联动
- [x] 按照本文第四部分的说明，修改 `wardrobe-picks/app/page.tsx`。
- [x] 提交代码并推送至 Vercel 进行部署。
- [ ] 从国内网络环境访问 `yourdomain.com`，点击卡片验证能否顺利跳转并极速加载 `trendradar.arthurlovegrace.top`。

---

## 六、注意事项与已知限制

1. **数据实时性受限**：GitHub Actions 的免费调度有时间间隔（通常最低 5-10 分钟执行一次），因此 TrendRadar 上的新闻不是绝对实时的，会有几分钟的延迟。这对于新闻聚合类应用通常是可接受的。
2. **不需要改动的部分**：
   - 所有现有 API routes (`/api/items`, `/api/sessions`, 等)。
   - Supabase 配置和数据库 migrations。
   - 现有的 `wardrobe` 核心选衣业务逻辑。
   - `next.config.ts` 保持原样，**无需**配置任何 rewrites 规则。
