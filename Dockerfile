# Baby Feed Dockerfile
# 多阶段构建，优化镜像大小

# ============================================
# 阶段1: 安装依赖
# ============================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ============================================
# 阶段2: 构建
# ============================================
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 构建 Next.js 应用（standalone 模式会将运行时依赖打包进 .next/standalone）
RUN npm run build

# ============================================
# 阶段3: 运行（最小化镜像）
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat su-exec tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Asia/Shanghai

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制 Next.js standalone 产物（已包含运行时所需的 node_modules）
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# ============================================
# 显式复制 standalone nft 无法追踪的依赖
# ============================================
# 原因：serverExternalPackages 中的包及其传递依赖不会被 Next.js bundle，
# 而 standalone 的 nft 文件跟踪器无法追踪动态 require 和平台特定的可选依赖。
# 我们需要手动复制完整的依赖链。

# 1) libsql 原生绑定（@libsql/linux-x64-musl 通过动态 require 加载）
COPY --from=builder /app/node_modules/libsql ./node_modules/libsql
COPY --from=builder /app/node_modules/@libsql ./node_modules/@libsql
COPY --from=builder /app/node_modules/@neon-rs ./node_modules/@neon-rs
COPY --from=builder /app/node_modules/detect-libc ./node_modules/detect-libc

# 2) @prisma/adapter-libsql 及其传递依赖
COPY --from=builder /app/node_modules/@prisma/adapter-libsql ./node_modules/@prisma/adapter-libsql
COPY --from=builder /app/node_modules/@prisma/driver-adapter-utils ./node_modules/@prisma/driver-adapter-utils
COPY --from=builder /app/node_modules/@prisma/debug ./node_modules/@prisma/debug
COPY --from=builder /app/node_modules/async-mutex ./node_modules/async-mutex
COPY --from=builder /app/node_modules/tslib ./node_modules/tslib

# 3) @libsql/client 的纯 JS 传递依赖
COPY --from=builder /app/node_modules/@libsql/hrana-client ./node_modules/@libsql/hrana-client
COPY --from=builder /app/node_modules/@libsql/isomorphic-ws ./node_modules/@libsql/isomorphic-ws
COPY --from=builder /app/node_modules/js-base64 ./node_modules/js-base64
COPY --from=builder /app/node_modules/promise-limit ./node_modules/promise-limit
COPY --from=builder /app/node_modules/cross-fetch ./node_modules/cross-fetch
COPY --from=builder /app/node_modules/node-fetch ./node_modules/node-fetch

# 4) bcryptjs（纯 JS 实现，但确保 standalone 能追踪到）
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

# 复制 public 目录（PWA manifest、Service Worker、图标等）
COPY --from=builder /app/public ./public

# 复制 Prisma 迁移文件和配置
COPY --from=builder /app/prisma ./prisma

# 复制 Prisma 生成的客户端代码
COPY --from=builder /app/app/generated/prisma ./app/generated/prisma

# 复制轻量级迁移脚本（替代 prisma migrate deploy，无需 Prisma CLI）
COPY --from=builder /app/scripts/migrate.mjs ./scripts/migrate.mjs

# 复制启动脚本
COPY --from=builder /app/start.sh ./start.sh

# 创建数据目录并设置权限
RUN mkdir -p /app/data && \
    chmod +x ./start.sh && \
    chown -R nextjs:nodejs /app/data /app/prisma

# 暴露端口
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "start.sh"]
