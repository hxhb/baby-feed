# Baby Feed Dockerfile
# 多阶段构建，优化镜像大小

# ============================================
# 阶段1: 基础镜像
# ============================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl

# ============================================
# 阶段2: 安装依赖
# ============================================
FROM base AS deps
WORKDIR /app

# 复制 package 文件
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm ci

# ============================================
# 阶段3: 构建
# ============================================
FROM base AS builder
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 设置环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 构建 Next.js 应用
RUN npm run build

# ============================================
# 阶段4: 运行
# ============================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制必要文件
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 复制 Prisma 相关文件
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/app/generated/prisma ./app/generated/prisma

# 复制完整的 node_modules（Prisma 7 需要完整依赖）
COPY --from=builder /app/node_modules ./node_modules

# 复制启动脚本
COPY --from=builder /app/start.sh ./start.sh

# 创建数据目录并设置权限
RUN mkdir -p /app/data && \
    chmod +x ./start.sh && \
    chown -R nextjs:nodejs /app/data /app/prisma

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动应用
CMD ["sh", "start.sh"]
