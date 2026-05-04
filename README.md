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

## Deployment direction

This repository is now prepared for a **single-container Docker deployment** for the main Next.js app:

- build the production image **locally or in CI**
- push the image to a registry such as **GHCR**
- let the VPS **pull and run** the image
- keep **Supabase, Cloudflare R2, and Cloudflare Workers** outside the VPS

Do **not** use production `docker compose build/up` on a 2 GB VPS for this project.

## Included deployment assets

- `Dockerfile` — multi-stage production image using Next.js standalone output
- `.dockerignore` — trims the Docker build context
- `.github/workflows/docker-image.yml` — CI workflow to build PR images and publish `main` images to GHCR
- `MD/vps-docker-deployment.md` — detailed VPS migration and operations guide

## Environment variables

The app expects runtime environment variables for Supabase, R2, and optional integrations. See:

- `MD/vps-docker-deployment.md`

That document includes:

- required runtime env vars
- optional feature-specific env vars
- CI build args for public `NEXT_PUBLIC_*` values
- VPS deploy, update, and rollback steps

## Notes

- The main CI check workflow now only validates the app and workers.
- Automatic Vercel deployment has been removed from the default `main` workflow path.
- Cloudflare Worker deployment remains separate from the VPS migration path.
