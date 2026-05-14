# 技术栈与数据模型

## 技术栈

| 领域 | 技术 |
|------|------|
| **前端框架** | Next.js 15（App Router，Standalone 模式） |
| **开发语言** | TypeScript |
| **样式方案** | Tailwind CSS |
| **数据库** | SQLite（通过 libsql） |
| **ORM** | Prisma + @prisma/adapter-libsql |
| **认证系统** | NextAuth.js |
| **密码加密** | bcryptjs |
| **图表库** | Recharts |
| **图标库** | Lucide React |
| **PWA** | 自定义 Service Worker + Web App Manifest |
| **部署方案** | Docker（Alpine 多阶段构建） |

## 数据模型

```
User（用户）
 ├── Baby（宝宝）     ← 一对多
 │    ├── FeedingRecord（喂养记录）  ← 一对多
 │    └── HealthRecord（健康记录）   ← 一对多
 ├── FeedingRecord（喂养记录）       ← 一对多（冗余关联，便于查询）
 └── HealthRecord（健康记录）        ← 一对多（冗余关联，便于查询）
```

所有关联均设置了 **级联删除**（`onDelete: Cascade`），删除用户或宝宝时会自动清理关联记录。

### 数据库 Schema

详见 [`prisma/schema.prisma`](../prisma/schema.prisma)。

### 认证系统

支持两种认证方式：

1. **Cookie/Session 认证** — Web 端登录后自动使用
2. **API Key 认证** — 适用于外部程序调用（iOS 快捷指令、自动化脚本等）

API Key 安全特性：

| 安全措施 | 说明 |
|---|---|
| **哈希存储** | 数据库只存储 SHA-256 哈希值 |
| **单次显示** | 创建时显示一次，关闭后无法再查看 |
| **用户隔离** | 每个 Key 绑定创建者 |
| **速率限制** | 每 IP 每分钟最多 30 次失败认证 |
| **过期机制** | 支持 7/30/90/180/365 天有效期 |
| **数量上限** | 每用户最多 10 个 Key |
