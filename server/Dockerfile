# ═══════════════════════════════════════════
# Stage 1: Build dependencies
# ═══════════════════════════════════════════
FROM node:20-slim AS builder

WORKDIR /app

# Use Aliyun mirrors for faster install in China
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy package manifests only (for layer caching)
COPY server/package.json server/pnpm-lock.yaml ./server/
COPY 1shared/package.json ./1shared/

# Install production dependencies for both
RUN cd server && pnpm install --prod --frozen-lockfile \
    && cd ../1shared && pnpm install --prod --no-frozen-lockfile \
    && pnpm store prune

# ═══════════════════════════════════════════
# Stage 2: Production runtime
# ═══════════════════════════════════════════
FROM node:20-slim

WORKDIR /app/server

# Copy node_modules from builder (compiled native modules included)
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/1shared/node_modules /app/1shared/node_modules

# Copy shared source (no node_modules thanks to .dockerignore)
COPY 1shared/ /app/1shared/

# Copy server source and configs
COPY server/ ./

ENV NODE_ENV=production

EXPOSE 5001

CMD ["node", "index.js"]
