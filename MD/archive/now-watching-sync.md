# Now Watching 同步说明

## 数据路径

- R2 bucket: `obsidian-vault`
- R2 prefix: `now-watching/`
- 前端页面: `/now-watching`

## GitHub Actions Secrets

- `DOUBAN_USER_ID`: 豆瓣个人主页 ID，来自 `https://movie.douban.com/people/<id>/collect`
- `DOUBAN_COOKIE`: 可选但强烈建议，减少豆瓣反爬拦截
- `DOUBAN_USER_AGENT`: 可选，自定义请求头 UA
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `TMDB_API_KEY`: 可选。豆瓣列表或详情页拿不到海报时，使用 TMDb 做匹配兜底

## 命名规则

- 默认按“电影名”写入，例如 `now-watching/花样年华.jpg`
- 如果同名冲突，脚本会优先尝试 `电影名 (年份)`，再尝试附加豆瓣 subject id，避免覆盖

## 工作流

- 文件: `.github/workflows/now-watching-sync.yml`
- 触发方式:
  - 每周日 UTC 03:00 自动执行
  - 支持手动 `workflow_dispatch`

## 抓取顺序

1. 从豆瓣“看过”片单抓取电影条目与列表海报
2. 如果列表海报缺失，抓取电影详情页 `og:image`
3. 如果仍失败，且配置了 `TMDB_API_KEY`，使用 TMDb 按标题和年份匹配海报

## 同步行为

- 脚本会把最新片单海报写入 `obsidian-vault/now-watching/`
- 默认删除该目录下已不在当前片单中的旧海报