# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder
ARG NEXT_PUBLIC_SPOTIFY_WORKER_URL=
ARG NEXT_PUBLIC_SPOTIFY_NOW_PLAYING_WORKER_URL=
ARG NEXT_PUBLIC_GENIUS_WORKER_URL=
ARG NEXT_PUBLIC_ENGAGEMENT_WORKER_URL=
ARG NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SPOTIFY_WORKER_URL=$NEXT_PUBLIC_SPOTIFY_WORKER_URL
ENV NEXT_PUBLIC_SPOTIFY_NOW_PLAYING_WORKER_URL=$NEXT_PUBLIC_SPOTIFY_NOW_PLAYING_WORKER_URL
ENV NEXT_PUBLIC_GENIUS_WORKER_URL=$NEXT_PUBLIC_GENIUS_WORKER_URL
ENV NEXT_PUBLIC_ENGAGEMENT_WORKER_URL=$NEXT_PUBLIC_ENGAGEMENT_WORKER_URL
ENV NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY


COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN --mount=type=secret,id=SUPABASE_SERVICE_ROLE_KEY,env=SUPABASE_SERVICE_ROLE_KEY \
    --mount=type=secret,id=R2_ACCOUNT_ID,env=R2_ACCOUNT_ID \
    --mount=type=secret,id=R2_ACCESS_KEY_ID,env=R2_ACCESS_KEY_ID \
    --mount=type=secret,id=R2_SECRET_ACCESS_KEY,env=R2_SECRET_ACCESS_KEY \
    --mount=type=secret,id=R2_BLOG_BUCKET,env=R2_BLOG_BUCKET \
    --mount=type=secret,id=R2_BLOG_PUBLIC_DOMAIN,env=R2_BLOG_PUBLIC_DOMAIN \
    --mount=type=secret,id=R2_SPOTIFY_BUCKET,env=R2_SPOTIFY_BUCKET \
    --mount=type=secret,id=R2_SPOTIFY_PUBLIC_DOMAIN,env=R2_SPOTIFY_PUBLIC_DOMAIN \
    --mount=type=secret,id=R2_WARDROBE_BUCKET,env=R2_WARDROBE_BUCKET \
    --mount=type=secret,id=R2_WARDROBE_PUBLIC_URL,env=R2_WARDROBE_PUBLIC_URL \
    --mount=type=secret,id=R2_CDN_BUCKET,env=R2_CDN_BUCKET \
    --mount=type=secret,id=R2_CDN_PUBLIC_DOMAIN,env=R2_CDN_PUBLIC_DOMAIN \
    npm run build
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
