#!/bin/sh
set -e

# 确保数据目录存在
mkdir -p /app/data

# 输出调试信息
echo "DATABASE_URL: $DATABASE_URL"

# 运行数据库迁移
npx prisma migrate deploy

# 启动应用
node server.js
