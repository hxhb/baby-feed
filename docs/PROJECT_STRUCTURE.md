# 项目结构

```
baby-feed/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # 根布局（PWA、字体、Service Worker 注册）
│   ├── page.tsx                # 首页（仪表盘）
│   ├── add/                    # 添加记录页面
│   ├── login/                  # 登录页面
│   ├── register/               # 注册页面
│   ├── offline/                # 离线回退页面（PWA）
│   ├── settings/               # 设置页面（账户管理 + 宝宝管理）
│   ├── stats/                  # 统计页面
│   ├── timeline/               # 时间轴页面
│   ├── api/                    # API 路由
│   │   ├── admin/              # 管理员接口（身份检查/站点设置/用户管理）
│   │   ├── auth/               # 认证（NextAuth + 注册 + 会话）
│   │   ├── babies/             # 宝宝管理 CRUD
│   │   ├── feeding/            # 喂养记录 CRUD
│   │   ├── health/             # 健康记录 CRUD
│   │   ├── site/               # 站点公开接口（注册状态查询）
│   │   ├── stats/              # 统计数据（总览 + 按日）
│   │   ├── timeline-dates/     # 时间轴有效日期
│   │   └── user/               # 用户管理（资料/密码/注销/API Key）
│   └── generated/prisma/       # Prisma 自动生成的客户端代码
├── components/                 # React 组件
│   ├── AdminPanel.tsx           # 管理员面板
│   ├── ApiKeyManager.tsx       # API Key 管理组件
│   ├── Dashboard.tsx           # 首页仪表盘
│   ├── FeedingForm.tsx         # 喂养记录表单
│   ├── FeedingRecordFields.tsx # 喂养记录字段组件
│   ├── HealthForm.tsx          # 健康记录表单
│   ├── HealthRecordFields.tsx  # 健康记录字段组件
│   ├── Navbar.tsx              # 响应式导航栏
│   ├── Providers.tsx           # NextAuth SessionProvider 封装
│   ├── RecordActionBar.tsx     # 记录操作栏组件
│   ├── RecordMetaFields.tsx    # 记录元信息字段组件
│   ├── Settings.tsx            # 设置组件（账户管理 + 宝宝管理）
│   ├── Stats.tsx               # 统计图表组件
│   ├── StatsUi.tsx             # 统计 UI 辅助组件
│   ├── Timeline.tsx            # 时间轴组件
│   └── TimelineEditRecordModal.tsx # 时间轴编辑记录弹窗
├── lib/                        # 工具库
│   ├── admin.ts                # 管理员权限验证
│   ├── api-helpers.ts          # API 响应辅助函数
│   ├── api-key.ts              # API Key 生成、验证
│   ├── auth.ts                 # NextAuth 认证配置（支持 Cookie + API Key）
│   ├── client-request-cache.ts # 客户端请求缓存
│   ├── feeding-records.ts      # 喂养记录工具函数
│   ├── health-records.ts       # 健康记录工具函数
│   ├── prisma.ts               # Prisma 客户端实例
│   ├── rate-limit.ts           # 速率限制
│   ├── record-display.tsx      # 记录展示组件
│   ├── server-auth.ts          # 服务端认证辅助
│   ├── server-babies.ts        # 服务端宝宝数据
│   ├── server-dashboard.ts     # 服务端仪表盘数据
│   ├── server-stats.ts         # 服务端统计数据
│   ├── server-timeline.ts      # 服务端时间轴数据
│   ├── site-settings.ts        # 站点设置管理
│   ├── time.ts                 # 时间处理工具
│   └── validation.ts           # 输入验证
├── prisma/                     # 数据库配置
│   ├── schema.prisma           # 数据库模型定义
│   └── migrations/             # 数据库迁移文件
├── scripts/
│   ├── migrate.mjs             # 轻量级迁移脚本（无需 Prisma CLI）
│   └── set-admin.mjs           # 设置管理员脚本
├── public/                     # 静态资源
│   ├── manifest.json           # PWA 配置
│   ├── sw.js                   # Service Worker
│   └── *.svg                   # 应用图标
├── types/                      # TypeScript 类型定义
│   └── next-auth.d.ts          # NextAuth 类型扩展
├── middleware.ts                # NextAuth 路由保护中间件
├── Dockerfile                  # 多阶段 Docker 构建
├── docker-compose.yml          # Docker Compose 编排
├── start.sh                    # 容器启动脚本（迁移 + 启动）
└── README.md                   # 项目文档
```
