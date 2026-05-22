# arthurs-blog

Personal blog + wardrobe management app built with Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase, Cloudflare R2, and Cloudflare Workers.

## Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run check
```

## Architecture at a glance

- **Main app**: Next.js server-rendered app for the blog, wardrobe pages, admin routes, and API routes
- **Data**: Supabase for relational data and auth
- **Object storage**: Cloudflare R2 for blog markdown, images, and wardrobe assets
- **Edge workloads**: Cloudflare Workers for engagement, Spotify, and other scheduled/edge tasks

## Deployment (VPS + Docker)

This repository is deployed as a **single-container Docker application** on a VPS (e.g., 2 GB / 2 vCPU Ubuntu server), completely replacing Vercel.

**Architecture**:
- **VPS**: Runs 1 Next.js production container + 1 Host Reverse Proxy (Nginx/Caddy)
- **External**: Supabase (Database/Auth), Cloudflare R2 (Object Storage), Cloudflare Workers (Edge Tasks)

### Deployment Workflow
1. **GitHub Actions**: Code pushed to `main` automatically runs type-checking & linting. If successful, it builds the Docker image and publishes it to `ghcr.io`.
2. **VPS**: Pulls the pre-built image and runs it via `docker compose`.

### CI Test Reports

**Allure report (API + Infra + E2E):**
- Open the GitHub Actions run → download artifact `allure-report-<run_number>`.
- Unzip and open `index.html` in a browser, or run `allure open allure-report/` locally.
- The report runs even when tests fail (`if: always()`), so you always get a result breakdown.

**Performance report (Locust):**
- Open the GitHub Actions run linked from the ntfy notification.
- Open the `Performance Tests (Locust)` job and read the job summary for the threshold table.
- Download artifact `perf-report-<run_number>` for `report.html` and raw CSV files.

Performance threshold warnings are reported in the job summary and ntfy notification, but they do not block the already-finished deploy.

### VPS Operations & Maintenance

*It is highly recommended NOT to run `docker compose build` or `npm run build` directly on a 2GB VPS.*

#### 1. 启动服务
```bash
docker compose up -d
```

#### 2. 升级流程 (更新镜像)
```bash
# 拉取最新镜像 (GHCR)
docker compose pull
# 重启服务 (无缝切换)
docker compose up -d
# 清理旧镜像释放磁盘
docker image prune -f
```

#### 3. 查看日志与状态
```bash
# 查看容器运行状态
docker compose ps
# 查看实时日志 (最后 100 行)
docker compose logs -f --tail 100
```

#### 4. 常用维护指令
```bash
# 进入容器 Shell
docker exec -it arthurs-blog sh
# 重启容器
docker compose restart
# 查看容器占用资源
docker stats arthurs-blog
```

#### 5. 缓存管理
Next.js 的 ISR 缓存持久化在命名卷 `nextjs_cache` 中。如需手动清空缓存，可以删除该卷并重建：
```bash
docker compose down
docker volume rm arthurs-blog_nextjs_cache
docker compose up -d
```

### Environment Variables

The container expects runtime variables injected via `/home/app.local` (as defined in `docker compose.yml`).
**Core variables required:**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- R2 variables: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BLOG_BUCKET`, `R2_WARDROBE_BUCKET`, etc.

*For CI builds, public environment variables (`NEXT_PUBLIC_*`) must be added to GitHub Repository Variables.*
