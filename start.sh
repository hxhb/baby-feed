#!/bin/sh
set -e

# 运行数据库迁移
./node_modules/prisma/build/index.js migrate deploy

# 启动应用
node server.js
