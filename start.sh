#!/bin/sh
set -e

# 确保数据目录存在并设置正确权限（解决挂载卷权限问题）
mkdir -p /app/data
chown -R nextjs:nodejs /app/data

# 以 nextjs 用户运行轻量级数据库迁移（不依赖 Prisma CLI）
su-exec nextjs node scripts/migrate.mjs

# 以 nextjs 用户启动应用
exec su-exec nextjs node server.js
