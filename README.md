# wardrobe-picks

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
2. **VPS**: Pulls the pre-built image and runs it via `docker-compose`.

### VPS Operations

*It is highly recommended NOT to run `docker-compose build` or `npm run build` directly on a 2GB VPS.*

**1. Pull & Run**
```bash
docker pull ghcr.io/arthurlovelin/wardrobe-picks:latest
docker-compose up -d
```

**2. Update Process**
```bash
docker-compose pull
docker-compose up -d
docker image prune -f # clean up old images
```

**3. Next.js Cache Persistence**
The `docker-compose.yml` mounts a named volume `nextjs_cache:/app/.next/cache` to persist the ISR cache across container restarts.

### Environment Variables

The container expects runtime variables injected via `/home/app.local` (as defined in `docker-compose.yml`).
**Core variables required:**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- R2 variables: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BLOG_BUCKET`, `R2_WARDROBE_BUCKET`, etc.

*For CI builds, public environment variables (`NEXT_PUBLIC_*`) must be added to GitHub Repository Variables.*
