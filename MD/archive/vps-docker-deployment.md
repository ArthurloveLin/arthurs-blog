# VPS Docker 迁移指南

## 目标

这份方案面向 **2 GB / 2 vCPU** 的 Ubuntu VPS，目标是：

- 只迁移 **Next.js 主站**
- 继续保留 **Supabase / Cloudflare R2 / Cloudflare Workers**
- 在 **本地或 CI 构建镜像**
- 让 VPS 只做 **pull + run**

不建议在线上执行：

- `docker compose up --build`
- `npm install && npm run build`
- 把数据库、对象存储、Worker、反代、监控全部做成容器堆在同一台 2 GB 机器上

## 当前仓库对应的推荐架构

### 保留在外部的平台

- **Supabase**：数据库、认证、角色数据
- **Cloudflare R2**：博客 markdown、博客图片、衣橱图片、Spotify 数据分片
- **Cloudflare Workers**：engagement、Spotify now playing、lyrics、cron 逻辑

### VPS 只运行

- **1 个 Next.js 生产容器**
- **1 个宿主机反向代理**（推荐 Caddy 或 Nginx）
- 基础系统服务（SSH、防火墙、日志轮转、swap）

## 仓库里已经做好的改动

- `next.config.ts` 已启用 `output: 'standalone'`
- `Dockerfile` 使用 multi-stage build 生成单容器生产镜像
- `.dockerignore` 已缩小构建上下文，避免把 docs / workers / 临时目录打进镜像
- `.github/workflows/docker-image.yml` 支持：
  - PR 构建镜像但不推送
  - `main` 构建并推送 GHCR 镜像
- `check.yml` 已移除自动 Vercel 发布步骤，避免继续走旧部署路径

## 资源建议

### 必做

- 添加 **2 GB swap**
- 仅运行一个主应用容器
- 不在 VPS 上执行镜像构建
- 给容器设置重启策略
- 配置 Cloudflare 继续做前层 CDN / TLS

### 建议

- 把反向代理装在宿主机，不要再套一层代理容器
- 定期清理旧镜像
- 保留最近两个稳定 tag 方便回滚
- 控制容器日志大小，避免磁盘被打满

## 运行时环境变量

下面按“核心必须 / 按功能启用”区分。

### 核心必须

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BLOG_BUCKET`
- `R2_BLOG_PUBLIC_DOMAIN`
- `R2_WARDROBE_BUCKET`
- `R2_WARDROBE_PUBLIC_URL`

### 按功能启用

#### Cloudflare / 缓存 / 安全

- `CF_ZONE_ID`
- `CF_API_TOKEN`
- `CLOUDFLARE_TURNSTILE_SECRET_KEY`
- `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY`

#### Worker 通讯

- `NEXT_PUBLIC_SPOTIFY_WORKER_URL`
- `NEXT_PUBLIC_SPOTIFY_NOW_PLAYING_WORKER_URL`
- `NEXT_PUBLIC_GENIUS_WORKER_URL`
- `NEXT_PUBLIC_ENGAGEMENT_WORKER_URL`
- `GENIUS_WORKER_URL`

#### Spotify / Last.fm

- `R2_SPOTIFY_BUCKET`
- `R2_SPOTIFY_PUBLIC_DOMAIN`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`
- `SPOTIFY_SYNC_SECRET`
- `LASTFM_API_KEY`

#### 监控 / OCR / 其他后台能力

- `UMAMI_ENDPOINT`
- `UMAMI_WEBSITE_ID`
- `UMAMI_API_TOKEN`
- `UMAMI_USERNAME`
- `UMAMI_PASSWORD`
- `BAIDU_OCR_API_KEY`
- `BAIDU_OCR_SECRET_KEY`
- `R2_CDN_BUCKET`
- `R2_CDN_PUBLIC_DOMAIN`

## CI 构建时需要的公开变量

Docker build 会把客户端需要的 `NEXT_PUBLIC_*` 值编译进产物。

至少要在 GitHub Repository Variables 中配置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

按功能再补：

- `NEXT_PUBLIC_SPOTIFY_WORKER_URL`
- `NEXT_PUBLIC_SPOTIFY_NOW_PLAYING_WORKER_URL`
- `NEXT_PUBLIC_GENIUS_WORKER_URL`
- `NEXT_PUBLIC_ENGAGEMENT_WORKER_URL`
- `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY`

PR 工作流会自动使用 placeholder 值做镜像构建验证；`main` 推镜像前会检查核心 public env 是否存在。

## 推荐发布流程

### 1. 在 GitHub Actions 构建镜像

默认发布位置：

- `ghcr.io/<owner>/<repo>:latest`
- `ghcr.io/<owner>/<repo>:sha-<commit>`

### 2. VPS 拉取新镜像

示例：

```bash
docker pull ghcr.io/<owner>/<repo>:latest
```

### 3. 使用单容器运行

示例：

```bash
docker run -d \
  --name wardrobe-picks \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  --env-file /opt/wardrobe-picks/app.env \
  ghcr.io/<owner>/<repo>:latest
```

### 4. 宿主机反代到 3000

推荐：

- Caddy 自动 TLS
- 或 Nginx 只代理到 `127.0.0.1:3000`

### 5. Cloudflare 继续放前面

让 Cloudflare 负责：

- TLS
- CDN 缓存
- WAF / 基础防护

## 更新流程

每次更新建议固定为：

1. 推代码到仓库
2. CI 构建并推送新镜像
3. VPS `docker pull`
4. 停旧容器
5. 起新容器
6. 验证首页、登录、图片、管理接口、缓存行为
7. 有问题就切回上一个 tag

## 回滚流程

建议至少保留：

- `latest`
- 当前稳定版本 tag
- 上一个稳定版本 tag

回滚时只需要：

1. pull 旧 tag
2. 停掉当前容器
3. 用旧 tag 重启

## 本地开发与生产边界

### 本地

可以使用 Docker 或 compose 做：

- 本地联调
- 手工构建镜像
- 验证容器能否启动

### 生产

不要依赖：

- `compose build`
- VPS 上临时构建
- 多容器堆叠

生产原则就是：

- **外部构建**
- **单容器发布**
- **线上只 pull/run**

## 上线后重点验证

### 路由与媒体

- 首页
- 博客详情页
- 衣橱列表与详情
- `now-watching`
- `life-gallery`
- Next Image 外链图片是否正常

### API / 管理接口

- `/api/blog/reindex`
- `/api/admin/upload-image`
- `/api/admin/config`
- `/api/revalidate`
- `/api/items`
- `/api/sessions`

### Worker 互通

- Next 应用访问的 Worker URL 是否仍正确
- Worker 是否允许新域名
- cron 是否仍在 Cloudflare 正常触发

### 缓存

- 首页缓存是否符合预期
- `/blog/reindex` 后 `revalidateTag / revalidatePath` 是否生效
- Cloudflare 没有误缓存动态接口

## 为什么不推荐生产 compose

在这个仓库里，真正的重资源步骤是：

- Next build
- 多服务同时拉起
- 部署瞬间新旧进程共存

2 GB 机器的主要问题不是 Docker 本身，而是：

- 在线构建
- 多容器编排
- 内存峰值不可控

所以生产最优解不是“全家桶 compose”，而是：

- **单个预构建镜像**
- **单容器运行**
- **外部服务继续托管**
