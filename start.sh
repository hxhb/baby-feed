#!/bin/sh
set -e

# 运行数据库迁移
npx prisma migrate deploy

# 启动应用
node server.js
