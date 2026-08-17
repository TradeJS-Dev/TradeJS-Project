# syntax=docker/dockerfile:1

FROM node:24-alpine AS dependencies

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_CHROME_SKIP_DOWNLOAD=true

RUN corepack enable && corepack prepare yarn@4.13.0 --activate

COPY package.json yarn.lock .yarnrc.yml ./

RUN --mount=type=cache,target=/root/.yarn/berry/cache \
    yarn install --immutable

FROM dependencies AS builder

COPY tradejs.config.ts ./tradejs.config.ts

ENV NODE_ENV=production \
    PROJECT_CWD=/app \
    APP_URL=http://localhost:3000 \
    NEXTAUTH_URL=http://localhost:3000

RUN --mount=type=cache,target=/app/.tradejs/app/.next/cache \
    yarn build

FROM node:24-alpine AS runner

ARG TRADEJS_PROJECT_SHA=unknown

LABEL org.opencontainers.image.source="https://github.com/TradeJS-Dev/TradeJS-Project" \
      org.opencontainers.image.description="TradeJS project runtime" \
      org.opencontainers.image.licenses="BUSL-1.1"

RUN apk add --no-cache \
    bash \
    ca-certificates \
    chromium \
    cronie \
    curl \
    dumb-init \
    ttf-dejavu \
    ttf-freefont \
    tzdata

WORKDIR /app

ENV NODE_ENV=production \
    TRADEJS_PROJECT_SHA=${TRADEJS_PROJECT_SHA} \
    PROJECT_CWD=/app \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY --from=builder /app ./
COPY entrypoint.sh ./entrypoint.sh
COPY cronjob /etc/crontabs/root

RUN chmod +x ./entrypoint.sh

EXPOSE 3000 3001

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./entrypoint.sh"]
