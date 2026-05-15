#!/bin/sh
set -e

# ============================================
# 安全检查：验证 NEXTAUTH_SECRET 强度
# ============================================
if [ -z "$NEXTAUTH_SECRET" ]; then
  echo "❌ Error: NEXTAUTH_SECRET environment variable is not set"
  exit 1
fi

SECRET_LEN=$(printf '%s' "$NEXTAUTH_SECRET" | wc -c)
if [ "$SECRET_LEN" -lt 32 ]; then
  echo "⚠️  WARNING: NEXTAUTH_SECRET is only ${SECRET_LEN} characters long (recommended: ≥32)"
  echo "   This is insecure. Generate a better value with: openssl rand -base64 32"
  echo "   The application will still start, but this will become a hard requirement in a future version."
  echo ""
fi

# 检查是否使用了已知的不安全默认值
case "$NEXTAUTH_SECRET" in
  "baby-feed-secret-key-change-in-production"|"your-secret-key-change-me-in-production"|"change-me"|"secret")
    echo "⚠️  WARNING: NEXTAUTH_SECRET is using a known weak default value."
    echo "   Please generate a secure random string: openssl rand -base64 32"
    echo "   The application will still start, but this is NOT safe for production use."
    echo ""
    ;;
esac

# ============================================
# 启动流程
# ============================================

# 确保数据目录存在并设置正确权限（解决挂载卷权限问题）
mkdir -p /app/data
chown -R nextjs:nodejs /app/data

# 以 nextjs 用户运行轻量级数据库迁移（不依赖 Prisma CLI）
su-exec nextjs node scripts/migrate.mjs

# 以 nextjs 用户启动应用
exec su-exec nextjs node server.js
